import {
    STORAGE_KEYS,
    apiFetch,
    elements,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatMoneyInputValue,
    formatNumber,
    parseMoneyInputValue,
    parseVoucherDescription,
    showToast,
    state,
    statusPill
} from "./core.js";

let promotionComboboxUid = 0;
let promotionRulesLoaded = false;
let promotionRulesLoading = null;

function getVoucherById(id) {
    return (state.vouchers || []).find((coupon) => Number(coupon.id) === Number(id))
        || (state.coupons || []).find((coupon) => Number(coupon.id) === Number(id))
        || null;
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function getVoucherTitle(coupon) {
    const parsed = parseVoucherDescription(coupon?.description);
    return parsed.title || String(coupon?.code || "").trim() || "Voucher";
}

function getVoucherMeta(coupon) {
    const descriptionMeta = parseVoucherDescription(coupon?.description);
    let campaignMeta = {};
    try {
        campaignMeta = coupon?.campaign_metadata ? JSON.parse(coupon.campaign_metadata) : {};
    } catch (_error) {
        campaignMeta = {};
    }
    return { ...descriptionMeta, ...campaignMeta };
}

const VOUCHER_AUDIENCE_LABELS = {
    all: "Tất cả thành viên",
    silver: "Thành viên Bạc",
    gold: "Thành viên Vàng",
    platinum: "Thành viên Bạch kim",
    diamond: "Thành viên Kim cương",
    vip: "Thành viên VIP"
};

function normalizeVoucherAudiences(value) {
    const values = Array.isArray(value)
        ? value
        : String(value || "all").split(",");
    const normalized = values
        .map((item) => String(item || "").trim())
        .filter((item) => Object.prototype.hasOwnProperty.call(VOUCHER_AUDIENCE_LABELS, item));
    if (!normalized.length || normalized.includes("all")) return ["all"];
    return Array.from(new Set(normalized));
}

function getSelectedVoucherAudiences() {
    if (!elements.voucherAudienceSelect) {
        return normalizeVoucherAudiences(elements.voucherForm?.elements.audience?.value || "all");
    }
    return normalizeVoucherAudiences(Array.from(elements.voucherAudienceSelect.selectedOptions).map((option) => option.value));
}

function getVoucherAudienceLabel(value) {
    const audiences = normalizeVoucherAudiences(value);
    if (audiences.includes("all")) return VOUCHER_AUDIENCE_LABELS.all;
    return audiences.map((item) => VOUCHER_AUDIENCE_LABELS[item] || item).join(", ");
}

function getProductNameById(id) {
    const product = (state.products || []).find((item) => String(item.id) === String(id));
    return product?.name || "Sản phẩm";
}

function getCategoryNameById(id) {
    const category = (state.categories || []).find((item) => String(item.id) === String(id));
    return category?.name || category?.ten_danh_muc || "Danh mục";
}

function getProductOptions(selectedValue = "", keyword = "") {
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    const products = (Array.isArray(state.products) ? state.products : []).filter((product) => {
        if (!normalizedKeyword) return true;
        const haystack = [
            product.name,
            product.ten_san_pham,
            product.sku
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedKeyword);
    });
    return [
        `<option value=""${selectedValue === "" ? " selected" : ""}>Chọn sản phẩm</option>`,
        `<option value="all"${selectedValue === "all" ? " selected" : ""}>Tất cả sản phẩm</option>`,
        ...products.map((product) => {
            const value = String(product.id);
            const label = `${product.name || "Sản phẩm"}${product.sku ? ` - ${product.sku}` : ""}`;
            return `<option value="${escapeHtml(value)}"${String(selectedValue) === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
        })
    ].join("");
}

function getPromotionOptionItems(scope = "products", keyword = "") {
    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    const source = scope === "categories"
        ? (Array.isArray(state.categories) ? state.categories : [])
        : (Array.isArray(state.products) ? state.products : []);
    return source.filter((item) => {
        if (!normalizedKeyword) return true;
        const haystack = scope === "categories"
            ? [item.name, item.ten_danh_muc].filter(Boolean).join(" ").toLowerCase()
            : [item.name, item.ten_san_pham, item.sku].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedKeyword);
    }).slice(0, 30);
}

function formatPromotionOptionLabel(item, scope = "products") {
    if (scope === "categories") return item.name || item.ten_danh_muc || "Danh mục";
    const name = item.name || item.ten_san_pham || "Sản phẩm";
    return item.sku ? `${name} - ${item.sku}` : name;
}

function getCategoryOptions(selectedValue = "") {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    return [
        `<option value=""${selectedValue === "" ? " selected" : ""}>Chọn danh mục</option>`,
        `<option value="all"${selectedValue === "all" ? " selected" : ""}>Tất cả danh mục</option>`,
        ...categories.map((category) => {
            const value = String(category.id);
            const label = category.name || category.ten_danh_muc || "Danh mục";
            return `<option value="${escapeHtml(value)}"${String(selectedValue) === value ? " selected" : ""}>${escapeHtml(label)}</option>`;
        })
    ].join("");
}

function getVoucherApplyScope() {
    const value = String(elements.voucherForm?.elements.apply_scope?.value || "products").trim();
    return value === "categories" ? "categories" : "products";
}

export function setVoucherApplyScope(scope = "products", values = ["all"]) {
    const safeScope = scope === "categories" ? "categories" : "products";
    if (elements.voucherForm?.elements.apply_scope) {
        elements.voucherForm.elements.apply_scope.value = safeScope;
    }
    document.querySelectorAll("[data-voucher-scope]").forEach((button) => {
        button.classList.toggle("active", button.dataset.voucherScope === safeScope);
    });
    renderAppliedProductRows(values);
    syncVoucherPreview();
}

function getAppliedProductRowValues() {
    if (!elements.voucherAppliedProductsList) return ["all"];
    return Array.from(elements.voucherAppliedProductsList.querySelectorAll("[data-voucher-applied-product], [data-voucher-applied-category]"))
        .map((select) => String(select.value || "").trim());
}

function getSelectedAppliedProducts() {
    const values = getAppliedProductRowValues().filter(Boolean);
    const productIds = values.filter((value) => value !== "all");
    return productIds.length ? [...new Set(productIds)] : ["all"];
}

function getSelectedAppliedCategories() {
    const values = getAppliedProductRowValues().filter(Boolean);
    const categoryIds = values.filter((value) => value !== "all");
    return categoryIds.length ? [...new Set(categoryIds)] : ["all"];
}

function renderAppliedProductRows(values = ["all"]) {
    if (!elements.voucherAppliedProductsList) return;
    const normalized = Array.isArray(values) && values.length ? values : ["all"];
    const isCategoryScope = getVoucherApplyScope() === "categories";
    const rowLabel = isCategoryScope ? "Danh mục áp dụng" : "Sản phẩm áp dụng";
    const selectAttribute = isCategoryScope ? "data-voucher-applied-category" : "data-voucher-applied-product";
    const optionBuilder = isCategoryScope ? getCategoryOptions : getProductOptions;

    elements.voucherAppliedProductsList.innerHTML = normalized.map((value, index) => `
      <div class="voucher-applied-product-row">
        <label>
          <span>${rowLabel} ${index + 1}</span>
          <select ${selectAttribute}>${optionBuilder(String(value || "all"))}</select>
        </label>
        <button class="chip-button" type="button" data-voucher-apply-action="remove" data-index="${index}" ${normalized.length <= 1 ? "disabled" : ""}>Xóa</button>
      </div>
    `).join("");
}

function getAppliedProductsLabel(values = getSelectedAppliedProducts()) {
    const selected = Array.isArray(values) && values.length ? values : ["all"];
    if (selected.includes("all")) return "Tất cả sản phẩm";
    return `${formatNumber(selected.length)} sản phẩm`;
}

function getAppliedCategoriesLabel(values = getSelectedAppliedCategories()) {
    const selected = Array.isArray(values) && values.length ? values : ["all"];
    if (selected.includes("all")) return "Tất cả danh mục";
    return `${formatNumber(selected.length)} danh mục`;
}

export function addVoucherAppliedProduct() {
    const values = getAppliedProductRowValues();
    renderAppliedProductRows([...(values.length ? values : ["all"]), ""]);
    syncVoucherPreview();
}

export function removeVoucherAppliedProduct(index) {
    const currentValues = getAppliedProductRowValues().map((value) => value || "all");
    currentValues.splice(Number(index), 1);
    renderAppliedProductRows(currentValues.length ? currentValues : ["all"]);
    syncVoucherPreview();
}

function isVoucherScheduled(coupon) {
    if (!coupon?.start_date) return false;
    return new Date(coupon.start_date).getTime() > Date.now();
}

function isVoucherExpired(coupon) {
    if (!coupon?.end_date) return false;
    return new Date(coupon.end_date).getTime() < Date.now();
}

function getVoucherStatus(coupon) {
    if (!coupon || coupon.is_active === false) return { key: "archived", label: "Đang tắt" };
    if (isVoucherScheduled(coupon)) return { key: "pending", label: "Sắp diễn ra" };
    if (isVoucherExpired(coupon)) return { key: "cancelled", label: "Đã hết hạn" };
    return { key: "active", label: "Đang hoạt động" };
}

function formatVoucherDiscount(coupon) {
    if (!coupon) return "-";
    if (coupon.discount_type === "percent") return `${formatNumber(coupon.discount_value)}%`;
    return formatCurrency(coupon.discount_value);
}

function buildVoucherPayload(raw) {
    const title = String(raw.title || "").trim();
    const note = String(raw.note || "").trim();
    const audiences = getSelectedVoucherAudiences();
    const audience = audiences[0] || "all";
    const applyScope = String(raw.apply_scope || getVoucherApplyScope()).trim() === "categories" ? "categories" : "products";
    const appliedProducts = applyScope === "products" ? getSelectedAppliedProducts() : ["all"];
    const appliedCategories = applyScope === "categories" ? getSelectedAppliedCategories() : ["all"];
    const saveMode = String(raw.save_mode || "publish").trim();
    const isActive = saveMode === "draft" ? false : raw.is_active === "on";
    const campaignMetadata = {
        campaign_type: String(raw.campaign_type || "discount").trim() || "discount",
        apply_scope: applyScope,
        audience,
        audiences,
        note,
        applied_product_ids: applyScope === "products" && !appliedProducts.includes("all")
            ? appliedProducts.map((value) => Number(value)).filter(Boolean)
            : [],
        applied_category_ids: applyScope === "categories" && !appliedCategories.includes("all")
            ? appliedCategories.map((value) => Number(value)).filter(Boolean)
            : [],
        applies_to_all_products: applyScope === "products" && appliedProducts.includes("all"),
        applies_to_all_categories: applyScope === "categories" && appliedCategories.includes("all")
    };

    return {
        code: normalizeCode(raw.code),
        description: title,
        campaign_metadata: JSON.stringify(campaignMetadata),
        discount_type: String(raw.discount_type || "percent").trim() || "percent",
        discount_value: Number(parseMoneyInputValue(raw.discount_value) || 0),
        min_order_value: raw.min_order_value ? Number(parseMoneyInputValue(raw.min_order_value)) : null,
        max_discount_value: raw.max_discount_value ? Number(parseMoneyInputValue(raw.max_discount_value)) : null,
        start_date: raw.start_date || null,
        end_date: raw.end_date || null,
        usage_limit: raw.usage_limit ? Number(raw.usage_limit) : null,
        used_count: 0,
        is_active: isActive
    };
}

async function reloadCouponsState() {
    const params = new URLSearchParams();
    Object.entries(state.filters.vouchers || {}).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    state.vouchers = await apiFetch(`/api/coupons${params.toString() ? `?${params.toString()}` : ""}`);
    renderVouchers();
}

export async function loadVouchers() {
    await reloadCouponsState();
}

function renderVoucherSummary() {
    if (!elements.vouchersSummary) return;
    elements.vouchersSummary.innerHTML = "";
}

function renderVoucherTable() {
    if (!elements.vouchersContent || !elements.vouchersMeta) return;
    const coupons = Array.isArray(state.vouchers) ? state.vouchers : [];
    elements.vouchersMeta.textContent = "";

    elements.vouchersContent.innerHTML = `
      <div class="voucher-table-wrap">
        <table class="list-table voucher-table">
          <thead>
            <tr>
              <th>Mã voucher</th>
              <th>Voucher</th>
              <th>Giá trị giảm</th>
              <th>Điều kiện</th>
              <th>Thời gian áp dụng</th>
              <th>Đã dùng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${coupons.map((coupon) => {
                const meta = getVoucherMeta(coupon);
                const status = getVoucherStatus(coupon);
                const usageLimit = coupon.usage_limit ? `${formatNumber(coupon.used_count || 0)} / ${formatNumber(coupon.usage_limit)}` : `${formatNumber(coupon.used_count || 0)} lượt`;
                const minOrder = Number(coupon.min_order_value || 0) > 0 ? formatCurrency(coupon.min_order_value) : "Không giới hạn";
                const audience = getVoucherAudienceLabel(meta.audiences || meta.audience || "all");
                return `
                  <tr>
                    <td><strong>${escapeHtml(coupon.code || "-")}</strong></td>
                    <td><div class="voucher-program-cell"><strong>${escapeHtml(getVoucherTitle(coupon))}</strong><span>${escapeHtml(meta.note || "Voucher ưu đãi cho khách hàng.")}</span></div></td>
                    <td><div class="voucher-value-stack"><strong>${escapeHtml(formatVoucherDiscount(coupon))}</strong><span>${coupon.max_discount_value ? `Giảm tối đa ${escapeHtml(formatCurrency(coupon.max_discount_value))}` : "Không giới hạn trần giảm"}</span></div></td>
                    <td><div class="voucher-value-stack"><strong>${escapeHtml(minOrder)}</strong><span>${escapeHtml(audience)}</span></div></td>
                    <td><div class="voucher-value-stack"><strong>${escapeHtml(coupon.start_date ? formatDate(coupon.start_date) : "Bắt đầu ngay")}</strong><span>${escapeHtml(coupon.end_date ? `Đến ${formatDate(coupon.end_date)}` : "Không giới hạn ngày kết thúc")}</span></div></td>
                    <td>${escapeHtml(usageLimit)}</td>
                    <td>${statusPill(status.key, status.label)}</td>
                    <td>
                      <div class="categories-actions">
                        <button class="chip-button" type="button" data-voucher-action="edit" data-id="${coupon.id}">Sửa</button>
                        <button class="chip-button" type="button" data-voucher-action="toggle-status" data-id="${coupon.id}" data-tone="accent">${coupon.is_active ? "Tắt voucher" : "Bật voucher"}</button>
                        <button class="chip-button" type="button" data-voucher-action="delete" data-id="${coupon.id}" data-tone="danger">Xóa</button>
                      </div>
                    </td>
                  </tr>
                `;
            }).join("") || '<tr><td colspan="8">Chưa có voucher phù hợp.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
}

function setVoucherPreview(raw = {}) {
    if (!elements.voucherPreviewTitle) return;
    const code = normalizeCode(raw.code) || "VOUCHER-CODE";
    const discountType = String(raw.discount_type || "percent").trim() || "percent";
    const discountValue = Number(parseMoneyInputValue(raw.discount_value) || 0);
    const maxDiscountValue = parseMoneyInputValue(raw.max_discount_value);
    const minOrderValue = parseMoneyInputValue(raw.min_order_value);
    const title = String(raw.title || "").trim() || "Mã giảm giá của bạn";
    const audience = raw.audiences || raw.audience || getSelectedVoucherAudiences();
    const applyScope = getVoucherApplyScope();

    elements.voucherPreviewBadge.textContent = getVoucherAudienceLabel(audience);
    elements.voucherPreviewTitle.textContent = title;
    elements.voucherPreviewCode.textContent = code;
    elements.voucherPreviewDiscount.textContent = discountType === "percent" ? `${formatNumber(discountValue)}%` : formatCurrency(discountValue);
    elements.voucherPreviewMaxDiscount.textContent = maxDiscountValue ? formatCurrency(maxDiscountValue) : "Không giới hạn";
    elements.voucherPreviewMinOrder.textContent = minOrderValue ? formatCurrency(minOrderValue) : "0 VND";
    if (elements.voucherPreviewScope) {
        elements.voucherPreviewScope.textContent = applyScope === "categories"
            ? getAppliedCategoriesLabel()
            : getAppliedProductsLabel();
    }
}

function setAudienceButtons(audience = "all") {
    const selectedAudiences = normalizeVoucherAudiences(audience);
    const selected = selectedAudiences[0] || "all";
    elements.voucherAudienceButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.voucherAudience === selected);
    });
    if (elements.voucherAudienceSelect) {
        Array.from(elements.voucherAudienceSelect.options).forEach((option) => {
            option.selected = selectedAudiences.includes(option.value);
        });
    }
    if (elements.voucherForm?.elements.audience) {
        elements.voucherForm.elements.audience.value = selectedAudiences.join(",");
    }
}

export function resetVoucherForm() {
    elements.voucherForm?.reset();
    if (elements.voucherForm?.elements.id) elements.voucherForm.elements.id.value = "";
    if (elements.voucherForm?.elements.save_mode) elements.voucherForm.elements.save_mode.value = "publish";
    if (elements.voucherFormTitle) elements.voucherFormTitle.textContent = "Tạo voucher";
    if (elements.voucherFormSubmitButton) elements.voucherFormSubmitButton.textContent = "Lưu & phát hành";
    setAudienceButtons("all");
    setVoucherApplyScope("products", ["all"]);
    if (elements.voucherForm?.elements.is_active) elements.voucherForm.elements.is_active.checked = true;
    setVoucherPreview({ title: "", code: "", discount_type: "percent", discount_value: 0, max_discount_value: 0, min_order_value: 0, audiences: ["all"] });
}

export function openVoucherForm(voucherId = null) {
    state.voucherWorkspace = "list";
    resetVoucherForm();

    if (!voucherId || !elements.voucherForm) {
        elements.voucherFormView?.classList.remove("hidden");
        renderVouchers();
        return;
    }

    const coupon = getVoucherById(voucherId);
    if (!coupon) return;

    const meta = getVoucherMeta(coupon);
    if (elements.voucherFormTitle) elements.voucherFormTitle.textContent = `Cập nhật ${coupon.code || `#${coupon.id}`}`;
    if (elements.voucherFormSubmitButton) elements.voucherFormSubmitButton.textContent = "Lưu cập nhật";

    const values = {
        id: coupon.id,
        title: getVoucherTitle(coupon),
        campaign_type: meta.campaign_type || "discount",
        code: coupon.code || "",
        discount_type: coupon.discount_type || "percent",
        discount_value: coupon.discount_value || 0,
        min_order_value: coupon.min_order_value || "",
        max_discount_value: coupon.max_discount_value || "",
        usage_limit: coupon.usage_limit || "",
        start_date: coupon.start_date ? String(coupon.start_date).slice(0, 10) : "",
        end_date: coupon.end_date ? String(coupon.end_date).slice(0, 10) : "",
        note: meta.note || ""
    };

    Object.entries(values).forEach(([field, value]) => {
        if (!elements.voucherForm.elements[field]) return;
        elements.voucherForm.elements[field].value = ["discount_value", "min_order_value", "max_discount_value"].includes(field)
            ? formatMoneyInputValue(value)
            : value;
    });
    if (elements.voucherForm.elements.is_active) elements.voucherForm.elements.is_active.checked = Boolean(coupon.is_active);

    const applyScope = meta.apply_scope === "categories" || (Array.isArray(meta.applied_category_ids) && meta.applied_category_ids.length) ? "categories" : "products";
    let appliedValues = ["all"];
    if (applyScope === "categories" && meta.applies_to_all_categories === false && Array.isArray(meta.applied_category_ids) && meta.applied_category_ids.length) {
        appliedValues = meta.applied_category_ids.map(String);
    } else if (applyScope === "products" && meta.applies_to_all_products === false && Array.isArray(meta.applied_product_ids) && meta.applied_product_ids.length) {
        appliedValues = meta.applied_product_ids.map(String);
    }
    setVoucherApplyScope(applyScope, appliedValues);
    const audiences = meta.audiences || meta.audience || "all";
    setAudienceButtons(audiences);
    setVoucherPreview({ ...values, audiences });
    elements.voucherFormView?.classList.remove("hidden");
    renderVouchers();
}

export function closeVoucherForm() {
    elements.voucherFormView?.classList.add("hidden");
    renderVouchers();
}

export function setVoucherSaveMode(mode) {
    if (elements.voucherForm?.elements.save_mode) {
        elements.voucherForm.elements.save_mode.value = mode === "draft" ? "draft" : "publish";
    }
}

export function autoGenerateVoucherCode() {
    const title = String(elements.voucherForm?.elements.title?.value || "").trim();
    const seed = title
        ? title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-")
        : "VOUCHER";
    const compact = seed.replace(/^-|-$/g, "").slice(0, 12) || "VOUCHER";
    const code = normalizeCode(`${compact}-${new Date().getFullYear()}`);
    if (elements.voucherCodeInput) elements.voucherCodeInput.value = code;
    syncVoucherPreview();
}

export function syncVoucherPreview() {
    if (!elements.voucherForm) return;
    const raw = Object.fromEntries(new FormData(elements.voucherForm).entries());
    setVoucherPreview(raw);
}

export async function submitVoucherForm(raw) {
    const payload = buildVoucherPayload(raw);
    if (!payload.code || !payload.description || !payload.discount_type) {
        throw new Error("Vui lòng nhập tên voucher, mã giảm giá và loại giảm giá.");
    }

    await apiFetch(raw.id ? `/api/coupons/${raw.id}` : "/api/coupons", {
        method: raw.id ? "PUT" : "POST",
        body: JSON.stringify(payload)
    });

    state.coupons = await apiFetch("/api/coupons");
    await reloadCouponsState();
    closeVoucherForm();
    showToast(raw.id ? "Đã cập nhật voucher." : "Đã tạo voucher mới.");
}

export async function handleVoucherAction(action, voucherId) {
    const coupon = getVoucherById(voucherId);
    if (!coupon) throw new Error("Không tìm thấy voucher.");

    if (action === "edit") {
        openVoucherForm(voucherId);
        return;
    }

    if (action === "toggle-status") {
        await apiFetch(`/api/coupons/${coupon.id}`, {
            method: "PUT",
            body: JSON.stringify({ ...coupon, description: coupon.description, is_active: !coupon.is_active })
        });
        state.coupons = await apiFetch("/api/coupons");
        await reloadCouponsState();
        showToast("Đã cập nhật trạng thái voucher.");
        return;
    }

    if (action === "delete") {
        if (!window.confirm(`Bạn chắc chắn muốn xóa voucher ${coupon.code}?`)) return;
        await apiFetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
        state.coupons = await apiFetch("/api/coupons");
        await reloadCouponsState();
        showToast("Đã xóa voucher.");
    }
}

function loadPromotionRulesFromStorage() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.promotionRules) || "[]");
        state.promotionRules = Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        state.promotionRules = [];
    }
}

