import {
    STORE_BRANCHES,
    STORAGE_KEYS,
    apiFetch,
    elements,
    escapeHtml,
    formatDate,
    formatNumber,
    resolveMediaUrl,
    saveStoreBranches,
    showToast,
    state,
    uploadImageFile
} from "./core.js";
import { loadProducts } from "./data.js";
import { renderProducts, updateProductWorkspace } from "./products.js";
import { renderAppIcon } from "./icons.js";

const CITY_OPTIONS = ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Cần Thơ", "Hải Phòng", "Bình Dương", "Đồng Nai"];
const LOW_STOCK_LIMIT = 5;
let branchImageFile = null;
let branchesLoadedFromApi = false;
let branchesLoadPromise = null;
let branchImportRequestsLoadedFromApi = false;
let branchImportRequestsLoadPromise = null;

function normalizeBranch(branch, index = 0) {
    return {
        key: String(branch.key || `store_${index + 1}`),
        code: String(branch.code || `CN-${String(index + 1).padStart(3, "0")}`),
        label: String(branch.label || branch.name || `Chi nhánh ${index + 1}`),
        name: String(branch.name || branch.label || `Chi nhánh ${index + 1}`),
        manager: String(branch.manager || ""),
        phone: String(branch.phone || ""),
        city: String(branch.city || ""),
        address: String(branch.address || ""),
        hours: String(branch.hours || ""),
        image_url: String(branch.image_url || ""),
        status: String(branch.status || "active")
    };
}

function syncBranches(branches = []) {
    STORE_BRANCHES.splice(0, STORE_BRANCHES.length, ...branches.map(normalizeBranch));
    saveStoreBranches();
}

async function loadBranchesFromApi({ silent = false, renderAfter = false } = {}) {
    if (branchesLoadPromise) return branchesLoadPromise;

    branchesLoadPromise = apiFetch("/api/branches")
        .then((payload) => {
            if (Array.isArray(payload?.branches)) {
                syncBranches(payload.branches);
            }
            branchesLoadedFromApi = true;
            if (renderAfter) {
                renderBranches();
            }
            return payload;
        })
        .catch((error) => {
            branchesLoadedFromApi = true;
            if (!silent) {
                showToast(error.message || "Không tải được danh sách chi nhánh từ CSDL.", true);
            }
            return null;
        })
        .finally(() => {
            branchesLoadPromise = null;
        });

    return branchesLoadPromise;
}

function ensureBranchesLoadedFromApi() {
    if (branchesLoadedFromApi || branchesLoadPromise) return;
    window.setTimeout(() => {
        loadBranchesFromApi({ silent: true, renderAfter: true });
    }, 0);
}

function normalizeBranchImportRequest(request) {
    return {
        ...request,
        id: String(request.id || ""),
        branch_key: String(request.branch_key || ""),
        branch_name: String(request.branch_name || ""),
        status: String(request.status || "pending"),
        items: Array.isArray(request.items)
            ? request.items.map((item) => ({
                ...item,
                product_id: item.product_id,
                quantity: Number(item.quantity || 0)
            }))
            : []
    };
}

async function loadBranchImportRequestsFromApi({ silent = false, renderAfter = false } = {}) {
    if (branchImportRequestsLoadPromise) return branchImportRequestsLoadPromise;

    branchImportRequestsLoadPromise = apiFetch("/api/branch-import-requests")
        .then((payload) => {
            state.branchImportRequests = Array.isArray(payload?.requests)
                ? payload.requests.map(normalizeBranchImportRequest)
                : [];
            branchImportRequestsLoadedFromApi = true;
            if (renderAfter) {
                renderBranches();
            }
            return payload;
        })
        .catch((error) => {
            branchImportRequestsLoadedFromApi = true;
            if (!silent) {
                showToast(error.message || "Không tải được phiếu yêu cầu gửi hàng từ CSDL.", true);
            }
            return null;
        })
        .finally(() => {
            branchImportRequestsLoadPromise = null;
        });

    return branchImportRequestsLoadPromise;
}

function ensureBranchImportRequestsLoadedFromApi() {
    if (branchImportRequestsLoadedFromApi || branchImportRequestsLoadPromise) return;
    window.setTimeout(() => {
        loadBranchImportRequestsFromApi({ silent: true, renderAfter: true });
    }, 0);
}

function defaultBranchImportExpectedDate() {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
}

