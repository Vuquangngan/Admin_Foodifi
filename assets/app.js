import { loadPartials } from "./js/partials-loader.js";

await loadPartials(document);
await import("./js/main.js");