function savePromotionRulesToStorage() {
    localStorage.setItem(STORAGE_KEYS.promotionRules, JSON.stringify(state.promotionRules || []));
}

async function loadPromotionRulesFromApi({ force = false } = {}) {
    if (promotionRulesLoading) return promotionRulesLoading;
    if (promotionRulesLoaded && !force) return state.promotionRules || [];

    promotionRulesLoading = apiFetch("/api/promotions")
        .then((payload) => {
            const remoteRules = Array.isArray(payload?.campaigns)
                ? payload.campaigns
                : Array.isArray(payload)
                    ? payload
                    : [];
            state.promotionRules = remoteRules;
            promotionRulesLoaded = true;
            localStorage.removeItem(STORAGE_KEYS.promotionRules);
            return state.promotionRules;
        })
        .catch((error) => {
            state.promotionRules = [];
            promotionRulesLoaded = true;
            showToast(error.message || "Không tải được chiến dịch khuyến mãi từ DB.", true);
            return state.promotionRules || [];
        })
        .finally(() => {
            promotionRulesLoading = null;
        });

    return promotionRulesLoading;
}

function promotionProductSelect(value = "", scope = "products") {
    const selectedLabel = value && value !== "all"
        ? (scope === "categories" ? getCategoryNameById(value) : getPromotionProductName(value))
        : (scope === "categories" ? "Tất cả danh mục" : "Tất cả sản phẩm");
    return `
      <div class="promotion-combobox" data-promotion-combobox="extra" data-scope="${escapeHtml(scope)}">
        <input data-promotion-extra-search autocomplete="off" value="${escapeHtml(selectedLabel)}" placeholder="Nhấn để chọn hoặc nhập tên/mã...">
        <input data-promotion-product type="hidden" value="${escapeHtml(value || "all")}">
        <div class="promotion-combobox-menu" data-promotion-menu="extra"></div>
      </div>
    `;
}