function defaultProductThumb() {
    return "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
        <rect width="80" height="80" rx="18" fill="#edf6e9"/>
        <circle cx="32" cy="34" r="13" fill="#2aa95f"/>
        <circle cx="50" cy="30" r="10" fill="#f3b04f"/>
        <path d="M20 56c9-14 18-19 29-19 8 0 14 5 18 19H20z" fill="#147d43"/>
      </svg>
    `);
}

function readBranchImportRequests() {
    return Array.isArray(state.branchImportRequests) ? state.branchImportRequests : [];
}

function saveBranchImportRequests(requests) {
    state.branchImportRequests = Array.isArray(requests) ? requests : [];
}

function getBranchLabel(branch) {
    return [branch?.label, branch?.name && branch.name !== branch.label ? branch.name : ""].filter(Boolean).join(" - ") || "Chi nhánh";
}

function getBranchCode(branch, index) {
    return String(branch.code || `CN-${String(index + 1).padStart(3, "0")}`).trim();
}

function buildBranchKey() {
    const nextNumber = STORE_BRANCHES.length + 1;
    let key = `store_${nextNumber}`;
    let suffix = nextNumber;
    while (STORE_BRANCHES.some((branch) => branch.key === key)) {
        suffix += 1;
        key = `store_${suffix}`;
    }
    return key;
}

function getBranchInitials(branch) {
    return String(branch.label || branch.name || "CN")
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "CN";
}

function getBranchStatus(branch) {
    if (branch.status === "closed") return { label: "Đã đóng", tone: "danger" };
    if (branch.status === "paused") return { label: "Tạm ngưng", tone: "warning" };
    return { label: "Đang hoạt động", tone: "active" };
}

function getBranchHours(branch, index) {
    if (branch.status === "closed") return "Đã đóng";
    if (branch.status === "paused") return "Tạm ngưng";
    if (branch.hours) return branch.hours;
    return index % 3 === 2 ? "Đã đóng" : index % 2 === 0 ? "07:00 - 21:00" : "06:00 - 22:00";
}

function parseBranchHours(hours = "") {
    const match = String(hours || "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    return {
        openTime: match?.[1] || "07:00",
        closeTime: match?.[2] || "21:00"
    };
}

function getCurrentBranch() {
    const key = state.branchImportBranchKey || STORE_BRANCHES[0]?.key || "";
    const branch = STORE_BRANCHES.find((item) => String(item.key) === String(key)) || STORE_BRANCHES[0] || null;
    state.branchImportBranchKey = branch?.key || "";
    return branch;
}

function getProductUnit(product) {
    return product?.stock_unit || product?.sale_unit || product?.unit || "đơn vị";
}

function getProductCategoryName(product) {
    return product?.category_name || product?.category?.name || "Chưa phân loại";
}

function getBranchProductStock(product, branchKey) {
    const allocation = (product?.store_allocations || []).find((item) => String(item.store_key) === String(branchKey));
    if (allocation) return Math.max(0, Number(allocation.allocated_quantity || 0));
    return Math.max(0, Math.round(Number(product?.stock_quantity || 0) * 0.12));
}

function getMinimumStock(product) {
    const stock = Number(product?.stock_quantity || 0);
    return Math.max(LOW_STOCK_LIMIT, Math.ceil(stock * 0.08));
}

function getSuggestedImportQuantity(product, branchKey) {
    const currentStock = getBranchProductStock(product, branchKey);
    const minimumStock = getMinimumStock(product);
    return Math.max(1, minimumStock - currentStock + Math.ceil(minimumStock * 0.5));
}

function getLowStockProducts(branchKey = state.branchImportBranchKey) {
    const products = Array.isArray(state.products) ? state.products : [];
    return products
        .map((product) => {
            const currentStock = getBranchProductStock(product, branchKey);
            const minimumStock = getMinimumStock(product);
            return {
                ...product,
                branch_stock: currentStock,
                minimum_stock: minimumStock,
                suggested_quantity: getSuggestedImportQuantity(product, branchKey)
            };
        })
        .filter((product) => product.branch_stock <= product.minimum_stock)
        .sort((left, right) => left.branch_stock - right.branch_stock)
        .slice(0, 12);
}

function getBranchDraftItems() {
    return Array.isArray(state.branchImportDraftItems) ? state.branchImportDraftItems : [];
}

function setDraftItemQuantity(productId, quantity) {
    const nextQuantity = Math.max(1, Number(quantity || 1));
    state.branchImportDraftItems = getBranchDraftItems().map((item) => (
        String(item.product_id) === String(productId)
            ? { ...item, quantity: nextQuantity }
            : item
    ));
}

function addProductToBranchRequest(productId, quantity = null) {
    const product = (state.products || []).find((item) => String(item.id) === String(productId));
    if (!product) return;
    const existing = getBranchDraftItems().find((item) => String(item.product_id) === String(productId));
    const nextQuantity = Math.max(1, Number(quantity || getSuggestedImportQuantity(product, state.branchImportBranchKey)));
    if (existing) {
        setDraftItemQuantity(productId, Number(existing.quantity || 0) + nextQuantity);
        return;
    }
    state.branchImportDraftItems = [
        ...getBranchDraftItems(),
        {
            product_id: product.id,
            name: product.name || product.ten_san_pham || "Sản phẩm",
            sku: product.sku || "",
            thumbnail_url: product.thumbnail_url || "",
            category_name: getProductCategoryName(product),
            unit: getProductUnit(product),
            quantity: nextQuantity
        }
    ];
}

export function prepareBranchImportFromProduct(productId) {
    if (!state.branchImportBranchKey) {
        state.branchImportBranchKey = STORE_BRANCHES[0]?.key || "";
    }
    addProductToBranchRequest(productId);
    state.branchWorkspace = "importRequests";
}

function removeProductFromBranchRequest(productId) {
    state.branchImportDraftItems = getBranchDraftItems().filter((item) => String(item.product_id) !== String(productId));
}

function getBranchRequestStatusMeta(status) {
    const value = String(status || "pending");
    if (value === "draft") return { label: "Nháp", tone: "neutral" };
    if (value === "approved") return { label: "Đã duyệt", tone: "active" };
    if (value === "receiving") return { label: "Đang gửi hàng", tone: "shipping" };
    if (value === "completed") return { label: "Hoàn tất", tone: "completed" };
    if (value === "rejected") return { label: "Từ chối", tone: "cancelled" };
    return { label: "Chờ duyệt", tone: "warning" };
}

function defaultBranchShipmentDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
}

function ensureBranchShipmentDraft() {
    if (!state.branchShipmentDraft) {
        state.branchShipmentDraft = {
            warehouse: "Kho tổng",
            branch_key: state.branchShipmentBranchFilter && state.branchShipmentBranchFilter !== "all"
                ? state.branchShipmentBranchFilter
                : STORE_BRANCHES[0]?.key || "",
            expected_date: defaultBranchShipmentDate(),
            priority: "normal",
            note: "",
            items: []
        };
    }
    return state.branchShipmentDraft;
}

function getShipmentProductOptions(selectedId = "") {
    return (state.products || [])
        .map((product) => `<option value="${escapeHtml(String(product.id))}" ${String(product.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(product.name || "Sản phẩm")} - ${escapeHtml(product.sku || "SKU")} (${formatNumber(product.stock_quantity || 0)} ${escapeHtml(getProductUnit(product))})</option>`)
        .join("");
}

function buildShipmentDraftItem(productId) {
    const product = (state.products || []).find((item) => String(item.id) === String(productId));
    if (!product) return null;
    return {
        product_id: product.id,
        name: product.name || "Sản phẩm",
        sku: product.sku || "",
        thumbnail_url: product.thumbnail_url || "",
        unit: getProductUnit(product),
        quantity: 1
    };
}

function addShipmentDraftProduct(productId = "") {
    const draft = ensureBranchShipmentDraft();
    const selectedId = productId || (state.products || [])
        .find((product) => !draft.items.some((item) => String(item.product_id) === String(product.id)))?.id;
    const nextItem = buildShipmentDraftItem(selectedId);
    if (!nextItem) {
        showToast("Không còn sản phẩm trong kho để thêm vào đơn.", true);
        return;
    }
    draft.items = [...draft.items, nextItem];
}

function updateShipmentDraftProduct(index, productId) {
    const draft = ensureBranchShipmentDraft();
    if (draft.items.some((item, itemIndex) => itemIndex !== index && String(item.product_id) === String(productId))) {
        showToast("Sản phẩm này đã có trong đơn gửi hàng.", true);
        return;
    }
    const nextItem = buildShipmentDraftItem(productId);
    if (!nextItem) return;
    nextItem.quantity = Math.max(1, Number(draft.items[index]?.quantity || 1));
    draft.items = draft.items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
}

function updateShipmentDraftQuantity(index, quantity) {
    const draft = ensureBranchShipmentDraft();
    draft.items = draft.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, quantity: Math.max(1, Number(quantity || 1)) } : item
    ));
}

function removeShipmentDraftProduct(index) {
    const draft = ensureBranchShipmentDraft();
    draft.items = draft.items.filter((_, itemIndex) => itemIndex !== index);
}

function getShipmentDraftTotal() {
    const draft = ensureBranchShipmentDraft();
    return draft.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getShipmentDraftItemProduct(item) {
    return (state.products || []).find((product) => String(product.id) === String(item?.product_id)) || null;
}

function getShipmentDraftItemStock(item) {
    const product = getShipmentDraftItemProduct(item);
    return Math.max(0, Number(product?.stock_quantity || 0));
}

function validateShipmentDraftStock(items) {
    const totals = new Map();
    items.forEach((item) => {
        const productId = String(item.product_id);
        totals.set(productId, Number(totals.get(productId) || 0) + Number(item.quantity || 0));
    });

    for (const [productId, quantity] of totals.entries()) {
        const product = (state.products || []).find((entry) => String(entry.id) === productId);
        if (!product) throw new Error("Có sản phẩm không còn tồn tại trong kho.");
        const stock = Number(product.stock_quantity || 0);
        if (quantity > stock) {
            throw new Error(`Kho tổng chỉ còn ${formatNumber(stock)} ${getProductUnit(product)} cho ${product.name || product.sku}.`);
        }
    }
}

function renderBranchShipmentCreateModal() {
    if (!state.branchShipmentCreateOpen) return "";
    const draft = ensureBranchShipmentDraft();

    return `
      <div class="modal-backdrop branch-shipment-create-backdrop" data-branch-shipment-draft-action="close">
        <form class="modal-card branch-shipment-create-modal" data-branch-shipment-create-form onclick="event.stopPropagation()">
          <header class="branch-shipment-create-head">
            <div>
              <span>Tạo đơn gửi hàng</span>
              <h3>Chi nhánh & Kho vận</h3>
            </div>
            <button type="button" class="branch-shipment-create-close" data-branch-shipment-draft-action="close" aria-label="Đóng popup">×</button>
          </header>

          <div class="branch-shipment-create-body">
            <section class="branch-shipment-create-section">
              <h4><span></span>Thông tin vận chuyển</h4>
              <div class="branch-shipment-create-grid">
                <label>
                  <span>Kho xuất hàng</span>
                  <select data-branch-shipment-draft-field="warehouse">
                    ${["Kho tổng", "Kho 1 - Đông lạnh", "Kho 2 - Rau và trái cây", "Kho 3 - Đồ khô"].map((name) => `<option value="${escapeHtml(name)}" ${draft.warehouse === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                  </select>
                </label>
                <label>
                  <span>Chi nhánh nhận</span>
                  <select data-branch-shipment-draft-field="branch_key">
                    ${STORE_BRANCHES.map((branch) => `<option value="${escapeHtml(branch.key)}" ${String(draft.branch_key) === String(branch.key) ? "selected" : ""}>${escapeHtml(getBranchLabel(branch))}</option>`).join("")}
                  </select>
                </label>
                <label>
                  <span>Ngày dự kiến giao</span>
                  <input type="date" value="${escapeHtml(draft.expected_date || defaultBranchShipmentDate())}" data-branch-shipment-draft-field="expected_date">
                </label>
                <div class="branch-shipment-priority">
                  <span>Mức độ ưu tiên</span>
                  <label><input type="radio" name="branch_shipment_priority" value="normal" ${draft.priority !== "urgent" ? "checked" : ""} data-branch-shipment-draft-field="priority"> Thường</label>
                  <label><input type="radio" name="branch_shipment_priority" value="urgent" ${draft.priority === "urgent" ? "checked" : ""} data-branch-shipment-draft-field="priority"> Hỏa tốc</label>
                </div>
              </div>
            </section>

            <section class="branch-shipment-create-section">
              <div class="branch-shipment-create-section-head">
                <h4><span></span>Danh sách sản phẩm</h4>
                <button type="button" class="ghost-button branch-shipment-add-product" data-branch-shipment-draft-action="add-product">+ Thêm sản phẩm</button>
              </div>
              <div class="branch-shipment-create-table">
                <div class="branch-shipment-create-row header">
                  <span>Sản phẩm</span>
                  <span>ĐVT</span>
                  <span>Số lượng gửi</span>
                  <span>Thao tác</span>
                </div>
                ${draft.items.map((item, index) => `
                  <div class="branch-shipment-create-row">
                    <div class="branch-shipment-product-select-cell">
                      <img src="${escapeHtml(resolveMediaUrl(item.thumbnail_url, defaultProductThumb()))}" alt="">
                      <div>
                        <select data-branch-shipment-draft-product="${index}">
                          ${getShipmentProductOptions(item.product_id)}
                        </select>
                        <small>Kho tổng còn ${formatNumber(getShipmentDraftItemStock(item))} ${escapeHtml(item.unit || "đơn vị")}</small>
                      </div>
                    </div>
                    <strong>${escapeHtml(item.unit || "đơn vị")}</strong>
                    <div class="branch-shipment-quantity-control">
                      <button type="button" data-branch-shipment-draft-action="decrease-quantity" data-index="${index}">−</button>
                      <input value="${escapeHtml(String(item.quantity || 1))}" inputmode="numeric" data-branch-shipment-draft-quantity="${index}">
                      <button type="button" data-branch-shipment-draft-action="increase-quantity" data-index="${index}">+</button>
                    </div>
                    <button type="button" class="branch-shipment-remove-product" data-branch-shipment-draft-action="remove-product" data-index="${index}">${renderAppIcon("trash")}</button>
                  </div>
                `).join("") || '<p class="branch-import-empty">Chưa có sản phẩm trong đơn. Bấm "+ Thêm sản phẩm" để chọn hàng từ kho.</p>'}
              </div>
            </section>

            <section class="branch-shipment-create-bottom">
              <label>
                <span>Ghi chú chung</span>
                <textarea data-branch-shipment-draft-field="note" placeholder="Nhập ghi chú cho bộ phận kho vận...">${escapeHtml(draft.note || "")}</textarea>
              </label>
              <aside class="branch-shipment-create-summary">
                <div><span>Tổng số mặt hàng</span><strong>${formatNumber(draft.items.length)}</strong></div>
                <div><span>Tổng số lượng</span><strong>${formatNumber(getShipmentDraftTotal())}</strong></div>
              </aside>
            </section>
          </div>

          <footer class="branch-shipment-create-footer">
            <button type="button" class="ghost-button" data-branch-shipment-draft-action="close">Hủy</button>
            <button type="submit" class="primary-button">Lưu đơn</button>
          </footer>
        </form>
      </div>
    `;
}

function buildBranchRequestCode(branch) {
    const branchIndex = Math.max(0, STORE_BRANCHES.findIndex((item) => item.key === branch?.key));
    const sequence = readBranchImportRequests().length + 1;
    return `REQ-CN${String(branchIndex + 1).padStart(2, "0")}-${String(sequence).padStart(4, "0")}`;
}

async function submitBranchImportRequest({ asDraft = false } = {}) {
    const branch = getCurrentBranch();
    const items = getBranchDraftItems();
    if (!branch) throw new Error("Chưa có chi nhánh để tạo yêu cầu nhập hàng.");
    if (!items.length) throw new Error("Vui lòng thêm ít nhất một sản phẩm vào phiếu yêu cầu.");

    const payload = {
        branch_key: branch.key,
        branch_name: getBranchLabel(branch),
        expected_date: state.branchImportExpectedDate || defaultBranchImportExpectedDate(),
        note: state.branchImportNote || "",
        status: asDraft ? "draft" : "pending",
        items: items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            sku: item.sku,
            thumbnail_url: item.thumbnail_url,
            unit: item.unit,
            quantity: Number(item.quantity || 1)
        }))
    };

    const response = await apiFetch("/api/branch-import-requests", {
        method: "POST",
        body: JSON.stringify(payload)
    });
    const savedRequest = response?.request ? normalizeBranchImportRequest(response.request) : null;
    if (savedRequest) {
        saveBranchImportRequests([savedRequest, ...readBranchImportRequests()]);
    } else {
        await loadBranchImportRequestsFromApi({ silent: true });
    }
    state.branchImportDraftItems = [];
    state.branchImportNote = "";
    state.branchImportExpectedDate = defaultBranchImportExpectedDate();
    showToast(asDraft ? "Đã lưu nháp yêu cầu nhập hàng." : "Đã gửi yêu cầu nhập hàng.");
}

