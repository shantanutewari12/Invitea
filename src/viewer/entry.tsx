import { createRoot } from "react-dom/client";

import { ViewerApp } from "./ViewerApp";

/**
 * Entry point of the standalone guest viewer bundle (scripts/build-viewer.mjs).
 * The static shell (public/viewer/shell.html) contains only an empty #root, so the same
 * document works for every token and can be precached by the service worker.
 */
const container = document.getElementById("root");
if (container) createRoot(container).render(<ViewerApp />);
