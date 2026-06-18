import {
    SIDEBAR_MENU,
    apiFetch,
    elements,
    escapeHtml,
    recordActivityLog,
    resolveMediaUrl,
    saveSession,
    showToast,
    state
} from "./core.js";
import { renderProducts, updateProductWorkspace } from "./products.js";
import { renderRecipes } from "./recipes.js";
import { renderOrders } from "./orders.js";
import { renderSuppliers } from "./suppliers.js";
import { activateChatsPanel, deactivateChatsPanel, renderChats } from "./chats.js";
import { renderUsers } from "./users.js";
import { renderVouchers } from "./vouchers.js";
import { renderBranches } from "./branches.js";
import { renderStaffShiftWorkspace } from "./staff-shifts.js";
import { renderStats } from "./stats.js";
import { renderEmailMarketing } from "./email-marketing.js";
import { renderActivityHistory } from "./activity-history.js";
import { getVisibleSidebarMenu, renderSettings } from "./settings.js";
import { renderProfile } from "./profile.js";
import { renderAppIcon } from "./icons.js";

function getMenuSection(sectionKey) {
    return getVisibleSidebarMenu().find((section) => section.key === sectionKey) || null;
}

function getMenuItem(itemKey) {
    for (const section of getVisibleSidebarMenu()) {
        const item = section.items.find((entry) => entry.key === itemKey);
        if (item) {
            return { ...item, sectionKey: section.key };
        }
    }

    return null;
}