function getRequestTotalQuantity(request) {
    return (request?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getRequestBranch(request) {
    return STORE_BRANCHES.find((branch) => String(branch.key) === String(request?.branch_key)) || null;
}

async function updateBranchImportRequest(requestId, patcher) {
    const requests = readBranchImportRequests();
    const currentRequest = requests.find((request) => String(request.id) === String(requestId));
    if (!currentRequest) return null;
    const patch = typeof patcher === "function" ? patcher(currentRequest) : patcher;

    const nextRequests = requests.map((request) => {
        if (String(request.id) !== String(requestId)) return request;
        return {
            ...request,
            ...patch,
            updated_at: new Date().toISOString()
        };
    });
    saveBranchImportRequests(nextRequests);

    const response = await apiFetch(`/api/branch-import-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
    });
    const savedRequest = response?.request ? normalizeBranchImportRequest(response.request) : null;
    if (savedRequest) {
        saveBranchImportRequests(readBranchImportRequests().map((request) => (
            String(request.id) === String(requestId) ? savedRequest : request
        )));
    }
    return savedRequest;
}

function getVisibleShipmentRequests() {
    const keyword = String(state.branchShipmentKeyword || "").trim().toLowerCase();
    return readBranchImportRequests()
        .filter((request) => String(request.status || "") !== "draft")
        .filter((request) => state.branchShipmentStatusFilter && state.branchShipmentStatusFilter !== "all"
            ? String(request.status || "pending") === String(state.branchShipmentStatusFilter)
            : true)
        .filter((request) => state.branchShipmentBranchFilter && state.branchShipmentBranchFilter !== "all"
            ? String(request.branch_key) === String(state.branchShipmentBranchFilter)
            : true)
        .filter((request) => {
            if (!keyword) return true;
            const haystack = [
                request.code,
                request.branch_name,
                request.note,
                ...(request.items || []).map((item) => `${item.name || ""} ${item.sku || ""}`)
            ].join(" ").toLowerCase();
            return haystack.includes(keyword);
        });
}

function getShipmentDetailRequest(requests = getVisibleShipmentRequests()) {
    const selected = requests.find((request) => String(request.id) === String(state.branchShipmentDetailId));
    const fallback = requests[0] || null;
    state.branchShipmentDetailId = selected?.id || fallback?.id || "";
    return selected || fallback;
}

async function changeShipmentRequestStatus(requestId, status) {
    const statusMessages = {
        approved: "Đã duyệt yêu cầu nhập hàng.",
        receiving: "Đã chuyển sang trạng thái đang gửi hàng.",
        completed: "Đã hoàn tất gửi hàng cho chi nhánh.",
        rejected: "Đã từ chối yêu cầu nhập hàng."
    };
    await updateBranchImportRequest(requestId, {
        status,
        status_note: statusMessages[status] || "",
        ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
        ...(status === "receiving" ? { shipped_at: new Date().toISOString() } : {}),
        ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
        ...(status === "rejected" ? { rejected_at: new Date().toISOString() } : {})
    });
    showToast(statusMessages[status] || "Đã cập nhật yêu cầu.");
}

async function updateShipmentItemQuantity(requestId, productId, quantity) {
    const nextQuantity = Math.max(1, Number(quantity || 1));
    saveBranchImportRequests(readBranchImportRequests().map((request) => (
        String(request.id) === String(requestId)
            ? {
                ...request,
                items: (request.items || []).map((item) => (
                    String(item.product_id) === String(productId)
                        ? { ...item, quantity: nextQuantity }
                        : item
                ))
            }
            : request
    )));
    const response = await apiFetch(`/api/branch-import-requests/${encodeURIComponent(requestId)}/items/${encodeURIComponent(productId)}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: nextQuantity })
    });
    const savedRequest = response?.request ? normalizeBranchImportRequest(response.request) : null;
    if (savedRequest) {
        saveBranchImportRequests(readBranchImportRequests().map((request) => (
            String(request.id) === String(requestId) ? savedRequest : request
        )));
    }
    return savedRequest;
}

