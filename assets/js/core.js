export const STORAGE_KEYS = {
    apiBase: "shopfood_admin_api_base",
    session: "shopfood_admin_session",
    branches: "shopfood_admin_branches",
    warehouseCapacities: "shopfood_admin_warehouse_capacities",
    generalSettings: "shopfood_admin_general_settings",
    menuSettings: "shopfood_admin_menu_settings",
    emailCampaignDraft: "shopfood_admin_email_campaign_draft",
    promotionRules: "shopfood_admin_promotion_rules",
    branchImportRequests: "shopfood_admin_branch_import_requests",
    supplierReturns: "shopfood_admin_supplier_returns",
    productImportSuppliers: "shopfood_admin_product_import_suppliers",
    activityLogs: "garden_fresh_admin_activity_logs",
    activityWarningNotes: "garden_fresh_admin_activity_warning_notes",
    recipes: "garden_fresh_admin_recipes",
    recipeCategories: "garden_fresh_admin_recipe_categories"
};

const DEFAULT_LOCAL_API_BASE = "http://localhost:3000";
const DEFAULT_PRODUCTION_API_BASE = "https://backend-shopfood.onrender.com";

function isLocalFrontendHost() {
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
}

function getRuntimeApiBase() {
    const config = window.SHOPFOOD_ADMIN_CONFIG || {};
    const configuredApiBase = isLocalFrontendHost()
        ? config.localApiBase
        : config.productionApiBase;

    return normalizeApiBase(configuredApiBase || config.apiBase || (
        isLocalFrontendHost() ? DEFAULT_LOCAL_API_BASE : DEFAULT_PRODUCTION_API_BASE
    ));
}

export const VOUCHER_META_PREFIX = "[[VOUCHER_META]]";

export const SIDEBAR_MENU = [
    {
        key: "overview",
        label: "Bảng điều khiển",
        icon: "grid",
        defaultExpanded: true,
        items: [
            { key: "overview-home", label: "Tổng quan", panel: "overview" }
        ]
    },
    {
        key: "products",
        label: "Sản phẩm",
        icon: "package",
        defaultExpanded: false,
        items: [
            { key: "product-import", label: "Nhập sản phẩm", panel: "products", workspace: "import" },
            { key: "product-inventory", label: "Kho hàng", panel: "products", workspace: "inventory" },
            { key: "product-low-stock", label: "Sản phẩm sắp hết", panel: "products", workspace: "lowStock" },
            { key: "branches-shipments", label: "Gửi hàng cho chi nhánh", panel: "branches", workspace: "shipments" },
            { key: "product-categories", label: "Danh mục sản phẩm", panel: "categories" }
        ]
    },
    {
        key: "recipes",
        label: "Công thức nấu ăn",
        icon: "book",
        defaultExpanded: false,
        items: [
            { key: "recipes-list", label: "Danh sách công thức", panel: "recipes", workspace: "list" },
            { key: "recipe-categories", label: "Danh mục công thức", panel: "recipes", workspace: "categories" }
        ]
    },
    {
        key: "chats",
        label: "Tin nhắn",
        icon: "chat",
        defaultExpanded: false,
        items: [
            { key: "chats-inbox", label: "Hội thoại khách hàng", panel: "chats", workspace: "inbox" },
            { key: "chats-ai-support", label: "Hỏi đáp AI", panel: "chats", workspace: "aiSupport" }
        ]
    },
    {
        key: "users",
        label: "Tài khoản",
        icon: "user",
        defaultExpanded: false,
        items: [
            { key: "users-manage", label: "Admin và nhân viên", panel: "users", workspace: "staff" },
            { key: "users-customers", label: "Khách hàng", panel: "users", workspace: "customers" }
        ]
    },
    {
        key: "shifts",
        label: "Lịch ca làm việc",
        icon: "calendar",
        defaultExpanded: false,
        items: [
            { key: "shifts-calendar", label: "Quản lý lịch ca", panel: "shifts" }
        ]
    },
    {
        key: "suppliers",
        label: "Nhà cung cấp",
        icon: "basket",
        defaultExpanded: false,
        items: [
            { key: "suppliers-list", label: "Danh sách nhà cung cấp", panel: "suppliers", workspace: "list" },
            { key: "supplier-returns", label: "Hoàn trả hàng", panel: "suppliers", workspace: "returns" }
        ]
    },
    {
        key: "branches",
        label: "Chi nhánh",
        icon: "store",
        defaultExpanded: false,
        items: [
            { key: "branches-list", label: "Quản lý chi nhánh", panel: "branches", workspace: "list" },
            { key: "product-publish", label: "Kho chi nhánh", panel: "products", workspace: "publish" },
            { key: "branches-import-requests", label: "Yêu cầu nhập hàng", panel: "branches", workspace: "importRequests" }
        ]
    },
    {
        key: "vouchers",
        label: "Quảng bá và Khuyến mãi",
        icon: "megaphone",
        defaultExpanded: false,
        items: [
            { key: "promotions", label: "Khuyến mãi", panel: "vouchers", workspace: "promotions" },
            { key: "vouchers-list", label: "Voucher", panel: "vouchers", workspace: "list" },
            { key: "email-campaign-create", label: "Tạo chiến dịch Email", panel: "emailMarketing", workspace: "campaign" }
        ]
    },
    {
        key: "orders",
        label: "Đơn hàng",
        icon: "cart",
        defaultExpanded: false,
        items: [
            { key: "orders-all", label: "Tất cả đơn hàng", panel: "orders", workspace: "list" },
            { key: "orders-complaints", label: "Khiếu nại", panel: "orders", workspace: "complaints" },
            { key: "orders-create", label: "Tạo đơn hàng", panel: "orders", workspace: "create" }
        ]
    },
    {
        key: "stats",
        label: "Thống kê",
        icon: "chart",
        defaultExpanded: false,
        items: [
            { key: "stats-inventory", label: "Thống kê kho hàng", panel: "stats", workspace: "inventory" },
            { key: "stats-revenue", label: "Thống kê doanh thu", panel: "stats", workspace: "revenue" },
            { key: "stats-orders", label: "Thống kê đơn hàng", panel: "stats", workspace: "orders" }
        ]
    },
    {
        key: "settings",
        label: "Cài đặt",
        icon: "settings",
        defaultExpanded: false,
        items: [
            { key: "settings-general", label: "Thiết lập chung", panel: "settings", workspace: "general" },
            { key: "settings-menus", label: "Menu chức năng", panel: "settings", workspace: "menus" },
            { key: "activity-history", label: "Lịch sử thao tác", panel: "activityHistory" }
        ]
    }
];

