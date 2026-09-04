import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { NotifyProvider } from "./components/common/Notify";
import InstallPrompt from "./components/common/InstallPrompt";
import { registerServiceWorker } from "./pwa/registerServiceWorker";
import App from "./App";
import "./index.css";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotifyProvider>
        <App />
        <InstallPrompt />
      </NotifyProvider>
    </BrowserRouter>
  </React.StrictMode>
);