function patchShipmentItemQuantityLocal(requestId, productId, quantity) {
    saveBranchImportRequests(readBranchImportRequests().map((request) => ({
        ...request,
        items: (request.items || []).map((item) => (
            String(request.id) === String(requestId) && String(item.product_id) === String(productId)
                ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
                : item
        ))
    })));
}

async function completeShipmentRequest(requestId) {
    const requests = readBranchImportRequests();
    const request = requests.find((item) => String(item.id) === String(requestId));
    if (!request) throw new Error("Không tìm thấy yêu cầu gửi hàng.");
    if (!request.items?.length) throw new Error("Yêu cầu chưa có sản phẩm.");

    const branch = getRequestBranch(request);
    if (!branch) throw new Error("Chi nhánh nhận hàng không hợp lệ.");
    if (!window.confirm(`Hoàn tất gửi hàng cho ${request.branch_name || getBranchLabel(branch)}? Kho tổng sẽ bị trừ theo số lượng trong phiếu.`)) {
        return;
    }

    const groupedItems = Array.from(request.items.reduce((map, item) => {
        const productId = String(item.product_id);
        const current = map.get(productId) || { ...item, quantity: 0 };
        current.quantity = Number(current.quantity || 0) + Number(item.quantity || 0);
        map.set(productId, current);
        return map;
    }, new Map()).values());

    validateShipmentDraftStock(groupedItems);

    for (const item of groupedItems) {
        const product = (state.products || []).find((productItem) => String(productItem.id) === String(item.product_id));
        if (!product) throw new Error(`Không tìm thấy sản phẩm ${item.name || item.product_id}.`);

        const existingAllocation = (product.store_allocations || []).find((allocation) => String(allocation.store_key) === String(request.branch_key));
        const currentBranchQuantity = Number(existingAllocation?.allocated_quantity || 0);
        const addedQuantity = Math.max(1, Number(item.quantity || 1));

        await apiFetch(`/api/products/${product.id}/store-allocation`, {
            method: "PUT",
            body: JSON.stringify({
                store_key: request.branch_key,
                store_name: request.branch_name || getBranchLabel(branch),
                allocated_quantity: currentBranchQuantity + addedQuantity,
                sale_price: product.sale_price || product.price || 0,
                sale_unit: product.sale_unit || product.unit || product.stock_unit || item.unit || "đơn vị",
                stock_per_sale_unit: product.stock_per_sale_unit || 1,
                publish_mode: existingAllocation?.publish_mode === "published" ? "published" : "draft"
            })
        });
    }

    await changeShipmentRequestStatus(requestId, "completed");
    await loadProducts();
    if (!elements.panels.products?.classList.contains("hidden")) {
        updateProductWorkspace();
        renderProducts();
    }
}