export const PRODUCT_WORKSPACES = {
    catalog: {
        eyebrow: "Catalog",
        title: "Danh sách sản phẩm",
        description: "",
        listTitle: "Danh sách sản phẩm",
        showFilter: true,
        showCreate: true,
        showImport: false
    },
    import: {
        eyebrow: "",
        title: "Nhập sản phẩm",
        listTitle: "Tồn kho hiện tại",
        showFilter: false,
        showCreate: false,
        showImport: true
    },
    inventory: {
        eyebrow: "",
        title: "Kho hàng",
        description: "",
        listTitle: "",
        showFilter: true,
        showCreate: false,
        showImport: false
    },
    lowStock: {
        eyebrow: "",
        title: "Sản phẩm sắp hết",
        description: "",
        listTitle: "",
        showFilter: false,
        showCreate: false,
        showImport: false
    },
    publish: {
        eyebrow: "Chi nhánh",
        title: "Kho chi nhánh",
        description: "",
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
        icon: "package",
        tone: "frozen",
        temperature: "-18°C",
        humidity: "45%"
    },
    {
        key: "fresh",
        label: "Kho 2",
        name: "Rau và trái cây",
        description: "Không gian dành cho rau củ tươi, trái cây và nông sản cần độ ẩm ổn định.",
        icon: "basket",
        tone: "fresh",
        temperature: "8°C",
        humidity: "78%"
    },
    {
        key: "dry",
        label: "Kho 3",
        name: "Đồ khô",
        description: "Lưu trữ gia vị, thực phẩm khô và các mặt hàng đóng gói cần nơi thoáng mát.",
        icon: "receipt",
        tone: "dry",
        temperature: "24°C",
        humidity: "38%"
    }
];

const DEFAULT_STORE_BRANCHES = [
    {
        key: "store_1",
        code: "CN-001",
        label: "Garden Fresh 1",
        name: "Garden Fresh 1",
        manager: "Trần Văn Lý",
        phone: "0906572167",
        city: "Hà Nội",
        address: "113 Cầu Giấy, Quận Cầu Giấy, Hà Nội",
        image_url: "",
        status: "active"
    },
    {
        key: "store_2",
        code: "CN-002",
        label: "Garden Fresh 2",
        name: "Garden Fresh 2",
        manager: "Vũ Quang Ngân",
        phone: "0916837759",
        city: "Hà Nội",
        address: "80 Trần Phú, Quận Hà Đông, Hà Nội",
        image_url: "",
        status: "active"
    },
    {
        key: "store_3",
        code: "CN-003",
        label: "Garden Fresh 3",
        name: "Garden Fresh 3",
        manager: "",
        phone: "",
        city: "Hà Nội",
        address: "",
        image_url: "",
        status: "active"
    }
];

function loadStoreBranches() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.branches) || "[]");
        if (Array.isArray(parsed) && parsed.length) {
            return parsed.map((branch, index) => ({
                key: String(branch.key || `store_${index + 1}`),
                code: String(branch.code || `CN-${String(index + 1).padStart(3, "0")}`),
                label: String(branch.label || `Cửa hàng ${index + 1}`),
                name: String(branch.name || branch.label || `Chi nhánh ${index + 1}`),
                manager: String(branch.manager || ""),
                phone: String(branch.phone || ""),
                city: String(branch.city || ""),
                address: String(branch.address || ""),
                image_url: String(branch.image_url || ""),
                status: String(branch.status || "active")
            }));
        }
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.branches);
    }

    return DEFAULT_STORE_BRANCHES.map((branch) => ({ ...branch, manager: "", phone: "", city: "", address: "", image_url: "", status: "active" }));
}

