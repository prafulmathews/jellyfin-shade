import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Jellyfin } from "@jellyfin/sdk";
import { v4 as uuidv4 } from "uuid";

interface JellyfinContextValue {
  jellyfin: Jellyfin | null;
  api: any | null;
  token: string | null;
  setToken: (token: string | null) => void;
}

const JellyfinApiContext = createContext<JellyfinContextValue>({
  jellyfin: null,
  api: null,
  token: null,
  setToken: () => {},
});

interface Props {
  serverUrl: string;
  children: ReactNode;
}

export const JellyfinApiProvider: React.FC<Props> = ({
  serverUrl,
  children,
}) => {
  const [jellyfin, setJellyfin] = useState<Jellyfin | null>(null);
  const [api, setApi] = useState<any | null>(null);
  const [token, setTokenState] = useState<string | null>(
    sessionStorage.getItem("jellyfin-token"),
  );

  const setToken = (token: string | null) => {
    setTokenState(token);
    if (token) sessionStorage.setItem("jellyfin-token", token);
    else sessionStorage.removeItem("jellyfin-token");
  };

  useEffect(() => {
    const getOrCreateDeviceId = () => {
      const key = "jellyfin-device-id";
      let id = localStorage.getItem(key);
      if (!id) {
        id = uuidv4();
        localStorage.setItem(key, id);
      }
      return id;
    };

    const jf = new Jellyfin({
      clientInfo: { name: "jellyfin-shade", version: "1.0.0" },
      deviceInfo: { name: "browser", id: getOrCreateDeviceId() },
    });

    setJellyfin(jf);
  }, []);

  useEffect(() => {
    if (!jellyfin) return;

    const apiInstance = jellyfin.createApi(serverUrl, token ?? undefined);
    setApi(apiInstance);
  }, [jellyfin, serverUrl, token]);

  return (
    <JellyfinApiContext.Provider value={{ jellyfin, api, token, setToken }}>
      {children}
    </JellyfinApiContext.Provider>
  );
};

export const useJellyfinApi = () => useContext(JellyfinApiContext);