async function submitBranchShipmentDraft() {
    const draft = ensureBranchShipmentDraft();
    const branch = STORE_BRANCHES.find((item) => String(item.key) === String(draft.branch_key));
    if (!branch) throw new Error("Vui lòng chọn chi nhánh nhận hàng.");
    if (!draft.items.length) throw new Error("Vui lòng thêm ít nhất một sản phẩm.");
    validateShipmentDraftStock(draft.items);

    const payload = {
        branch_key: branch.key,
        branch_name: getBranchLabel(branch),
        expected_date: draft.expected_date || defaultBranchShipmentDate(),
        note: [
            draft.note || "",
            draft.priority === "urgent" ? "Ưu tiên: Hỏa tốc" : "Ưu tiên: Thường",
            draft.warehouse ? `Kho xuất: ${draft.warehouse}` : ""
        ].filter(Boolean).join("\n"),
        status: "pending",
        items: draft.items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            sku: item.sku,
            thumbnail_url: item.thumbnail_url,
            unit: item.unit,
            quantity: Number(item.quantity || 1)
        }))
    };

    const createdResponse = await apiFetch("/api/branch-import-requests", {
        method: "POST",
        body: JSON.stringify(payload)
    });
    let savedRequest = createdResponse?.request ? normalizeBranchImportRequest(createdResponse.request) : null;

    if (savedRequest?.id) {
        const receivingResponse = await apiFetch(`/api/branch-import-requests/${encodeURIComponent(savedRequest.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "receiving", note: payload.note })
        });
        savedRequest = receivingResponse?.request ? normalizeBranchImportRequest(receivingResponse.request) : savedRequest;
    }

    if (savedRequest) {
        saveBranchImportRequests([
            savedRequest,
            ...readBranchImportRequests().filter((request) => String(request.id) !== String(savedRequest.id))
        ]);
        state.branchShipmentDetailId = savedRequest.id;
        state.branchShipmentStatusFilter = "receiving";
    } else {
        await loadBranchImportRequestsFromApi({ silent: true });
    }

    state.branchShipmentCreateOpen = false;
    state.branchShipmentDraft = null;
    showToast("Đã tạo đơn gửi hàng cho chi nhánh.");
}

function renderBranchListWorkspace() {
    const keyword = String(state.branchSearch || "").trim().toLowerCase();
    const visibleBranches = STORE_BRANCHES.filter((branch) => {
        if (!keyword) return true;
        return [branch.label, branch.name, branch.manager, branch.phone, branch.city, branch.address, branch.key]
            .some((value) => String(value || "").toLowerCase().includes(keyword));
    }).filter((branch) => {
        if (state.branchStatusFilter === "closed") return getBranchStatus(branch).tone === "danger";
        if (state.branchStatusFilter === "paused") return getBranchStatus(branch).tone === "warning";
        if (state.branchStatusFilter === "active") return getBranchStatus(branch).tone === "active";
        return true;
    });

    elements.branchesMeta.textContent = `${visibleBranches.length} / ${STORE_BRANCHES.length} chi nhánh`;
    elements.branchesContent.innerHTML = `
      <section class="branches-shell">
        <form class="branches-filter-card" data-branch-filter-form>
          <div class="branch-filter-title">${renderAppIcon("grid")} <strong>Bộ lọc</strong></div>
          <label>
            <span>Tìm kiếm</span>
            <input id="branchSearchInput" name="keyword" value="${escapeHtml(state.branchSearch || "")}" placeholder="Tìm kiếm chi nhánh...">
          </label>
          <label>
            <span>Trạng thái</span>
            <select name="status">
              <option value="all" ${state.branchStatusFilter === "all" ? "selected" : ""}>Tất cả</option>
              <option value="active" ${state.branchStatusFilter === "active" ? "selected" : ""}>Đang hoạt động</option>
              <option value="paused" ${state.branchStatusFilter === "paused" ? "selected" : ""}>Tạm ngưng</option>
              <option value="closed" ${state.branchStatusFilter === "closed" ? "selected" : ""}>Đã đóng</option>
            </select>
          </label>
          <button class="primary-button branch-filter-submit" type="submit">Áp dụng</button>
        </form>

        <article class="surface branch-table-card">
          <div class="branch-table-wrap">
            <table class="branch-table">
              <thead>
                <tr>
                  <th>Thông tin chi nhánh</th>
                  <th>Địa chỉ</th>
                  <th>Quản trị</th>
                  <th>Vận hành</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${visibleBranches.map((branch, index) => {
                    const status = getBranchStatus(branch);
                    const hours = getBranchHours(branch, index);
                    const isSuspended = branch.status === "paused" || branch.status === "closed";
                    const toggleLabel = isSuspended ? "Mở lại" : "Tạm ngưng";
                    const toggleIcon = isSuspended ? renderAppIcon("shield") : renderAppIcon("pause");
                    const operationNote = status.tone === "danger"
                        ? "Đang sửa chữa"
                        : status.tone === "warning"
                            ? "Tạm ngưng nhận đơn"
                            : "Phục vụ hằng ngày";
                    return `
                      <tr>
                        <td>
                          <div class="branch-identity">
                            <div class="branch-avatar">
                              ${branch.image_url
                                ? `<img src="${escapeHtml(resolveMediaUrl(branch.image_url))}" alt="${escapeHtml(branch.label)}">`
                                : `<span>${escapeHtml(getBranchInitials(branch))}</span>`}
                            </div>
                            <div>
                              <strong>${escapeHtml(branch.label || branch.name)}</strong>
                              <small>${escapeHtml(getBranchCode(branch, index))}</small>
                            </div>
                          </div>
                        </td>
                        <td class="branch-address">${escapeHtml([branch.address, branch.city].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ")}</td>
                        <td>
                          <div class="branch-admin">
                            <span class="branch-admin-avatar">${renderAppIcon("user")}</span>
                            <div>
                              <strong>${escapeHtml(branch.manager || "Chưa phân công")}</strong>
                              <small>${escapeHtml(branch.phone || "Chưa cập nhật")}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="branch-operation">
                            <strong>${escapeHtml(hours)}</strong>
                            <small>${escapeHtml(operationNote)}</small>
                          </div>
                        </td>
                        <td><span class="branch-status ${status.tone}">${escapeHtml(status.label)}</span></td>
                        <td>
                          <div class="branch-actions">
                            <button type="button" data-branch-action="edit" data-branch-key="${escapeHtml(branch.key)}" aria-label="Sửa chi nhánh">${renderAppIcon("edit")} <span>Sửa</span></button>
                            <button type="button" data-branch-action="toggle-status" data-branch-key="${escapeHtml(branch.key)}" aria-label="${escapeHtml(toggleLabel)} chi nhánh">${toggleIcon} <span>${escapeHtml(toggleLabel)}</span></button>
                            <button type="button" data-branch-action="delete" data-branch-key="${escapeHtml(branch.key)}" aria-label="Xóa chi nhánh">${renderAppIcon("trash")} <span>Xóa</span></button>
                          </div>
                        </td>
                      </tr>
                    `;
                }).join("") || '<tr><td colspan="6" class="branch-empty-state">Không có chi nhánh phù hợp.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
}

function renderBranchImportSummaryCard(icon, title, value, note, tone = "") {
    return `
      <article class="branch-import-stat ${escapeHtml(tone)}">
        <span class="branch-import-stat-icon">${renderAppIcon(icon)}</span>
        <div>
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(String(value))}</strong>
          <small>${escapeHtml(note)}</small>
        </div>
      </article>
    `;
}

function renderBranchRequestStatusPill(status) {
    const meta = getBranchRequestStatusMeta(status);
    return `<span class="branch-request-status ${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span>`;
}

function renderBranchImportWorkspace() {
    const branch = getCurrentBranch();
    const branchIndex = Math.max(0, STORE_BRANCHES.findIndex((item) => item.key === branch?.key));
    const lowStockProducts = getLowStockProducts(branch?.key);
    const requests = readBranchImportRequests().filter((request) => String(request.branch_key) === String(branch?.key));
    const draftItems = getBranchDraftItems();
    const totalQuantity = draftItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    elements.branchesMeta.textContent = branch ? `Chi nhánh: ${getBranchLabel(branch)}` : "Chưa có chi nhánh";
    elements.branchesContent.innerHTML = `
      <section class="branch-import-shell">
        <div class="branch-import-topbar">
          <label class="branch-import-select">
            <span>Chi nhánh</span>
            <select data-branch-import-field="branch">
              ${STORE_BRANCHES.map((item) => `<option value="${escapeHtml(item.key)}" ${String(item.key) === String(branch?.key) ? "selected" : ""}>${escapeHtml(getBranchLabel(item))}</option>`).join("")}
            </select>
          </label>
        </div>

        <article class="branch-import-info-card">
          <div>${renderAppIcon("store")} <span>Mã chi nhánh</span><strong>${escapeHtml(getBranchCode(branch || {}, branchIndex))}</strong></div>
          <div>${renderAppIcon("user")} <span>Quản lý</span><strong>${escapeHtml(branch?.manager || "Chưa phân công")}</strong></div>
          <div>${renderAppIcon("pin")} <span>Địa chỉ</span><strong>${escapeHtml([branch?.address, branch?.city].filter(Boolean).join(", ") || "Chưa cập nhật")}</strong></div>
          <div>${renderAppIcon("calendar")} <span>Cập nhật tồn kho</span><strong>${escapeHtml(formatDate(new Date()))}</strong></div>
        </article>

        <div class="branch-import-layout">
          <article class="surface branch-import-card">
            <div class="section-head">
              <h3>Cảnh báo tồn kho của chi nhánh</h3>
              <span class="branch-import-muted">Hiển thị ${formatNumber(lowStockProducts.length)} sản phẩm sắp hết</span>
            </div>
            <div class="branch-import-table-wrap">
              <table class="list-table branch-import-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Danh mục</th>
                    <th>Tồn hiện tại</th>
                    <th>Mức tối thiểu</th>
                    <th>Đề xuất nhập</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${lowStockProducts.map((product) => {
                    const unit = getProductUnit(product);
                    return `
                      <tr>
                        <td>
                          <div class="branch-product-cell">
                            <img src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultProductThumb()))}" alt="">
                            <div>
                              <strong>${escapeHtml(product.name || product.ten_san_pham || "Sản phẩm")}</strong>
                              <span>${escapeHtml(product.sku || "-")}</span>
                            </div>
                          </div>
                        </td>
                        <td>${escapeHtml(getProductCategoryName(product))}</td>
                        <td><strong class="branch-stock-danger">${formatNumber(product.branch_stock)}</strong> ${escapeHtml(unit)}</td>
                        <td>${formatNumber(product.minimum_stock)} ${escapeHtml(unit)}</td>
                        <td>
                          <div class="branch-import-stepper">
                            <button type="button" data-branch-import-action="decrease-suggest" data-product-id="${escapeHtml(String(product.id))}">-</button>
                            <input value="${escapeHtml(String(product.suggested_quantity))}" data-branch-import-suggest="${escapeHtml(String(product.id))}" inputmode="numeric">
                            <button type="button" data-branch-import-action="increase-suggest" data-product-id="${escapeHtml(String(product.id))}">+</button>
                          </div>
                        </td>
                        <td><button class="chip-button" type="button" data-branch-import-action="add-product" data-product-id="${escapeHtml(String(product.id))}">Thêm vào phiếu</button></td>
                      </tr>
                    `;
                  }).join("") || '<tr><td colspan="6">Chưa có sản phẩm sắp hết cho chi nhánh này.</td></tr>'}
                </tbody>
              </table>
            </div>
          </article>

          <aside class="surface branch-import-card branch-request-draft-card">
            <div class="section-head">
              <h3>Phiếu yêu cầu của chi nhánh</h3>
              <span class="branch-import-badge">${formatNumber(draftItems.length)} mặt hàng</span>
            </div>
            <div class="branch-request-draft-list">
              ${draftItems.map((item) => `
                <article class="branch-request-draft-item">
                  <img src="${escapeHtml(resolveMediaUrl(item.thumbnail_url, defaultProductThumb()))}" alt="">
                  <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.sku || item.category_name || "-")}</span>
                  </div>
                  <input value="${escapeHtml(String(item.quantity || 1))}" inputmode="numeric" data-branch-import-quantity="${escapeHtml(String(item.product_id))}">
                  <span>${escapeHtml(item.unit || "đơn vị")}</span>
                  <button type="button" data-branch-import-action="remove-product" data-product-id="${escapeHtml(String(item.product_id))}" aria-label="Xóa sản phẩm">${renderAppIcon("trash")}</button>
                </article>
              `).join("") || '<p class="branch-import-empty">Chọn sản phẩm sắp hết ở bảng bên trái để thêm vào phiếu.</p>'}
            </div>
            <label class="branch-import-note">
              <span>Ghi chú</span>
              <textarea data-branch-import-field="note" maxlength="300" placeholder="Nhập ghi chú cho yêu cầu nhập hàng...">${escapeHtml(state.branchImportNote || "")}</textarea>
            </label>
            <label class="branch-import-date">
              <span>Ngày dự kiến nhận hàng</span>
              <input type="date" data-branch-import-field="expected-date" value="${escapeHtml(state.branchImportExpectedDate || defaultBranchImportExpectedDate())}">
            </label>
            <div class="branch-request-draft-total">
              <div><span>Tổng số mặt hàng</span><strong>${formatNumber(draftItems.length)}</strong></div>
              <div><span>Tổng số lượng</span><strong>${formatNumber(totalQuantity)}</strong></div>
            </div>
            <div class="branch-request-draft-actions">
              <button class="ghost-button" type="button" data-branch-import-action="save-draft">Lưu nháp</button>
              <button class="primary-button" type="button" data-branch-import-action="submit-request">Gửi yêu cầu</button>
            </div>
          </aside>
        </div>

        <article class="surface branch-import-card">
          <div class="section-head">
            <h3>Lịch sử yêu cầu của chi nhánh</h3>
            <span class="branch-import-muted">${formatNumber(requests.length)} yêu cầu</span>
          </div>
          <div class="branch-import-table-wrap">
            <table class="list-table branch-import-history-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Ngày tạo</th>
                  <th>Số mặt hàng</th>
                  <th>Tổng số lượng</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${requests.map((request) => `
                  <tr>
                    <td><strong>${escapeHtml(request.code)}</strong></td>
                    <td>${escapeHtml(formatDate(request.created_at))}</td>
                    <td>${formatNumber(request.items?.length || 0)} sản phẩm</td>
                    <td>${formatNumber((request.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0))}</td>
                    <td>${renderBranchRequestStatusPill(request.status)}</td>
                    <td>${escapeHtml(request.note || "-")}</td>
                  </tr>
                `).join("") || '<tr><td colspan="6">Chưa có yêu cầu nhập hàng nào.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
}

function renderShipmentRequestCard(request) {
    const branch = getRequestBranch(request);
    const status = getBranchRequestStatusMeta(request.status);
    const isActive = String(request.id) === String(state.branchShipmentDetailId);
    return `
      <article class="branch-shipment-request-card ${isActive ? "active" : ""}" data-branch-shipment-action="view-request" data-request-id="${escapeHtml(String(request.id))}">
        <span class="branch-shipment-status-icon ${escapeHtml(status.tone)}">${renderAppIcon(status.tone === "shipping" ? "truck" : status.tone === "cancelled" ? "warning" : status.tone === "active" ? "shield" : "receipt")}</span>
        <div class="branch-shipment-request-main">
          <strong>${escapeHtml(request.code || "REQ")}</strong>
          <span>${escapeHtml(request.branch_name || getBranchLabel(branch))}</span>
        </div>
        <div class="branch-shipment-request-meta">
          <span>Người gửi: ${escapeHtml(branch?.manager || "Nhân viên kho")}</span>
          <span>${formatNumber(request.items?.length || 0)} sản phẩm - ${formatNumber(getRequestTotalQuantity(request))} ${escapeHtml((request.items || [])[0]?.unit || "đơn vị")}</span>
        </div>
        <div class="branch-shipment-request-time">
          <span>${escapeHtml(formatDate(request.created_at))}</span>
          <small>${escapeHtml(request.expected_date ? `Dự kiến ${formatDate(request.expected_date)}` : "")}</small>
        </div>
        ${renderBranchRequestStatusPill(request.status)}
        <button class="chip-button" type="button" data-branch-shipment-action="view-request" data-request-id="${escapeHtml(String(request.id))}">Xem chi tiết</button>
      </article>
    `;
}

function renderShipmentDetail(request) {
    if (!request) {
        return `
          <aside class="branch-shipment-detail-card surface">
            <h3>Chi tiết yêu cầu</h3>
            <p class="branch-import-empty">Chưa có yêu cầu nhập hàng để duyệt.</p>
          </aside>
        `;
    }

    const branch = getRequestBranch(request);
    const actions = String(request.status || "pending") === "pending"
        ? [
            { action: "approve-request", label: "Duyệt yêu cầu", tone: "primary" },
            { action: "reject-request", label: "Từ chối yêu cầu", tone: "danger" }
        ]
        : String(request.status || "") === "approved"
            ? [
                { action: "start-shipping", label: "Gửi hàng cho chi nhánh", tone: "primary" },
                { action: "reject-request", label: "Từ chối yêu cầu", tone: "danger" }
            ]
            : String(request.status || "") === "receiving"
                ? [{ action: "complete-request", label: "Xác nhận hoàn tất", tone: "primary" }]
                : [];

    return `
      <aside class="branch-shipment-detail-card surface">
        <div class="branch-shipment-detail-head">
          <div>
            <h3>Chi tiết yêu cầu</h3>
            ${renderBranchRequestStatusPill(request.status)}
          </div>
          <button type="button" data-branch-shipment-action="clear-detail" aria-label="Đóng chi tiết">×</button>
        </div>

        <div class="branch-shipment-detail-code">
          <strong>${escapeHtml(request.code || "REQ")}</strong>
          <span>${escapeHtml(request.branch_name || getBranchLabel(branch))}</span>
        </div>

        <div class="branch-shipment-detail-meta">
          <div><span>Người gửi</span><strong>${escapeHtml(branch?.manager || "Nhân viên kho")}</strong></div>
          <div><span>Ngày gửi</span><strong>${escapeHtml(formatDate(request.created_at))}</strong></div>
          <div><span>Dự kiến nhận</span><strong>${escapeHtml(request.expected_date ? formatDate(request.expected_date) : "Chưa chọn")}</strong></div>
          <div><span>Ghi chú</span><strong>${escapeHtml(request.note || "Không có ghi chú")}</strong></div>
        </div>

        <div class="branch-shipment-detail-products">
          <h4>Danh sách sản phẩm</h4>
          ${(request.items || []).map((item) => {
              const product = (state.products || []).find((entry) => String(entry.id) === String(item.product_id));
              const stock = product ? getBranchProductStock(product, request.branch_key) : 0;
              return `
                <article class="branch-shipment-product-row">
                  <img src="${escapeHtml(resolveMediaUrl(item.thumbnail_url || product?.thumbnail_url, defaultProductThumb()))}" alt="">
                  <div>
                    <strong>${escapeHtml(item.name || product?.name || "Sản phẩm")}</strong>
                    <span>${escapeHtml(item.sku || product?.sku || "-")}</span>
                    <small>Tồn hiện tại: ${formatNumber(stock)} ${escapeHtml(item.unit || getProductUnit(product))}</small>
                  </div>
                  <input value="${escapeHtml(String(item.quantity || 1))}" inputmode="numeric" data-branch-shipment-quantity="${escapeHtml(String(item.product_id))}" data-request-id="${escapeHtml(String(request.id))}" ${["completed", "rejected"].includes(String(request.status)) ? "disabled" : ""}>
                  <span>${escapeHtml(item.unit || getProductUnit(product))}</span>
                </article>
              `;
          }).join("") || '<p class="branch-import-empty">Phiếu chưa có sản phẩm.</p>'}
        </div>

        <div class="branch-shipment-total">
          <span>Tổng số lượng đề xuất</span>
          <strong>${formatNumber(getRequestTotalQuantity(request))}</strong>
        </div>

        <div class="branch-shipment-detail-actions">
          ${actions.map((item) => `<button class="${item.tone === "primary" ? "primary-button" : "ghost-button branch-shipment-danger-button"}" type="button" data-branch-shipment-action="${escapeHtml(item.action)}" data-request-id="${escapeHtml(String(request.id))}">${escapeHtml(item.label)}</button>`).join("")}
        </div>
      </aside>
    `;
}

function renderBranchShipmentWorkspace() {
    const requests = getVisibleShipmentRequests();
    const detailRequest = getShipmentDetailRequest(requests);

    elements.branchesMeta.textContent = `${formatNumber(requests.length)} yêu cầu cần xử lý`;
    elements.branchesContent.innerHTML = `
      <section class="branch-shipment-shell">
        <div class="branch-shipment-layout">
          <section class="branch-shipment-main-column">
            <div class="branch-shipment-topbar">
              <label class="branch-import-select branch-shipment-branch-select">
                <span>Chi nhánh</span>
                <select data-branch-shipment-filter="branch">
                  <option value="all" ${state.branchShipmentBranchFilter === "all" ? "selected" : ""}>Tất cả chi nhánh</option>
                  ${STORE_BRANCHES.map((branch) => `<option value="${escapeHtml(branch.key)}" ${String(state.branchShipmentBranchFilter) === String(branch.key) ? "selected" : ""}>${escapeHtml(getBranchLabel(branch))}</option>`).join("")}
                </select>
              </label>
              <button class="primary-button branch-shipment-create-button" type="button" data-branch-shipment-draft-action="open">+ Tạo đơn gửi hàng</button>
            </div>

            <section class="branch-shipment-list-card surface">
              <div class="branch-shipment-tabs">
                ${[
                  ["all", "Tất cả trạng thái"],
                  ["pending", "Chờ duyệt"],
                  ["approved", "Đã duyệt"],
                  ["receiving", "Đang gửi hàng"],
                  ["completed", "Hoàn tất"],
                  ["rejected", "Từ chối"]
                ].map(([value, label]) => `<button class="${String(state.branchShipmentStatusFilter || "all") === value ? "active" : ""}" type="button" data-branch-shipment-filter-status="${value}">${label}</button>`).join("")}
              </div>

              <div class="branch-shipment-filter-row">
                <input value="${escapeHtml(state.branchShipmentKeyword || "")}" data-branch-shipment-filter="keyword" placeholder="Tìm mã yêu cầu, chi nhánh, sản phẩm...">
              </div>

              <div class="branch-shipment-request-list">
                ${requests.map((request) => renderShipmentRequestCard(request)).join("") || '<p class="branch-import-empty">Không có yêu cầu phù hợp với bộ lọc hiện tại.</p>'}
              </div>
            </section>
          </section>

          ${renderShipmentDetail(detailRequest)}
        </div>
        ${renderBranchShipmentCreateModal()}
      </section>
    `;
}

export function renderBranches() {
    ensureBranchesLoadedFromApi();
    ensureBranchImportRequestsLoadedFromApi();
    if (!elements.branchesContent) return;
    const isImportWorkspace = state.branchWorkspace === "importRequests";
    const isShipmentWorkspace = state.branchWorkspace === "shipments";
    const title = elements.branchesPanel?.querySelector(".panel-head h2");
    const actionWrap = elements.branchesPanel?.querySelector(".panel-actions");
    if (title) title.textContent = isShipmentWorkspace ? "Gửi hàng cho chi nhánh" : isImportWorkspace ? "Yêu cầu nhập hàng" : "Quản lý chi nhánh";
    if (actionWrap) {
        actionWrap.classList.toggle("hidden", isImportWorkspace || isShipmentWorkspace);
    }

    if (!state.branchImportExpectedDate) {
        state.branchImportExpectedDate = defaultBranchImportExpectedDate();
    }

    if (isImportWorkspace) {
        renderBranchImportWorkspace();
        return;
    }
    if (isShipmentWorkspace) {
        renderBranchShipmentWorkspace();
        return;
    }
    renderBranchListWorkspace();
}

export function openBranchModal(branchKey = "") {
    if (!elements.branchModal || !elements.branchForm) return;
    const branch = STORE_BRANCHES.find((item) => item.key === branchKey) || null;
    elements.branchForm.reset();
    branchImageFile = null;
    state.branchImageDataUrl = branch?.image_url || "";
    if (elements.branchForm.elements.key) elements.branchForm.elements.key.value = branch?.key || "";
    const labelInput = elements.branchForm.elements.branch_label || elements.branchForm.elements.label;
    const managerInput = elements.branchForm.elements.branch_manager || elements.branchForm.elements.manager;
    const phoneInput = elements.branchForm.elements.branch_contact_number || elements.branchForm.elements.phone;
    const addressInput = elements.branchForm.elements.branch_location_detail || elements.branchForm.elements.address;
    const cityInput = elements.branchForm.elements.branch_city_code || elements.branchForm.elements.city;
    const openTimeInput = elements.branchForm.elements.branch_open_time || elements.branchForm.elements.open_time;
    const closeTimeInput = elements.branchForm.elements.branch_close_time || elements.branchForm.elements.close_time;
    if (labelInput) labelInput.value = branch?.label || "";
    if (managerInput) managerInput.value = branch?.manager || "";
    if (phoneInput) phoneInput.value = branch?.phone || "";
    if (addressInput) addressInput.value = branch?.address || "";
    const hours = parseBranchHours(branch?.hours);
    if (openTimeInput) openTimeInput.value = hours.openTime;
    if (closeTimeInput) closeTimeInput.value = hours.closeTime;
    if (elements.branchImagePreview) {
        if (branch?.image_url) {
            elements.branchImagePreview.src = resolveMediaUrl(branch.image_url);
            elements.branchImagePreview.classList.remove("hidden");
            elements.branchForm.querySelector(".branch-upload-placeholder")?.classList.add("hidden");
        } else {
            elements.branchImagePreview.removeAttribute("src");
            elements.branchImagePreview.classList.add("hidden");
            elements.branchForm.querySelector(".branch-upload-placeholder")?.classList.remove("hidden");
        }
    }
    if (cityInput) {
        cityInput.innerHTML = `<option value="">Chọn thành phố</option>${CITY_OPTIONS.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join("")}`;
        cityInput.value = branch?.city || "";
    }
    const title = elements.branchModal.querySelector(".branch-modal-header h2");
    if (title) title.textContent = branch ? "Sửa chi nhánh" : "Thêm chi nhánh mới";
    const submitButton = elements.branchForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = branch ? "Lưu thay đổi" : "Thêm chi nhánh";
    elements.branchModal.classList.remove("hidden");
}

export function closeBranchModal() {
    elements.branchModal?.classList.add("hidden");
}

export function handleBranchImage(file) {
    if (!file) return;
    branchImageFile = file;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        state.branchImageDataUrl = String(reader.result || "");
        if (elements.branchImagePreview) {
            elements.branchImagePreview.src = state.branchImageDataUrl;
            elements.branchImagePreview.classList.remove("hidden");
        }
        elements.branchForm?.querySelector(".branch-upload-placeholder")?.classList.add("hidden");
    });
    reader.readAsDataURL(file);
}

export async function submitBranchForm(raw) {
    const key = String(raw.key || "").trim();
    const label = String(raw.branch_label || raw.label || "").trim();
    const manager = String(raw.branch_manager || raw.manager || "").trim();
    const phone = String(raw.branch_contact_number || raw.phone || "").trim();
    const city = String(raw.branch_city_code || raw.city || "").trim();
    const address = String(raw.branch_location_detail || raw.address || "").trim();
    const openTime = String(raw.branch_open_time || raw.open_time || "").trim();
    const closeTime = String(raw.branch_close_time || raw.close_time || "").trim();
    if (!label) throw new Error("Vui lòng nhập tên chi nhánh.");
    if (!phone) throw new Error("Vui lòng nhập số điện thoại chi nhánh.");
    if (!city) throw new Error("Vui lòng chọn thành phố.");
    if (!address) throw new Error("Vui lòng nhập địa chỉ chi tiết.");
    if (!openTime || !closeTime) throw new Error("Vui lòng nhập thời gian làm việc của chi nhánh.");

    let imageUrl = state.branchImageDataUrl;
    if (branchImageFile) {
        imageUrl = await uploadImageFile(branchImageFile, "branches");
    }

    const payload = {
        key: key || buildBranchKey(),
        code: key ? (STORE_BRANCHES.find((branch) => branch.key === key)?.code || "") : "",
        label,
        name: label,
        manager,
        phone,
        city,
        address,
        hours: `${openTime} - ${closeTime}`,
        image_url: imageUrl
    };

    const existingIndex = STORE_BRANCHES.findIndex((branch) => branch.key === key);
    const response = await apiFetch(existingIndex >= 0 ? `/api/branches/${encodeURIComponent(key)}` : "/api/branches", {
        method: existingIndex >= 0 ? "PATCH" : "POST",
        body: JSON.stringify(payload)
    });
    const savedBranch = normalizeBranch(response?.branch || payload, existingIndex >= 0 ? existingIndex : STORE_BRANCHES.length);

    if (existingIndex >= 0) {
        STORE_BRANCHES.splice(existingIndex, 1, { ...STORE_BRANCHES[existingIndex], ...savedBranch });
    } else {
        STORE_BRANCHES.push(savedBranch);
    }
    saveStoreBranches();
    branchImageFile = null;
    if (!STORE_BRANCHES.some((branch) => branch.key === state.publishStoreFilter)) {
        state.publishStoreFilter = STORE_BRANCHES[0]?.key || "store_1";
    }
    closeBranchModal();
    renderBranches();
    if (!elements.panels.products?.classList.contains("hidden")) {
        updateProductWorkspace();
        renderProducts();
    }
    showToast(existingIndex >= 0 ? "Đã cập nhật chi nhánh." : "Đã thêm chi nhánh mới.");
}

export async function handleBranchAction(action, branchKey) {
    const branch = STORE_BRANCHES.find((item) => item.key === branchKey);
    if (!branch) return;
    if (action === "edit") {
        openBranchModal(branchKey);
        return;
    }
    if (action === "delete") {
        if (!window.confirm(`Bạn chắc chắn muốn xóa chi nhánh "${branch.label || branch.name}"?`)) return;
        try {
            await apiFetch(`/api/branches/${encodeURIComponent(branchKey)}`, {
                method: "DELETE"
            });
        } catch (error) {
            showToast(error.message || "Không xóa được chi nhánh.", true);
            return;
        }
        const index = STORE_BRANCHES.findIndex((item) => item.key === branchKey);
        if (index < 0) return;
        STORE_BRANCHES.splice(index, 1);
        if (state.publishStoreFilter === branchKey) {
            state.publishStoreFilter = STORE_BRANCHES[0]?.key || "store_1";
        }
        saveStoreBranches();
        renderBranches();
        if (!elements.panels.products?.classList.contains("hidden")) {
            updateProductWorkspace();
            renderProducts();
        }
        showToast("Đã xóa chi nhánh.");
        return;
    }
    if (action === "toggle-status") {
        const nextStatus = branch.status === "paused" || branch.status === "closed" ? "active" : "paused";
        const message = nextStatus === "paused"
            ? `Tạm ngưng chi nhánh "${branch.label || branch.name}"?`
            : `Mở lại chi nhánh "${branch.label || branch.name}"?`;
        if (!window.confirm(message)) return;
        try {
            const response = await apiFetch(`/api/branches/${encodeURIComponent(branchKey)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    ...branch,
                    status: nextStatus
                })
            });
            Object.assign(branch, normalizeBranch(response?.branch || { ...branch, status: nextStatus }));
        } catch (error) {
            showToast(error.message || "Không cập nhật được trạng thái chi nhánh.", true);
            return;
        }
        saveStoreBranches();
        renderBranches();
        if (!elements.panels.products?.classList.contains("hidden")) {
            updateProductWorkspace();
            renderProducts();
        }
        showToast(nextStatus === "paused" ? "Đã tạm ngưng chi nhánh." : "Đã mở lại chi nhánh.");
    }
}

