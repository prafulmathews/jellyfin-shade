import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";

export function EpisodePlayer() {
  const { api, token } = useJellyfinApi();
  const { episodeId } = useParams();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const serverUrl = api?.configuration?.basePath?.replace(/\/$/, "");

  useEffect(() => {
    if (!serverUrl || !token || !episodeId) return;

    const fetchStreamUrl = async () => {
      try {
        /**
         * Jellyfin SDK `getVideoStream` will register the playback session,
         * and can apply transcoding or direct-play logic depending on arguments.
         * However, it doesn’t directly return a usable URL.
         */
        // const videoApi = getVideosApi(api);

        // // You can call it just to confirm playback is supported (optional)
        // await videoApi.getVideoStream({
        //   itemId: episodeId,
        //   // Example optional options:
        //   static_: true,
        //   container: "mp4",
        //   mediaSourceId: episodeId, // usually just same as itemId
        //   params: {}, // additional query params if needed
        // });

        // Build your actual streaming URL
        const url = `${serverUrl}/Videos/${episodeId}/stream.mp4?static=true&api_key=${token}`;
        console.log("Constructed video URL:", url);
        setVideoUrl(url);
      } catch (err: any) {
        console.error("Failed to prepare video:", err);
        setError("Failed to load video stream.");
      }
    };

    fetchStreamUrl();
  }, [serverUrl, token, episodeId, api]);

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
      {/* <ReactPlayer
        url={videoUrl}
        controls
        playing
        width="80vw"
        height="45vw"
        style={{
          borderRadius: "8px",
          boxShadow: "0 0 20px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
        /> */}
      <video
        key={episodeId}
        ref={videoRef}
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
