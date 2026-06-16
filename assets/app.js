const ADMIN_ASSET_VERSION = "20260617-a";

const { loadPartials } = await import(`./js/partials-loader.js?v=${ADMIN_ASSET_VERSION}`);

await loadPartials(document);
await import(`./js/main.js?v=${ADMIN_ASSET_VERSION}`);