export function renderSidebarMenu() {
    elements.navCard.innerHTML = getVisibleSidebarMenu().map((section) => {
        const isExpanded = Boolean(state.expandedSections[section.key]);
        const isActiveSection = state.sidebarSection === section.key;
        const hasItems = section.items.length > 0;

        return `
          <section class="nav-section ${isExpanded ? "open" : ""}">
            <button class="nav-section-trigger ${isActiveSection ? "active" : ""}" type="button" data-section-toggle="${section.key}" aria-expanded="${isExpanded}">
              <span class="nav-section-main">
                <span class="nav-icon">${renderAppIcon(section.icon)}</span>
                <span>${escapeHtml(section.label)}</span>
              </span>
              ${hasItems ? `<span class="nav-chevron">${isExpanded ? "-" : "+"}</span>` : ""}
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

export function setAdminPageTitle(title) {
    if (!elements.adminPageTitle) return;
    const nextTitle = title || "Tổng quan";
    elements.adminPageTitle.textContent = nextTitle;
    if (elements.adminTopbarTitle) {
        elements.adminTopbarTitle.textContent = nextTitle;
    }
}

export function updateSessionUi() {
    const isLoggedIn = Boolean(state.token && state.user);
    elements.sessionCard.classList.toggle("hidden", !isLoggedIn);
    elements.navCard.classList.toggle("hidden", !isLoggedIn);
    elements.adminQuickbar?.classList.toggle("hidden", !isLoggedIn);
    elements.adminPageHeader?.classList.toggle("hidden", !isLoggedIn);
    elements.appShell.classList.toggle("auth-screen", !isLoggedIn);
    const displayName = state.user?.username || state.user?.full_name || state.user?.name || "Qu?n lý vu?n";
    elements.sessionName.textContent = isLoggedIn ? "Qu?n lý vu?n" : "-";
    elements.sessionMeta.textContent = isLoggedIn ? state.user.email : "-";
    if (elements.adminQuickName) {
        elements.adminQuickName.textContent = isLoggedIn ? displayName : "-";
    }
    if (elements.adminQuickRole) {
        elements.adminQuickRole.textContent = state.user?.role === "admin" ? "Qu?n tr? viên" : "Nhân viên";
    }
    if (elements.adminQuickAvatar && isLoggedIn) {
        const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='20' fill='%23e2f5e9'/%3E%3Ccircle cx='20' cy='16' r='6' fill='%230d7f42'/%3E%3Cpath d='M9 34c3-8 8-12 11-12s8 4 11 12' fill='%230d7f42'/%3E%3C/svg%3E";
        elements.adminQuickAvatar.src = resolveMediaUrl(state.user?.avatar_url, fallback);
    }
    if (!isLoggedIn) {
        elements.adminAccountDropdown?.classList.add("hidden");
        elements.adminAccountTrigger?.setAttribute("aria-expanded", "false");
        setAdminPageTitle("Ðang nh?p h? th?ng");
    }
}

export function toggleSidebarSection(sectionKey) {
    const section = getMenuSection(sectionKey);
    if (!section) return;

    if (!section.items?.length && section.staticLink) {
        showToast("S?p có.");
        return;
    }

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
        showToast("S?p có.");
        return;
    }

    if (item.panel === "products" && item.workspace) {
        state.productWorkspace = item.workspace;
    }

    if (item.panel === "recipes") {
        state.recipeWorkspace = item.workspace || "list";
    }

    if (item.panel === "orders") {
        state.orderWorkspace = item.workspace || "list";
    }

    if (item.panel === "users") {
        state.userWorkspace = item.workspace || "staff";
    }

    if (item.panel === "vouchers") {
        state.voucherWorkspace = item.workspace || "list";
    }

    if (item.panel === "branches") {
        state.branchWorkspace = item.workspace || "list";
    }

    if (item.panel === "settings") {
        state.settingsWorkspace = item.workspace || "general";
    }

    if (item.panel === "stats") {
        state.statsWorkspace = item.workspace || "inventory";
    }

    if (item.panel === "emailMarketing") {
        state.emailMarketingWorkspace = item.workspace || "campaign";
    }

    if (item.panel === "chats") {
        state.chatWorkspace = item.workspace || "inbox";
    }

    if (item.panel !== "chats" || state.chatWorkspace !== "inbox") {
        deactivateChatsPanel();
    }

    renderSidebarMenu();
    setAdminPageTitle(item.label);
    updateProductWorkspace();
    setActivePanel(item.panel || "overview");

    if (item.panel === "products") {
        renderProducts();
    }

    if (item.panel === "recipes") {
        renderRecipes();
    }

    if (item.panel === "orders") {
        renderOrders();
    }

    if (item.panel === "chats" && state.chatWorkspace === "inbox") {
        activateChatsPanel();
    } else if (item.panel === "chats") {
        renderChats();
    }

    if (item.panel === "suppliers") {
        state.supplierView = item.workspace || "list";
        renderSuppliers();
    }

    if (item.panel === "branches") {
        renderBranches();
    }

    if (item.panel === "users") {
        renderUsers();
    }

    if (item.panel === "profile") {
        renderProfile();
    }

    if (item.panel === "shifts") {
        renderStaffShiftWorkspace();
    }

    if (item.panel === "vouchers") {
        renderVouchers();
    }

    if (item.panel === "settings") {
        renderSettings();
    }

    if (item.panel === "stats") {
        renderStats();
    }

    if (item.panel === "emailMarketing") {
        renderEmailMarketing();
    }

    if (item.panel === "activityHistory") {
        renderActivityHistory();
    }
}

export function jumpToView(view) {
    if (view === "products") {
        selectSidebarItem("product-inventory");
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

    if (view === "chats") {
        selectSidebarItem("chats-inbox");
        return;
    }

    if (view === "suppliers") {
        selectSidebarItem("suppliers-list");
        return;
    }

    if (view === "users") {
        selectSidebarItem("users-manage");
        return;
    }

    if (view === "vouchers") {
        selectSidebarItem("vouchers-list");
        return;
    }

    selectSidebarItem("overview-home");
}

export function setAuthMode(mode) {
    const wantsRegister = mode === "register";
    if (wantsRegister) {
        showToast("B?n không có quy?n này", true);
    }

    state.authMode = "login";
    const isRegister = false;

    elements.authTabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.authMode === state.authMode);
    });

    elements.usernameField.classList.toggle("hidden", !isRegister);
    elements.confirmPasswordField.classList.toggle("hidden", !isRegister);
    elements.forgotPasswordButton.classList.toggle("hidden", isRegister);
    elements.usernameInput.required = isRegister;
    elements.confirmPasswordInput.required = isRegister;
    elements.authTitle.textContent = isRegister ? "T?o tài kho?n qu?n tr?" : "Ðang nh?p h? th?ng";
    elements.authSubtitle.textContent = "";
    elements.authSubtitle.classList.add("hidden");
    elements.authSubtitle.classList.remove("auth-error-message");
    elements.authSubmitButton.textContent = isRegister ? "Ðang ký" : "Ðang nh?p";
    elements.authFooterText.textContent = "";
    elements.authFooterText.classList.add("hidden");
    elements.passwordInput.value = "";
    elements.confirmPasswordInput.value = "";
}

export async function login(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const payload = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email: normalizedEmail,
            password: String(password || "")
        })
    });

    if (!payload?.token || !payload?.user) {
        throw new Error("Ph?n h?i dang nh?p không h?p l?.");
    }

    if (!["admin", "staff"].includes(payload.user.role)) {
        throw new Error("Tài kho?n này không có quy?n truy c?p admin.");
    }

    state.token = payload.token;
    state.refreshToken = payload.refresh_token || "";
    state.user = payload.user;
    recordActivityLog({
        id: `login-${Date.now()}`,
        action: "login",
        targetType: "H? th?ng",
        targetName: "Web Admin",
        detail: "Ðang nh?p web admin thành công",
        status: "success"
    });
    saveSession();
    updateSessionUi();
}

export async function registerAccount(username, email, password) {
    await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
            username: String(username || "").trim(),
            email: String(email || "").trim().toLowerCase(),
            password: String(password || "")
        })
    });
}

export function logout(showMessage = true) {
    state.token = "";
    state.refreshToken = "";
    state.user = null;
    state.chatConversations = [];
    state.chatMessages = [];
    state.chatCurrentConversationId = null;
    state.chatSearch = "";
    state.chatMessageDraft = "";
    state.categories = [];
    state.coupons = [];
    state.vouchers = [];
    state.users = [];
    state.customers = [];
    state.usersHydrated = false;
    state.customersHydrated = false;
    state.products = [];
    state.orders = [];
    state.orderWorkspace = "list";
    state.dashboard = null;
    deactivateChatsPanel();
    saveSession();
    updateSessionUi();
    setActivePanel("login");
    if (showMessage) showToast("Ðã dang xu?t.");
}




