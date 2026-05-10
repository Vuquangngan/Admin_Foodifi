import { apiFetch, showToast, state } from "./core.js";
import { renderOverview } from "./overview.js";
import { renderProducts, syncProductCategorySelects } from "./products.js";
import { renderCategories, syncCategoryParentSelect } from "./categories.js";
import { renderOrders } from "./orders.js";

export async function loadCategories() {
    state.categories = await apiFetch("/api/categories");
    syncProductCategorySelects();
    syncCategoryParentSelect();
    renderCategories();
}

export async function loadCoupons() {
    state.coupons = await apiFetch("/api/coupons");
}

export async function loadProducts() {
    const params = new URLSearchParams();
    Object.entries(state.filters.products).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    params.set("limit", "100");

    const payload = await apiFetch(`/api/products?${params.toString()}`);
    state.products = payload.items || [];
    state.productPagination = payload.pagination || null;
    renderProducts();
}

export async function loadOrders() {
    const params = new URLSearchParams();
    Object.entries(state.filters.orders).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    state.orders = await apiFetch(`/api/orders?${params.toString()}`);
    renderOrders();
}

export async function loadOverview() {
    state.dashboard = await apiFetch("/api/dashboard/admin/overview");
    renderOverview();
}

export async function bootstrapAdmin() {
    await Promise.all([loadCoupons(), loadCategories(), loadProducts(), loadOrders()]);
    await loadOverview();
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
