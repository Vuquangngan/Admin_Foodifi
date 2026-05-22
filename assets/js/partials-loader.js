export async function loadPartials(root = document) {
    const targets = Array.from(root.querySelectorAll("[data-partial]"));
    if (!targets.length) return;

    await Promise.all(targets.map(async (target) => {
        const url = target.dataset.partial;
        if (!url) return;

        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok) {
            throw new Error(`Không tải được giao diện module: ${url}`);
        }

        target.outerHTML = await response.text();
    }));
}