function ensurePromotionComboboxId(root) {
    if (!root) return "";
    if (!root.dataset.promotionComboboxId) {
        promotionComboboxUid += 1;
        root.dataset.promotionComboboxId = `promo-combobox-${promotionComboboxUid}`;
    }
    return root.dataset.promotionComboboxId;
}

function getPromotionMenu(root) {
    if (!root) return null;
    const ownerId = ensurePromotionComboboxId(root);
    return root.querySelector(".promotion-combobox-menu")
        || document.querySelector(`.promotion-combobox-menu[data-portal-owner="${ownerId}"]`);
}

function getPromotionRootFromTarget(target) {
    const localRoot = target?.closest?.("[data-promotion-combobox]");
    if (localRoot) return localRoot;

    const portalOwner = target?.closest?.(".promotion-combobox-menu")?.dataset.portalOwner;
    return portalOwner ? document.querySelector(`[data-promotion-combobox-id="${portalOwner}"]`) : null;
}

function restorePromotionComboboxMenu(root) {
    const menu = getPromotionMenu(root);
    if (!root || !menu) return;
    menu.removeAttribute("style");
    delete menu.dataset.portalOwner;
    if (menu.parentElement !== root) {
        root.appendChild(menu);
    }
}

function populatePromotionSelects() {
    if (!elements.promotionForm) return;
    const applyScope = getPromotionApplyScope();
    const label = document.querySelector("#promotionApplyTargetLabel");
    if (label) label.textContent = applyScope === "categories" ? "Danh mục áp dụng" : "Sản phẩm áp dụng";
    renderPromotionCombobox("gift");
    renderPromotionCombobox("apply");
}

