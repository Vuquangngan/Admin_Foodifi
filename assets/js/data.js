import { apiFetch, elements, showToast, state } from "./core.js";
import { renderOverview } from "./overview.js";
import { renderProducts, syncProductCategorySelects } from "./products.js";
import { renderCategories, syncCategoryParentSelect } from "./categories.js";
import { renderChats } from "./chats.js";
import { renderOrders } from "./orders.js";
import { renderSuppliers, syncSupplierSelects } from "./suppliers.js";
import { renderUsers } from "./users.js";
import { renderVouchers } from "./vouchers.js";
import { renderStats } from "./stats.js";
import { renderEmailMarketing } from "./email-marketing.js";

async function runOptionalLoad(loader, fallback) {
    try {
        await loader();
        return true;
    } catch (error) {
        const message = error.message || "Có lỗi xảy ra.";
        if (elements.appShell?.classList.contains("auth-screen") && elements.authSubtitle) {
            elements.authSubtitle.textContent = message;
            elements.authSubtitle.classList.remove("hidden");
            elements.authSubtitle.classList.add("auth-error-message");
        }
        console.warn("Khong the tai du lieu admin:", error);
        fallback?.(error);
        return false;
    }
}

export async function loadCategories() {
    state.categories = await apiFetch("/api/categories");
    syncProductCategorySelects();
    syncCategoryParentSelect();
    renderCategories();
}

export async function loadCoupons() {
    state.coupons = await apiFetch("/api/coupons");
    state.vouchers = Array.isArray(state.coupons) ? [...state.coupons] : [];
    renderVouchers();
}

export async function loadProducts() {
    const params = new URLSearchParams();
    Object.entries(state.filters.products).forEach(([key, value]) => {
        if (key === "visibility") return;
        if (value) params.set(key, value);
    });
    params.set("limit", "1000");

    const payload = await apiFetch(`/api/products?${params.toString()}`);
    state.products = payload.items || [];
    state.productPagination = payload.pagination || null;
    renderProducts();
    renderCategories();
    if (state.sidebarSection === "stats") renderStats();
}

export async function loadSuppliers() {
    const params = new URLSearchParams();
    Object.entries(state.filters.suppliers).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    state.suppliers = await apiFetch(`/api/inventory/suppliers${params.toString() ? `?${params.toString()}` : ""}`);
    syncSupplierSelects();
    renderSuppliers();
}

export async function loadOrders() {
    const params = new URLSearchParams();
    Object.entries(state.filters.orders).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    state.orders = await apiFetch(`/api/orders?${params.toString()}`);
    renderOrders();
    if (state.sidebarSection === "stats") renderStats();
}

export async function loadOverview() {
    state.dashboard = await apiFetch("/api/dashboard/admin/overview");
    renderOverview();
}

export async function loadChats() {
    state.chatConversations = await apiFetch("/api/chat/conversations");
    renderChats();
}

export async function loadUsers() {
    const params = new URLSearchParams();
    Object.entries(state.filters.users).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    params.set("scope", "staff");

    state.users = await apiFetch(`/api/users${params.toString() ? `?${params.toString()}` : ""}`);
    state.usersHydrated = true;
    renderUsers();
}

export async function loadCustomers() {
    const params = new URLSearchParams();
    Object.entries(state.filters.customers).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    state.customers = await apiFetch(`/api/users/customers${params.toString() ? `?${params.toString()}` : ""}`);
    state.customersHydrated = true;
    renderUsers();
    if (state.sidebarItem === "email-campaign-create") renderEmailMarketing();
}

export async function bootstrapAdmin() {
    const overviewLoaded = await runOptionalLoad(loadOverview, () => {
        state.dashboard = null;
        renderOverview();
    });

    const backgroundLoads = [
        runOptionalLoad(loadCategories, () => {
            state.categories = [];
            syncProductCategorySelects();
            syncCategoryParentSelect();
            renderCategories();
        }),
        runOptionalLoad(loadProducts, () => {
            state.products = [];
            state.productPagination = null;
            renderProducts();
        }),
        runOptionalLoad(loadOrders, () => {
            state.orders = [];
            renderOrders();
        }),
        runOptionalLoad(loadCoupons),
        runOptionalLoad(loadSuppliers, () => {
            state.suppliers = [];
            syncSupplierSelects();
            renderSuppliers();
        }),
        runOptionalLoad(loadUsers, () => {
            state.users = [];
            state.usersHydrated = false;
            renderUsers();
        }),
        runOptionalLoad(loadCustomers, () => {
            state.customers = [];
            state.customersHydrated = false;
            renderUsers();
        }),
        runOptionalLoad(loadChats, () => {
            state.chatConversations = [];
            state.chatMessages = [];
            state.chatCurrentConversationId = null;
            renderChats();
        })
    ];

    Promise.all(backgroundLoads).catch((error) => {
        console.warn("Khong the tai nen du lieu admin:", error);
    });

    return overviewLoaded;
}

export async function withLoading(button, task) {
    const original = button?.textContent || "";
    if (button) {
        button.disabled = true;
        button.textContent = "Đang xử lý...";
    }

    try {
        await task();
    } catch (error) {
        showToast(error.message || "Có lỗi xảy ra.", true);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = original;
        }
    }
}
