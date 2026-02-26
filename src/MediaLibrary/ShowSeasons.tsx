import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";

// We can use plain fetch for this endpoint for simplicity
// Jellyfin SDK doesn't yet have a "show seasons" helper

interface Season {
  Id: string;
  Name: string;
  IndexNumber?: number;
  CanDelete?: boolean;
  MediaSourceCount?: number;
  EpisodeCount?: number;
}

export function ShowSeasons() {
  const { api } = useJellyfinApi();
  const { id } = useParams(); // seriesId
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesName, setSeriesName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  console.log("ShowSeasons component rendered with id:", id);
  const serverUrl = api?.configuration?.basePath?.replace(/\/$/, ""); // get Jellyfin base URL
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (!serverUrl || !userId || !id) return;

    const fetchSeasons = async () => {
      setLoading(true);
      try {
        // const url = new URL(`${serverUrl}/Shows/${id}/Seasons`);
        // url.searchParams.set("userId", userId);
        // url.searchParams.set(
        //   "Fields",
        //   "ItemCounts,PrimaryImageAspectRatio,CanDelete,MediaSourceCount"
        // );

        const response = await getTvShowsApi(api).getSeasons({
          userId: userId,
          seriesId: id,
          fields:
            "ItemCounts,PrimaryImageAspectRatio,CanDelete,MediaSourceCount",
        });
        setSeasons(response.data.Items || []);
        setSeriesName(response.data.Items[0].SeriesName || "Show");
        setError(null);
      } catch (e: any) {
        setError(e.message || "Error fetching seasons.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, [serverUrl, userId, id, api]);

  if (loading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[160px] w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (!seasons.length) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-muted-foreground">
        <p>No seasons found for this show.</p>
        <Link to="/library">
          <Button className="mt-4" variant="secondary">
            Back to Library
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{seriesName}</h1>
        <Link to="/library">
          <Button variant="secondary">← Back to Library</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {seasons.map((season) => (
          <Link key={season.Id} to={`/item/${id}/${season.Id}`}>
            <Card
              key={season.Id}
              className="cursor-pointer transition-all hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="truncate">
                  {season.Name || `Season ${season.IndexNumber}`}
                </CardTitle>
              </CardHeader>
              {/* <CardContent className="text-sm text-muted-foreground">
              <p>Episodes: {season.EpisodeCount ?? 0}</p>
              <p>Can Delete: {season.CanDelete ? "Yes" : "No"}</p>
            </CardContent> */}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
