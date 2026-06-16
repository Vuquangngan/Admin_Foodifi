import { apiFetch, elements, escapeHtml, fillSelectOptions, formatDate, formatNumber, resolveMediaUrl, showToast, state, statusPill, STORAGE_KEYS } from "./core.js";

let supplierLogoFile = null;

function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
}

function readProductImportSupplierRecords() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.productImportSuppliers) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.productImportSuppliers);
        return [];
    }
}

function findImportedSupplierName(product) {
    const productId = Number(product?.id || 0);
    const sku = normalizeText(product?.sku);
    const name = normalizeText(product?.name);
    const record = readProductImportSupplierRecords().find((item) => {
        if (productId && Number(item.product_id) === productId) return true;
        if (sku && normalizeText(item.sku) === sku) return true;
        if (name && normalizeText(item.product_name) === name) return true;
        return false;
    });
    return String(record?.supplier_name || "").trim();
}

function getSupplierNameFromProduct(product) {
    if (product?.supplier_name) return String(product.supplier_name).trim();
    const description = String(product?.description || "");
    const properMatch = description.match(/Nhà cung cấp:\s*([^\n]+)/i);
    if (properMatch) return String(properMatch[1] || "").trim();
    const match = description.match(/Nh(?:à|a) cung c(?:ấ|a)p:\s*([^\n]+)/i);
    if (match) return String(match[1] || "").trim();
    return findImportedSupplierName(product);
}

function getSupplierById(id) {
    return (state.suppliers || []).find((supplier) => Number(supplier.id) === Number(id)) || null;
}

function getSupplierLogoSource(supplier) {
    const value = String(supplier?.logo_url || "").trim();
    return value ? resolveMediaUrl(value, "") : "";
}

function buildSupplierAvatar(supplier) {
    const logoSource = getSupplierLogoSource(supplier);
    if (logoSource) {
        return `<img src="${escapeHtml(logoSource)}" alt="${escapeHtml(supplier?.name || "Logo đối tác")}">`;
    }

    return escapeHtml(String(supplier?.name || "?").trim().slice(0, 2).toUpperCase());
}

function setSupplierLogoPreview(value) {
    if (!elements.supplierLogoPreview) return;

    const nextValue = String(value || "").trim();
    if (!nextValue) {
        elements.supplierLogoPreview.src = "";
        elements.supplierLogoPreview.classList.add("hidden");
        return;
    }

    elements.supplierLogoPreview.src = nextValue;
    elements.supplierLogoPreview.classList.remove("hidden");
}

async function uploadSupplierLogo(file) {
    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch("/api/uploads/images?folder=suppliers", {
        method: "POST",
        body: formData
    });

    return payload?.file?.relative_url
        || payload?.file?.url
        || payload?.hinh_anh?.duong_dan_tuong_doi
        || payload?.hinh_anh?.duong_dan
        || "";
}

function getSupplierProductCount(supplier) {
    const supplierName = normalizeText(supplier?.name);
    if (!supplierName) return 0;
    return (state.products || []).filter((product) => normalizeText(getSupplierNameFromProduct(product)) === supplierName).length;
}

function readSupplierReturns() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.supplierReturns) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        localStorage.removeItem(STORAGE_KEYS.supplierReturns);
        return [];
    }
}

function saveSupplierReturns(tickets) {
    localStorage.setItem(STORAGE_KEYS.supplierReturns, JSON.stringify(Array.isArray(tickets) ? tickets : []));
}

function getProductStock(product) {
    const value = Number(product?.stock_quantity ?? product?.stock ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function defaultSupplierProductThumb() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88'%3E%3Crect width='100%25' height='100%25' rx='16' fill='%23efe5d8'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23765f4a' font-family='Arial' font-size='16'%3ESP%3C/text%3E%3C/svg%3E";
}

function getProductImageSource(product) {
    const images = Array.isArray(product?.images)
        ? product.images
        : Array.isArray(product?.danh_sach_hinh_anh)
            ? product.danh_sach_hinh_anh
            : [];
    const firstImage = images.find((image) => image?.image_url || image?.duong_dan_anh);
    return product?.thumbnail_url
        || product?.anh_dai_dien
        || firstImage?.image_url
        || firstImage?.duong_dan_anh
        || "";
}

function renderSupplierProductThumb(product, className = "supplier-return-thumb") {
    const fallback = defaultSupplierProductThumb();
    const src = resolveMediaUrl(getProductImageSource(product), fallback);
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(product?.name || "Sản phẩm")}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';">`;
}

function getProductExpirationMeta(product) {
    const rawDate = product?.expiration_date || product?.expiry_date || product?.expires_at || "";
    if (!rawDate) return null;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    let status = "Gần hết hạn";
    if (daysLeft < 0) status = "Quá hạn";
    else if (daysLeft <= 7) status = "Khẩn cấp";

    return { date, daysLeft, status };
}

function getSupplierFilterOptions() {
    const names = new Set();
    (state.suppliers || []).forEach((supplier) => {
        if (supplier?.name) names.add(String(supplier.name).trim());
    });
    (state.products || []).forEach((product) => {
        const name = getSupplierNameFromProduct(product);
        if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "vi"));
}

function getExpiringSupplierProducts() {
    const filters = state.supplierReturnFilters || {};
    const keyword = normalizeText(filters.keyword);
    const supplierFilter = normalizeText(filters.supplier);
    const untilDate = filters.until ? new Date(filters.until) : null;
    if (untilDate && !Number.isNaN(untilDate.getTime())) untilDate.setHours(23, 59, 59, 999);

    return (state.products || []).filter((product) => {
        const expiration = getProductExpirationMeta(product);
        if (!expiration || expiration.daysLeft > 30) return false;
        if (getProductStock(product) <= 0) return false;

        const supplierName = getSupplierNameFromProduct(product) || "Chưa xác định";
        if (supplierFilter && normalizeText(supplierName) !== supplierFilter) return false;

        if (untilDate && !Number.isNaN(untilDate.getTime()) && expiration.date > untilDate) return false;

        if (keyword) {
            const haystack = normalizeText(`${product.name || ""} ${product.sku || ""} ${supplierName}`);
            if (!haystack.includes(keyword)) return false;
        }

        return true;
    }).sort((a, b) => {
        const first = getProductExpirationMeta(a)?.date?.getTime() || 0;
        const second = getProductExpirationMeta(b)?.date?.getTime() || 0;
        return first - second;
    });
}