function renderPromotionCombobox(kind, container = null) {
    if (!elements.promotionForm) return;
    const root = container || elements.promotionForm.querySelector(`[data-promotion-combobox="${kind}"]`);
    if (!root) return;
    const searchInput = root.querySelector("[data-promotion-search-target], [data-promotion-extra-search]");
    const hiddenInput = kind === "gift"
        ? elements.promotionForm.elements.gift_product_id
        : kind === "apply"
            ? elements.promotionForm.elements.apply_product_id
            : root.querySelector("[data-promotion-product]");
    const menu = getPromotionMenu(root);
    if (!searchInput || !hiddenInput || !menu) return;

    const scope = kind === "gift" ? "products" : String(elements.promotionForm.elements.apply_scope?.value || root.dataset.scope || "products");
    const allLabel = scope === "categories" ? "Tất cả danh mục" : "Tất cả sản phẩm";
    const selectedValue = String(hiddenInput.value || "");
    const currentSearchValue = String(searchInput.value || "").trim();
    const keyword = selectedValue === "all" && currentSearchValue === allLabel ? "" : currentSearchValue;
    if (kind === "apply" && !keyword) {
        searchInput.placeholder = scope === "categories"
            ? "Nhấn để chọn hoặc nhập tên danh mục..."
            : "Nhấn để chọn hoặc nhập tên/mã sản phẩm...";
    }
    const includeAll = kind !== "gift";
    const items = getPromotionOptionItems(scope, keyword);
    menu.innerHTML = [
        includeAll ? `<button type="button" data-promotion-select-value="all" data-promotion-select-label="${escapeHtml(allLabel)}">${escapeHtml(allLabel)}</button>` : "",
        ...items.map((item) => {
            const label = formatPromotionOptionLabel(item, scope);
            return `<button type="button" data-promotion-select-value="${escapeHtml(String(item.id))}" data-promotion-select-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
        })
    ].join("") || '<span class="promotion-combobox-empty">Không tìm thấy dữ liệu phù hợp.</span>';
}

function positionPromotionComboboxMenu(root) {
    const searchInput = root?.querySelector("[data-promotion-search-target], [data-promotion-extra-search]");
    const menu = getPromotionMenu(root);
    if (!searchInput || !menu) return;

    const rect = searchInput.getBoundingClientRect();
    const availableBelow = window.innerHeight - rect.bottom - 12;
    const availableAbove = rect.top - 12;
    const maxHeight = Math.min(184, Math.max(88, Math.max(availableBelow, availableAbove)));
    const shouldOpenAbove = availableBelow < 140 && availableAbove > availableBelow;
    const ownerId = ensurePromotionComboboxId(root);
    menu.dataset.portalOwner = ownerId;
    if (menu.parentElement !== document.body) {
        document.body.appendChild(menu);
    }
    menu.style.position = "fixed";
    menu.style.left = `${rect.left}px`;
    menu.style.top = shouldOpenAbove
        ? `${Math.max(8, rect.top - maxHeight - 6)}px`
        : `${Math.min(window.innerHeight - maxHeight - 8, rect.bottom + 6)}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.zIndex = "3200";
    menu.style.display = "grid";
    menu.style.gap = "6px";
}

function closePromotionComboboxes(exceptRoot = null) {
    document.querySelectorAll(".promotion-combobox.open").forEach((root) => {
        if (root === exceptRoot) return;
        root.classList.remove("open");
        restorePromotionComboboxMenu(root);
    });
}

function getPromotionSelectedTime() {
    const activeButton = elements.promotionFormView?.querySelector("[data-promotion-time].active");
    if (activeButton?.dataset.promotionTime) return activeButton.dataset.promotionTime;
    const activeRow = elements.promotionFormView?.querySelector("[data-promotion-custom-time].active");
    if (!activeRow) return "";
    const start = activeRow.querySelector("[data-time-start]")?.value || "";
    const end = activeRow.querySelector("[data-time-end]")?.value || "";
    return start && end ? `${start} - ${end}` : "";
}

function addPromotionTimeRange() {
    const list = document.querySelector("#promotionCustomTimeList");
    if (!list) return;
    const row = document.createElement("div");
    row.className = "promotion-custom-time active";
    row.dataset.promotionCustomTime = "true";
    row.innerHTML = `
      <input data-time-start type="time" value="18:00" aria-label="Giờ bắt đầu">
      <span>-</span>
      <input data-time-end type="time" value="20:00" aria-label="Giờ kết thúc">
      <button type="button" data-promotion-action="remove-time">Xóa</button>
    `;
    elements.promotionFormView?.querySelectorAll("[data-promotion-time], [data-promotion-custom-time]").forEach((item) => item.classList.remove("active"));
    list.appendChild(row);
    syncPromotionPreview();
}

function getPromotionProductName(productId) {
    const product = (state.products || []).find((item) => String(item.id) === String(productId));
    return product?.name || product?.ten_san_pham || "Sản phẩm ngẫu nhiên";
}

function getPromotionAppliedProducts() {
    const values = [
        String(elements.promotionForm?.elements.apply_product_id?.value || "all"),
        ...Array.from(elements.promotionProductsList?.querySelectorAll("[data-promotion-product]") || []).map((select) => String(select.value || ""))
    ].filter(Boolean);
    const productIds = values.filter((value) => value !== "all");
    return productIds.length ? [...new Set(productIds)] : ["all"];
}

function getPromotionApplyScope() {
    return String(elements.promotionForm?.elements.apply_scope?.value || "products") === "categories" ? "categories" : "products";
}

function getPromotionStatus(rule) {
    if (!rule.is_active) return "paused";
    const today = new Date();
    const endDate = rule.end_date ? new Date(rule.end_date) : null;
    if (endDate && endDate < today) return "ended";
    if (endDate) {
        const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= 7) return "ending";
    }
    return "active";
}

function getPromotionStatusLabel(status) {
    return {
        active: "Đang chạy",
        ending: "Sắp hết hạn",
        paused: "Tạm dừng",
        ended: "Đã kết thúc"
    }[status] || "Đang chạy";
}

function getPromotionTypeLabel(type) {
    return type === "discount" || type === "golden_hour" ? "Giảm giá" : "Mua X tặng Y";
}

function openPromotionForm() {
    resetPromotionForm();
    elements.promotionFormView?.classList.remove("hidden");
}

function setPromotionType(type = "buy_x_get_y") {
    const normalizedType = type === "discount" || type === "golden_hour" ? "discount" : "buy_x_get_y";
    elements.promotionForm?.querySelectorAll("input[name='type']").forEach((input) => {
        input.checked = input.value === normalizedType;
        input.closest(".promotion-type-card")?.classList.toggle("active", input.checked);
    });
}

function setPromotionTimeRange(timeRange = "") {
    const normalizedTime = String(timeRange || "").trim();
    const timeButtons = elements.promotionFormView?.querySelectorAll("[data-promotion-time]") || [];
    let matched = false;
    timeButtons.forEach((button) => {
        const active = normalizedTime && button.dataset.promotionTime === normalizedTime;
        button.classList.toggle("active", active);
        matched = matched || active;
    });

    if (!normalizedTime || matched) return;

    const [start = "", end = ""] = normalizedTime.split("-").map((part) => part.trim());
    addPromotionTimeRange();
    const customRow = elements.promotionFormView?.querySelector("[data-promotion-custom-time].active");
    if (customRow) {
        const startInput = customRow.querySelector("[data-time-start]");
        const endInput = customRow.querySelector("[data-time-end]");
        if (startInput) startInput.value = start;
        if (endInput) endInput.value = end;
    }
}

function setPromotionComboboxValue(kind, value, scope = "products") {
    const root = elements.promotionForm?.querySelector(`[data-promotion-combobox="${kind}"]`);
    if (!root) return;
    const hiddenInput = root.querySelector("[data-promotion-search-target]")?.name === "gift_product_search"
        ? elements.promotionForm.elements.gift_product_id
        : elements.promotionForm.elements.apply_product_id;
    const searchInput = root.querySelector("[data-promotion-search-target]");
    const nextValue = String(value || (kind === "apply" ? "all" : ""));
    if (hiddenInput) hiddenInput.value = nextValue;
    if (searchInput) {
        searchInput.value = nextValue && nextValue !== "all"
            ? (scope === "categories" ? getCategoryNameById(nextValue) : getPromotionProductName(nextValue))
            : (kind === "apply" ? (scope === "categories" ? "Tất cả danh mục" : "Tất cả sản phẩm") : "");
    }
}

function openPromotionRuleDetail(ruleId) {
    const rule = (state.promotionRules || []).find((item) => String(item.id) === String(ruleId));
    if (!rule || !elements.promotionForm) return;

    resetPromotionForm();
    elements.promotionFormView?.classList.remove("hidden");

    elements.promotionForm.elements.name.value = rule.name || "";
    elements.promotionForm.elements.is_active.checked = Boolean(rule.is_active);
    elements.promotionForm.elements.apply_scope.value = rule.apply_scope === "categories" ? "categories" : "products";
    elements.promotionForm.elements.discount_percent.value = rule.discount_percent || "";
    elements.promotionForm.elements.start_date.value = rule.start_date || "";
    elements.promotionForm.elements.end_date.value = rule.end_date || "";

    setPromotionType(rule.type);
    populatePromotionSelects();
    setPromotionComboboxValue("gift", rule.gift_product_id || "", "products");

    const applyScope = getPromotionApplyScope();
    const productIds = Array.isArray(rule.apply_product_ids) && rule.apply_product_ids.length ? rule.apply_product_ids : ["all"];
    setPromotionComboboxValue("apply", productIds[0] || "all", applyScope);
    productIds.slice(1).forEach((value) => addPromotionAppliedProduct(value));
    setPromotionTimeRange(rule.time_range || "");
    syncPromotionPreview();
}

function closePromotionForm() {
    closePromotionComboboxes();
    elements.promotionFormView?.classList.add("hidden");
}

export function addPromotionAppliedProduct(value = "") {
    if (!elements.promotionProductsList) return;
    const index = elements.promotionProductsList.querySelectorAll("[data-promotion-product-row]").length + 2;
    const scope = getPromotionApplyScope();
    const row = document.createElement("div");
    row.className = "promotion-product-row";
    row.dataset.promotionProductRow = String(index);
    row.innerHTML = `
      <label>
        <span>${scope === "categories" ? "Danh mục" : "Sản phẩm"} áp dụng ${index}</span>
        ${promotionProductSelect(value || "all", scope)}
      </label>
      <button class="chip-button" type="button" data-promotion-action="remove-product">Xóa</button>
    `;
    elements.promotionProductsList.appendChild(row);
    syncPromotionPreview();
}

export function resetPromotionForm() {
    elements.promotionForm?.reset();
    if (elements.promotionProductsList) elements.promotionProductsList.innerHTML = "";
    populatePromotionSelects();
    document.querySelectorAll(".promotion-type-card").forEach((card, index) => card.classList.toggle("active", index === 0));
    syncPromotionPreview();
}

export function syncPromotionPreview() {
    if (!elements.promotionForm) return;
    const raw = Object.fromEntries(new FormData(elements.promotionForm).entries());
    const type = String(raw.type || "buy_x_get_y") === "golden_hour" ? "discount" : String(raw.type || "buy_x_get_y");
    const title = String(raw.name || "").trim() || "Mùa Thu Rực Rỡ";
    const discount = Number(raw.discount_percent || 0);
    const products = getPromotionAppliedProducts();

    if (elements.promotionPreviewTitle) elements.promotionPreviewTitle.textContent = title;
    if (elements.promotionPreviewType) {
        elements.promotionPreviewType.textContent = type === "discount"
            ? `Giảm ${discount || 0}%`
            : "Mua X tặng Y";
    }
    if (elements.promotionPreviewSchedule) {
        const start = raw.start_date ? formatDate(raw.start_date) : "Bắt đầu ngay";
        const end = raw.end_date ? ` - ${formatDate(raw.end_date)}` : "";
        const time = getPromotionSelectedTime();
        elements.promotionPreviewSchedule.textContent = `${start}${end}${time ? ` • ${time}` : ""}`;
    }
    if (elements.promotionPreviewAudience) elements.promotionPreviewAudience.textContent = "Tất cả khách hàng";
    if (elements.promotionPreviewScope) {
        const scopeLabel = getPromotionApplyScope() === "categories" ? "danh mục" : "sản phẩm";
        elements.promotionPreviewScope.textContent = products.includes("all")
            ? (getPromotionApplyScope() === "categories" ? "Tất cả danh mục" : "Tất cả sản phẩm")
            : `${formatNumber(products.length)} ${scopeLabel}`;
    }
}

function buildPromotionPayload(raw = {}) {
    const products = getPromotionAppliedProducts();
    const type = String(raw.type || "buy_x_get_y") === "golden_hour" ? "discount" : String(raw.type || "buy_x_get_y");
    const isActive = raw.is_active === "on";
    return {
        name: String(raw.name || "").trim(),
        type,
        is_active: isActive,
        status: isActive ? "active" : "paused",
        gift_product_id: raw.gift_product_id || "",
        apply_scope: String(raw.apply_scope || "products") === "categories" ? "categories" : "products",
        apply_product_ids: products,
        discount_percent: type === "discount" ? Number(raw.discount_percent || 0) : 0,
        time_range: getPromotionSelectedTime(),
        start_date: raw.start_date || "",
        end_date: raw.end_date || "",
        created_at: new Date().toISOString()
    };
}

export async function submitPromotionForm(raw) {
    const payload = buildPromotionPayload(raw);
    if (!payload.name) throw new Error("Vui lòng nhập tên chiến dịch khuyến mãi.");

    try {
        await apiFetch("/api/promotions", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    } catch (error) {
        if (error.status === 404) {
            throw new Error(`Backend hiện tại chưa có API /api/promotions tại ${state.apiBase}. Cần deploy backend mới rồi lưu lại chiến dịch.`);
        }
        throw error;
    }
    await loadPromotionRulesFromApi({ force: true });

    renderPromotionRules();
    syncPromotionPreview();
    closePromotionForm();
    showToast("Đã lưu chiến dịch khuyến mãi vào cơ sở dữ liệu.");
}

export async function handlePromotionAction(action, target = null) {
    if (action === "open-form" || action === "new") {
        openPromotionForm();
        return;
    }
    if (action === "view-rule") {
        openPromotionRuleDetail(target?.dataset.id || "");
        return;
    }
    if (action === "close-form") {
        closePromotionForm();
        return;
    }
    if (action === "refresh-list") {
        loadPromotionRulesFromApi({ force: true }).then(renderPromotionRules);
        return;
    }
    if (action === "refresh-selects") {
        populatePromotionSelects();
        syncPromotionPreview();
        return;
    }
    if (action === "select-option") {
        const root = getPromotionRootFromTarget(target);
        const value = target?.dataset.promotionSelectValue || "";
        const label = target?.dataset.promotionSelectLabel || "";
        if (!root) return;
        const hiddenInput = root.dataset.promotionCombobox === "gift"
            ? elements.promotionForm?.elements.gift_product_id
            : root.dataset.promotionCombobox === "apply"
                ? elements.promotionForm?.elements.apply_product_id
                : root.querySelector("[data-promotion-product]");
        const searchInput = root.querySelector("[data-promotion-search-target], [data-promotion-extra-search]");
        if (hiddenInput) hiddenInput.value = value;
        if (searchInput) searchInput.value = label;
        root.classList.remove("open");
        restorePromotionComboboxMenu(root);
        syncPromotionPreview();
        return;
    }
    if (action === "open-combobox") {
        const root = target?.closest?.("[data-promotion-combobox]");
        if (!root) return;
        closePromotionComboboxes(root);
        renderPromotionCombobox(root.dataset.promotionCombobox || "extra", root);
        root.classList.add("open");
        positionPromotionComboboxMenu(root);
        return;
    }
    if (action === "close-comboboxes") {
        closePromotionComboboxes();
        return;
    }
    if (action === "add-product") {
        addPromotionAppliedProduct();
        return;
    }
    if (action === "add-time") {
        addPromotionTimeRange();
        return;
    }
    if (action === "remove-time") {
        target?.closest?.("[data-promotion-custom-time]")?.remove();
        syncPromotionPreview();
        return;
    }
    if (action === "remove-product") {
        target?.closest?.("[data-promotion-product-row]")?.remove();
        syncPromotionPreview();
        return;
    }
    if (action === "delete-rule") {
        const id = Number(target?.dataset.id || 0);
        if (!window.confirm("Bạn chắc chắn muốn xóa chiến dịch khuyến mãi này?")) return;
        const rule = (state.promotionRules || []).find((item) => Number(item.id) === id);
        if (rule?.saved_locally) {
            state.promotionRules = (state.promotionRules || []).filter((item) => Number(item.id) !== id);
            savePromotionRulesToStorage();
            renderPromotionRules();
            showToast("Đã xóa chiến dịch khuyến mãi.");
            return;
        }
        try {
            await apiFetch(`/api/promotions/${id}`, { method: "DELETE" });
            await loadPromotionRulesFromApi({ force: true });
            renderPromotionRules();
            showToast("Đã xóa chiến dịch khuyến mãi.");
        } catch (error) {
            showToast(error.message || "Không xóa được chiến dịch khuyến mãi.", true);
        }
        return;
    }
    if (action === "toggle-rule") {
        const id = Number(target?.dataset.id || 0);
        const rule = (state.promotionRules || []).find((item) => Number(item.id) === id);
        if (!rule) return;
        if (rule.saved_locally) {
            rule.is_active = !rule.is_active;
            rule.status = rule.is_active ? "active" : "paused";
            rule.updated_at = new Date().toISOString();
            savePromotionRulesToStorage();
            renderPromotionRules();
            showToast("Đã cập nhật trạng thái chiến dịch.");
            return;
        }
        try {
            await apiFetch(`/api/promotions/${id}`, {
                method: "PUT",
                body: JSON.stringify({ ...rule, is_active: !rule.is_active })
            });
            await loadPromotionRulesFromApi({ force: true });
            renderPromotionRules();
            showToast("Đã cập nhật trạng thái chiến dịch.");
        } catch (error) {
            showToast(error.message || "Không cập nhật được chiến dịch khuyến mãi.", true);
        }
    }
}

function getFilteredPromotionRules() {
    const statusFilter = elements.promotionStatusFilter?.value || "";
    const typeFilter = elements.promotionTypeFilter?.value || "";
    const keyword = String(elements.promotionSearchInput?.value || "").trim().toLowerCase();
    return (state.promotionRules || []).filter((rule) => {
        const status = getPromotionStatus(rule);
        const ruleType = rule.type === "golden_hour" ? "discount" : rule.type;
        const matchStatus = !statusFilter || status === statusFilter;
        const matchType = !typeFilter || ruleType === typeFilter;
        const matchKeyword = !keyword || String(rule.name || "").toLowerCase().includes(keyword);
        return matchStatus && matchType && matchKeyword;
    });
}

function renderPromotionRules() {
    const target = elements.promotionCampaignList || elements.promotionRulesList;
    if (!target) return;
    const rules = getFilteredPromotionRules();
    target.innerHTML = rules.map((rule) => {
        const status = getPromotionStatus(rule);
        const productIds = rule.apply_product_ids || [];
        const applyScope = rule.apply_scope === "categories" ? "categories" : "products";
        const productCount = productIds.includes("all")
            ? (applyScope === "categories" ? (state.categories || []).length : (state.products || []).length)
            : productIds.length;
        const applyLabel = applyScope === "categories" ? "danh mục áp dụng" : "sản phẩm áp dụng";
        const giftName = rule.gift_product_id ? getPromotionProductName(rule.gift_product_id) : "Sản phẩm ngẫu nhiên";
        const start = rule.start_date ? formatDate(rule.start_date) : "Không giới hạn";
        const end = rule.end_date ? formatDate(rule.end_date) : "Không giới hạn";
        return `
          <article class="promotion-campaign-item">
            <div class="promotion-campaign-thumb">${rule.type === "discount" || rule.type === "golden_hour" ? "%" : "🎁"}</div>
            <div class="promotion-campaign-info">
              <div class="promotion-campaign-title">
                <strong>${escapeHtml(rule.name)}</strong>
                <span class="promotion-status ${status}">${getPromotionStatusLabel(status)}</span>
              </div>
              <p>${getPromotionTypeLabel(rule.type)} • ${rule.type === "discount" || rule.type === "golden_hour" ? `Giảm ${formatNumber(rule.discount_percent || 0)}%` : `Tặng ${escapeHtml(giftName)}`}</p>
              <small>${formatNumber(productCount)} ${applyLabel}</small>
            </div>
            <div class="promotion-campaign-gift">
              <span>${rule.type === "discount" || rule.type === "golden_hour" ? "Ưu đãi" : "Quà tặng"}</span>
              <strong>${rule.type === "discount" || rule.type === "golden_hour" ? `Giảm ${formatNumber(rule.discount_percent || 0)}%` : escapeHtml(giftName)}</strong>
              <small>Số lượng: 1</small>
            </div>
            <div class="promotion-campaign-date">
              <span>${start}</span>
              <span>${end}</span>
            </div>
            <div class="promotion-campaign-actions">
              <button class="promotion-status-button ${status}" type="button" data-promotion-action="toggle-rule" data-id="${rule.id}">${getPromotionStatusLabel(status)}</button>
              <button class="outline-button" type="button" data-promotion-action="view-rule" data-id="${rule.id}">Xem chi tiết</button>
              <button class="ghost-button danger" type="button" data-promotion-action="delete-rule" data-id="${rule.id}">Xóa</button>
            </div>
          </article>
        `;
    }).join("") || '<p class="section-copy">Chưa có chiến dịch khuyến mãi nào.</p>';
}

function renderPromotionWorkspace() {
    populatePromotionSelects();
    if (!promotionRulesLoaded) {
        loadPromotionRulesFromApi().then(renderPromotionRules);
    }
    renderPromotionRules();
    syncPromotionPreview();
}
export function renderVouchers() {
    const isPromotionWorkspace = state.voucherWorkspace === "promotions";
    const isVoucherModalOpen = !elements.voucherFormView?.classList.contains("hidden");

    elements.promotionBuilderView?.classList.toggle("hidden", !isPromotionWorkspace);
    elements.voucherListView?.classList.toggle("hidden", isPromotionWorkspace);
    if (!isPromotionWorkspace) elements.promotionFormView?.classList.add("hidden");
    if (isPromotionWorkspace) {
        elements.voucherFormView?.classList.add("hidden");
    } else {
        elements.voucherFormView?.classList.toggle("hidden", !isVoucherModalOpen);
    }

    if (isPromotionWorkspace) {
        renderPromotionWorkspace();
        return;
    }

    renderVoucherSummary();
    renderVoucherTable();
    if (isVoucherModalOpen) syncVoucherPreview();
}

