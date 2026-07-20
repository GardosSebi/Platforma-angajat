import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import "./styles/global.css";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import { registerServiceWorker } from "./pwa/sw";

async function bootstrap() {
  await registerServiceWorker();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </React.StrictMode>
  );
}

void bootstrap();
