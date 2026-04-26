import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary context="What's New">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
