import {
    SIDEBAR_MENU,
    apiFetch,
    elements,
    escapeHtml,
    saveSession,
    showToast,
    state
} from "./core.js";
import { renderProducts, updateProductWorkspace } from "./products.js";

function getMenuSection(sectionKey) {
    return SIDEBAR_MENU.find((section) => section.key === sectionKey) || null;
}

function getMenuItem(itemKey) {
    for (const section of SIDEBAR_MENU) {
        const item = section.items.find((entry) => entry.key === itemKey);
        if (item) {
            return { ...item, sectionKey: section.key };
        }
    }

    return null;
}

export function renderSidebarMenu() {
    elements.navCard.innerHTML = SIDEBAR_MENU.map((section) => {
        const isExpanded = Boolean(state.expandedSections[section.key]);
        const isActiveSection = state.sidebarSection === section.key;
        const hasItems = section.items.length > 0;

        return `
          <section class="nav-section ${isExpanded ? "open" : ""}">
            <button class="nav-section-trigger ${isActiveSection ? "active" : ""}" type="button" data-section-toggle="${section.key}" aria-expanded="${isExpanded}">
              <span class="nav-section-main">
                <span class="nav-icon">${escapeHtml(section.icon)}</span>
                <span>${escapeHtml(section.label)}</span>
              </span>
              ${hasItems ? `<span class="nav-chevron">${isExpanded ? "−" : "+"}</span>` : ""}
            </button>
            ${hasItems && isExpanded ? `
              <div class="nav-section-sublist">
                ${section.items.map((item) => `
                  <button class="nav-sublink ${state.sidebarItem === item.key ? "active" : ""}" type="button" data-nav-item="${item.key}">
                    <span class="nav-sublink-dot"></span>
                    <span>${escapeHtml(item.label)}</span>
                  </button>
                `).join("")}
              </div>
            ` : ""}
          </section>
        `;
    }).join("");
}

export function setActivePanel(view) {
    Object.entries(elements.panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === view);
        panel.classList.toggle("hidden", key !== view);
    });
}

export function updateSessionUi() {
    const isLoggedIn = Boolean(state.token && state.user);
    elements.sessionCard.classList.toggle("hidden", !isLoggedIn);
    elements.navCard.classList.toggle("hidden", !isLoggedIn);
    elements.appShell.classList.toggle("auth-screen", !isLoggedIn);
    elements.sessionName.textContent = isLoggedIn ? "Quản lý vườn" : "-";
    elements.sessionMeta.textContent = isLoggedIn ? state.user.email : "-";
}

export function toggleSidebarSection(sectionKey) {
    const section = getMenuSection(sectionKey);
    if (!section) return;

    state.expandedSections[sectionKey] = !state.expandedSections[sectionKey];
    renderSidebarMenu();
}

export function selectSidebarItem(itemKey) {
    const item = getMenuItem(itemKey);
    if (!item) return;

    state.sidebarSection = item.sectionKey;
    state.sidebarItem = item.key;
    state.expandedSections[item.sectionKey] = true;

    if (item.staticLink) {
        renderSidebarMenu();
        showToast("Mục này mình sẽ làm tiếp ở bước sau.");
        return;
    }

    if (item.workspace) {
        state.productWorkspace = item.workspace;
    }

    renderSidebarMenu();
    updateProductWorkspace();
    setActivePanel(item.panel || "overview");

    if (item.panel === "products") {
        renderProducts();
    }
}

export function jumpToView(view) {
    if (view === "products") {
        selectSidebarItem("product-catalog");
        return;
    }

    if (view === "categories") {
        selectSidebarItem("product-categories");
        return;
    }

    if (view === "orders") {
        selectSidebarItem("orders-all");
        return;
    }

    selectSidebarItem("overview-home");
}

export function setAuthMode(mode) {
    state.authMode = mode === "register" ? "register" : "login";
    const isRegister = state.authMode === "register";

    elements.authTabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.authMode === state.authMode);
    });

    elements.usernameField.classList.toggle("hidden", !isRegister);
    elements.confirmPasswordField.classList.toggle("hidden", !isRegister);
    elements.forgotPasswordButton.classList.toggle("hidden", isRegister);
    elements.usernameInput.required = isRegister;
    elements.confirmPasswordInput.required = isRegister;
    elements.authTitle.textContent = isRegister ? "Tạo tài khoản quản trị" : "Đăng nhập hệ thống";
    elements.authSubtitle.textContent = isRegister
        ? "Nhập thông tin để tạo tài khoản và bắt đầu quản lý cửa hàng."
        : "Vui lòng nhập thông tin để truy cập không gian quản trị.";
    elements.authSubmitButton.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
    elements.authFooterText.innerHTML = isRegister
        ? 'Đã có tài khoản? <button class="inline-link" id="authFooterSwitch" type="button">Đăng nhập ngay</button>'
        : 'Chưa có tài khoản? <button class="inline-link" id="authFooterSwitch" type="button">Đăng ký ngay</button>';
    elements.passwordInput.value = "";
    elements.confirmPasswordInput.value = "";
}

export async function login(email, password) {
    const payload = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    if (!payload?.token || !payload?.user) {
        throw new Error("Phản hồi đăng nhập không hợp lệ.");
    }

    if (!["admin", "staff"].includes(payload.user.role)) {
        throw new Error("Tài khoản này không có quyền truy cập admin.");
    }

    state.token = payload.token;
    state.refreshToken = payload.refresh_token || "";
    state.user = payload.user;
    saveSession();
    updateSessionUi();
}

export async function registerAccount(username, email, password) {
    await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
    });
}

export function logout(showMessage = true) {
    state.token = "";
    state.refreshToken = "";
    state.user = null;
    state.categories = [];
    state.products = [];
    state.orders = [];
    state.dashboard = null;
    saveSession();
    updateSessionUi();
    setActivePanel("login");
    if (showMessage) showToast("Đã đăng xuất.");
}