export const STORE_BRANCHES = loadStoreBranches();

export function saveStoreBranches() {
    localStorage.setItem(STORAGE_KEYS.branches, JSON.stringify(STORE_BRANCHES));
}

function loadWarehouseCapacities() {
    const defaults = { frozen: 35, fresh: 35, dry: 35 };
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.warehouseCapacities) || "{}");
        return Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
            const nextValue = Number(parsed?.[key]);
            return [key, Number.isFinite(nextValue) && nextValue > 0 ? nextValue : value];
        }));
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.warehouseCapacities);
        return defaults;
    }
}

export function saveWarehouseCapacities(capacities) {
    localStorage.setItem(STORAGE_KEYS.warehouseCapacities, JSON.stringify(capacities));
}

function loadActivityLogs() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.activityLogs) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.activityLogs);
        return [];
    }
}

function loadActivityWarningNotes() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.activityWarningNotes) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.activityWarningNotes);
        return {};
    }
}

export const state = {
    apiBase: getRuntimeApiBase(),
    token: "",
    refreshToken: "",
    user: null,
    coupons: [],
    vouchers: [],
    promotionRules: [],
    users: [],
    customers: [],
    usersHydrated: false,
    customersHydrated: false,
    categories: [],
    products: [],
    suppliers: [],
    branchImageDataUrl: "",
    productPagination: null,
    orders: [],
    orderQuickFilter: "all",
    orderWorkspace: "list",
    statsWorkspace: "inventory",
    emailMarketingWorkspace: "campaign",
    emailCampaignDraft: null,
    complaintFilters: {
        order_code: "",
        status: ""
    },
    currentOrderDetail: null,
    currentComplaintDetail: null,
    dashboard: null,
    authMode: "login",
    overviewRangeDays: 30,
    overviewSearch: "",
    publishStatusFilter: "all",
    publishZoneFilter: "all",
    publishStoreFilter: "store_1",
    publishDrafts: {},
    chatConversations: [],
    chatMessages: [],
    chatCurrentConversationId: null,
    chatStatusFilter: "open",
    chatSearch: "",
    chatMessageDraft: "",
    chatWorkspace: "inbox",
    aiSupportDraft: "",
    aiSupportMessages: [],
    aiSupportSending: false,
    inventoryZone: "frozen",
    inventorySearch: "",
    productImportSourceId: "",
    productImportExcelRows: [],
    recipes: [],
    recipesHydrated: false,
    recipeCategories: [],
    recipeCategoriesHydrated: false,
    recipeWorkspace: "list",
    recipeFilters: {
        keyword: "",
        category: "all"
    },
    recipeCategoryFilters: {
        keyword: ""
    },
    recipeEditingId: "",
    recipeCategoryEditingId: "",
    recipeImageDataUrl: "",
    recipeCategoryImageDataUrl: "",
    lowStockFilters: {
        keyword: "",
        parent_category_id: "",
        category_id: "",
        zone: "all",
        status: "all"
    },
    warehouseCapacities: loadWarehouseCapacities(),
    warehouseCapacityEditorZone: null,
    productImportImageDataUrl: "",
    supplierView: "list",
    supplierReturnFilters: {
        keyword: "",
        supplier: "",
        until: ""
    },
    supplierReturnModalProductId: "",
    branchSearch: "",
    branchStatusFilter: "all",
    branchWorkspace: "list",
    branchImportBranchKey: "",
    branchImportDraftItems: [],
    branchImportNote: "",
    branchImportExpectedDate: "",
    branchShipmentStatusFilter: "all",
    branchShipmentBranchFilter: "all",
    branchShipmentKeyword: "",
    branchShipmentDetailId: "",
    voucherWorkspace: "list",
    userAdminPage: 1,
    customerAdminPage: 1,
    activityHistoryPage: 1,
    activityHistoryFilters: {
        keyword: "",
        from: "",
        to: "",
        role: "all",
        action: "all"
    },
    activityWarningOpenId: "",
    activityWarningEditingId: "",
    activityWarningNotes: loadActivityWarningNotes(),
    activityLogs: loadActivityLogs(),
    sidebarSection: "overview",
    sidebarItem: "overview-home",
    productWorkspace: "inventory",
    userWorkspace: "staff",
    settingsWorkspace: "general",
    expandedSections: Object.fromEntries(SIDEBAR_MENU.map((section) => [section.key, Boolean(section.defaultExpanded)])),
    filters: {
        products: {},
        orders: {},
        suppliers: {},
        vouchers: {},
        users: {},
        customers: {},
        categories: {},
        settingsMenus: {}
    }
};

