import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";

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
        <Link to="/library">
          <Button variant="secondary">← Back</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {episodes.map((ep) => (
          <Link key={ep.Id} to={`/episode/${ep.Id}`}>
            <Card
              key={ep.Id}
              className="cursor-pointer transition-all hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="truncate">
                  {ep.IndexNumber ? `E${ep.IndexNumber}: ` : ""}
                  {ep.Name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  Premiered:{" "}
                  {ep.PremiereDate
                    ? new Date(ep.PremiereDate).toLocaleDateString()
                    : "Unknown"}
                </p>
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