export async function handleBranchImportClick(event) {
    const draftButton = event.target.closest("[data-branch-shipment-draft-action]");
    if (draftButton) {
        const action = draftButton.dataset.branchShipmentDraftAction;
        const index = Number(draftButton.dataset.index || 0);

        if (action === "open") {
            state.branchShipmentDraft = null;
            ensureBranchShipmentDraft();
            state.branchShipmentCreateOpen = true;
            renderBranches();
            return true;
        }

        if (action === "close") {
            state.branchShipmentCreateOpen = false;
            state.branchShipmentDraft = null;
            renderBranches();
            return true;
        }

        if (action === "add-product") {
            addShipmentDraftProduct();
            renderBranches();
            return true;
        }

        if (action === "remove-product") {
            removeShipmentDraftProduct(index);
            renderBranches();
            return true;
        }

        if (action === "increase-quantity" || action === "decrease-quantity") {
            const draft = ensureBranchShipmentDraft();
            const current = Number(draft.items[index]?.quantity || 1);
            updateShipmentDraftQuantity(index, current + (action === "increase-quantity" ? 1 : -1));
            renderBranches();
            return true;
        }

        return true;
    }

    const shipmentStatusButton = event.target.closest("[data-branch-shipment-filter-status]");
    if (shipmentStatusButton) {
        state.branchShipmentStatusFilter = shipmentStatusButton.dataset.branchShipmentFilterStatus || "all";
        state.branchShipmentDetailId = "";
        renderBranches();
        return true;
    }

    const shipmentButton = event.target.closest("[data-branch-shipment-action]");
    if (shipmentButton) {
        const action = shipmentButton.dataset.branchShipmentAction;
        const requestId = shipmentButton.dataset.requestId;

        if (action === "view-request") {
            state.branchShipmentDetailId = requestId || "";
            renderBranches();
            return true;
        }

        if (action === "clear-detail") {
            state.branchShipmentDetailId = "";
            renderBranches();
            return true;
        }

        if (action === "approve-request") {
            await changeShipmentRequestStatus(requestId, "approved");
            renderBranches();
            return true;
        }

        if (action === "start-shipping") {
            await changeShipmentRequestStatus(requestId, "receiving");
            renderBranches();
            return true;
        }

        if (action === "complete-request") {
            await completeShipmentRequest(requestId);
            renderBranches();
            return true;
        }

        if (action === "reject-request") {
            if (!window.confirm("Bạn chắc chắn muốn từ chối yêu cầu nhập hàng này?")) return true;
            await changeShipmentRequestStatus(requestId, "rejected");
            renderBranches();
            return true;
        }

        return true;
    }

    const button = event.target.closest("[data-branch-import-action]");
    if (!button) return false;
    const action = button.dataset.branchImportAction;
    const productId = button.dataset.productId;

    if (action === "add-product") {
        const input = elements.branchesContent?.querySelector(`[data-branch-import-suggest="${CSS.escape(String(productId))}"]`);
        addProductToBranchRequest(productId, Number(input?.value || 0));
        renderBranches();
        return true;
    }

    if (action === "remove-product") {
        removeProductFromBranchRequest(productId);
        renderBranches();
        return true;
    }

    if (action === "increase-suggest" || action === "decrease-suggest") {
        const input = elements.branchesContent?.querySelector(`[data-branch-import-suggest="${CSS.escape(String(productId))}"]`);
        const current = Number(input?.value || 1);
        if (input) input.value = String(Math.max(1, current + (action === "increase-suggest" ? 1 : -1)));
        return true;
    }

    if (action === "save-draft" || action === "submit-request") {
        try {
            await submitBranchImportRequest({ asDraft: action === "save-draft" });
        } catch (error) {
            showToast(error.message || "Không lưu được phiếu yêu cầu nhập hàng.", true);
        }
        renderBranches();
        return true;
    }

    return false;
}

