import React, { useState } from "react";
import { LoginForm } from "./LoginForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Route, Routes } from "react-router-dom";
import { MediaLibrary } from "./MediaLibrary/MediaLibrary";
import { MediaItems } from "./MediaLibrary/MediaItems";
import { ShowSeasons } from "./MediaLibrary/ShowSeasons";
import { SeasonEpisodes } from "./MediaLibrary/ShowEpisodes";
import { EpisodePlayer } from "./MediaLibrary/StreamEpisodes";

export default function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(
    localStorage.getItem("server-url"),
  );
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.ChangeEvent) => {
    e.preventDefault();
    if (!inputValue) return;

    let formatted = inputValue.trim();
    // Automatically prepend protocol if not given
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `http://${formatted}`;
    }

    localStorage.setItem("server-url", formatted);
    setServerUrl(formatted);
  };

  if (!serverUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Card className="w-95 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Connect to Your Jellyfin Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="server">Server Address</Label>
                <Input
                  id="server"
                  type="text"
                  placeholder="example: 100.64.128.110:8096"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Connect
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            Enter your Jellyfin server’s IP or domain
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/library" element={<MediaLibrary />} />
      <Route path="/library/:parentId" element={<MediaItems />} />
      <Route path="/item/:id" element={<ShowSeasons />} />
      <Route path="/item/:id/:seasonId" element={<SeasonEpisodes />} />
      <Route path="/episode/:episodeId" element={<EpisodePlayer />} />
    </Routes>
  );
}