export const elements = {
    appShell: document.querySelector("#appShell"),
    toast: document.querySelector("#toast"),
    adminQuickbar: document.querySelector("#adminQuickbar"),
    adminNotificationButton: document.querySelector("#adminNotificationButton"),
    adminNotificationBadge: document.querySelector("#adminNotificationBadge"),
    adminAccountMenu: document.querySelector("#adminAccountMenu"),
    adminAccountTrigger: document.querySelector("#adminAccountTrigger"),
    adminAccountDropdown: document.querySelector("#adminAccountDropdown"),
    adminQuickAvatar: document.querySelector("#adminQuickAvatar"),
    adminQuickName: document.querySelector("#adminQuickName"),
    adminPageHeader: document.querySelector("#adminPageHeader"),
    adminPageTitle: document.querySelector("#adminPageTitle"),
    adminPageContent: document.querySelector("#adminPageContent"),
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
    publishBranchCard: document.querySelector("#publishBranchCard"),
    publishBranchName: document.querySelector("#publishBranchName"),
    publishBranchCount: document.querySelector("#publishBranchCount"),
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
    productImportSupplierSelect: document.querySelector("#productImportSupplierSelect"),
    productImportImageFile: document.querySelector("#productImportImageFile"),
    productImportImageUrl: document.querySelector("#productImportImageUrl"),
    productImportPreview: document.querySelector("#productImportPreview"),
    productImportExcelFile: document.querySelector("#productImportExcelFile"),
    productImportExcelResult: document.querySelector("#productImportExcelResult"),
    submitProductImportExcelButton: document.querySelector("#submitProductImportExcelButton"),
    downloadProductImportTemplateButton: document.querySelector("#downloadProductImportTemplateButton"),
    resetProductImportButton: document.querySelector("#resetProductImportButton"),
    productsListCard: document.querySelector("#productsListCard"),
    productsListTitle: document.querySelector("#productsListTitle"),
    productsContent: document.querySelector("#productsContent"),
    productsMeta: document.querySelector("#productsMeta"),
    recipesContent: document.querySelector("#recipesContent"),
    recipesMeta: document.querySelector("#recipesMeta"),
    recipesPanelTitle: document.querySelector("#recipesPanelTitle"),
    recipesPanelDescription: document.querySelector("#recipesPanelDescription"),
    recipeSearchInput: document.querySelector("#recipeSearchInput"),
    recipeCategoryFilter: document.querySelector("#recipeCategoryFilter"),
    openRecipeModalButton: document.querySelector("#openRecipeModalButton"),
    recipeCategorySummary: document.querySelector("#recipeCategorySummary"),
    recipeModal: document.querySelector("#recipeModal"),
    recipeForm: document.querySelector("#recipeForm"),
    recipeModalTitle: document.querySelector("#recipeModalTitle"),
    recipeImageFile: document.querySelector("#recipeImageFile"),
    recipeImageUrl: document.querySelector("#recipeImageUrl"),
    recipeImagePreview: document.querySelector("#recipeImagePreview"),
    recipeIngredients: document.querySelector("#recipeIngredients"),
    recipeSteps: document.querySelector("#recipeSteps"),
    closeRecipeModalButton: document.querySelector("#closeRecipeModalButton"),
    cancelRecipeButton: document.querySelector("#cancelRecipeButton"),
    recipeCategoryModal: document.querySelector("#recipeCategoryModal"),
    recipeCategoryForm: document.querySelector("#recipeCategoryForm"),
    recipeCategoryModalTitle: document.querySelector("#recipeCategoryModalTitle"),
    recipeCategoryImageFile: document.querySelector("#recipeCategoryImageFile"),
    recipeCategoryImageUrl: document.querySelector("#recipeCategoryImageUrl"),
    recipeCategoryImagePreview: document.querySelector("#recipeCategoryImagePreview"),
    closeRecipeCategoryModalButton: document.querySelector("#closeRecipeCategoryModalButton"),
    cancelRecipeCategoryButton: document.querySelector("#cancelRecipeCategoryButton"),
    chatsContent: document.querySelector("#chatsContent"),
    refreshUsersButton: document.querySelector("#refreshUsersButton"),
    userFilterForm: document.querySelector("#userFilterForm"),
    usersToolbarCard: document.querySelector("#usersToolbarCard"),
    usersPanelTitle: document.querySelector("#usersPanelTitle"),
    usersPanelCopy: document.querySelector("#usersPanelCopy"),
    usersListTitle: document.querySelector("#usersListTitle"),
    usersContent: document.querySelector("#usersContent"),
    usersMeta: document.querySelector("#usersMeta"),
    shiftsContent: document.querySelector("#shiftsContent"),
    refreshShiftsButton: document.querySelector("#refreshShiftsButton"),
    statsContent: document.querySelector("#statsContent"),
    emailMarketingContent: document.querySelector("#emailMarketingContent"),
    openUserFormButton: document.querySelector("#openUserFormButton"),
    userFormModal: document.querySelector("#userFormModal"),
    userForm: document.querySelector("#userForm"),
    userFormTitle: document.querySelector("#userFormTitle"),
    userFormSubtitle: document.querySelector("#userFormSubtitle"),
    userFormSubmitButton: document.querySelector("#userFormSubmitButton"),
    cancelUserFormButton: document.querySelector("#cancelUserFormButton"),
    resetUserFormButton: document.querySelector("#resetUserFormButton"),
    userAvatarFile: document.querySelector("#userAvatarFile"),
    userAvatarPreview: document.querySelector("#userAvatarPreview"),
    userAvatarPlaceholder: document.querySelector("#userAvatarPlaceholder"),
    userAvatarTrigger: document.querySelector("#userAvatarTrigger"),
    userAvatarEditButton: document.querySelector("#userAvatarEditButton"),
    customerProfileModal: document.querySelector("#customerProfileModal"),
    customerProfileTitle: document.querySelector("#customerProfileTitle"),
    customerProfileSubtitle: document.querySelector("#customerProfileSubtitle"),
    customerProfileContent: document.querySelector("#customerProfileContent"),
    closeCustomerProfileButton: document.querySelector("#closeCustomerProfileButton"),
    productEditorModal: document.querySelector("#productEditorModal"),
    productEditorForm: document.querySelector("#productEditorForm"),
    productEditorTitle: document.querySelector("#productEditorTitle"),
    productEditorCategorySelect: document.querySelector("#productEditorCategorySelect"),
    closeProductEditorButton: document.querySelector("#closeProductEditorButton"),
    resetProductEditorButton: document.querySelector("#resetProductEditorButton"),
    productEditorSubmitButton: document.querySelector("#productEditorSubmitButton"),
    productEditorImageFile: document.querySelector("#productEditorImageFile"),
    productEditorPreviewImage: document.querySelector("#productEditorPreviewImage"),
    productEditorPreviewName: document.querySelector("#productEditorPreviewName"),
    productEditorPreviewSku: document.querySelector("#productEditorPreviewSku"),
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
    suppliersPanel: document.querySelector("#suppliersPanel"),
    supplierFilterCard: document.querySelector("#supplierFilterCard"),
    supplierFilterForm: document.querySelector("#supplierFilterForm"),
    supplierListCard: document.querySelector("#supplierListCard"),
    suppliersContent: document.querySelector("#suppliersContent"),
    suppliersSummary: document.querySelector("#suppliersSummary"),
    suppliersMeta: document.querySelector("#suppliersMeta"),
    refreshSuppliersButton: document.querySelector("#refreshSuppliersButton"),
    openSupplierFormButton: document.querySelector("#openSupplierFormButton"),
    supplierFormCard: document.querySelector("#supplierFormCard"),
    supplierForm: document.querySelector("#supplierForm"),
    supplierFormTitle: document.querySelector("#supplierFormTitle"),
    supplierFormSubmitButton: document.querySelector("#supplierFormSubmitButton"),
    cancelSupplierFormButton: document.querySelector("#cancelSupplierFormButton"),
    supplierLogoFile: document.querySelector("#supplierLogoFile"),
    supplierLogoPreview: document.querySelector("#supplierLogoPreview"),
    branchesPanel: document.querySelector("#branchesPanel"),
    branchesContent: document.querySelector("#branchesContent"),
    branchesMeta: document.querySelector("#branchesMeta"),
    openBranchFormButton: document.querySelector("#openBranchFormButton"),
    branchModal: document.querySelector("#branchModal"),
    branchForm: document.querySelector("#branchForm"),
    branchImageInput: document.querySelector("#branchImageInput"),
    branchImagePreview: document.querySelector("#branchImagePreview"),
    closeBranchModalButton: document.querySelector("#closeBranchModalButton"),
    cancelBranchFormButton: document.querySelector("#cancelBranchFormButton"),
    voucherPanel: document.querySelector("#vouchersPanel"),
    voucherFilterForm: document.querySelector("#voucherFilterForm"),
    refreshVouchersButton: document.querySelector("#refreshVouchersButton"),
    vouchersSummary: document.querySelector("#vouchersSummary"),
    vouchersMeta: document.querySelector("#vouchersMeta"),
    vouchersContent: document.querySelector("#vouchersContent"),
    voucherListView: document.querySelector("#voucherListView"),
    promotionBuilderView: document.querySelector("#promotionBuilderView"),
    promotionFormView: document.querySelector("#promotionFormView"),
    promotionForm: document.querySelector("#promotionForm"),
    promotionRulesList: document.querySelector("#promotionRulesList"),
    promotionCampaignList: document.querySelector("#promotionCampaignList"),
    promotionStatusFilter: document.querySelector("#promotionStatusFilter"),
    promotionTypeFilter: document.querySelector("#promotionTypeFilter"),
    promotionSearchInput: document.querySelector("#promotionSearchInput"),
    promotionProductsList: document.querySelector("#promotionProductsList"),
    promotionPreviewTitle: document.querySelector("#promotionPreviewTitle"),
    promotionPreviewType: document.querySelector("#promotionPreviewType"),
    promotionPreviewSchedule: document.querySelector("#promotionPreviewSchedule"),
    promotionPreviewAudience: document.querySelector("#promotionPreviewAudience"),
    promotionPreviewScope: document.querySelector("#promotionPreviewScope"),
    voucherFormView: document.querySelector("#voucherFormView"),
    openVoucherFormButton: document.querySelector("#openVoucherFormButton"),
    voucherForm: document.querySelector("#voucherForm"),
    voucherFormTitle: document.querySelector("#voucherFormTitle"),
    voucherFormSubmitButton: document.querySelector("#voucherFormSubmitButton"),
    cancelVoucherFormButton: document.querySelector("#cancelVoucherFormButton"),
    voucherCodeInput: document.querySelector("#voucherCodeInput"),
    voucherCodeAutoButton: document.querySelector("#voucherCodeAutoButton"),
    voucherAudienceButtons: Array.from(document.querySelectorAll("[data-voucher-audience]")),
    voucherPreviewBadge: document.querySelector("#voucherPreviewBadge"),
    voucherPreviewTitle: document.querySelector("#voucherPreviewTitle"),
    voucherPreviewCode: document.querySelector("#voucherPreviewCode"),
    voucherPreviewDiscount: document.querySelector("#voucherPreviewDiscount"),
    voucherPreviewMaxDiscount: document.querySelector("#voucherPreviewMaxDiscount"),
    voucherPreviewMinOrder: document.querySelector("#voucherPreviewMinOrder"),
    voucherPreviewScope: document.querySelector("#voucherPreviewScope"),
    voucherAppliedProductsList: document.querySelector("#voucherAppliedProductsList"),
    orderFilterForm: document.querySelector("#orderFilterForm"),
    orderFilterCard: document.querySelector("#orderFilterCard"),
    ordersContent: document.querySelector("#ordersContent"),
    ordersMeta: document.querySelector("#ordersMeta"),
    orderListCard: document.querySelector("#orderListCard"),
    orderCreateCard: document.querySelector("#orderCreateCard"),
    orderCreateContent: document.querySelector("#orderCreateContent"),
    orderComplaintsCard: document.querySelector("#orderComplaintsCard"),
    complaintsContent: document.querySelector("#complaintsContent"),
    complaintsMeta: document.querySelector("#complaintsMeta"),
    refreshOrdersButton: document.querySelector("#refreshOrdersButton"),
    orderDetailModal: document.querySelector("#orderDetailModal"),
    closeOrderDetailButton: document.querySelector("#closeOrderDetailButton"),
    orderDetailContent: document.querySelector("#orderDetailContent"),
    orderDetailTitle: document.querySelector("#orderDetailTitle"),
    orderInvoicePrintButton: document.querySelector("#orderInvoicePrintButton"),
    orderInvoiceExportButton: document.querySelector("#orderInvoiceExportButton"),
    complaintDetailModal: document.querySelector("#complaintDetailModal"),
    closeComplaintDetailButton: document.querySelector("#closeComplaintDetailButton"),
    complaintDetailTitle: document.querySelector("#complaintDetailTitle"),
    complaintDetailContent: document.querySelector("#complaintDetailContent"),
    activityHistoryContent: document.querySelector("#activityHistoryContent"),
    activityHistoryMeta: document.querySelector("#activityHistoryMeta"),
    activitySearchInput: document.querySelector("#activitySearchInput"),
    activityDateFrom: document.querySelector("#activityDateFrom"),
    activityDateTo: document.querySelector("#activityDateTo"),
    activityRoleFilter: document.querySelector("#activityRoleFilter"),
    activityActionTabs: document.querySelector("#activityActionTabs"),
    activityExportButton: document.querySelector("#activityExportButton"),
    activityWarningModal: document.querySelector("#activityWarningModal"),
    activityWarningForm: document.querySelector("#activityWarningForm"),
    activityWarningTarget: document.querySelector("#activityWarningTarget"),
    closeActivityWarningButton: document.querySelector("#closeActivityWarningButton"),
    clearActivityWarningButton: document.querySelector("#clearActivityWarningButton"),
    profileContent: document.querySelector("#profileContent"),
    panels: {
        login: document.querySelector("#loginPanel"),
        overview: document.querySelector("#overviewPanel"),
        products: document.querySelector("#productsPanel"),
        recipes: document.querySelector("#recipesPanel"),
        chats: document.querySelector("#chatsPanel"),
        users: document.querySelector("#usersPanel"),
        profile: document.querySelector("#profilePanel"),
        shifts: document.querySelector("#shiftsPanel"),
        stats: document.querySelector("#statsPanel"),
        emailMarketing: document.querySelector("#emailMarketingPanel"),
        categories: document.querySelector("#categoriesPanel"),
        suppliers: document.querySelector("#suppliersPanel"),
        branches: document.querySelector("#branchesPanel"),
        vouchers: document.querySelector("#vouchersPanel"),
        orders: document.querySelector("#ordersPanel"),
        activityHistory: document.querySelector("#activityHistoryPanel"),
        settings: document.querySelector("#settingsPanel")
    }
};