function getSupplierReturnTicketByProduct(productId) {
    const product = (state.products || []).find((item) => Number(item.id) === Number(productId));
    if (!product) return null;
    const existing = readSupplierReturns().find((ticket) => {
        if (Number(ticket.product_id) === Number(product.id)) return true;
        if (!Array.isArray(ticket.items)) return false;
        return ticket.items.some((item) => Number(item.product_id) === Number(product.id));
    });
    return existing || null;
}

function buildSupplierReturnCode() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
    ].join("");
    return `RTN-${stamp}`;
}

function getSupplierReturnSelectableProducts() {
    return (state.products || [])
        .filter((product) => getProductStock(product) > 0)
        .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi"));
}

function buildSupplierReturnDraftItem(product, overrides = {}) {
    const stock = getProductStock(product);
    return {
        product_id: String(overrides.product_id ?? product?.id ?? "").trim(),
        quantity: String(overrides.quantity ?? (product ? Math.max(1, Math.min(stock, 1)) : "")).trim(),
        reason: String(overrides.reason || "near_expiry").trim() || "near_expiry"
    };
}

function createSupplierReturnDraft(productId) {
    if (!productId || productId === "new") {
        return {
            supplier_name: "",
            warehouse_name: "Kho tổng",
            return_date: new Date().toISOString().slice(0, 10),
            note: "",
            items: [buildSupplierReturnDraftItem(null)]
        };
    }

    const product = (state.products || []).find((item) => Number(item.id) === Number(productId));
    if (!product) return null;

    const existing = getSupplierReturnTicketByProduct(product.id);
    const items = Array.isArray(existing?.items) && existing.items.length
        ? existing.items.map((item) => {
            const selectedProduct = (state.products || []).find((entry) => Number(entry.id) === Number(item.product_id)) || product;
            return buildSupplierReturnDraftItem(selectedProduct, item);
        })
        : [buildSupplierReturnDraftItem(product, existing || {})];

    return {
        supplier_name: String(existing?.supplier_name || getSupplierNameFromProduct(product) || "Chưa xác định").trim(),
        warehouse_name: String(existing?.warehouse_name || "Kho tổng").trim(),
        return_date: String(existing?.return_date || new Date().toISOString().slice(0, 10)).trim(),
        note: String(existing?.note || "").trim(),
        items
    };
}

function ensureSupplierReturnDraft(productId = state.supplierReturnModalProductId) {
    if (!productId) return null;
    if (state.supplierReturnDraft && String(state.supplierReturnDraftSourceId || "") === String(productId)) {
        return state.supplierReturnDraft;
    }

    state.supplierReturnDraftSourceId = String(productId);
    state.supplierReturnDraft = createSupplierReturnDraft(productId);
    return state.supplierReturnDraft;
}

function syncSupplierReturnDraftFromForm() {
    const form = document.querySelector("#supplierReturnTicketForm");
    if (!form || !state.supplierReturnDraft) return state.supplierReturnDraft;

    const data = new FormData(form);
    const productIds = data.getAll("item_product_id");
    const quantities = data.getAll("item_quantity");
    const reasons = data.getAll("item_reason");

    state.supplierReturnDraft = {
        supplier_name: String(data.get("supplier_name") || "").trim(),
        warehouse_name: String(data.get("warehouse_name") || "").trim(),
        return_date: String(data.get("return_date") || "").trim(),
        note: String(data.get("note") || "").trim(),
        items: productIds.map((productId, index) => {
            const product = (state.products || []).find((item) => Number(item.id) === Number(productId));
            return buildSupplierReturnDraftItem(product, {
                product_id: String(productId || "").trim(),
                quantity: String(quantities[index] || "").trim(),
                reason: String(reasons[index] || "near_expiry").trim()
            });
        })
    };

    return state.supplierReturnDraft;
}

function addSupplierReturnDraftItem(productIds = []) {
    const draft = syncSupplierReturnDraftFromForm() || ensureSupplierReturnDraft();
    if (!draft) return;

    const options = getSupplierReturnSelectableProducts();
    if (!options.length) {
        showToast("Không còn sản phẩm nào để thêm vào phiếu trả.");
        return;
    }

    if (productIds.length > 0) {
        for (const pid of productIds) {
            const product = options.find((p) => String(p.id) === String(pid));
            draft.items.push(buildSupplierReturnDraftItem(product || null, product ? { product_id: product.id } : {}));
        }
    } else {
        draft.items.push(buildSupplierReturnDraftItem(null));
    }
}

function renderProductSelectModal() {
    const products = getSupplierReturnSelectableProducts();
    const selected = state.productSelectModalSelected || [];
    const keyword = state.productSelectModalKeyword || "";
    const filtered = keyword
        ? products.filter((p) => {
              const kw = keyword.toLowerCase();
              return (p.name || "").toLowerCase().includes(kw) || (p.sku || "").toLowerCase().includes(kw);
          })
        : products;

    return `
      <div class="modal-backdrop product-select-backdrop" data-supplier-action="close-product-select" style="z-index:1100">
        <div class="modal-card product-select-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()" style="max-width:540px;width:100%;max-height:80vh;display:flex;flex-direction:column;padding:0;overflow:hidden">
          <div style="padding:20px 24px 12px;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div>
                <strong style="font-size:1.05rem">Chọn sản phẩm trong kho</strong><br>
                <small style="color:var(--text-muted)">${filtered.length} sản phẩm khả dụng</small>
              </div>
              <button class="icon-button" type="button" data-supplier-action="close-product-select" style="font-size:1.2rem">✕</button>
            </div>
            <div style="position:relative">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
              <input
                id="productSelectSearch"
                type="text"
                placeholder="Nhập tên sản phẩm hoặc SKU..."
                value="${escapeHtml(keyword)}"
                data-supplier-action="search-product-select"
                style="width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:0.9rem"
                oninput="this.setAttribute('data-val',this.value)"
              >
            </div>
          </div>
          <div style="overflow-y:auto;flex:1;padding:12px 24px">
            ${filtered.length === 0
                ? `<p style="text-align:center;color:var(--text-muted);padding:24px 0">Không tìm thấy sản phẩm</p>`
                : filtered.map((p) => {
                    const stock = getProductStock(p);
                    const unit = p.stock_unit || p.unit || "đơn vị";
                    const isSelected = selected.includes(String(p.id));
                    return `
                      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light,#f0f0f0)">
                        <span class="supplier-return-thumb small" style="flex-shrink:0">${renderSupplierProductThumb(p)}</span>
                        <div style="flex:1;min-width:0">
                          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.name || "-")}</div>
                          <small style="color:var(--text-muted)">SKU: ${escapeHtml(p.sku || "—")}</small><br>
                          <small style="color:var(--text-muted)">Kho tổng còn ${formatNumber(stock)} ${escapeHtml(unit)}</small>
                        </div>
                        <button
                          class="${isSelected ? "primary-button" : "chip-button"}"
                          type="button"
                          data-supplier-action="toggle-product-select"
                          data-id="${escapeHtml(p.id)}"
                          style="flex-shrink:0"
                        >${isSelected ? "✓ Đã chọn" : "Chọn"}</button>
                      </div>`;
                }).join("")}
          </div>
          <div style="padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">
            <button class="ghost-button" type="button" data-supplier-action="close-product-select">Hủy</button>
            <button class="primary-button" type="button" data-supplier-action="confirm-product-select">Thêm ${selected.length} sản phẩm</button>
          </div>
        </div>
      </div>
    `;
}

