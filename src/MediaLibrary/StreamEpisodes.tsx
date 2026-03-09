import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";

interface IntroTimestamps {
  IntroStart: number;
  IntroEnd: number;
  ShowSkipPromptAt: number;
  HideSkipPromptAt: number;
  Valid: boolean;
}

export function EpisodePlayer() {
  const { api, token } = useJellyfinApi();
  const { episodeId } = useParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [introTimestamps, setIntroTimestamps] = useState<IntroTimestamps | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userId = localStorage.getItem("userId");

  // Callback ref — fires exactly when the video element mounts/unmounts
  const videoCallbackRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node) setVideoReady(true);
  };

  // Step 1: Construct stream URL
  useEffect(() => {
    if (!token || !episodeId) return;

    const fetchStreamUrl = async () => {
      try {
        const url = `/Videos/${episodeId}/stream.mp4?static=true&api_key=${token}`;
        console.log("Constructed video URL:", url);
        setVideoUrl(url);
      } catch (err: any) {
        console.error("Failed to prepare video:", err);
        setError("Failed to load video stream.");
      }
    };

    fetchStreamUrl();
  }, [token, episodeId]);

  // Step 1.5: Fetch intro timestamps (Intro Skipper plugin)
  useEffect(() => {
    if (!token || !episodeId) return;

    const fetchIntro = async () => {
      try {
        const res = await fetch(`/Episode/${episodeId}/IntroTimestamps/v1`, {
          headers: { Authorization: `MediaBrowser Token="${token}"` },
        });
        if (!res.ok) return; // plugin not installed or no intro data
        const data: IntroTimestamps = await res.json();
        if (data.Valid) setIntroTimestamps(data);
      } catch {
        // silently ignore — intro skip is optional
      }
    };

    fetchIntro();
  }, [token, episodeId]);

  // Step 2: Resume from saved position
  // Depends on videoReady so we know videoRef.current is populated
  useEffect(() => {
    if (!api || !token || !userId || !episodeId || !videoReady) return;

    const fetchResumeTime = async (): Promise<number> => {
      try {
        const res = await getItemsApi(api).getItems({
          userId: userId,
          ids: [episodeId],
        });
        const item = res.data.Items?.[0];
        const ticks = item?.UserData?.PlaybackPositionTicks ?? 0;
        const seconds = ticks / 10_000_000;
        console.log(`Saved playback position: ${seconds.toFixed(1)}s`);
        return seconds;
      } catch (err) {
        console.error("Failed to fetch resume position:", err);
        return 0;
      }
    };

    const setupResume = async () => {
      const video = videoRef.current;
      if (!video) return;

      const resumeSeconds = await fetchResumeTime();

      const seekToPosition = () => {
        if (resumeSeconds > 3 && resumeSeconds < video.duration - 5) {
          video.currentTime = resumeSeconds;
          console.log(
            `Resuming playback from ${resumeSeconds.toFixed(1)} seconds`,
          );
        }
      };

      // If metadata is already available (e.g. cached video on refresh), seek immediately.
      // readyState >= 1 means HAVE_METADATA — duration is already known.
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

  // Step 3: Periodically send playback progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !episodeId || !token || !videoReady || !api) return;

    const sendProgress = async () => {
      try {
        const positionTicks = Math.floor(video.currentTime * 10_000_000);
        await getPlaystateApi(api).reportPlaybackProgress({
          playbackProgressInfo: {
            ItemId: episodeId,
            PositionTicks: positionTicks,
            IsPaused: video.paused,
          },
        });
      } catch (err) {
        console.error("Failed to send progress:", err);
      }
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
      } catch (err) {
        console.error("Failed to mark playback stopped:", err);
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [api, episodeId, videoReady]);

  // Step 5: Show/hide skip intro button based on playback position
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !introTimestamps || !videoReady) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setShowSkipIntro(t >= introTimestamps.ShowSkipPromptAt && t < introTimestamps.HideSkipPromptAt);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [introTimestamps, videoReady]);

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
      <Link to={-1 as any}>
        <Button
          variant="secondary"
          className="absolute top-4 left-4 z-10 text-sm"
        >
          ← Back
        </Button>
      </Link>

      {showSkipIntro && introTimestamps && (
        <Button
          variant="secondary"
          className="absolute bottom-24 right-8 z-10 text-sm font-semibold px-5 py-2 border border-white/30"
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime = introTimestamps.IntroEnd;
          }}
        >
          Skip Intro
        </Button>
      )}

      <video
        key={episodeId}
        ref={videoCallbackRef}
        controls
        autoPlay
        crossOrigin="anonymous"
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          borderRadius: "8px",
          background: "black",
        }}
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