export function showToast(message, isError = false) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    elements.toast.style.background = isError ? "#f9d8d5" : "#dff1d8";
    elements.toast.style.color = isError ? "#7c2525" : "#111b14";
    elements.toast.style.zIndex = "10000";
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
    const savedApiBase = normalizeApiBase(localStorage.getItem(STORAGE_KEYS.apiBase) || "");
    state.apiBase = savedApiBase || getRuntimeApiBase();

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

export async function refreshStoredSession() {
    if (!state.refreshToken) return false;

    let response;
    try {
        response = await fetch(`${state.apiBase}/api/auth/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                refresh_token: state.refreshToken
            })
        });
    } catch (_error) {
        const error = new Error(`Không kết nối được backend tại ${state.apiBase}.`);
        error.isNetworkError = true;
        throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof payload === "string" ? payload : payload?.message || "Không thể làm mới phiên đăng nhập.";
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    const nextToken = payload?.token || payload?.access_token || "";
    if (!nextToken) return false;

    state.token = nextToken;
    state.refreshToken = payload.refresh_token || state.refreshToken;
    if (payload.user) {
        state.user = payload.user;
    }
    saveSession();
    return true;
}

export function formatCurrency(value) {
    const rounded = Math.round(Number(value || 0));
    return `${new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 0
    }).format(rounded)} đ`;
}

const MONEY_FIELD_NAMES = new Set([
    "price",
    "sale_price",
    "retail_price",
    "import_cost",
    "shipping_fee",
    "discount_value",
    "min_order_value",
    "max_discount_value"
]);

export function parseMoneyInputValue(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue) return "";

    const dotParts = rawValue.split(".");
    if (
        dotParts.length === 2
        && /^\d+$/.test(dotParts[0])
        && /^\d{1,3}$/.test(dotParts[1])
        && dotParts[0].length > 3
    ) {
        return String(Number(dotParts[0]));
    }

    const integerPart = rawValue.includes(",") ? rawValue.split(",")[0] : rawValue;
    const digits = integerPart.replace(/[^\d]/g, "");
    return digits ? String(Number(digits)) : "";
}

export function formatMoneyInputValue(value) {
    const normalizedValue = parseMoneyInputValue(value);
    if (!normalizedValue) return "";
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(normalizedValue));
}

function isMoneyInput(input) {
    return input?.matches?.("[data-money-input]") || MONEY_FIELD_NAMES.has(String(input?.name || ""));
}

export function formatMoneyInputs(root = document) {
    root.querySelectorAll?.("input").forEach((input) => {
        if (!isMoneyInput(input)) return;
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.value = formatMoneyInputValue(input.value);
    });
}

export function bindMoneyInputFormatting(root = document) {
    formatMoneyInputs(root);
    if (root.__shopfoodMoneyFormatterBound) return;
    root.__shopfoodMoneyFormatterBound = true;

    root.addEventListener("input", (event) => {
        const input = event.target;
        if (!isMoneyInput(input)) return;
        const cursorAtEnd = input.selectionStart === input.value.length;
        input.value = formatMoneyInputValue(input.value);
        if (cursorAtEnd) {
            input.setSelectionRange(input.value.length, input.value.length);
        }
    });

    root.addEventListener("blur", (event) => {
        const input = event.target;
        if (!isMoneyInput(input)) return;
        input.value = formatMoneyInputValue(input.value);
    }, true);
}

export function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function parseVoucherDescription(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return {
            title: "",
            note: "",
            audience: "all"
        };
    }

    const markerIndex = raw.indexOf(VOUCHER_META_PREFIX);
    if (markerIndex === -1) {
        return {
            title: raw,
            note: "",
            audience: "all"
        };
    }

    const title = raw.slice(0, markerIndex).trim();
    const metaRaw = raw.slice(markerIndex + VOUCHER_META_PREFIX.length).trim();

    try {
        const meta = JSON.parse(metaRaw);
        return {
            title: title || String(meta?.title || "").trim(),
            note: String(meta?.note || "").trim(),
            audience: String(meta?.audience || "all").trim() || "all"
        };
    } catch (_error) {
        return {
            title: title || raw.replace(VOUCHER_META_PREFIX, "").trim(),
            note: "",
            audience: "all"
        };
    }
}

export function buildVoucherDescription({ title, note, audience }) {
    const normalizedTitle = String(title || "").trim();
    const metadata = {
        audience: String(audience || "all").trim() || "all",
        note: String(note || "").trim()
    };

    if (!metadata.note && metadata.audience === "all") {
        return normalizedTitle;
    }

    return `${normalizedTitle}\n${VOUCHER_META_PREFIX}${JSON.stringify(metadata)}`;
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

export function getUploadedMediaUrl(payload) {
    return payload?.file?.relative_url
        || payload?.hinh_anh?.duong_dan_tuong_doi
        || payload?.files?.[0]?.relative_url
        || payload?.files?.[0]?.duong_dan_tuong_doi
        || payload?.file?.url
        || payload?.hinh_anh?.url
        || payload?.file?.duong_dan
        || payload?.hinh_anh?.duong_dan
        || payload?.files?.[0]?.url
        || payload?.files?.[0]?.duong_dan
        || "";
}

export async function uploadImageFile(file, folder = "general") {
    if (!file || !file.size) return "";
    if (!String(file.type || "").startsWith("image/")) {
        throw new Error("Vui lòng chọn đúng tệp ảnh.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Ảnh tải lên tối đa 5MB.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch(`/api/uploads/images?folder=${encodeURIComponent(folder)}`, {
        method: "POST",
        body: formData
    });
    const uploadedUrl = getUploadedMediaUrl(payload);
    if (!uploadedUrl) {
        throw new Error("Không lấy được đường dẫn ảnh sau khi tải lên.");
    }

    return uploadedUrl;
}

export function defaultImagePlaceholder(label = "SP") {
    const safeLabel = encodeURIComponent(String(label || "SP").slice(0, 8));
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' rx='20' fill='%23efe5d8'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23765f4a' font-family='Arial' font-size='16'%3E${safeLabel}%3C/text%3E%3C/svg%3E`;
}

