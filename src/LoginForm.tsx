import React, { useState } from "react";
import { useJellyfinApi } from "./ApiConfig/ApiContext";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";

// shadcn/ui
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaLibrary } from "./MediaLibrary/MediaLibrary";

export function LoginForm() {
  const { api, setToken, token } = useJellyfinApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await getUserApi(api).authenticateUserByName({
        authenticateUserByName: { Username: username, Pw: password },
      });
      const accessToken = res.data?.AccessToken;
      const userId = res.data?.User?.Id;
      if (accessToken && userId) {
        localStorage.setItem("userId", userId);
        setToken(accessToken);
      } else {
        setAuthError("No access token returned.");
      }
    } catch (err) {
      setAuthError(`Login failed — check credentials: ${err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // if (loading)
  //   return (
  //     <div className="flex h-screen items-center justify-center text-muted-foreground">
  //       Connecting to server...
  //     </div>
  //   );

  // if (error)
  //   return (
  //     <div className="flex h-screen items-center justify-center text-red-500">
  //       Failed to connect: {error}
  //     </div>
  //   );

  if (token) return <MediaLibrary />;

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <Card className="w-90 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Login to Jellyfin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="demo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Login"}
            </Button>
          </form>
          {authError && (
            <p className="mt-3 text-sm text-red-500">{authError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
