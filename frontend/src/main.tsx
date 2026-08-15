import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* BrowserRouter enables page navigation (like /login, /signup)
        without actually reloading the browser each time */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);