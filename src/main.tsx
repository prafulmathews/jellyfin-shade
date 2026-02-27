import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
