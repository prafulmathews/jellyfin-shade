import { LoginForm } from "./LoginForm";
import { Route, Routes } from "react-router-dom";
import { MediaLibrary } from "./MediaLibrary/MediaLibrary";
import { MediaItems } from "./MediaLibrary/MediaItems";
import { ShowSeasons } from "./MediaLibrary/ShowSeasons";
import { SeasonEpisodes } from "./MediaLibrary/ShowEpisodes";
import { EpisodePlayer } from "./MediaLibrary/StreamEpisodes";
import { JellyfinApiProvider } from "./ApiConfig/ApiContext";

export default function App() {
  return (
    <JellyfinApiProvider>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/library" element={<MediaLibrary />} />
        <Route path="/library/:parentId" element={<MediaItems />} />
        <Route path="/item/:id" element={<ShowSeasons />} />
        <Route path="/item/:id/:seasonId" element={<SeasonEpisodes />} />
        <Route path="/episode/:episodeId" element={<EpisodePlayer />} />
      </Routes>
    </JellyfinApiProvider>
  );
}