export function bindImageFallbacks(root = document) {
    root.addEventListener("error", (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "true") return;

        image.dataset.fallbackApplied = "true";
        image.src = image.dataset.fallbackSrc || defaultImagePlaceholder(image.alt || "SP");
        image.classList.add("image-fallback");
    }, true);
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
    const data = Object.fromEntries(new FormData(form).entries());
    form?.querySelectorAll?.("input").forEach((input) => {
        if (!isMoneyInput(input) || !input.name) return;
        data[input.name] = parseMoneyInputValue(input.value);
    });
    return data;
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

    let response;
    try {
        response = await fetch(`${state.apiBase}${path}`, {
            ...options,
            headers
        });
    } catch (_error) {
        const error = new Error(`Không kết nối được backend tại ${state.apiBase}. Hãy kiểm tra server backend đã chạy và API base URL đúng.`);
        error.isNetworkError = true;
        throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof payload === "string" ? payload : payload?.message || "Yêu cầu thất bại.";
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    recordApiActivity(path, options.method || "GET");
    return payload;
}

function getApiActivityAction(method) {
    const normalized = String(method || "GET").toUpperCase();
    if (normalized === "POST") return "create";
    if (normalized === "DELETE") return "delete";
    if (normalized === "PUT" || normalized === "PATCH") return "update";
    return "";
}

