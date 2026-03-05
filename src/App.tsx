import { LoginForm } from "./LoginForm";
import { Navigate, Route, Routes } from "react-router-dom";
import { MediaLibrary } from "./MediaLibrary/MediaLibrary";
import { MediaItems } from "./MediaLibrary/MediaItems";
import { ShowSeasons } from "./MediaLibrary/ShowSeasons";
import { SeasonEpisodes } from "./MediaLibrary/ShowEpisodes";
import { EpisodePlayer } from "./MediaLibrary/StreamEpisodes";
import { JellyfinApiProvider, useJellyfinApi } from "./ApiConfig/ApiContext";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useJellyfinApi();
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <JellyfinApiProvider>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/library" element={<ProtectedRoute><MediaLibrary /></ProtectedRoute>} />
        <Route path="/library/:parentId" element={<ProtectedRoute><MediaItems /></ProtectedRoute>} />
        <Route path="/item/:id" element={<ProtectedRoute><ShowSeasons /></ProtectedRoute>} />
        <Route path="/item/:id/:seasonId" element={<ProtectedRoute><SeasonEpisodes /></ProtectedRoute>} />
        <Route path="/episode/:episodeId" element={<ProtectedRoute><EpisodePlayer /></ProtectedRoute>} />
      </Routes>
    </JellyfinApiProvider>
  );
}
