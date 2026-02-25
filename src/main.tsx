import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { JellyfinApiProvider } from "./ApiConfig/ApiContext.tsx";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <JellyfinApiProvider
          serverUrl={localStorage.getItem("server-url") || ""}
        >
          <App />
        </JellyfinApiProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
