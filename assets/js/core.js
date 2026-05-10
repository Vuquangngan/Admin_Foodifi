export const STORAGE_KEYS = {
    apiBase: "shopfood_admin_api_base",
    session: "shopfood_admin_session"
};

export const SIDEBAR_MENU = [
    {
        key: "overview",
        label: "Bảng điều khiển",
        icon: "▦",
        defaultExpanded: true,
        items: [
            { key: "overview-home", label: "Tổng quan", panel: "overview" }
        ]
    },
    {
        key: "products",
        label: "Sản phẩm",
        icon: "◫",
        defaultExpanded: true,
        items: [
            { key: "product-catalog", label: "Danh sách sản phẩm", panel: "products", workspace: "catalog" },
            { key: "product-import", label: "Nhập sản phẩm", panel: "products", workspace: "import" },
            { key: "product-inventory", label: "Kho hàng", panel: "products", workspace: "inventory" },
            { key: "product-publish", label: "Đưa sản phẩm lên sàn", panel: "products", workspace: "publish" },
            { key: "product-categories", label: "Danh mục sản phẩm", panel: "categories" }
        ]
    },
    {
        key: "orders",
        label: "Đơn hàng",
        icon: "◌",
        defaultExpanded: false,
        items: [
            { key: "orders-all", label: "Tất cả đơn hàng", panel: "orders" }
        ]
    },
    {
        key: "settings",
        label: "Cài đặt",
        icon: "⚙",
        defaultExpanded: false,
        items: [
            { key: "settings-general", label: "Thiết lập chung", staticLink: "settings" }
        ]
    }
];

export const PRODUCT_WORKSPACES = {
    catalog: {
        eyebrow: "Catalog",
        title: "Danh sách sản phẩm",
        description: "Quản lý toàn bộ sản phẩm, giá bán và thông tin hiển thị.",
        listTitle: "Danh sách sản phẩm",
        showFilter: true,
        showCreate: true,
        showImport: false
    },
    import: {
        eyebrow: "Inbound",
        title: "Nhập sản phẩm",
        description: "Tạo sản phẩm mới theo form nhập kho gọn, bỏ các trường hệ thống tự sinh.",
        listTitle: "Tồn kho hiện tại",
        showFilter: false,
        showCreate: false,
        showImport: true
    },
    inventory: {
        eyebrow: "",
        title: "Kho hàng",
        description: "Theo dõi tồn kho, SKU và mức sẵn sàng bán của từng sản phẩm.",
        listTitle: "Tổng quan tồn kho",
        showFilter: true,
        showCreate: false,
        showImport: false
    },
    publish: {
        eyebrow: "Marketplace",
        title: "Đưa sản phẩm lên sàn",
        description: "Kiểm soát sản phẩm nào đang publish và sản phẩm nào còn chờ lên sàn.",
        listTitle: "Trạng thái hiển thị sản phẩm",
        showFilter: true,
        showCreate: false,
        showImport: false
    }
};

export const WAREHOUSE_ZONES = [
    {
        key: "frozen",
        label: "Kho 1",
        name: "Đông lạnh",
        description: "Bảo quản thực phẩm cấp đông, hải sản và các mặt hàng cần nhiệt độ thấp.",
        icon: "❄",
        tone: "frozen",
        temperature: "-18°C",
        humidity: "45%"
    },
    {
        key: "fresh",
        label: "Kho 2",
        name: "Rau và trái cây",
        description: "Không gian dành cho rau củ tươi, trái cây và nông sản cần độ ẩm ổn định.",
        icon: "🍃",
        tone: "fresh",
        temperature: "8°C",
        humidity: "78%"
    },
    {
        key: "dry",
        label: "Kho 3",
        name: "Đồ khô",
        description: "Lưu trữ gia vị, thực phẩm khô và các mặt hàng đóng gói cần nơi thoáng mát.",
        icon: "📦",
        tone: "dry",
        temperature: "24°C",
        humidity: "38%"
    }
];

export const state = {
    apiBase: localStorage.getItem(STORAGE_KEYS.apiBase) || "http://localhost:3000",
    token: "",
    refreshToken: "",
    user: null,
    coupons: [],
    categories: [],
    products: [],
    productPagination: null,
    orders: [],
    dashboard: null,
    authMode: "login",
    overviewRangeDays: 30,
    overviewSearch: "",
    publishStatusFilter: "all",
    publishZoneFilter: "all",
    publishDrafts: {},
    inventoryZone: "frozen",
    inventorySearch: "",
    productImportImageDataUrl: "",
    sidebarSection: "overview",
    sidebarItem: "overview-home",
    productWorkspace: "catalog",
    expandedSections: Object.fromEntries(SIDEBAR_MENU.map((section) => [section.key, Boolean(section.defaultExpanded)])),
    filters: {
        products: {},
        orders: {}
    }
};

