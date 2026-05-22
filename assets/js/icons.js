const ICONS = {
    package: `<path d="M10 16 24 8l14 8-14 8-14-8Z"/><path d="M10 16v16l14 8 14-8V16"/><path d="M24 24v16"/><path d="m17 12 14 8"/>`,
    grid: `<rect x="10" y="10" width="10" height="10" rx="2"/><rect x="28" y="10" width="10" height="10" rx="2"/><rect x="10" y="28" width="10" height="10" rx="2"/><rect x="28" y="28" width="10" height="10" rx="2"/>`,
    home: `<path d="M9 22 24 10l15 12"/><path d="M13 20v18h22V20"/><path d="M20 38V27h8v11"/><path d="M18 22h12v8H18z"/>`,
    bell: `<path d="M16 34h16"/><path d="M18 34V21a6 6 0 0 1 12 0v13"/><path d="M21 38a4 4 0 0 0 6 0"/><path d="M22 12a2 2 0 0 1 4 0"/><circle cx="34" cy="17" r="6"/><path d="M34 14v4"/><path d="M34 21h.01"/>`,
    store: `<path d="M12 16h24l2 8H10l2-8Z"/><path d="M12 24v14h24V24"/><path d="M18 38V28h12v10"/><path d="M10 24c1.5 3 5 3 7 0 2 3 6 3 8 0 2 3 6 3 8 0 2 3 5.5 3 7 0"/>`,
    pin: `<path d="M24 40s12-11 12-22a12 12 0 0 0-24 0c0 11 12 22 12 22Z"/><circle cx="24" cy="18" r="4"/>`,
    chat: `<path d="M12 15a8 8 0 0 1 8-8h9a8 8 0 0 1 8 8v5a8 8 0 0 1-8 8h-8l-9 6 3-8a8 8 0 0 1-3-6v-5Z"/><path d="M20 18h.01M25 18h.01M30 18h.01"/>`,
    user: `<circle cx="24" cy="18" r="7"/><path d="M11 39c3-8 8-12 13-12s10 4 13 12"/><circle cx="24" cy="24" r="18"/>`,
    cart: `<path d="M9 12h5l4 20h17l4-14H17"/><circle cx="20" cy="38" r="2.5"/><circle cx="33" cy="38" r="2.5"/>`,
    receipt: `<path d="M14 8h20v32l-4-3-4 3-4-3-4 3-4-3V8Z"/><path d="M20 16h8M20 23h12M20 30h10"/><path d="M33 16h.01"/>`,
    book: `<path d="M12 10h13a7 7 0 0 1 7 7v23H17a5 5 0 0 0-5 5V10Z"/><path d="M36 10h-4a7 7 0 0 0-7 7v23h15a4 4 0 0 1 4 4V14a4 4 0 0 0-4-4h-4Z"/><path d="M17 18h6M17 25h6"/>`,
    ticket: `<path d="M10 17a4 4 0 0 1 4-4h24v7a4 4 0 0 0 0 8v7H14a4 4 0 0 1-4-4v-7a4 4 0 0 0 0-8v-5Z"/><path d="M25 14v4M25 22v4M25 30v4"/>`,
    truck: `<path d="M8 16h20v16H8z"/><path d="M28 21h6l6 6v5H28"/><circle cx="15" cy="35" r="3"/><circle cx="34" cy="35" r="3"/>`,
    calendar: `<rect x="10" y="12" width="28" height="28" rx="4"/><path d="M16 8v8M32 8v8M10 20h28"/><path d="M17 27h4v4h-4zM27 27h4v4h-4zM17 34h4v4h-4zM27 34h4v4h-4z"/>`,
    users: `<circle cx="24" cy="16" r="6"/><path d="M14 38c2-7 6-10 10-10s8 3 10 10"/><circle cx="12" cy="21" r="4"/><path d="M5 36c1-5 4-7 7-7"/><circle cx="36" cy="21" r="4"/><path d="M36 29c3 0 6 2 7 7"/>`,
    chart: `<path d="M10 38h30"/><path d="M14 38V27h5v11M23 38V20h5v18M32 38V12h5v26"/>`,
    wallet: `<path d="M10 14h25a4 4 0 0 1 4 4v18H10a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"/><path d="M34 25h8v8h-8a4 4 0 0 1 0-8Z"/><path d="M34 29h.01"/>`,
    megaphone: `<path d="M10 28h7l16-8v16l-16-8"/><path d="M17 28l3 10h5l-3-8"/><path d="M35 20c3 2 4 5 4 8s-1 6-4 8"/>`,
    basket: `<path d="M12 20h24l-3 18H15l-3-18Z"/><path d="M17 20c1-6 4-9 7-9s6 3 7 9"/><path d="M18 27v5M24 27v5M30 27v5"/><path d="M18 14c-4-2-6-4-6-8 4 0 7 2 9 6"/><path d="M30 14c4-2 6-4 6-8-4 0-7 2-9 6"/>`,
    shield: `<path d="M24 8 38 14v10c0 9-5 14-14 18-9-4-14-9-14-18V14l14-6Z"/><path d="m17 25 5 5 10-11"/>`,
    warning: `<path d="M24 9 42 39H6L24 9Z"/><path d="M24 19v9"/><path d="M24 34h.01"/>`,
    settings: `<circle cx="24" cy="24" r="6"/><path d="M24 7v5M24 36v5M7 24h5M36 24h5M12 12l4 4M32 32l4 4M36 12l-4 4M16 32l-4 4"/><path d="M18 9h12l2 5 5 2v12l-5 2-2 5H18l-2-5-5-2V16l5-2 2-5Z"/>`,
    search: `<circle cx="21" cy="21" r="9"/><path d="m28 28 8 8"/>`,
    upload: `<path d="M14 34h20"/><path d="M16 22h5v12h6V22h5l-8-9-8 9Z"/>`,
    edit: `<path d="M13 34h8"/><path d="m18 30 16-16 4 4-16 16-6 2 2-6Z"/>`,
    trash: `<path d="M14 16h20"/><path d="M19 16V11h10v5"/><path d="M17 20l2 20h10l2-20"/><path d="M22 24v11M28 24v11"/>`,
    pause: `<path d="M17 13h6v22h-6zM29 13h6v22h-6z"/>`,
    plus: `<path d="M24 12v24M12 24h24"/>`,
    lock: `<rect x="13" y="21" width="22" height="17" rx="3"/><path d="M18 21v-5a6 6 0 0 1 12 0v5"/>`,
    mail: `<rect x="10" y="14" width="28" height="20" rx="3"/><path d="m12 17 12 10 12-10"/>`,
    eye: `<path d="M8 24s6-10 16-10 16 10 16 10-6 10-16 10S8 24 8 24Z"/><circle cx="24" cy="24" r="5"/>`
};

export function renderAppIcon(name, options = {}) {
    const key = Object.prototype.hasOwnProperty.call(ICONS, name) ? name : "grid";
    const className = options.className ? ` ${options.className}` : "";
    const title = options.title ? `<title>${String(options.title).replace(/[<>&"]/g, "")}</title>` : "";

    return `<svg class="app-icon app-icon-${key}${className}" viewBox="0 0 48 48" aria-hidden="${options.title ? "false" : "true"}" focusable="false" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${title}${ICONS[key]}</svg>`;
}

export function hydrateStaticIcons(root = document) {
    root.querySelectorAll("[data-app-icon]").forEach((target) => {
        target.innerHTML = renderAppIcon(target.dataset.appIcon || "grid");
    });
}

export function iconDataUri(name) {
    const svg = renderAppIcon(name, { className: "category-preset-icon" })
        .replace(' class="app-icon app-icon-', ' class="')
        .replace(/<title>.*?<\/title>/g, "");

    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="#eef5e9"/><g transform="translate(36 36) scale(1.85)" color="#11864a">${svg}</g></svg>`
    )}`;
}
