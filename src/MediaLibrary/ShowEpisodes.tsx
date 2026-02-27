import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";

function WatchProgressIndicator({ item }: { item: BaseItemDto }) {
  const isWatched = item.UserData?.Played === true;
  const playedPercentage = item.UserData?.PlayedPercentage ?? 0;
  const hasStarted = playedPercentage > 0 && !isWatched;

  if (!isWatched && !hasStarted) return null;

  const size = 28;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (playedPercentage / 100) * circumference;

  if (isWatched) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-primary"
        style={{ width: size, height: size }}
        title="Watched"
      >
        {/* Checkmark */}
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 12 12"
          fill="none"
        >
          <polyline
            points="1.5,6 4.5,9 10.5,3"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div title={`${Math.round(playedPercentage)}% watched`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/30"
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          className="text-primary"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
    </div>
  );
}

export function SeasonEpisodes() {
  const { api } = useJellyfinApi();
  const { id, seasonId } = useParams();
  const [episodes, setEpisodes] = useState<BaseItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (!api || !userId || !seasonId) return;
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        const res = await getTvShowsApi(api).getEpisodes({
          seriesId: id ?? "",
          userId: userId,
          seasonId: seasonId,
          fields: [
            "ItemCounts",
            "PrimaryImageAspectRatio",
            "CanDelete",
            "MediaSourceCount",
            "Overview",
          ] as ItemFields[],
        });
        setEpisodes(res.data.Items ?? []);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch episodes");
      } finally {
        setLoading(false);
      }
    };
    fetchEpisodes();
  }, [api, userId, seasonId]);

  if (loading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        {error}
      </div>
    );

  if (!episodes.length) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-muted-foreground">
        <p>No episodes found for this season.</p>
        <Link to="/library">
          <Button className="mt-4" variant="secondary">
            Back
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Episodes</h1>
        <Link to={`/item/${id}`}>
          <Button variant="secondary">← Back</Button>
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {episodes.map((ep) => (
          <Link key={ep.Id} to={`/episode/${ep.Id}`}>
            <Card className="cursor-pointer transition-all hover:shadow-md h-40 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2 w-full overflow-hidden">
                  <CardTitle
                    className="text-sm font-semibold leading-snug min-w-0 flex-1 overflow-hidden"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                    title={`${ep.IndexNumber ? `E${ep.IndexNumber}: ` : ""}${ep.Name}`}
                  >
                    {ep.IndexNumber ? `E${ep.IndexNumber}: ` : ""}
                    {ep.Name}
                  </CardTitle>
                  <div className="shrink-0 mt-0.5">
                    <WatchProgressIndicator item={ep} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  Duration:{" "}
                  {ep.RunTimeTicks
                    ? `${Math.round(ep.RunTimeTicks / 600000000)} min`
                    : "N/A"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