export const elements = {
    appShell: document.querySelector("#appShell"),
    toast: document.querySelector("#toast"),
    sessionCard: document.querySelector("#sessionCard"),
    sessionName: document.querySelector("#sessionName"),
    sessionMeta: document.querySelector("#sessionMeta"),
    navCard: document.querySelector("#navCard"),
    apiBaseInput: document.querySelector("#apiBaseInput"),
    loginForm: document.querySelector("#loginForm"),
    emailInput: document.querySelector("#emailInput"),
    passwordInput: document.querySelector("#passwordInput"),
    usernameField: document.querySelector("#usernameField"),
    usernameInput: document.querySelector("#usernameInput"),
    confirmPasswordField: document.querySelector("#confirmPasswordField"),
    confirmPasswordInput: document.querySelector("#confirmPasswordInput"),
    authTitle: document.querySelector("#authTitle"),
    authSubtitle: document.querySelector("#authSubtitle"),
    authSubmitButton: document.querySelector("#authSubmitButton"),
    authFooterText: document.querySelector("#authFooterText"),
    forgotPasswordButton: document.querySelector("#forgotPasswordButton"),
    authTabs: Array.from(document.querySelectorAll(".auth-tab")),
    logoutButton: document.querySelector("#logoutButton"),
    overviewContent: document.querySelector("#overviewContent"),
    productsPanelEyebrow: document.querySelector("#productsPanelEyebrow"),
    productsPanelTitle: document.querySelector("#productsPanelTitle"),
    productsPanelDescription: document.querySelector("#productsPanelDescription"),
    productFilterForm: document.querySelector("#productFilterForm"),
    productFilterCard: document.querySelector("#productFilterCard"),
    productForm: document.querySelector("#productForm"),
    productCreateCard: document.querySelector("#productCreateCard"),
    productFormTitle: document.querySelector("#productFormTitle"),
    resetProductFormButton: document.querySelector("#resetProductFormButton"),
    productFilterCategory: document.querySelector("#productFilterCategory"),
    productCategorySelect: document.querySelector("#productCategorySelect"),
    productImportCard: document.querySelector("#productImportCard"),
    productImportForm: document.querySelector("#productImportForm"),
    productImportCategory: document.querySelector("#productImportCategory"),
    productImportImageFile: document.querySelector("#productImportImageFile"),
    productImportImageUrl: document.querySelector("#productImportImageUrl"),
    productImportPreview: document.querySelector("#productImportPreview"),
    resetProductImportButton: document.querySelector("#resetProductImportButton"),
    productsListCard: document.querySelector("#productsListCard"),
    productsListTitle: document.querySelector("#productsListTitle"),
    productsContent: document.querySelector("#productsContent"),
    productsMeta: document.querySelector("#productsMeta"),
    publishEditorModal: document.querySelector("#publishEditorModal"),
    publishEditorForm: document.querySelector("#publishEditorForm"),
    publishEditorTitle: document.querySelector("#publishEditorTitle"),
    publishEditorSubmit: document.querySelector("#publishEditorSubmit"),
    closePublishEditorButton: document.querySelector("#closePublishEditorButton"),
    publishEditorCancelButton: document.querySelector("#publishEditorCancelButton"),
    publishEditorSku: document.querySelector("#publishEditorSku"),
    publishEditorName: document.querySelector("#publishEditorName"),
    publishEditorImage: document.querySelector("#publishEditorImage"),
    publishEditorStock: document.querySelector("#publishEditorStock"),
    publishEditorStockNote: document.querySelector("#publishEditorStockNote"),
    refreshProductsButton: document.querySelector("#refreshProductsButton"),
    categoryForm: document.querySelector("#categoryForm"),
    categoryFormTitle: document.querySelector("#categoryFormTitle"),
    categoryParentSelect: document.querySelector("#categoryParentSelect"),
    openCategoryModalButton: document.querySelector("#openCategoryModalButton"),
    closeCategoryModalButton: document.querySelector("#closeCategoryModalButton"),
    categoryModal: document.querySelector("#categoryModal"),
    categoryImageFile: document.querySelector("#categoryImageFile"),
    categoryImagePreview: document.querySelector("#categoryImagePreview"),
    categoryIconButtons: Array.from(document.querySelectorAll("[data-category-icon]")),
    categoriesSummary: document.querySelector("#categoriesSummary"),
    categoriesContent: document.querySelector("#categoriesContent"),
    categoriesMeta: document.querySelector("#categoriesMeta"),
    refreshCategoriesButton: document.querySelector("#refreshCategoriesButton"),
    orderFilterForm: document.querySelector("#orderFilterForm"),
    ordersContent: document.querySelector("#ordersContent"),
    ordersMeta: document.querySelector("#ordersMeta"),
    refreshOrdersButton: document.querySelector("#refreshOrdersButton"),
    panels: {
        login: document.querySelector("#loginPanel"),
        overview: document.querySelector("#overviewPanel"),
        products: document.querySelector("#productsPanel"),
        categories: document.querySelector("#categoriesPanel"),
        orders: document.querySelector("#ordersPanel")
    }
};

