import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Captions,
} from "lucide-react";

interface SubtitleTrack {
  index: number;
  displayTitle: string;
  language?: string;
}

interface IntroTimestamps {
  start: number;
  end: number;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function MoviePlayer() {
  const { api, token } = useJellyfinApi();
  const { movieId } = useParams();
  const serverUrl = localStorage.getItem("server-url") ?? "";
  const videoUrl =
    token && movieId
      ? `${serverUrl}/Videos/${movieId}/stream.mp4?static=true&api_key=${token}`
      : null;

  const [videoReady, setVideoReady] = useState(false);
  const [introTimestamps, setIntroTimestamps] =
    useState<IntroTimestamps | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [apiDuration, setApiDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = localStorage.getItem("userId");

  const showControls = () => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isFullscreen) setControlsVisible(false);
    }, 3000);
  };

  useEffect(() => {
    if (!isFullscreen) {
      setControlsVisible(true);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    } else {
      showControls();
    }
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [isFullscreen]);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node) setVideoReady(true);
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIntroTimestamps(null);
    setShowSkipIntro(false);
    setSubtitles([]);
    setSelectedSubtitle(null);
    setShowSubtitleMenu(false);
    setSubtitleBlobUrl(null);
  }, [movieId]);

  // Detect intro from chapter metadata
  useEffect(() => {
    if (!api || !movieId) return;
    const fetchIntro = async () => {
      try {
        const res = await getItemsApi(api).getItems({
          ids: [movieId],
          fields: ["Chapters", "MediaStreams"] as ItemFields[],
        });
        const item = res.data.Items?.[0];
        const chapters = item?.Chapters ?? [];

        const subs = (item?.MediaStreams ?? [])
          .filter(s => s.Type === "Subtitle")
          .map(s => ({
            index: s.Index!,
            displayTitle: s.DisplayTitle ?? s.Language ?? `Track ${s.Index}`,
            language: s.Language ?? undefined,
          }));
        setSubtitles(subs);
        const introIdx = chapters.findIndex((c) =>
          /opening|intro|op\b/i.test(c.Name ?? ""),
        );
        if (introIdx === -1 || !chapters[introIdx + 1]) return;
        setIntroTimestamps({
          start: (chapters[introIdx].StartPositionTicks ?? 0) / 10_000_000,
          end: (chapters[introIdx + 1].StartPositionTicks ?? 0) / 10_000_000,
        });
      } catch {
        // chapter data is optional
      }
    };
    fetchIntro();
  }, [api, movieId]);

  // Resume from saved position
  useEffect(() => {
    if (!api || !token || !userId || !movieId || !videoReady) return;

    const setupResume = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const res = await getItemsApi(api).getItems({
          userId,
          ids: [movieId],
        });
        const item = res.data.Items?.[0];
        const runtimeTicks = item?.RunTimeTicks ?? 0;
        if (runtimeTicks > 0) setApiDuration(runtimeTicks / 10_000_000);

        const resumeSeconds =
          (item?.UserData?.PlaybackPositionTicks ?? 0) / 10_000_000;
        const seekToPosition = () => {
          if (resumeSeconds > 3 && resumeSeconds < video.duration - 5)
            video.currentTime = resumeSeconds;
        };
        if (video.readyState >= 1) {
          seekToPosition();
        } else {
          video.addEventListener("loadedmetadata", seekToPosition);
        }
      } catch {
        // ignore
      }
    };

    setupResume();
  }, [api, token, userId, movieId, videoReady]);

  // Report playback progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movieId || !token || !videoReady || !api) return;

    const sendProgress = async () => {
      try {
        await getPlaystateApi(api).reportPlaybackProgress({
          playbackProgressInfo: {
            ItemId: movieId,
            PositionTicks: Math.floor(video.currentTime * 10_000_000),
            IsPaused: video.paused,
          },
        });
      } catch {}
    };

    const handleTimeUpdate = () => {
      if ((video.currentTime | 0) % 10 === 0) sendProgress();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [api, token, movieId, videoReady]);

  // Notify Jellyfin on playback end
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movieId || !videoReady || !api) return;

    const handleEnded = async () => {
      try {
        await getPlaystateApi(api).reportPlaybackStopped({
          playbackStopInfo: {
            ItemId: movieId,
            PositionTicks: Math.floor(video.currentTime * 10_000_000),
          },
        });
      } catch {}
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [api, movieId, videoReady]);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Show/hide Skip Intro button
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !introTimestamps || !videoReady) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setShowSkipIntro(t >= introTimestamps.start && t < introTimestamps.end);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [introTimestamps, videoReady]);

  // Fetch subtitle VTT as blob URL to avoid cross-origin <track> restrictions
  useEffect(() => {
    let blobUrl: string | null = null;
    if (selectedSubtitle === null || !token || !movieId) {
      setSubtitleBlobUrl(null);
      return;
    }
    fetch(`${serverUrl}/Videos/${movieId}/${movieId}/Subtitles/${selectedSubtitle}/0/Stream.vtt?api_key=${token}`)
      .then(r => r.text())
      .then(text => {
        blobUrl = URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
        setSubtitleBlobUrl(blobUrl);
      })
      .catch(() => {});
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setSubtitleBlobUrl(null);
    };
  }, [selectedSubtitle, token, movieId, serverUrl]);

  // Subtitle track activation
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const activate = () => {
      Array.from(video.textTracks).forEach(t => {
        t.mode = subtitleBlobUrl !== null && (t.kind === "subtitles" || t.kind === "captions")
          ? "showing"
          : "disabled";
      });
    };
    activate();
    video.textTracks.addEventListener("addtrack", activate);
    return () => video.textTracks.removeEventListener("addtrack", activate);
  }, [subtitleBlobUrl, videoReady]);

  // Custom player state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoReady, movieId]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch((err) => console.error("play() failed:", err));
    } else {
      v.pause();
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapperRef.current?.requestFullscreen();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = Number(e.target.value);
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  };

  // Keyboard shortcuts: Space = play/pause, ArrowLeft/Right = ±5s
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === "Space") {
        e.preventDefault();
        v.paused ? v.play().catch(() => {}) : v.pause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prefer the API-supplied runtime; fall back to what the video element reports
  const displayDuration = apiDuration || duration;

  if (!videoUrl) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Preparing video...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      {!isFullscreen && (
        <Link to={-1 as any}>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 left-4 z-10 text-white/80 hover:text-white hover:bg-white/10"
          >
            ← Back
          </Button>
        </Link>
      )}

      <div
        ref={wrapperRef}
        onMouseMove={showControls}
        className="relative bg-black flex flex-col rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl"
        style={
          isFullscreen
            ? {
                width: "100vw",
                height: "100vh",
                borderRadius: 0,
                cursor: controlsVisible ? "default" : "none",
              }
            : { maxWidth: "90vw" }
        }
      >
        {/* Skip Intro */}
        {showSkipIntro && introTimestamps && controlsVisible && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-20 right-4 z-50 bg-black/60 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 hover:text-white font-medium"
            onClick={() => {
              if (videoRef.current)
                videoRef.current.currentTime = introTimestamps.end;
            }}
          >
            Skip Intro
          </Button>
        )}

        {/* Video */}
        <video
          key={movieId}
          ref={videoCallbackRef}
          src={videoUrl}
          preload="auto"
          autoPlay
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          style={isFullscreen ? {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "black",
            objectFit: "contain",
            objectPosition: "center",
            cursor: controlsVisible ? "pointer" : "none",
          } : {
            width: "100%",
            flex: 1,
            minHeight: 0,
            maxHeight: "85vh",
            background: "black",
            display: "block",
            objectFit: "contain",
            objectPosition: "center",
            cursor: "pointer",
          }}
        >
          {subtitleBlobUrl && (
            <track
              key={subtitleBlobUrl}
              kind="subtitles"
              src={subtitleBlobUrl}
              default
            />
          )}
        </video>

        {/* Controls */}
        <div
          className={`w-full bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 pb-4 pt-3 flex flex-col gap-3 transition-opacity duration-300 ${
            isFullscreen ? "absolute bottom-0 left-0 right-0 z-40" : ""
          } ${
            isFullscreen && !controlsVisible
              ? "opacity-0 pointer-events-none"
              : "opacity-100"
          }`}
        >
          {/* Progress bar */}
          <div className="relative w-full flex items-center group">
            {introTimestamps && displayDuration > 0 && (
              <div
                className="absolute w-0.5 h-3 bg-yellow-400/80 rounded-full pointer-events-none z-10"
                style={{
                  left: `${(introTimestamps.end / displayDuration) * 100}%`,
                }}
                title="Intro ends here"
              />
            )}
            <input
              type="range"
              min={0}
              max={displayDuration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 rounded-full accent-white cursor-pointer appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-webkit-slider-thumb]:transition-opacity"
              style={{
                background: `linear-gradient(to right, white ${(currentTime / (displayDuration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (displayDuration || 1)) * 100}%)`,
              }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-2 text-white/90">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                className="w-20 h-1 rounded-full accent-white cursor-pointer appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                style={{
                  background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>

            <span className="text-xs text-white/50 tabular-nums font-mono ml-1">
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </span>

            <div className="ml-auto flex items-center gap-1">
              {subtitles.length > 0 && (
                <div className="relative">
                  {showSubtitleMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSubtitleMenu(false)}
                      />
                      <div className="absolute bottom-8 right-0 z-50 bg-black/95 border border-white/20 rounded-lg py-1 min-w-36 shadow-xl">
                        <button
                          onClick={() => { setSelectedSubtitle(null); setShowSubtitleMenu(false); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors ${selectedSubtitle === null ? "text-white" : "text-white/50"}`}
                        >
                          Off
                        </button>
                        {subtitles.map(sub => (
                          <button
                            key={sub.index}
                            onClick={() => { setSelectedSubtitle(sub.index); setShowSubtitleMenu(false); }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition-colors ${selectedSubtitle === sub.index ? "text-white" : "text-white/50"}`}
                          >
                            {sub.displayTitle}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => setShowSubtitleMenu(prev => !prev)}
                    title="Subtitles"
                    className={`p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors ${selectedSubtitle !== null ? "text-white" : "text-white/50"}`}
                  >
                    <Captions size={16} />
                  </button>
                </div>
              )}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
