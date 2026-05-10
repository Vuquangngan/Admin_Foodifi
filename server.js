const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
};

function resolveFilePath(urlPath) {
    const safePath = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
    const requestedPath = path.join(ROOT_DIR, safePath || "index.html");
    const normalizedPath = path.normalize(requestedPath);

    if (!normalizedPath.startsWith(ROOT_DIR)) {
        return null;
    }

    if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isFile()) {
        return normalizedPath;
    }

    if (path.extname(normalizedPath)) {
        return null;
    }

    const fallbackPath = path.join(ROOT_DIR, "index.html");
    return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

const server = http.createServer((req, res) => {
    const filePath = resolveFilePath(req.url || "/");
    if (!filePath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Internal server error");
            return;
        }

        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Web admin đang chạy tại http://localhost:${PORT}`);
    console.log("Cập nhật API base URL trong màn hình đăng nhập nếu backend không chạy ở cổng 3000.");
});