export function handleBranchImportInput(event) {
    const target = event.target;
    if (target?.dataset.branchShipmentDraftField) {
        const draft = ensureBranchShipmentDraft();
        draft[target.dataset.branchShipmentDraftField] = target.value || "";
        return true;
    }
    if (target?.dataset.branchShipmentDraftProduct !== undefined) {
        updateShipmentDraftProduct(Number(target.dataset.branchShipmentDraftProduct), target.value);
        renderBranches();
        return true;
    }
    if (target?.dataset.branchShipmentDraftQuantity !== undefined) {
        updateShipmentDraftQuantity(Number(target.dataset.branchShipmentDraftQuantity), target.value);
        return true;
    }
    if (target?.dataset.branchShipmentFilter === "branch") {
        state.branchShipmentBranchFilter = target.value || "all";
        state.branchShipmentDetailId = "";
        renderBranches();
        return true;
    }
    if (target?.dataset.branchShipmentFilter === "keyword") {
        state.branchShipmentKeyword = target.value || "";
        renderBranches();
        const nextInput = elements.branchesContent?.querySelector("[data-branch-shipment-filter='keyword']");
        if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(state.branchShipmentKeyword.length, state.branchShipmentKeyword.length);
        }
        return true;
    }
    if (target?.dataset.branchShipmentQuantity) {
        patchShipmentItemQuantityLocal(target.dataset.requestId, target.dataset.branchShipmentQuantity, target.value);
        updateShipmentItemQuantity(target.dataset.requestId, target.dataset.branchShipmentQuantity, target.value)
            .catch((error) => showToast(error.message || "Không cập nhật được số lượng trong phiếu.", true));
        return true;
    }
    if (target?.dataset.branchImportField === "note") {
        state.branchImportNote = target.value || "";
        return true;
    }
    if (target?.dataset.branchImportField === "expected-date") {
        state.branchImportExpectedDate = target.value || defaultBranchImportExpectedDate();
        return true;
    }
    if (target?.dataset.branchImportField === "branch") {
        state.branchImportBranchKey = target.value || STORE_BRANCHES[0]?.key || "";
        state.branchImportDraftItems = [];
        renderBranches();
        return true;
    }
    if (target?.dataset.branchImportQuantity) {
        setDraftItemQuantity(target.dataset.branchImportQuantity, target.value);
        return true;
    }
    return false;
}

export async function submitBranchShipmentCreateForm(event) {
    const form = event.target.closest("[data-branch-shipment-create-form]");
    if (!form) return false;
    event.preventDefault();
    try {
        await submitBranchShipmentDraft();
    } catch (error) {
        showToast(error.message || "Không tạo được đơn gửi hàng.", true);
    }
    renderBranches();
    return true;
}
