import React, { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Jellyfin } from "@jellyfin/sdk";
import type { Api } from "@jellyfin/sdk/lib/api";
import { v4 as uuidv4 } from "uuid";

interface JellyfinContextValue {
  jellyfin: Jellyfin;
  api: Api | null;
  token: string | null;
  setToken: (token: string | null) => void;
}

const JellyfinApiContext = createContext<JellyfinContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export const JellyfinApiProvider: React.FC<Props> = ({ children }) => {
  // ✅ Create Jellyfin ONCE using lazy init (NO effect)
  const [jellyfin] = useState(() => {
    const key = "jellyfin-device-id";
    let deviceId = localStorage.getItem(key);

    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(key, deviceId);
    }

    return new Jellyfin({
      clientInfo: {
        name: "jellyfin-shade",
        version: "1.0.0",
      },
      deviceInfo: {
        name: "browser",
        id: deviceId,
      },
    });
  });

  const [token, setTokenState] = useState<string | null>(
    sessionStorage.getItem("jellyfin-token"),
  );

  const setToken = (token: string | null) => {
    setTokenState(token);
    if (token) {
      sessionStorage.setItem("jellyfin-token", token);
    } else {
      sessionStorage.removeItem("jellyfin-token");
    }
  };

  // ✅ Derived value (NO state, NO effect)
  const api = useMemo<Api | null>(() => {
    return jellyfin.createApi("/", token ?? undefined);
  }, [jellyfin, token]);

  return (
    <JellyfinApiContext.Provider value={{ jellyfin, api, token, setToken }}>
      {children}
    </JellyfinApiContext.Provider>
  );
};

export const useJellyfinApi = () => {
  const ctx = useContext(JellyfinApiContext);
  if (!ctx) {
    throw new Error("useJellyfinApi must be used within JellyfinApiProvider");
  }
  return ctx;
};