function getApiTargetType(path) {
    const normalized = String(path || "").toLowerCase();
    if (normalized.includes("/orders")) return "Đơn hàng";
    if (normalized.includes("/products")) return "Sản phẩm";
    if (normalized.includes("/categories")) return "Danh mục sản phẩm";
    if (normalized.includes("/inventory/suppliers")) return "Nhà cung cấp";
    if (normalized.includes("/users")) return "Tài khoản";
    if (normalized.includes("/coupons")) return "Voucher";
    if (normalized.includes("/promotions")) return "Chiến dịch khuyến mãi";
    if (normalized.includes("/recipes")) return "Công thức";
    if (normalized.includes("/recipe-categories")) return "Danh mục công thức";
    if (normalized.includes("/branch")) return "Chi nhánh";
    return "API";
}

function recordApiActivity(path, method) {
    const action = getApiActivityAction(method);
    if (!action) return;

    const normalizedPath = String(path || "");
    if (
        normalizedPath.startsWith("/api/auth/")
        || normalizedPath.includes("/auth/")
        || normalizedPath.includes("/uploads/")
    ) {
        return;
    }

    recordActivityLog({
        action,
        targetType: getApiTargetType(normalizedPath),
        targetName: normalizedPath.replace(/\?.*$/, ""),
        detail: `Request ${String(method || "GET").toUpperCase()} thành công`,
        status: "success"
    });
}

export function recordActivityLog(entry) {
    const actor = state.user || {};
    const nextEntry = {
        id: entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: entry.time || new Date().toISOString(),
        actor: {
            name: actor.username || actor.full_name || actor.name || actor.email || entry.actor?.name || "Hệ thống",
            email: actor.email || entry.actor?.email || "",
            role: actor.role || entry.actor?.role || "system"
        },
        action: entry.action || "update",
        targetType: entry.targetType || "Hệ thống",
        targetName: entry.targetName || "Không rõ",
        detail: entry.detail || "",
        status: entry.status || "success",
        warning: Boolean(entry.warning)
    };

    state.activityLogs = [nextEntry, ...(state.activityLogs || [])].slice(0, 300);
    localStorage.setItem(STORAGE_KEYS.activityLogs, JSON.stringify(state.activityLogs));
}
