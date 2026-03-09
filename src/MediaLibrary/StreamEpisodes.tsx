import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";

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

export function EpisodePlayer() {
  const { api, token } = useJellyfinApi();
  const { episodeId } = useParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [introTimestamps, setIntroTimestamps] =
    useState<IntroTimestamps | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
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

  const videoCallbackRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node) setVideoReady(true);
  };

  // Step 1: Construct stream URL
  useEffect(() => {
    if (!token || !episodeId) return;
    setVideoUrl(
      `http://100.64.128.110:4242/Videos/${episodeId}/stream.mp4?static=true&api_key=${token}`,
    );
  }, [token, episodeId]);

  // Step 1.5: Detect intro from MP4 chapter metadata (indexed by Jellyfin)
  useEffect(() => {
    if (!api || !episodeId) return;
    const fetchIntro = async () => {
      try {
        const res = await getItemsApi(api).getItems({
          ids: [episodeId],
          fields: ["Chapters"] as ItemFields[],
        });
        const chapters = res.data.Items?.[0]?.Chapters ?? [];
        const introIdx = chapters.findIndex((c) =>
          /opening|intro|op\b/i.test(c.Name ?? ""),
        );
        if (introIdx === -1 || !chapters[introIdx + 1]) return;
        setIntroTimestamps({
          start: (chapters[introIdx].StartPositionTicks ?? 0) / 10_000_000,
          end: (chapters[introIdx + 1].StartPositionTicks ?? 0) / 10_000_000,
        });
      } catch {
        // silently ignore — chapter data is optional
      }
    };
    fetchIntro();
  }, [api, episodeId]);

  // Step 2: Resume from saved position
  useEffect(() => {
    if (!api || !token || !userId || !episodeId || !videoReady) return;

    const fetchResumeTime = async (): Promise<number> => {
      try {
        const res = await getItemsApi(api).getItems({
          userId,
          ids: [episodeId],
        });
        const ticks = res.data.Items?.[0]?.UserData?.PlaybackPositionTicks ?? 0;
        return ticks / 10_000_000;
      } catch {
        return 0;
      }
    };

    const setupResume = async () => {
      const video = videoRef.current;
      if (!video) return;
      const resumeSeconds = await fetchResumeTime();
      const seekToPosition = () => {
        if (resumeSeconds > 3 && resumeSeconds < video.duration - 5)
          video.currentTime = resumeSeconds;
      };
      if (video.readyState >= 1) {
        seekToPosition();
      } else {
        video.addEventListener("loadedmetadata", seekToPosition);
        return () =>
          video.removeEventListener("loadedmetadata", seekToPosition);
      }
    };

    setupResume();
  }, [api, token, userId, episodeId, videoReady]);

  // Step 3: Periodically report playback progress to Jellyfin
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !episodeId || !token || !videoReady || !api) return;

    const sendProgress = async () => {
      try {
        await getPlaystateApi(api).reportPlaybackProgress({
          playbackProgressInfo: {
            ItemId: episodeId,
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
  }, [api, token, episodeId, videoReady]);

  // Step 4: Notify Jellyfin on playback end
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !episodeId || !videoReady || !api) return;

    const handleEnded = async () => {
      try {
        await getPlaystateApi(api).reportPlaybackStopped({
          playbackStopInfo: {
            ItemId: episodeId,
            PositionTicks: Math.floor(video.currentTime * 10_000_000),
          },
        });
      } catch {}
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [api, episodeId, videoReady]);

  // Step 5a: Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Step 5b: Show/hide Skip Intro button
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

  // Step 6: Custom player state
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
  }, [videoReady]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
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

  // --- UI Rendering ---
  if (!videoUrl) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        {error || "Preparing video..."}
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
            ? { width: "100vw", height: "100vh", borderRadius: 0, cursor: controlsVisible ? "default" : "none" }
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
          key={episodeId}
          ref={videoCallbackRef}
          autoPlay
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          style={{
            width: "100%",
            flex: 1,
            minHeight: 0,
            maxHeight: isFullscreen ? "calc(100vh - 72px)" : "85vh",
            background: "black",
            display: "block",
            cursor: isFullscreen && !controlsVisible ? "none" : "pointer",
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* Controls */}
        <div
          className={`w-full bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 pb-4 pt-3 flex flex-col gap-3 transition-opacity duration-300 ${
            isFullscreen && !controlsVisible ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Progress bar */}
          <div className="relative w-full flex items-center group">
            {introTimestamps && duration > 0 && (
              <div
                className="absolute w-0.5 h-3 bg-yellow-400/80 rounded-full pointer-events-none z-10"
                style={{ left: `${(introTimestamps.end / duration) * 100}%` }}
                title="Intro ends here"
              />
            )}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 rounded-full accent-white cursor-pointer appearance-none bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:opacity-0 group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-webkit-slider-thumb]:transition-opacity"
              style={{
                background: `linear-gradient(to right, white ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%)`,
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
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-auto">
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