export function showToast(message, isError = false) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    elements.toast.style.background = isError ? "rgba(180, 55, 55, 0.94)" : "rgba(46, 32, 20, 0.92)";
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(() => elements.toast?.classList.add("hidden"), 3200);
}

export function normalizeApiBase(input) {
    return String(input || "").trim().replace(/\/+$/, "");
}

export function saveSession() {
    localStorage.setItem(STORAGE_KEYS.apiBase, state.apiBase);

    if (!state.token || !state.user) {
        localStorage.removeItem(STORAGE_KEYS.session);
        return;
    }

    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user
    }));
}

export function restoreSession() {
    if (elements.apiBaseInput) {
        elements.apiBaseInput.value = state.apiBase;
    }

    const rawSession = localStorage.getItem(STORAGE_KEYS.session);
    if (!rawSession) return;

    try {
        const parsed = JSON.parse(rawSession);
        state.token = parsed.token || "";
        state.refreshToken = parsed.refreshToken || "";
        state.user = parsed.user || null;
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.session);
    }
}

export function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

export function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function formatDate(value) {
    if (!value) return "Chưa có";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function statusPill(status, label) {
    return `<span class="status-pill ${escapeHtml(status || "")}">${escapeHtml(label || status || "-")}</span>`;
}

export function resolveMediaUrl(path, fallback = "") {
    const value = String(path || "").trim();
    if (!value) return fallback;

    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
        return value;
    }

    if (value.startsWith("/")) {
        return `${state.apiBase}${value}`;
    }

    return `${state.apiBase}/${value.replace(/^\/+/, "")}`;
}

export function getGrowthMeta(currentValue, previousValue) {
    const current = Number(currentValue || 0);
    const previous = Number(previousValue || 0);

    if (current === 0 && previous === 0) {
        return { value: "0.0%", tone: "neutral" };
    }

    if (previous === 0) {
        return { value: "+100.0%", tone: "positive" };
    }

    const diff = ((current - previous) / previous) * 100;
    return {
        value: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
        tone: diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral"
    };
}

export function startOfDay(date) {
    const clone = new Date(date);
    clone.setHours(0, 0, 0, 0);
    return clone;
}

export function addDays(date, days) {
    const clone = new Date(date);
    clone.setDate(clone.getDate() + days);
    return clone;
}

export function getOrderDate(order) {
    const value = order?.created_at || order?.updated_at;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildRevenueSeries(orders, days) {
    const today = startOfDay(new Date());
    const labels = [];
    const values = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const dayStart = addDays(today, -offset);
        const dayEnd = addDays(dayStart, 1);
        const total = orders.reduce((sum, order) => {
            const orderDate = getOrderDate(order);
            if (!orderDate || orderDate < dayStart || orderDate >= dayEnd) return sum;
            return sum + Number(order.total_amount || 0);
        }, 0);

        labels.push(new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(dayStart));
        values.push(total);
    }

    return { labels, values };
}

export function sumRevenueBetween(orders, startDate, endDate) {
    return orders.reduce((sum, order) => {
        const orderDate = getOrderDate(order);
        if (!orderDate || orderDate < startDate || orderDate >= endDate) return sum;
        return sum + Number(order.total_amount || 0);
    }, 0);
}

export function countOrdersBetween(orders, startDate, endDate) {
    return orders.filter((order) => {
        const orderDate = getOrderDate(order);
        return orderDate && orderDate >= startDate && orderDate < endDate;
    }).length;
}

export function countCustomersBetween(orders, startDate, endDate) {
    const customers = new Set();

    orders.forEach((order) => {
        const orderDate = getOrderDate(order);
        if (!orderDate || orderDate < startDate || orderDate >= endDate) return;
        const customerKey = order.user_id || order.customer_phone || order.customer_name || order.order_code;
        customers.add(String(customerKey));
    });

    return customers.size;
}

export function collectFormData(form) {
    return Object.fromEntries(new FormData(form).entries());
}

export function fillSelectOptions(select, items, { includeBlank = false, blankLabel = "Chọn" } = {}) {
    if (!select) return;

    const currentValue = select.value;
    const options = [];

    if (includeBlank) {
        options.push(`<option value="">${escapeHtml(blankLabel)}</option>`);
    }

    options.push(...items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`));
    select.innerHTML = options.join("");

    if (currentValue && Array.from(select.options).some((option) => option.value === currentValue)) {
        select.value = currentValue;
    }
}

export async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;

    if (!isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    if (state.token) {
        headers.set("Authorization", `Bearer ${state.token}`);
    }

    const response = await fetch(`${state.apiBase}${path}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof payload === "string" ? payload : payload?.message || "Yêu cầu thất bại.";
        throw new Error(message);
    }

    return payload;
}
