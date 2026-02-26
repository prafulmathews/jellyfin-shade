import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useJellyfinApi } from "../ApiConfig/ApiContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import type { SortOrder } from "@jellyfin/sdk/lib/generated-client/models/sort-order";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import type { ItemSortBy } from "@jellyfin/sdk/lib/generated-client/models/item-sort-by";
import type { ImageType } from "@jellyfin/sdk/lib/generated-client/models/image-type";

interface QueryOptions {
  userId?: string;
  sortBy?: ItemSortBy[];
  sortOrder?: SortOrder[];
  IncludeItemTypes?: string;
  recursive?: boolean;
  fields?: ItemFields[];
  ImageTypeLimit?: number;
  enableImageTypes?: ImageType[];
  startIndex?: number;
  limit?: number;
  parentId?: string;
}

export function MediaItems() {
  const { api } = useJellyfinApi();
  const { parentId } = useParams(); // from /library/:parentId
  const [items, setItems] = useState<BaseItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = localStorage.getItem("userId");

  // ✅ Default params (can be customized later)
  const defaultParams: QueryOptions = {
    userId: userId ?? "",
    // sortBy: "SortName",
    // sortOrder: [{ Ascending: "Ascending" }],
    // IncludeItemTypes: "Series",
    // recursive: true,
    // fields: "PrimaryImageAspectRatio",
    // ImageTypeLimit: 1,
    // enableImageTypes: "Primary,Backdrop,Banner,Thumb",
    // startIndex: 0,
    // limit: 100,
    parentId: parentId,
  };

  useEffect(() => {
    if (!api || !userId || !parentId) return;

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        console.log("Test");
        const res = await getItemsApi(api).getItems(defaultParams);
        setItems(res.data.Items || []);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError("Failed to fetch series.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [api, parentId, userId]);

  if (isLoading) {
    return (
      <div className="grid gap-4 p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-md" />
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

  if (!items.length) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        No series found in this library.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Series</h1>
        <Link to="/library">
          <Button variant="secondary">← Back</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <Link key={item.Id} to={`/item/${item.Id}`}>
            getTvShowsApi
            <Card
              key={item.Id}
              className="cursor-pointer transition-all hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="truncate">{item.Name}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Type: {item.Type}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
