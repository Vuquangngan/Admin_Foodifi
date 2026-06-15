import { loadPartials } from "./js/partials-loader.js";

await loadPartials(document);

function isLocalFrontendHost() {
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
}

function normalizeApiBase(input) {
    return String(input || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api$/i, "");
}

function getFallbackApiBase() {
    const config = window.SHOPFOOD_ADMIN_CONFIG || {};
    const configuredApiBase = isLocalFrontendHost()
        ? config.localApiBase
        : config.productionApiBase;

    return normalizeApiBase(configuredApiBase || config.apiBase || (
        isLocalFrontendHost() ? "http://localhost:3000" : "https://backend-shopfood.onrender.com"
    ));
}

function showAuthMessage(message, isError = true) {
    const subtitle = document.querySelector("#authSubtitle");
    if (!subtitle) return;
    subtitle.textContent = message;
    subtitle.classList.remove("hidden");
    subtitle.classList.toggle("auth-error-message", isError);
}

function bindLoginFallback() {
    const form = document.querySelector("#loginForm");
    if (!form) return;

    const apiBaseInput = document.querySelector("#apiBaseInput");
    if (apiBaseInput && !apiBaseInput.value) {
        apiBaseInput.value = getFallbackApiBase();
    }

    form.addEventListener("submit", async (event) => {
        if (window.__foodifiMainReady) return;
        event.preventDefault();

        const button = document.querySelector("#authSubmitButton");
        const originalText = button?.textContent || "Đăng nhập";
        if (button) {
            button.disabled = true;
            button.textContent = "Đang xử lý...";
        }

        try {
            showAuthMessage("", false);
            const formData = new FormData(form);
            const apiBase = normalizeApiBase(formData.get("apiBase") || getFallbackApiBase());
            const response = await fetch(`${apiBase}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: String(formData.get("email") || "").trim(),
                    password: String(formData.get("password") || "")
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || "Không đăng nhập được. Vui lòng kiểm tra email và mật khẩu.");
            }

            const user = payload.user || payload.data?.user || null;
            const token = payload.token || payload.access_token || payload.data?.token || "";
            if (!token || !user || !["admin", "staff"].includes(user.role)) {
                throw new Error("Tài khoản không có quyền truy cập admin.");
            }

            localStorage.setItem("shopfood_admin_api_base", apiBase);
            localStorage.setItem("shopfood_admin_session", JSON.stringify({
                token,
                refreshToken: payload.refresh_token || payload.refreshToken || "",
                user
            }));
            showAuthMessage("Đăng nhập thành công. Đang mở trang quản trị...", false);
            window.location.reload();
        } catch (error) {
            if (error instanceof TypeError) {
                const apiBase = normalizeApiBase(new FormData(form).get("apiBase") || getFallbackApiBase());
                showAuthMessage(`Không kết nối được backend tại ${apiBase}. Hãy kiểm tra backend/CORS.`, true);
            } else {
                showAuthMessage(error.message || "Có lỗi xảy ra khi đăng nhập.", true);
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    });
}

bindLoginFallback();

try {
    await import("./js/main.js");
} catch (error) {
    console.error("Không khởi tạo được admin shell:", error);
    showAuthMessage("Giao diện quản trị chưa khởi tạo đầy đủ, nhưng bạn vẫn có thể thử đăng nhập.", true);
}
