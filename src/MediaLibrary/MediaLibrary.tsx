import { useEffect, useState } from "react";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserViewsApi } from "@jellyfin/sdk/lib/utils/api/user-views-api";
import { Link } from "react-router-dom";
interface MediaFolder {
  Id: string;
  Name: string;
  CollectionType: string;
  ImageTags?: Record<string, string>;
}

export function MediaLibrary() {
  const { api, token } = useJellyfinApi();
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !token) return;

    const fetchUserMedia = async () => {
      try {
        if (!localStorage.getItem("userId")) return;
        const res = await getUserViewsApi(api).getUserViews({
          userId: localStorage.getItem("userId") ?? "",
        });
        setFolders(res.data.Items || []);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch user media folders.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchUserMedia();
  }, [api, token]);

  if (isFetching) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-md" />
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

  if (!folders.length) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        No media libraries found.
      </div>
    );
  }

  const collectionType = (collectionType: string) => {
    switch (collectionType) {
      case "movies":
        return "Movies";
      case "tvshows":
        return "TV Shows";
      case "music":
        return "Music";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <h1 className="text-2xl font-semibold mb-6">Media Libraries</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {folders.map((folder) => (
          <Link key={folder.Id} to={`/library/${folder.Id}`}>
            <Card className="cursor-pointer transition-all hover:shadow-lg">
              <CardHeader>
                <CardTitle className="truncate">{folder.Name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Collection: {collectionType(folder.CollectionType)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