function removeSupplierReturnDraftItem(index) {
    const draft = syncSupplierReturnDraftFromForm() || ensureSupplierReturnDraft();
    if (!draft) return;

    draft.items = draft.items.filter((_, itemIndex) => itemIndex !== Number(index));
}

function renderSupplierReturnItemRow(item, index, selectableProducts) {
    const product = (state.products || []).find((entry) => Number(entry.id) === Number(item.product_id));
    const stock = getProductStock(product);
    const unit = product?.stock_unit || product?.unit || "đơn vị";
    const quantityValue = item.quantity || "";

    return `
      <div class="supplier-return-item-row">
        <div class="supplier-return-product-info">
          <span class="supplier-return-thumb small">${renderSupplierProductThumb(product)}</span>
          <div class="supplier-return-product-copy">
            <select name="item_product_id" data-return-field="product" aria-label="Sản phẩm trả hàng">
              <option value="">Chọn sản phẩm từ kho</option>
              ${selectableProducts.map((option) => `<option value="${escapeHtml(option.id)}" ${Number(option.id) === Number(item.product_id) ? "selected" : ""}>${escapeHtml(option.name || "-")} (${escapeHtml(option.sku || "Không có SKU")})</option>`).join("")}
            </select>
            <small>SKU: ${escapeHtml(product?.sku || "Chưa chọn sản phẩm")}</small>
          </div>
        </div>
        <strong>${formatNumber(stock)} ${escapeHtml(unit)}</strong>
        <label class="supplier-return-quantity">
          <input name="item_quantity" type="number" min="1" max="${escapeHtml(stock || 1)}" value="${escapeHtml(quantityValue)}" required>
          <span>${escapeHtml(unit)}</span>
        </label>
        <select name="item_reason" required>
          ${["near_expiry", "damaged", "bad_package", "quality_issue", "other"].map((reason) => `<option value="${reason}" ${reason === String(item.reason || "near_expiry") ? "selected" : ""}>${escapeHtml(getSupplierReturnReasonLabel(reason))}</option>`).join("")}
        </select>
        <button class="icon-button soft-danger" type="button" data-supplier-action="remove-return-item" data-id="${escapeHtml(index)}" aria-label="Xóa sản phẩm">🗑</button>
      </div>
    `;
}

function getSupplierReturnReasonLabel(reason) {
    const labels = {
        near_expiry: "Hàng gần hết hạn",
        damaged: "Hàng dập nát",
        bad_package: "Bao bì hư hỏng",
        quality_issue: "Không đạt chất lượng",
        other: "Lý do khác"
    };
    return labels[reason] || labels.near_expiry;
}

function getSupplierReturnStatusLabel(ticket, fallback = "Gần hết hạn") {
    if (!ticket) return fallback;
    if (ticket.status === "resolved") return "Đã giải quyết";
    return "Đã tạo phiếu";
}

function renderSupplierReturnModal() {
    const productId = state.supplierReturnModalProductId;
    if (!productId) return "";

    const product = (state.products || []).find((item) => Number(item.id) === Number(productId));
    if (!product) return "";

    const expiration = getProductExpirationMeta(product);
    const supplierName = getSupplierNameFromProduct(product) || "Chưa xác định";
    const stock = getProductStock(product);
    const unit = product.stock_unit || product.unit || "đơn vị";

    return `
      <div class="modal-backdrop supplier-return-backdrop" data-supplier-action="close-return-modal">
        <div class="modal-card supplier-return-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <div class="supplier-return-modal-head">
            <div>
              <p class="eyebrow">Phiếu trả hàng</p>
              <h2>Tạo phiếu trả nhà cung cấp</h2>
              <p class="section-copy">Áp dụng cho hàng gần hết hạn hoặc hàng dập nát cần hoàn trả.</p>
            </div>
            <button class="ghost-button" type="button" data-supplier-action="close-return-modal">Đóng</button>
          </div>
          <form id="supplierReturnTicketForm" class="supplier-return-form">
            <input type="hidden" name="product_id" value="${escapeHtml(product.id)}">
            <article class="supplier-return-product-card">
              <div class="supplier-return-thumb">${renderSupplierProductThumb(product)}</div>
              <div>
                <strong>${escapeHtml(product.name || "-")}</strong>
                <span>SKU: ${escapeHtml(product.sku || "-")}</span>
                <span>Nhà cung cấp: ${escapeHtml(supplierName)}</span>
              </div>
              <div class="supplier-return-stock">
                <span>Tồn kho</span>
                <strong>${formatNumber(stock)} ${escapeHtml(unit)}</strong>
              </div>
            </article>
            <div class="compact-grid">
              <label>
                <span>Ngày hết hạn</span>
                <input value="${escapeHtml(formatDate(expiration?.date))}" disabled>
              </label>
              <label>
                <span>Trạng thái</span>
                <input value="${escapeHtml(expiration?.status || "Không rõ")}" disabled>
              </label>
              <label>
                <span>Số lượng trả</span>
                <input name="quantity" type="number" min="1" max="${escapeHtml(stock)}" value="${escapeHtml(Math.max(1, Math.min(stock, stock)))}" required>
              </label>
              <label>
                <span>Lý do trả hàng</span>
                <select name="reason" required>
                  <option value="near_expiry">Hàng gần hết hạn</option>
                  <option value="damaged">Hàng dập nát</option>
                  <option value="bad_package">Bao bì hư hỏng</option>
                  <option value="other">Lý do khác</option>
                </select>
              </label>
              <label class="span-2">
                <span>Ghi chú</span>
                <textarea name="note" rows="4" placeholder="Mô tả tình trạng hàng, hình thức xử lý hoặc ghi chú cho nhà cung cấp..."></textarea>
              </label>
            </div>
            <div class="supplier-return-modal-actions">
              <button class="ghost-button" type="button" data-supplier-action="close-return-modal">Hủy</button>
              <button class="primary-button" type="button" data-supplier-action="submit-return-ticket">Lưu phiếu trả hàng</button>
            </div>
          </form>
        </div>
      </div>
    `;
}

function renderSupplierReturnSheet() {
    const productId = state.supplierReturnModalProductId;
    if (!productId) return "";

    const product = productId === "new"
        ? null
        : (state.products || []).find((item) => Number(item.id) === Number(productId));
    if (productId !== "new" && !product) return "";

    const draft = ensureSupplierReturnDraft(productId);
    const existing = product ? getSupplierReturnTicketByProduct(product.id) : null;
    const previewProductId = draft?.items?.[0]?.product_id || product?.id || "";
    const previewProduct = (state.products || []).find((item) => Number(item.id) === Number(previewProductId)) || product;
    const supplierName = draft?.supplier_name || getSupplierNameFromProduct(product) || "";
    const returnDate = draft?.return_date || new Date().toISOString().slice(0, 10);
    const warehouseName = draft?.warehouse_name || "Kho tổng";
    const supplierOptions = getSupplierFilterOptions();
    const selectableProducts = getSupplierReturnSelectableProducts();
    const itemsMarkup = draft?.items?.length
        ? draft.items.map((item, index) => renderSupplierReturnItemRow(item, index, selectableProducts)).join("")
        : `<div class="supplier-return-empty">Chưa có sản phẩm nào trong phiếu trả. Bấm "Thêm sản phẩm" để bổ sung.</div>`;

    return `
      <div class="modal-backdrop supplier-return-backdrop" data-supplier-action="close-return-modal">
        <div class="modal-card supplier-return-modal supplier-return-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <div class="supplier-return-sheet-head">
            <div>
              <p class="eyebrow">Inventory / Returns</p>
              <h2>${existing ? "Cập nhật phiếu trả hàng" : "Tạo phiếu trả hàng"}</h2>
            </div>
            <div class="supplier-return-head-actions">
              <button class="ghost-button" type="button" data-supplier-action="close-return-modal" data-id="${escapeHtml(productId)}">Hủy</button>
              <button class="primary-button" type="button" data-supplier-action="submit-return-ticket" data-id="${escapeHtml(productId)}">Xác nhận trả hàng</button>
            </div>
          </div>

          <form id="supplierReturnTicketForm" class="supplier-return-form">
            <input type="hidden" name="product_id" value="${escapeHtml(product?.id || draft?.items?.[0]?.product_id || "")}">

            <section class="supplier-return-section">
              <h3>Thông tin chung</h3>
              <div class="supplier-return-general-grid">
                <label>
                  <span>Nhà cung cấp</span>
                  <select name="supplier_name">
                    <option value="">Chọn nhà cung cấp</option>
                    ${supplierOptions.map((name) => `<option value="${escapeHtml(name)}" ${name === supplierName ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                    ${supplierOptions.includes(supplierName) || !supplierName ? "" : `<option value="${escapeHtml(supplierName)}" selected>${escapeHtml(supplierName)}</option>`}
                  </select>
                </label>
                <label>
                  <span>Kho xuất hàng</span>
                  <select name="warehouse_name">
                    ${["Kho tổng", "Kho 1 - Đông lạnh", "Kho 2 - Rau củ", "Kho 3 - Đồ khô"].map((name) => `<option value="${escapeHtml(name)}" ${name === warehouseName ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                  </select>
                </label>
                <label>
                  <span>Ngày trả hàng</span>
                  <input name="return_date" type="date" value="${escapeHtml(returnDate)}">
                </label>
              </div>
            </section>

            <section class="supplier-return-section">
              <div class="supplier-return-section-title">
                <h3>Danh sách sản phẩm trả</h3>
                <button class="text-button" type="button" data-supplier-action="add-return-item">+ Thêm sản phẩm</button>
              </div>
              <div class="supplier-return-items">
                <div class="supplier-return-items-head">
                  <span>Sản phẩm</span>
                  <span>Tồn kho hiện tại</span>
                  <span>Số lượng trả</span>
                  <span>Lý do</span>
                  <span></span>
                </div>
                ${itemsMarkup}
              </div>
            </section>

            <section class="supplier-return-bottom-grid">
              <div class="supplier-return-section">
                <h3>Bằng chứng &amp; Hình ảnh</h3>
                <div class="supplier-return-evidence">
                  <label class="supplier-return-upload">
                    <input name="evidence_images" type="file" accept="image/*" multiple hidden>
                    <span>+</span>
                    <strong>Tải lên</strong>
                  </label>
                  <span class="supplier-return-proof">${renderSupplierProductThumb(previewProduct)}</span>
                  <span class="supplier-return-proof sample"></span>
                </div>
              </div>
              <label class="supplier-return-section">
                <span>Ghi chú thêm</span>
                <textarea name="note" rows="5" placeholder="Nhập thêm chi tiết về tình trạng hàng hóa hoặc yêu cầu bồi thường...">${escapeHtml(draft?.note || "")}</textarea>
              </label>
            </section>
            ${state.productSelectModalOpen ? renderProductSelectModal() : ""}
          </form>
        </div>
      </div>
    `;
}
function renderSupplierReturns() {
    if (!elements.suppliersContent) return;

    const products = getExpiringSupplierProducts();
    const tickets = readSupplierReturns();
    const supplierOptions = getSupplierFilterOptions();
    const filters = state.supplierReturnFilters || {};
    elements.suppliersMeta.closest(".section-head")?.classList.remove("hidden");
    elements.suppliersMeta.textContent = `${formatNumber(products.length)} sản phẩm cần theo dõi`;
    elements.suppliersSummary.innerHTML = "";
    elements.suppliersContent.innerHTML = `
      <div class="supplier-return-page">
        <div class="supplier-return-toolbar">
          <label>
            <span>Tìm kiếm sản phẩm</span>
            <input id="supplierReturnKeyword" value="${escapeHtml(filters.keyword || "")}" placeholder="Tên sản phẩm hoặc SKU...">
          </label>
          <label>
            <span>Nhà cung cấp</span>
            <select id="supplierReturnSupplier">
              <option value="">Tất cả nhà cung cấp</option>
              ${supplierOptions.map((name) => `<option value="${escapeHtml(name)}" ${name === filters.supplier ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Hạn trước ngày</span>
            <input id="supplierReturnUntil" type="date" value="${escapeHtml(filters.until || "")}">
          </label>
          <button class="primary-button" type="button" data-supplier-action="filter-returns">Lọc dữ liệu</button>
          <button class="primary-button" type="button" data-supplier-action="open-return-ticket" data-id="new">Tạo phiếu trả hàng</button>
          <button class="secondary-button" type="button" data-supplier-action="export-returns">Xuất báo cáo</button>
        </div>
        <div class="suppliers-table-wrap">
          <table class="list-table suppliers-table supplier-return-table">
            <thead>
              <tr>
                <th>Sản phẩm & SKU</th>
                <th>Nhà cung cấp</th>
                <th>Ngày hết hạn</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((product) => {
                  const expiration = getProductExpirationMeta(product);
                  const supplierName = getSupplierNameFromProduct(product) || "Chưa xác định";
                  const ticket = getSupplierReturnTicketByProduct(product.id);
                  const unit = product.stock_unit || product.unit || "đơn vị";
                  return `
                    <tr>
                      <td>
                        <div class="supplier-name-cell">
                          <span class="supplier-avatar supplier-product-avatar">${renderSupplierProductThumb(product, "supplier-product-avatar-img")}</span>
                          <div>
                            <strong>${escapeHtml(product.name || "-")}</strong>
                            <span>SKU: ${escapeHtml(product.sku || "-")}</span>
                          </div>
                        </div>
                      </td>
                      <td>${escapeHtml(supplierName)}</td>
                      <td class="${expiration?.daysLeft <= 7 ? "supplier-return-danger" : ""}">${escapeHtml(formatDate(expiration?.date))}</td>
                      <td><strong>${formatNumber(getProductStock(product))}</strong> ${escapeHtml(unit)}</td>
                      <td>${statusPill(expiration?.daysLeft < 0 ? "inactive" : "pending", ticket ? "Đã tạo phiếu" : expiration?.status || "Gần hết hạn")}</td>
                      <td>
                        <div class="categories-actions">
                          <button class="chip-button" type="button" data-supplier-action="open-return-ticket" data-id="${product.id}">${ticket ? "Xem phiếu" : "Tạo phiếu"}</button>
                        </div>
                      </td>
                    </tr>
                  `;
              }).join("") || '<tr><td colspan="6">Chưa có sản phẩm nào còn dưới 1 tháng hạn sử dụng.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      ${renderSupplierReturnSheet()}
    `;
}

async function reloadSuppliersState() {
    const params = new URLSearchParams();
    Object.entries(state.filters.suppliers || {}).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    state.suppliers = await apiFetch(`/api/inventory/suppliers${params.toString() ? `?${params.toString()}` : ""}`);
    syncSupplierSelects();
    renderSuppliers();
}

function buildSupplierPayload(raw) {
    return {
        name: String(raw.name || "").trim(),
        code: String(raw.code || "").trim(),
        logo_url: String(raw.logo_url || "").trim(),
        contact_person: String(raw.contact_person || "").trim(),
        phone: String(raw.phone || "").trim(),
        email: String(raw.email || "").trim(),
        address: String(raw.address || "").trim(),
        note: String(raw.note || "").trim(),
        status: String(raw.status || "active").trim() || "active"
    };
}

function renderSupplierSummary() {
    if (!elements.suppliersSummary) return;
    elements.suppliersSummary.innerHTML = "";
}

function renderSupplierTable() {
    if (!elements.suppliersContent) return;
    const suppliers = Array.isArray(state.suppliers) ? state.suppliers : [];
    elements.suppliersMeta.textContent = "";
    elements.suppliersMeta.closest(".section-head")?.classList.add("hidden");
    elements.suppliersContent.innerHTML = `
      <div class="suppliers-table-wrap">
        <table class="list-table suppliers-table">
          <thead>
            <tr>
              <th>Nhà cung cấp</th>
              <th>Người liên hệ</th>
              <th>Liên hệ</th>
              <th>Địa chỉ</th>
              <th>Số lượng sản phẩm</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${suppliers.map((supplier) => {
                const productCount = getSupplierProductCount(supplier);
                const statusLabel = supplier.status_label || (supplier.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động");
                return `
                  <tr>
                    <td>
                      <div class="supplier-name-cell">
                        <span class="supplier-avatar">${buildSupplierAvatar(supplier)}</span>
                        <div>
                          <strong>${escapeHtml(supplier.name || "-")}</strong>
                          <span>${escapeHtml(supplier.note || "Nhà cung cấp trong kho")}</span>
                        </div>
                      </div>
                    </td>
                    <td>${escapeHtml(supplier.contact_person || "-")}</td>
                    <td>
                      <div class="supplier-contact-stack">
                        <span>${escapeHtml(supplier.phone || "-")}</span>
                        <span>${escapeHtml(supplier.email || "-")}</span>
                      </div>
                    </td>
                    <td>${escapeHtml(supplier.address || "-")}</td>
                    <td><span class="categories-count-pill">${formatNumber(productCount)}</span></td>
                    <td>${statusPill(supplier.status, statusLabel)}</td>
                    <td>
                      <div class="categories-actions">
                        <button class="chip-button" type="button" data-supplier-action="edit" data-id="${supplier.id}">Sửa</button>
                        <button class="chip-button" type="button" data-supplier-action="toggle-status" data-id="${supplier.id}" data-tone="accent">${supplier.status === "active" ? "Ngừng hoạt động" : "Kích hoạt"}</button>
                        <button class="chip-button" type="button" data-supplier-action="delete" data-id="${supplier.id}" data-tone="danger">Xóa</button>
                      </div>
                    </td>
                  </tr>
                `;
            }).join("") || '<tr><td colspan="7">Chưa có nhà cung cấp phù hợp.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
}

export function syncSupplierSelects() {
    fillSelectOptions(elements.productImportSupplierSelect, state.suppliers || [], {
        includeBlank: true,
        blankLabel: "Chọn nhà cung cấp"
    });
}

export function resetSupplierForm() {
    supplierLogoFile = null;
    elements.supplierForm?.reset();
    if (elements.supplierForm?.elements.id) elements.supplierForm.elements.id.value = "";
    if (elements.supplierForm?.elements.logo_url) elements.supplierForm.elements.logo_url.value = "";
    if (elements.supplierLogoFile) elements.supplierLogoFile.value = "";
    setSupplierLogoPreview("");
    if (elements.supplierFormTitle) elements.supplierFormTitle.textContent = "Thêm nhà cung cấp";
    if (elements.supplierFormSubmitButton) elements.supplierFormSubmitButton.textContent = "Lưu nhà cung cấp";
    state.supplierView = "list";
}

export function openSupplierForm(supplierId = null) {
    state.supplierView = "form";
    elements.supplierFormCard?.classList.remove("hidden");
    if (!supplierId || !elements.supplierForm) {
        resetSupplierForm();
        state.supplierView = "form";
        elements.supplierFormCard?.classList.remove("hidden");
        return;
    }

    const supplier = getSupplierById(supplierId);
    if (!supplier) return;

    resetSupplierForm();
    state.supplierView = "form";
    elements.supplierFormCard?.classList.remove("hidden");
    elements.supplierFormTitle.textContent = `Cập nhật ${supplier.code || `#${supplier.id}`}`;
    elements.supplierFormSubmitButton.textContent = "Lưu cập nhật";

    const fields = ["id", "name", "code", "logo_url", "contact_person", "phone", "email", "address", "note", "status"];
    fields.forEach((field) => {
        if (elements.supplierForm.elements[field]) {
            elements.supplierForm.elements[field].value = supplier[field] || "";
        }
    });

    setSupplierLogoPreview(getSupplierLogoSource(supplier));
}

export function closeSupplierForm() {
    resetSupplierForm();
    elements.supplierFormCard?.classList.add("hidden");
}

export async function submitSupplierForm(raw) {
    const payload = buildSupplierPayload(raw);
    if (!payload.name || !payload.code) {
        throw new Error("Vui lòng nhập tên và mã nhà cung cấp.");
    }

    if (supplierLogoFile) {
        payload.logo_url = await uploadSupplierLogo(supplierLogoFile);
    }

    await apiFetch(raw.id ? `/api/inventory/suppliers/${raw.id}` : "/api/inventory/suppliers", {
        method: raw.id ? "PUT" : "POST",
        body: JSON.stringify(payload)
    });

    closeSupplierForm();
    await reloadSuppliersState();
    showToast(raw.id ? "Đã cập nhật nhà cung cấp." : "Đã thêm nhà cung cấp.");
}

function applySupplierReturnFilters() {
    state.supplierReturnFilters = {
        keyword: String(document.querySelector("#supplierReturnKeyword")?.value || "").trim(),
        supplier: String(document.querySelector("#supplierReturnSupplier")?.value || "").trim(),
        until: String(document.querySelector("#supplierReturnUntil")?.value || "").trim()
    };
    renderSuppliers();
}

function openSupplierReturnModal(productId) {
    state.supplierReturnModalProductId = productId;
    state.supplierReturnDraftSourceId = String(productId || "");
    state.supplierReturnDraft = createSupplierReturnDraft(productId);
    renderSuppliers();
}

function closeSupplierReturnModal() {
    state.supplierReturnModalProductId = "";
    state.supplierReturnDraftSourceId = "";
    state.supplierReturnDraft = null;
    renderSuppliers();
}

export function handleSupplierReturnFieldChange(target) {
    if (!target || !target.closest(".supplier-return-backdrop")) return;
    if (!["supplier_name", "warehouse_name", "return_date", "note", "item_product_id", "item_quantity", "item_reason"].includes(target.name)) return;

    syncSupplierReturnDraftFromForm();
    if (target.name === "item_product_id") {
        renderSuppliers();
    }
}

async function submitSupplierReturnTicket() {
    const form = document.querySelector("#supplierReturnTicketForm");
    if (!form) return;

    const raw = Object.fromEntries(new FormData(form).entries());
    const product = (state.products || []).find((item) => Number(item.id) === Number(raw.product_id));
    if (!product) throw new Error("Không tìm thấy sản phẩm cần trả.");

    const existing = getSupplierReturnTicketByProduct(product.id);
    const alreadyResolved = existing?.status === "resolved";
    const quantity = Number(raw.quantity || 0);
    const stock = getProductStock(product);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Số lượng trả phải lớn hơn 0.");
    }
    if (!alreadyResolved && quantity > stock) {
        throw new Error("Số lượng trả không được lớn hơn tồn kho.");
    }

    const tickets = readSupplierReturns();
    const nextStock = alreadyResolved ? stock : Math.max(0, stock - quantity);
    const productPayload = {
        category_id: Number(product.category_id || product.category?.id || 0),
        name: String(product.name || "").trim(),
        price: Number(product.price || product.current_price || 0),
        sale_price: product.sale_price ? Number(product.sale_price) : null,
        stock_quantity: nextStock,
        stock_unit: String(product.stock_unit || product.unit || product.sale_unit || "").trim(),
        sale_unit: String(product.sale_unit || product.unit || product.stock_unit || "").trim(),
        stock_per_sale_unit: product.stock_per_sale_unit ? Number(product.stock_per_sale_unit) : 1,
        production_date: product.production_date || null,
        expiration_date: product.expiration_date || null,
        thumbnail_url: String(product.thumbnail_url || "").trim(),
        short_description: String(product.short_description || "").trim(),
        description: String(product.description || "").trim(),
        status: nextStock > 0 ? (product.status || "active") : "out_of_stock",
        is_published: Boolean(product.is_published),
        is_featured: Boolean(product.is_featured)
    };
    if (String(product.slug || "").trim()) productPayload.slug = String(product.slug).trim();
    if (String(product.sku || "").trim()) productPayload.sku = String(product.sku).trim();

    await apiFetch(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify(productPayload)
    });

    const payload = {
        id: existing?.id || Date.now(),
        code: existing?.code || buildSupplierReturnCode(),
        product_id: product.id,
        product_name: product.name || "",
        sku: product.sku || "",
        supplier_name: getSupplierNameFromProduct(product) || "Chưa xác định",
        expiration_date: product.expiration_date || "",
        supplier_name: String(raw.supplier_name || getSupplierNameFromProduct(product) || "Chưa xác định").trim(),
        warehouse_name: String(raw.warehouse_name || "Kho tổng").trim(),
        return_date: String(raw.return_date || new Date().toISOString().slice(0, 10)).trim(),
        quantity,
        unit: product.stock_unit || product.unit || "đơn vị",
        reason: String(raw.reason || "near_expiry"),
        note: String(raw.note || "").trim(),
        status: "resolved",
        resolved_at: new Date().toISOString(),
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const nextTickets = existing
        ? tickets.map((ticket) => Number(ticket.id) === Number(existing.id) ? payload : ticket)
        : [payload, ...tickets];
    saveSupplierReturns(nextTickets);
    product.stock_quantity = nextStock;
    product.status = productPayload.status;
    state.supplierReturnModalProductId = "";
    renderSuppliers();
    showToast("Đã lưu phiếu trả hàng nhà cung cấp.");
}

function exportSupplierReturnReport() {
    const products = getExpiringSupplierProducts();
    if (!products.length) {
        showToast("Không có dữ liệu để xuất báo cáo.");
        return;
    }

    const rows = [
        ["Sản phẩm", "SKU", "Nhà cung cấp", "Ngày hết hạn", "Tồn kho", "Đơn vị", "Trạng thái"],
        ...products.map((product) => {
            const expiration = getProductExpirationMeta(product);
            return [
                product.name || "",
                product.sku || "",
                getSupplierNameFromProduct(product) || "Chưa xác định",
                product.expiration_date || "",
                getProductStock(product),
                product.stock_unit || product.unit || "đơn vị",
                expiration?.status || "Gan het han"
            ];
        })
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `supplier-return-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

async function submitSupplierReturnTicketV2() {
    const form = document.querySelector("#supplierReturnTicketForm");
    if (!form) return;

    const raw = Object.fromEntries(new FormData(form).entries());
    const draft = syncSupplierReturnDraftFromForm() || ensureSupplierReturnDraft(raw.product_id || state.supplierReturnModalProductId);
    const anchorProductId = raw.product_id || draft?.items?.find((item) => item.product_id)?.product_id || "";
    const anchorProduct = (state.products || []).find((item) => Number(item.id) === Number(anchorProductId));
    if (!anchorProduct) throw new Error("Khong tim thay san pham can tra.");
    if (!draft?.items?.length) {
        throw new Error("Vui long them it nhat 1 san pham vao phieu tra.");
    }

    const existing = getSupplierReturnTicketByProduct(anchorProduct.id);
    const alreadyResolved = existing?.status === "resolved";
    const seenProductIds = new Set();
    const savedItems = [];

    for (const item of draft.items) {
        if (!item.product_id) {
            throw new Error("Vui long chon san pham tu kho truoc khi luu phieu tra.");
        }
        const product = (state.products || []).find((entry) => Number(entry.id) === Number(item.product_id));
        if (!product) {
            throw new Error("Co san pham trong phieu tra khong ton tai.");
        }
        if (seenProductIds.has(String(product.id))) {
            throw new Error(`San pham ${product.name || product.sku || product.id} dang bi trung.`);
        }
        seenProductIds.add(String(product.id));

        const quantity = Number(item.quantity || 0);
        const stock = getProductStock(product);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`So luong tra cua ${product.name || "san pham"} phai lon hon 0.`);
        }
        if (!alreadyResolved && quantity > stock) {
            throw new Error(`So luong tra cua ${product.name || "san pham"} khong duoc lon hon ton kho hien tai.`);
        }

        const unit = product.stock_unit || product.unit || "đơn vị";
        const nextStock = alreadyResolved ? stock : Math.max(0, stock - quantity);
        const productPayload = {
            category_id: Number(product.category_id || product.category?.id || 0),
            name: String(product.name || "").trim(),
            price: Number(product.price || product.current_price || 0),
            sale_price: product.sale_price ? Number(product.sale_price) : null,
            stock_quantity: nextStock,
            stock_unit: String(product.stock_unit || product.unit || product.sale_unit || unit).trim(),
            sale_unit: String(product.sale_unit || product.unit || product.stock_unit || unit).trim(),
            stock_per_sale_unit: product.stock_per_sale_unit ? Number(product.stock_per_sale_unit) : 1,
            production_date: product.production_date || null,
            expiration_date: product.expiration_date || null,
            thumbnail_url: String(product.thumbnail_url || "").trim(),
            short_description: String(product.short_description || "").trim(),
            description: String(product.description || "").trim(),
            status: nextStock > 0 ? (product.status || "active") : "out_of_stock",
            is_published: Boolean(product.is_published),
            is_featured: Boolean(product.is_featured)
        };
        if (String(product.slug || "").trim()) productPayload.slug = String(product.slug).trim();
        if (String(product.sku || "").trim()) productPayload.sku = String(product.sku).trim();

        if (!alreadyResolved) {
            await apiFetch(`/api/products/${product.id}`, {
                method: "PUT",
                body: JSON.stringify(productPayload)
            });
            product.stock_quantity = nextStock;
            product.status = productPayload.status;
        }

        savedItems.push({
            product_id: product.id,
            product_name: product.name || "",
            sku: product.sku || "",
            quantity,
            unit,
            reason: String(item.reason || "near_expiry"),
            expiration_date: product.expiration_date || ""
        });
    }

    const tickets = readSupplierReturns();
    const primaryItem = savedItems[0];
    const totalQuantity = savedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const payload = {
        id: existing?.id || Date.now(),
        code: existing?.code || buildSupplierReturnCode(),
        product_id: primaryItem.product_id,
        product_name: primaryItem.product_name,
        sku: primaryItem.sku,
        supplier_name: String(draft.supplier_name || getSupplierNameFromProduct(anchorProduct) || "Chưa xác định").trim(),
        warehouse_name: String(draft.warehouse_name || "Kho tổng").trim(),
        return_date: String(draft.return_date || new Date().toISOString().slice(0, 10)).trim(),
        expiration_date: primaryItem.expiration_date || "",
        quantity: primaryItem.quantity,
        quantity_total: totalQuantity,
        unit: primaryItem.unit,
        reason: String(primaryItem.reason || "near_expiry"),
        note: String(draft.note || "").trim(),
        item_count: savedItems.length,
        items: savedItems,
        status: "resolved",
        resolved_at: new Date().toISOString(),
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const nextTickets = existing
        ? tickets.map((ticket) => Number(ticket.id) === Number(existing.id) ? payload : ticket)
        : [payload, ...tickets];
    saveSupplierReturns(nextTickets);

    state.supplierReturnModalProductId = "";
    state.supplierReturnDraftSourceId = "";
    state.supplierReturnDraft = null;
    renderSuppliers();
    showToast(alreadyResolved
        ? "Phiếu trả hàng này đã được xử lý trước đó."
        : `Đã xác nhận trả ${formatNumber(totalQuantity)} đơn vị từ ${savedItems.length} dòng sản phẩm.`
    );
}
function renderSupplierReturnsV2() {
    if (!elements.suppliersContent) return;

    const products = getExpiringSupplierProducts();
    const tickets = readSupplierReturns();
    const supplierOptions = getSupplierFilterOptions();
    const filters = state.supplierReturnFilters || {};
    elements.suppliersMeta.closest(".section-head")?.classList.remove("hidden");
    elements.suppliersMeta.textContent = `${formatNumber(products.length)} sản phẩm cần theo dõi`;
    elements.suppliersSummary.innerHTML = "";
    elements.suppliersContent.innerHTML = `
      <div class="supplier-return-page">
        <div class="supplier-return-toolbar">
          <label>
            <span>Tìm kiếm sản phẩm</span>
            <input id="supplierReturnKeyword" value="${escapeHtml(filters.keyword || "")}" placeholder="Tên sản phẩm hoặc SKU...">
          </label>
          <label>
            <span>Nhà cung cấp</span>
            <select id="supplierReturnSupplier">
              <option value="">Tất cả nhà cung cấp</option>
              ${supplierOptions.map((name) => `<option value="${escapeHtml(name)}" ${name === filters.supplier ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Hạn trước ngày</span>
            <input id="supplierReturnUntil" type="date" value="${escapeHtml(filters.until || "")}">
          </label>
          <button class="primary-button" type="button" data-supplier-action="filter-returns">Lọc dữ liệu</button>
          <button class="primary-button" type="button" data-supplier-action="open-return-ticket" data-id="new">Tạo phiếu trả hàng</button>
          <button class="secondary-button" type="button" data-supplier-action="export-returns">Xuất báo cáo</button>
        </div>
        <div class="suppliers-table-wrap">
          <table class="list-table suppliers-table supplier-return-table">
            <thead>
              <tr>
                <th>Sản phẩm & SKU</th>
                <th>Nhà cung cấp</th>
                <th>Ngày hết hạn</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((product) => {
                  const expiration = getProductExpirationMeta(product);
                  const supplierName = getSupplierNameFromProduct(product) || "Chưa xác định";
                     const ticket = getSupplierReturnTicketByProduct(product.id);
                  const unit = product.stock_unit || product.unit || "đơn vị";
                  const tone = ticket?.status === "resolved" ? "active" : expiration?.daysLeft < 0 ? "inactive" : "pending";
                  const label = getSupplierReturnStatusLabel(ticket, expiration?.status || "Gần hết hạn");
                  return `
                    <tr>
                      <td>
                        <div class="supplier-name-cell">
                          <span class="supplier-avatar supplier-product-avatar">${renderSupplierProductThumb(product, "supplier-product-avatar-img")}</span>
                          <div>
                            <strong>${escapeHtml(product.name || "-")}</strong>
                            <span>SKU: ${escapeHtml(product.sku || "-")}</span>
                          </div>
                        </div>
                      </td>
                      <td>${escapeHtml(supplierName)}</td>
                      <td class="${expiration?.daysLeft <= 7 ? "supplier-return-danger" : ""}">${escapeHtml(formatDate(expiration?.date))}</td>
                      <td><strong>${formatNumber(getProductStock(product))}</strong> ${escapeHtml(unit)}</td>
                      <td>${statusPill(tone, label)}</td>
                      <td>
                        <div class="categories-actions">
                          <button class="chip-button" type="button" data-supplier-action="open-return-ticket" data-id="${product.id}">${ticket ? "Xem phiếu" : "Tạo phiếu"}</button>
                        </div>
                      </td>
                    </tr>
                  `;
              }).join("") || '<tr><td colspan="6">Chưa có sản phẩm nào còn dưới 1 tháng hạn sử dụng.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      ${renderSupplierReturnSheet()}
    `;
}

async function handleSupplierReturnAction(action, supplierId) {
    if (action === "open-return-ticket") {
        openSupplierReturnModal(supplierId);
        return true;
    }
    if (action === "filter-returns") {
        applySupplierReturnFilters();
        return true;
    }
    if (action === "export-returns") {
        exportSupplierReturnReport();
        return true;
    }
    if (action === "close-return-modal") {
        closeSupplierReturnModal();
        return true;
    }
    if (action === "add-return-item") {
        syncSupplierReturnDraftFromForm();
        state.productSelectModalOpen = true;
        state.productSelectModalSelected = [];
        state.productSelectModalKeyword = "";
        renderSuppliers();
        return true;
    }
    if (action === "close-product-select") {
        state.productSelectModalOpen = false;
        state.productSelectModalSelected = [];
        state.productSelectModalKeyword = "";
        renderSuppliers();
        return true;
    }
    if (action === "toggle-product-select") {
        const sel = state.productSelectModalSelected || [];
        const sid = String(supplierId);
        state.productSelectModalSelected = sel.includes(sid) ? sel.filter((x) => x !== sid) : [...sel, sid];
        renderSuppliers();
        return true;
    }
    if (action === "search-product-select") {
        return true;
    }
    if (action === "confirm-product-select") {
        const selected = state.productSelectModalSelected || [];
        if (selected.length > 0) {
            addSupplierReturnDraftItem(selected);
        }
        state.productSelectModalOpen = false;
        state.productSelectModalSelected = [];
        state.productSelectModalKeyword = "";
        renderSuppliers();
        return true;
    }
    if (action === "remove-return-item") {
        removeSupplierReturnDraftItem(supplierId);
        renderSuppliers();
        return true;
    }
    if (action === "submit-return-ticket") {
        await submitSupplierReturnTicketV2();
        return true;
    }
    return false;
}

export async function handleSupplierAction(action, supplierId) {
    if (await handleSupplierReturnAction(action, supplierId)) return;

    const supplier = getSupplierById(supplierId);
    if (!supplier) throw new Error("Không tìm thấy nhà cung cấp.");

    if (action === "edit") {
        openSupplierForm(supplierId);
        return;
    }

    if (action === "toggle-status") {
        await apiFetch(`/api/inventory/suppliers/${supplier.id}`, {
            method: "PUT",
            body: JSON.stringify({
                ...buildSupplierPayload(supplier),
                status: supplier.status === "active" ? "inactive" : "active"
            })
        });
        await reloadSuppliersState();
        showToast("Đã cập nhật trạng thái nhà cung cấp.");
        return;
    }

    if (action === "delete") {
        if (!window.confirm(`Bạn chắc chắn muốn xóa nhà cung cấp ${supplier.name}?`)) return;
        await apiFetch(`/api/inventory/suppliers/${supplier.id}`, { method: "DELETE" });
        await reloadSuppliersState();
        showToast("Đã xóa nhà cung cấp.");
    }
}

export function renderSuppliers() {
    if (state.supplierView === "returns") {
        elements.supplierFilterCard?.classList.add("hidden");
        elements.supplierFormCard?.classList.add("hidden");
        renderSupplierReturnsV2();
        return;
    }

    elements.supplierFilterCard?.classList.remove("hidden");
    renderSupplierSummary();
    renderSupplierTable();
}
lierFilterCard?.classList.remove("hidden");
    renderSupplierSummary();
    renderSupplierTable();
    if (state.supplierView !== "form") {
        elements.supplierFormCard?.classList.add("hidden");
    }


export function bindSupplierMediaEvents() {
    if (!elements.supplierLogoFile) return;

    elements.supplierLogoFile.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        supplierLogoFile = file;

        const reader = new FileReader();
        reader.onload = () => {
            setSupplierLogoPreview(String(reader.result || ""));
        };
        reader.readAsDataURL(file);
    });
}





