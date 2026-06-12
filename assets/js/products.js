import { PRODUCT_WORKSPACES, STORE_BRANCHES, WAREHOUSE_ZONES, STORAGE_KEYS, apiFetch, elements, escapeHtml, fillSelectOptions, formatCurrency, formatMoneyInputValue, formatNumber, resolveMediaUrl, saveWarehouseCapacities, showToast, state, statusPill, uploadImageFile } from "./core.js";
import { loadOverview, loadProducts } from "./data.js";
import { renderAppIcon } from "./icons.js";

let productEditorImagePreview = "";

function defaultProductThumb() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23efe5d8'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23765f4a' font-family='Arial' font-size='16'%3ESP%3C/text%3E%3C/svg%3E";
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

function renderProductThumb(product, className = "product-thumb") {
    const fallback = defaultProductThumb();
    const src = resolveMediaUrl(getProductImageSource(product), fallback);
    return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" data-fallback-src="${escapeHtml(fallback)}" alt="${escapeHtml(product?.name || "Sản phẩm")}" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc;">`;
}

function getProductById(productId) {
    return state.products.find((item) => Number(item.id) === Number(productId));
}

function getInlineProductMeta(product) {
    return escapeHtml(product.category_name || product.category?.name || "-");
}

function toDateInputValue(value) {
    return value ? String(value).slice(0, 10) : "";
}

function normalizeProductImageUrl(value) {
    const text = String(value || "").trim();
    if (!text || text.startsWith("data:image/") || text.startsWith("blob:")) return "";
    return text;
}

function parseStockInputValue(value) {
    const normalized = String(value || "0")
        .trim()
        .replace(/\s+/g, "")
        .replace(",", ".");
    const number = Number(normalized || 0);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatStockInputValue(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number)
        ? String(number)
        : String(Number(number.toFixed(3))).replace(",", ".");
}

async function uploadProductImage(file) {
    if (!file || !file.size) return "";
    if (!String(file.type || "").startsWith("image/")) {
        throw new Error("Vui lòng chọn đúng file ảnh.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Ảnh sản phẩm tối đa 5MB.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch("/api/uploads/images?folder=products", {
        method: "POST",
        body: formData
    });

    return payload?.file?.relative_url
        || payload?.file?.url
        || payload?.hinh_anh?.duong_dan_tuong_doi
        || payload?.hinh_anh?.duong_dan
        || "";
}

export async function prepareProductImageUpload(raw, fileInput) {
    const nextRaw = {
        ...raw,
        thumbnail_url: normalizeProductImageUrl(raw.thumbnail_url)
    };
    const file = fileInput?.files?.[0];
    if (file) {
        nextRaw.thumbnail_url = await uploadImageFile(file, "products");
    }
    return nextRaw;
}

function getCategoryDescendantIds(categoryId) {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    const ids = new Set();
    const visit = (parentId) => {
        categories
            .filter((category) => Number(category.parent_id || 0) === Number(parentId))
            .forEach((child) => {
                const childId = Number(child.id);
                if (!childId || ids.has(childId)) return;
                ids.add(childId);
                visit(childId);
            });
    };
    visit(categoryId);
    return ids;
}

function parseImportReferencePrice(product) {
    const explicitValue = Number(product.import_price || product.cost_price || 0);
    if (explicitValue > 0) return explicitValue;
    const description = String(product.description || "");
    const match = description.match(/Giá nhập tham chiếu:\s*([^\n]+)/i);
    if (!match) return Number(product.price || 0);
    const normalized = String(match[1] || "").replace(/[^\d]/g, "");
    return normalized ? Number(normalized) : Number(product.price || 0);
}

function resolveRetailPriceValue(product) {
    const salePrice = Number(product?.sale_price);
    if (Number.isFinite(salePrice) && salePrice > 0) return salePrice;

    const currentPrice = Number(product?.current_price);
    if (Number.isFinite(currentPrice) && currentPrice > 0 && currentPrice !== Number(product?.price || 0)) {
        return currentPrice;
    }

    return Number(product?.price || 0);
}

function syncPublishDraft(productId, overrides = {}) {
    const product = getProductById(productId);
    if (!product && !state.publishDrafts[productId]) return;

    state.publishDrafts[productId] = {
        retailPrice: overrides.retailPrice ?? resolveRetailPriceValue(product),
        saleUnit: overrides.saleUnit ?? String(product?.sale_unit || product?.unit || product?.stock_unit || "").trim(),
        listingQuantity: overrides.listingQuantity ?? Number(product?.stock_per_sale_unit || 1),
        publishMode: overrides.publishMode ?? (product?.is_published ? "published" : "draft")
    };
}

function getPublishDraft(product) {
    const saved = state.publishDrafts[product.id] || {};
    return {
        retailPrice: saved.retailPrice ?? resolveRetailPriceValue(product),
        saleUnit: saved.saleUnit ?? String(product.sale_unit || product.unit || product.stock_unit || "").trim(),
        listingQuantity: saved.listingQuantity ?? Number(product.stock_per_sale_unit || 1),
        publishMode: saved.publishMode ?? (product.is_published ? "published" : "draft")
    };
}

function getPublishZoneOptions() {
    return [{ key: "all", label: "Tất cả kho" }, ...WAREHOUSE_ZONES.map((zone) => ({ key: zone.key, label: `${zone.label}: ${zone.name}` }))];
}

function getStoreBranch(storeKey = state.publishStoreFilter) {
    return STORE_BRANCHES.find((branch) => branch.key === storeKey) || STORE_BRANCHES[0];
}

function getStoreAllocation(product, storeKey = state.publishStoreFilter) {
    return (product?.store_allocations || []).find((allocation) => allocation.store_key === storeKey) || null;
}

function getStoreProductStage(product, storeKey = state.publishStoreFilter) {
    const allocation = getStoreAllocation(product, storeKey);
    const quantity = Number(allocation?.allocated_quantity || 0);
    if (!allocation || quantity <= 0) return "not_allocated";
    if (allocation.publish_mode === "published") return "published";
    return "allocated";
}

function getPublishedStoreCount(product) {
    return (product?.store_allocations || []).filter((allocation) => allocation.publish_mode === "published" && Number(allocation.allocated_quantity || 0) > 0).length;
}

function isChildCategory(category) {
    return Boolean(Number(category?.parent_id || 0));
}

function buildGroupedCategoryOptions(selectedValue = "") {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    const parents = categories
        .filter((category) => !isChildCategory(category))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
    const childrenByParent = categories
        .filter(isChildCategory)
        .reduce((groups, category) => {
            const parentId = String(category.parent_id || "");
            if (!groups.has(parentId)) groups.set(parentId, []);
            groups.get(parentId).push(category);
            return groups;
        }, new Map());
    const childIds = new Set(categories.filter(isChildCategory).map((category) => Number(category.id)));
    const orphanChildren = categories.filter((category) => isChildCategory(category) && !categories.some((parent) => Number(parent.id) === Number(category.parent_id)));

    const option = (category, prefix = "") => {
        const value = String(category.id);
        return `<option value="${escapeHtml(value)}" ${String(selectedValue) === value ? "selected" : ""}>${escapeHtml(prefix + (category.name || category.label || value))}</option>`;
    };

    const parentOptions = parents.map((parent) => option(parent, "Cha: ")).join("");
    const childGroups = parents.map((parent) => {
        const children = (childrenByParent.get(String(parent.id)) || [])
            .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
        if (!children.length) return "";
        return `<optgroup label="${escapeHtml(parent.name || parent.label || "Danh mục cha")}">${children.map((child) => option(child, "Con: ")).join("")}</optgroup>`;
    }).join("");
    const looseParents = categories
        .filter((category) => !isChildCategory(category) && !parents.some((parent) => Number(parent.id) === Number(category.id)) && !childIds.has(Number(category.id)))
        .map((category) => option(category))
        .join("");
    const orphanOptions = orphanChildren.length
        ? `<optgroup label="Danh mục con chưa có cha">${orphanChildren.map((child) => option(child, "Con: ")).join("")}</optgroup>`
        : "";

    return `<option value="">Tất cả danh mục</option><optgroup label="Danh mục cha">${parentOptions || looseParents}</optgroup>${childGroups}${orphanOptions}`;
}

function getParentCategoryOptions(selectedValue = "") {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    return `<option value="">Tất cả</option>${categories
        .filter((category) => !isChildCategory(category))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"))
        .map((category) => `<option value="${escapeHtml(String(category.id))}" ${String(selectedValue) === String(category.id) ? "selected" : ""}>${escapeHtml(category.name || category.label || category.id)}</option>`)
        .join("")}`;
}

function getChildCategoryOptions(parentId = "", selectedValue = "") {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    const parentValue = Number(parentId || 0);
    const children = categories
        .filter((category) => isChildCategory(category))
        .filter((category) => !parentValue || Number(category.parent_id || 0) === parentValue)
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));

    return `<option value="">Tất cả</option>${children
        .map((category) => `<option value="${escapeHtml(String(category.id))}" ${String(selectedValue) === String(category.id) ? "selected" : ""}>${escapeHtml(category.name || category.label || category.id)}</option>`)
        .join("")}`;
}

function getStorePublishStatusCopy(product, storeKey = state.publishStoreFilter) {
    const allocation = getStoreAllocation(product, storeKey);
    const quantity = Number(allocation?.allocated_quantity || 0);
    const unit = product.stock_unit || product.sale_unit || product.unit || "";
    const stage = getStoreProductStage(product, storeKey);
    if (!allocation) {
        return {
            allocation,
            stage,
            quantity: 0,
            isPublished: false,
            pill: statusPill("draft", "Chưa chuyển"),
            note: "Cửa hàng này chưa có hàng. Cần chuyển từ kho tổng trước khi bán."
        };
    }

    if (allocation.publish_mode === "published" && quantity > 0) {
        return {
            allocation,
            stage,
            quantity,
            isPublished: true,
            pill: statusPill("active", "Đang bán"),
            note: `Đang bán ${formatNumber(quantity)} ${unit} tại cửa hàng này.`.trim()
        };
    }

    return {
        allocation,
        stage,
        quantity,
        isPublished: false,
        pill: statusPill("pending", "Đã chuyển"),
        note: quantity > 0
            ? `Đã chuyển ${formatNumber(quantity)} ${unit} sang cửa hàng, chưa đưa lên bán.`.trim()
            : "Đang chờ thiết lập lượng chuyển cho cửa hàng này."
    };
}

function buildPublishFilterChips() {
    const activeStore = getStoreBranch();
    const storeCounts = (state.products || []).reduce((counts, product) => {
        const stage = getStoreProductStage(product, activeStore.key);
        counts[stage] = (counts[stage] || 0) + 1;
        return counts;
    }, { not_allocated: 0, allocated: 0, published: 0 });

    return `
      <div class="publish-filter-panel">
        <p class="section-copy publish-store-copy"><strong>${escapeHtml(activeStore.label)} - ${escapeHtml(activeStore.name)}</strong><span>Sản phẩm chưa chuyển sang cửa hàng này sẽ không được bán tại đây.</span></p>
      </div>
    `;
}

function buildPublishBranchSummary() {
    const activeStore = getStoreBranch();
    return `
      <article class="publish-filter-branch-card">
        <span>Chi nhánh</span>
        <strong>${escapeHtml(activeStore.label || activeStore.name || "-")}</strong>
        <small>Tổng số chi nhánh: ${formatNumber(STORE_BRANCHES.length)}</small>
        <i></i>
      </article>
    `;
}

function buildProductActionButtons(product) {
    return `
      <div class="action-row">
        <button class="chip-button" type="button" data-action="edit-product" data-id="${product.id}">Sửa</button>
        <button class="chip-button" type="button" data-action="${product.is_published ? "unpublish-product" : "open-publish-editor"}" data-id="${product.id}" data-tone="accent">
          ${product.is_published ? "Gỡ khỏi sàn" : "Đưa lên sàn"}
        </button>
        ${state.user?.role === "admin" ? `<button class="chip-button" type="button" data-action="delete-product" data-id="${product.id}" data-tone="danger">Xóa</button>` : ""}
      </div>
    `;
}

function estimateProductWeightTons(product) {
    const quantity = Number(product.stock_quantity || 0);
    const unit = String(product.stock_unit || product.unit || product.sale_unit || "").toLowerCase();
    const zone = getWarehouseZoneForProduct(product);
    if (!quantity) return 0;
    if (/(tấn|tan|ton)/i.test(unit)) return quantity;
    if (/(kg|kilogram)/i.test(unit)) return quantity / 1000;
    if (/(g|gram)/i.test(unit)) return quantity / 1000000;
    if (/(mg)/i.test(unit)) return quantity / 1000000000;
    const unitWeightByZone = { frozen: 0.008, fresh: 0.012, dry: 0.004 };
    return quantity * (unitWeightByZone[zone] || 0.005);
}

function getWarehouseProducts(zoneKey) {
    const keyword = String(state.filters.products?.keyword || state.inventorySearch || "").trim().toLowerCase();
    const visibility = String(state.filters.products?.visibility || "").trim();
    const childCategoryId = Number(state.filters.products?.category_id || 0);
    const parentCategoryId = Number(state.filters.products?.parent_category_id || 0);
    const categoryId = childCategoryId || parentCategoryId;
    const categoryIds = childCategoryId
        ? new Set([childCategoryId])
        : (categoryId ? new Set([categoryId, ...getCategoryDescendantIds(categoryId)]) : null);
    return (state.products || []).filter((product) => getWarehouseZoneForProduct(product) === zoneKey).filter((product) => {
        if (!keyword) return true;
        return [product.name, product.sku, product.category_name, product.category?.name].some((value) => String(value || "").toLowerCase().includes(keyword));
    }).filter((product) => {
        if (!categoryIds) return true;
        return categoryIds.has(Number(product.category_id || product.category?.id || 0));
    }).filter((product) => {
        if (visibility === "published") return Boolean(product.is_published);
        if (visibility === "hidden") return !Boolean(product.is_published);
        return true;
    });
}

function getWarehouseStatus(product) {
    const stock = Number(product.stock_quantity || 0);
    return stock <= 20 ? statusPill("pending", "Sắp hết") : statusPill("active", "Ổn định");
}

function getProductUnit(product) {
    return String(product.stock_unit || product.unit || product.sale_unit || "đơn vị").trim();
}

function getProductReorderLevel(product) {
    const explicitLevel = Number(product.reorder_level || product.low_stock_threshold || product.minimum_stock || 0);
    if (Number.isFinite(explicitLevel) && explicitLevel > 0) return explicitLevel;
    return 20;
}

function getLowStockStatus(product) {
    const stock = Number(product.stock_quantity || 0);
    const threshold = getProductReorderLevel(product);
    if (stock <= 0) return { key: "out", label: "Hết hàng", tone: "danger" };
    if (stock <= Math.max(1, Math.ceil(threshold * 0.4))) return { key: "urgent", label: "Khẩn cấp", tone: "danger" };
    return { key: "low", label: "Sắp hết", tone: "warning" };
}

function getLowStockProducts() {
    const filters = state.lowStockFilters || {};
    const keyword = String(filters.keyword || "").trim().toLowerCase();
    const status = String(filters.status || "all");
    const zone = String(filters.zone || "all");
    const childCategoryId = Number(filters.category_id || 0);
    const parentCategoryId = Number(filters.parent_category_id || 0);
    const categoryId = childCategoryId || parentCategoryId;
    const categoryIds = childCategoryId
        ? new Set([childCategoryId])
        : (categoryId ? new Set([categoryId, ...getCategoryDescendantIds(categoryId)]) : null);

    return (state.products || [])
        .map((product) => {
            const threshold = getProductReorderLevel(product);
            const stock = Number(product.stock_quantity || 0);
            const stockStatus = getLowStockStatus(product);
            return {
                ...product,
                low_stock_threshold: threshold,
                low_stock_status: stockStatus,
                low_stock_percent: threshold > 0 ? Math.min(100, Math.max(0, Math.round((stock / threshold) * 100))) : 0
            };
        })
        .filter((product) => Number(product.stock_quantity || 0) <= Number(product.low_stock_threshold || 0))
        .filter((product) => {
            if (!keyword) return true;
            return [product.name, product.sku, product.category_name, product.category?.name].some((value) => String(value || "").toLowerCase().includes(keyword));
        })
        .filter((product) => {
            if (!categoryIds) return true;
            return categoryIds.has(Number(product.category_id || product.category?.id || 0));
        })
        .filter((product) => zone === "all" || getWarehouseZoneForProduct(product) === zone)
        .filter((product) => status === "all" || product.low_stock_status.key === status)
        .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0));
}

function getPublishStatusCopy(product) {
    if (product.is_published) {
        return { pill: statusPill("active", "Đã đăng"), note: "Sản phẩm đang hiển thị trên sàn." };
    }
    return { pill: statusPill("draft", "Chưa đăng"), note: "Sản phẩm đang ở trạng thái nháp." };
}

function buildPublishPayload(product, raw) {
    const retailPrice = Number(raw.retail_price || 0);
    if (!Number.isFinite(retailPrice) || retailPrice < 1000) throw new Error("Giá bán lẻ phải từ 1.000 VND trở lên.");
    const saleUnit = String(raw.sale_unit || "").trim();
    if (!saleUnit) throw new Error("Vui lòng nhập đơn vị niêm yết.");
    const listingQuantity = Number(raw.listing_quantity || 0);
    if (!Number.isFinite(listingQuantity) || listingQuantity <= 0) throw new Error("Định lượng niêm yết phải lớn hơn 0.");
    const storeKey = String(raw.store_key || "").trim();
    if (!STORE_BRANCHES.some((store) => store.key === storeKey)) throw new Error("Vui lòng chọn cửa hàng nhận hàng.");
    const storeQuantity = Number(raw.store_quantity || 0);
    const publishMode = raw.publish_mode === "published" ? "published" : "draft";
    if (!Number.isFinite(storeQuantity) || storeQuantity < 0) throw new Error("Số lượng chuyển cho cửa hàng không hợp lệ.");
    if (publishMode === "published" && storeQuantity <= 0) throw new Error("Cần nhập số lượng chuyển từ kho tổng để đăng bán.");
    return {
        sale_price: retailPrice,
        sale_unit: saleUnit,
        stock_per_sale_unit: listingQuantity,
        store_key: storeKey,
        store_label: STORE_BRANCHES.find((store) => store.key === storeKey)?.label || storeKey,
        store_name: STORE_BRANCHES.find((store) => store.key === storeKey)?.name || storeKey,
        allocated_quantity: storeQuantity,
        publish_mode: publishMode,
        is_published: publishMode === "published"
    };
}

function resetPublishEditorState() {
    if (elements.publishEditorForm) {
        elements.publishEditorForm.reset();
        if (elements.publishEditorForm.elements.id) elements.publishEditorForm.elements.id.value = "";
        if (elements.publishEditorForm.elements.store_key) {
            elements.publishEditorForm.elements.store_key.innerHTML = STORE_BRANCHES.map((store) => `<option value="${store.key}">${escapeHtml(store.label)} - ${escapeHtml(store.name)}</option>`).join("");
            elements.publishEditorForm.elements.store_key.value = state.publishStoreFilter || STORE_BRANCHES[0].key;
        }
        if (elements.publishEditorForm.elements.store_quantity) elements.publishEditorForm.elements.store_quantity.value = "0";
        if (elements.publishEditorForm.elements.publish_mode) elements.publishEditorForm.elements.publish_mode.value = "draft";
    }
    if (elements.publishEditorTitle) elements.publishEditorTitle.textContent = "Thiết lập niêm yết sản phẩm";
    if (elements.publishEditorSku) elements.publishEditorSku.textContent = "-";
    if (elements.publishEditorName) elements.publishEditorName.textContent = "-";
    if (elements.publishEditorImage) elements.publishEditorImage.src = defaultProductThumb();
    if (elements.publishEditorStock) elements.publishEditorStock.textContent = "0";
    if (elements.publishEditorStockNote) elements.publishEditorStockNote.textContent = "Hệ thống sẽ tự trừ kho khi bán hàng.";
    if (elements.publishEditorSubmit) elements.publishEditorSubmit.textContent = "Lưu niêm yết";
}

function getWarehouseCapacityTons(zoneKey) {
    const value = Number(state.warehouseCapacities?.[zoneKey]);
    return Number.isFinite(value) && value > 0 ? value : 35;
}

export function setWarehouseCapacity(zoneKey, value) {
    if (!WAREHOUSE_ZONES.some((zone) => zone.key === zoneKey)) return;
    const numericValue = Number(value);
    const nextValue = Math.max(1, Math.min(999, Number.isFinite(numericValue) ? numericValue : 1));
    state.warehouseCapacities = {
        ...(state.warehouseCapacities || {}),
        [zoneKey]: Number(nextValue.toFixed(1))
    };
    saveWarehouseCapacities(state.warehouseCapacities);
    renderProducts();
}

export function adjustWarehouseCapacity(zoneKey, delta) {
    setWarehouseCapacity(zoneKey, getWarehouseCapacityTons(zoneKey) + delta);
}

export function openWarehouseCapacityEditor(zoneKey) {
    state.warehouseCapacityEditorZone = WAREHOUSE_ZONES.some((zone) => zone.key === zoneKey) ? zoneKey : state.inventoryZone;
    renderProducts();
}

export function closeWarehouseCapacityEditor() {
    state.warehouseCapacityEditorZone = null;
    renderProducts();
}

function renderWarehouseCapacityEditor() {
    if (!state.warehouseCapacityEditorZone) return "";
    const zone = WAREHOUSE_ZONES.find((item) => item.key === state.warehouseCapacityEditorZone) || WAREHOUSE_ZONES[0];
    const activeZone = zone;
    const zoneProducts = getWarehouseProducts(zone.key);
    const zoneWeightTons = zoneProducts.reduce((sum, product) => sum + estimateProductWeightTons(product), 0);
    const maxCapacityTons = getWarehouseCapacityTons(zone.key);
    const capacity = Math.min(100, Math.max(0, Math.round((zoneWeightTons / maxCapacityTons) * 100)));

    return `
      <div class="warehouse-capacity-modal-backdrop" data-warehouse-capacity-backdrop>
        <form class="warehouse-capacity-modal ${escapeHtml(zone.tone)}" data-warehouse-capacity-form data-zone="${escapeHtml(zone.key)}">
          <div class="warehouse-capacity-modal-head">
            <div>
              <span>Chỉnh sức chứa</span>
              <h3>${escapeHtml(zone.label)} - ${escapeHtml(zone.name)}</h3>
            </div>
            <button type="button" class="warehouse-capacity-modal-close" data-warehouse-capacity-action="close">×</button>
          </div>
          <div class="warehouse-capacity-modal-meter">
            <span>${renderAppIcon(zone.icon, { className: "app-icon-inline" })} Sức chứa hiện tại</span>
            <strong>${capacity}%</strong>
            <small>${zoneWeightTons.toFixed(1)} / ${maxCapacityTons} tấn</small>
            <div class="warehouse-capacity-bar"><i style="width:${capacity}%"></i></div>
            <button type="button" class="warehouse-capacity-edit" data-warehouse-capacity-action="open" data-zone="${escapeHtml(activeZone.key)}">Chỉnh sức chứa</button>
          </div>
          <div class="warehouse-capacity-control" aria-label="Chỉnh sức chứa kho">
            <button type="button" data-warehouse-capacity-action="decrease" data-zone="${escapeHtml(zone.key)}">-</button>
            <label>
              <span>Sức chứa tối đa</span>
              <input type="number" min="1" max="999" step="0.5" value="${escapeHtml(String(maxCapacityTons))}" data-warehouse-capacity-input data-zone="${escapeHtml(zone.key)}">
            </label>
            <button type="button" data-warehouse-capacity-action="increase" data-zone="${escapeHtml(zone.key)}">+</button>
          </div>
          <p class="warehouse-capacity-modal-note">Đơn vị tính là tấn. Khi tăng hoặc giảm sức chứa, phần trăm sử dụng kho sẽ tự tính lại theo tồn kho hiện tại.</p>
          <div class="warehouse-capacity-modal-actions">
            <button type="button" class="btn-ghost" data-warehouse-capacity-action="close">Hủy</button>
            <button type="button" class="btn-primary" data-warehouse-capacity-action="save">Lưu sức chứa</button>
          </div>
        </form>
      </div>
    `;
}

function renderWarehouseWorkspace() {
    const activeZone = WAREHOUSE_ZONES.find((zone) => zone.key === state.inventoryZone) || WAREHOUSE_ZONES[0];
    const zoneProducts = getWarehouseProducts(activeZone.key);
    const zoneWeightTons = zoneProducts.reduce((sum, product) => sum + estimateProductWeightTons(product), 0);
    const maxCapacityTons = getWarehouseCapacityTons(activeZone.key);
    const capacity = Math.min(100, Math.max(0, Math.round((zoneWeightTons / maxCapacityTons) * 100)));

    elements.productsMeta.textContent = `${formatNumber(zoneProducts.length)} sản phẩm trong ${activeZone.label.toLowerCase()}`;
    elements.productsContent.innerHTML = `
      <section class="warehouse-shell">
        <div class="warehouse-copy warehouse-copy-top">
          <h3>Quản lý kho hàng</h3>
        </div>
        <div class="warehouse-copy warehouse-copy-inline">
          <h3>Quản lý kho hàng</h3>
        </div>
        <article class="warehouse-zone-card ${escapeHtml(activeZone.tone)}">
          <div class="warehouse-zone-main">
            <span class="warehouse-zone-icon">${renderAppIcon(activeZone.icon)}</span>
            <div class="warehouse-zone-copy">
              <div class="warehouse-zone-heading">
                <span class="warehouse-zone-badge">Hoạt động</span>
                <h4>${escapeHtml(activeZone.label)} - ${escapeHtml(activeZone.name)}</h4>
              </div>
            </div>
          </div>
          <div class="warehouse-capacity ${escapeHtml(activeZone.tone)}">
            <span>${renderAppIcon(activeZone.icon, { className: "app-icon-inline" })} Sức chứa</span>
            <strong>${capacity}%</strong>
            <small>${zoneWeightTons.toFixed(1)} / ${maxCapacityTons} tấn</small>
            <div class="warehouse-capacity-bar"><i style="width:${capacity}%"></i></div>
            <div class="warehouse-capacity-control" aria-label="Chỉnh sức chứa kho">
              <button type="button" data-warehouse-capacity-action="decrease" data-zone="${escapeHtml(activeZone.key)}">-</button>
              <label>
                <span>Sức chứa tối đa</span>
                <input type="number" min="1" max="999" step="0.5" value="${escapeHtml(String(maxCapacityTons))}" data-warehouse-capacity-input data-zone="${escapeHtml(activeZone.key)}">
              </label>
              <button type="button" data-warehouse-capacity-action="increase" data-zone="${escapeHtml(activeZone.key)}">+</button>
            </div>
          </div>
        </article>
        <article class="surface warehouse-table-card">
          <div class="warehouse-table-scroll">
            <table class="list-table warehouse-table">
            <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Tồn kho</th><th>Đơn vị</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              ${zoneProducts.map((product) => `<tr><td><div class="product-cell">${renderProductThumb(product)}<div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">SKU: ${escapeHtml(product.sku || "-")}</span></div></div></td><td>${escapeHtml(product.category_name || product.category?.name || "-")}</td><td><strong>${formatNumber(product.stock_quantity)}</strong></td><td>${escapeHtml(product.stock_unit || product.unit || product.sale_unit || "-")}</td><td>${getWarehouseStatus(product)}</td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp trong khu này.</td></tr>'}
            </tbody>
            </table>
          </div>
        </article>
        ${renderWarehouseCapacityEditor()}
      </section>
    `;
}

function renderLowStockWorkspace(items) {
    const filters = state.lowStockFilters || {};
    const allLowStock = (state.products || []).filter((product) => Number(product.stock_quantity || 0) <= getProductReorderLevel(product));
    const urgentCount = allLowStock.filter((product) => getLowStockStatus(product).key === "urgent" || getLowStockStatus(product).key === "out").length;
    const categories = Array.isArray(state.categories) ? state.categories : [];
    const parentCategoryOptions = `<option value="">Tất cả danh mục cha</option>${categories
        .filter((category) => !isChildCategory(category))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"))
        .map((category) => `<option value="${escapeHtml(String(category.id))}" ${String(filters.parent_category_id || "") === String(category.id) ? "selected" : ""}>${escapeHtml(category.name || category.label || category.id)}</option>`)
        .join("")}`;
    const selectedParentId = Number(filters.parent_category_id || 0);
    const childCategoryOptions = `<option value="">Tất cả danh mục con</option>${categories
        .filter((category) => isChildCategory(category))
        .filter((category) => !selectedParentId || Number(category.parent_id || 0) === selectedParentId)
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"))
        .map((category) => `<option value="${escapeHtml(String(category.id))}" ${String(filters.category_id || "") === String(category.id) ? "selected" : ""}>${escapeHtml(category.name || category.label || category.id)}</option>`)
        .join("")}`;

    elements.productsMeta.textContent = `Hiển thị ${formatNumber(items.length)} trong số ${formatNumber(allLowStock.length)} sản phẩm cần theo dõi`;
    elements.productsContent.innerHTML = `
      <section class="low-stock-shell">
        <div class="low-stock-summary-grid">
          <article class="low-stock-summary-card surface">
            <div>
              <span>Sản phẩm sắp hết</span>
              <strong>${formatNumber(allLowStock.length)}</strong>
              <small>Đang thấp hơn ngưỡng cảnh báo</small>
            </div>
            <i>${renderAppIcon("receipt")}</i>
          </article>
          <article class="low-stock-summary-card surface danger">
            <div>
              <span>Cảnh báo khẩn cấp</span>
              <strong>${formatNumber(urgentCount)}</strong>
              <small>Cần nhập hàng sớm để không gián đoạn bán hàng</small>
            </div>
            <i>${renderAppIcon("warning")}</i>
          </article>
        </div>

        <section class="low-stock-filter-panel">
          <label>
            <span>Tìm kiếm</span>
            <input data-low-stock-filter="keyword" value="${escapeHtml(filters.keyword || "")}" placeholder="Tên sản phẩm, SKU...">
          </label>
          <label>
            <span>Danh mục cha</span>
            <select data-low-stock-filter="parent_category_id">
              ${parentCategoryOptions}
            </select>
          </label>
          <label>
            <span>Danh mục con</span>
            <select data-low-stock-filter="category_id">
              ${childCategoryOptions}
            </select>
          </label>
          <label>
            <span>Kho hàng</span>
            <select data-low-stock-filter="zone">
              <option value="all" ${String(filters.zone || "all") === "all" ? "selected" : ""}>Tất cả kho hàng</option>
              ${WAREHOUSE_ZONES.map((zone) => `<option value="${escapeHtml(zone.key)}" ${String(filters.zone || "all") === zone.key ? "selected" : ""}>${escapeHtml(zone.label)} - ${escapeHtml(zone.name)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Trạng thái</span>
            <select data-low-stock-filter="status">
              <option value="all" ${String(filters.status || "all") === "all" ? "selected" : ""}>Tất cả trạng thái</option>
              <option value="low" ${String(filters.status || "all") === "low" ? "selected" : ""}>Sắp hết</option>
              <option value="urgent" ${String(filters.status || "all") === "urgent" ? "selected" : ""}>Khẩn cấp</option>
              <option value="out" ${String(filters.status || "all") === "out" ? "selected" : ""}>Hết hàng</option>
            </select>
          </label>
          <button class="low-stock-filter-button" type="button" data-low-stock-action="filter">Lọc dữ liệu</button>
        </section>

        <article class="low-stock-table-card surface">
          <div class="low-stock-table-scroll">
            <table class="list-table low-stock-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th>Kho</th>
                  <th>Tồn kho / Ngưỡng</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((product) => {
                    const zone = WAREHOUSE_ZONES.find((item) => item.key === getWarehouseZoneForProduct(product));
                    const unit = getProductUnit(product);
                    const status = product.low_stock_status || getLowStockStatus(product);
                    const stock = Number(product.stock_quantity || 0);
                    const threshold = Number(product.low_stock_threshold || getProductReorderLevel(product));
                    return `
                      <tr>
                        <td>
                          <div class="product-cell">
                            ${renderProductThumb(product)}
                            <div>
                              <strong>${escapeHtml(product.name || "Sản phẩm")}</strong>
                              <br><span class="section-copy">SKU: ${escapeHtml(product.sku || "-")}</span>
                            </div>
                          </div>
                        </td>
                        <td><span class="low-stock-category">${escapeHtml(product.category_name || product.category?.name || "-")}</span></td>
                        <td>${escapeHtml(zone ? `${zone.label} - ${zone.name}` : "Chưa phân kho")}</td>
                        <td>
                          <div class="low-stock-meter">
                            <strong>${formatNumber(stock)} ${escapeHtml(unit)}</strong>
                            <span>Ngưỡng: ${formatNumber(threshold)} ${escapeHtml(unit)}</span>
                            <div><i class="${escapeHtml(status.tone)}" style="width:${product.low_stock_percent}%"></i></div>
                          </div>
                        </td>
                        <td><span class="low-stock-status ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span></td>
                        <td>
                          <div class="low-stock-actions">
                            <button class="primary-button" type="button" data-low-stock-action="import" data-product-id="${escapeHtml(String(product.id))}">Nhập hàng</button>
                            <button class="chip-button" type="button" data-action="edit-product" data-id="${escapeHtml(String(product.id))}">${renderAppIcon("edit")}</button>
                          </div>
                        </td>
                      </tr>
                    `;
                }).join("") || '<tr><td colspan="6">Không có sản phẩm nào dưới ngưỡng cảnh báo.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
    elements.productsContent.querySelectorAll('[data-action="open-publish-editor"]').forEach((button) => {
        button.textContent = "Sửa";
    });
    const branchStockHeader = elements.productsContent.querySelector(".publish-table thead th:nth-child(4)");
    if (branchStockHeader) {
        branchStockHeader.textContent = "Kho chi nhánh";
    }
    elements.productsContent.querySelectorAll(".publish-table tbody td:nth-child(4) .section-copy").forEach((node) => {
        node.remove();
    });
}

function renderPublishWorkspace(items) {
    const zoneOptions = getPublishZoneOptions();
    const publishedCount = items.filter((product) => product.is_published).length;
    const unpublishedCount = items.length - publishedCount;
    elements.productsContent.innerHTML = `
      <section class="publish-shell">
        <div class="publish-toolbar">
          <div class="publish-toolbar-stack">
            <div class="publish-toolbar-pills">
              <button class="publish-filter-chip ${state.publishStatusFilter === "all" ? "active" : ""}" type="button" data-publish-filter="all">Tất cả</button>
              <button class="publish-filter-chip ${state.publishStatusFilter === "unpublished" ? "active" : ""}" type="button" data-publish-filter="unpublished">Chưa đăng ${unpublishedCount ? `(${unpublishedCount})` : ""}</button>
              <button class="publish-filter-chip ${state.publishStatusFilter === "published" ? "active" : ""}" type="button" data-publish-filter="published">Đã đăng ${publishedCount ? `(${publishedCount})` : ""}</button>
            </div>
            <div class="publish-zone-tabs">
              ${zoneOptions.map((zone) => `<button class="publish-zone-chip ${state.publishZoneFilter === zone.key ? "active" : ""}" type="button" data-publish-zone="${zone.key}">${escapeHtml(zone.label)}</button>`).join("")}
            </div>
          </div>
        </div>
        <article class="surface publish-table-card">
          <div class="publish-table-scroll">
            <table class="list-table publish-table">
          <thead><tr><th>Sản phẩm</th><th>Loại kho</th><th>Tồn kho</th><th>Giá nhập</th><th>Giá bán lẻ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            ${items.map((product) => {
                const draft = getPublishDraft(product);
                const publishStatus = getPublishStatusCopy(product);
                const zone = WAREHOUSE_ZONES.find((item) => item.key === getWarehouseZoneForProduct(product));
                return `<tr><td><div class="product-cell">${renderProductThumb(product)}<div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${getInlineProductMeta(product)} • SKU: ${escapeHtml(product.sku || "-")}</span></div></div></td><td><span class="status-pill ${escapeHtml(zone?.tone || "")}">${escapeHtml(zone ? `${zone.label}: ${zone.name}` : "Chưa phân loại")}</span></td><td><strong>${formatNumber(product.stock_quantity)}</strong> ${escapeHtml(product.stock_unit || product.sale_unit || product.unit || "")}</td><td>${formatCurrency(parseImportReferencePrice(product))}</td><td><strong>${formatCurrency(draft.retailPrice)}</strong><div class="section-copy" style="margin-top:8px;">${escapeHtml(String(draft.listingQuantity || 1))} ${escapeHtml(draft.saleUnit || "-")}</div></td><td>${publishStatus.pill}<div class="section-copy" style="margin-top:8px;">${publishStatus.note}</div></td><td><div class="publish-action-stack"><button class="chip-button" type="button" data-action="open-publish-editor" data-id="${product.id}">Cập nhật</button>${product.is_published ? `<button class="chip-button" type="button" data-action="unpublish-product" data-id="${product.id}" data-tone="danger">Gỡ xuống</button>` : `<button class="chip-button" type="button" data-action="edit-product" data-id="${product.id}">Đăng bán</button>`}</div></td></tr>`;
            }).join("") || '<tr><td colspan="7">Không có sản phẩm phù hợp.</td></tr>'}
          </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
}

function renderStorePublishWorkspace(items) {
    const activeStore = getStoreBranch();

    elements.productsContent.innerHTML = `
      <section class="publish-shell">
        <article class="surface publish-table-card">
          <div class="publish-table-scroll">
            <table class="list-table publish-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Loại kho</th>
                  <th>Kho tổng còn</th>
                  <th>${escapeHtml(activeStore.label)}</th>
                  <th>Giá bán lẻ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((product) => {
                    const draft = getPublishDraft(product);
                    const publishStatus = getStorePublishStatusCopy(product, activeStore.key);
                    const zone = WAREHOUSE_ZONES.find((item) => item.key === getWarehouseZoneForProduct(product));
                    const publishedStoreCount = getPublishedStoreCount(product);
                    const allocationValue = `${formatNumber(publishStatus.quantity || 0)} ${product.stock_unit || product.sale_unit || product.unit || ""}`.trim();
                    const actionButton = publishStatus.stage === "published"
                        ? `<button class="chip-button" type="button" data-action="hide-store-product" data-id="${product.id}" data-store-key="${activeStore.key}" data-tone="danger">Ẩn khỏi sàn</button>`
                        : `<button class="chip-button" type="button" data-action="open-publish-editor" data-id="${product.id}" data-store-key="${activeStore.key}" data-tone="accent">Đưa lên sàn</button>`;

                    return `
                      <tr>
                        <td>
                          <div class="product-cell">
                            ${renderProductThumb(product)}
                            <div>
                              <strong>${escapeHtml(product.name)}</strong><br>
                              <span class="section-copy">${getInlineProductMeta(product)} • SKU: ${escapeHtml(product.sku || "-")}</span>
                            </div>
                          </div>
                        </td>
                        <td><span class="status-pill ${escapeHtml(zone?.tone || "")}">${escapeHtml(zone ? `${zone.label}: ${zone.name}` : "Chưa phân loại")}</span></td>
                        <td><strong>${formatNumber(product.stock_quantity)}</strong> ${escapeHtml(product.stock_unit || product.sale_unit || product.unit || "")}</td>
                        <td><strong>${escapeHtml(allocationValue)}</strong><div class="section-copy" style="margin-top:8px;">Đang bán tại ${publishedStoreCount}/${STORE_BRANCHES.length} cửa hàng</div></td>
                        <td><strong>${formatCurrency(draft.retailPrice)}</strong><div class="section-copy" style="margin-top:8px;">${escapeHtml(String(draft.listingQuantity || 1))} ${escapeHtml(draft.saleUnit || "-")}</div></td>
                        <td>${publishStatus.pill}<div class="section-copy" style="margin-top:8px;">${escapeHtml(publishStatus.note)}</div></td>
                        <td>
                          <div class="publish-action-stack">
                            ${actionButton}
                          </div>
                        </td>
                      </tr>
                    `;
                }).join("") || '<tr><td colspan="7">Không có sản phẩm phù hợp.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
}

export function syncProductCategorySelects() {
    const activeProductFilterCategory = elements.productFilterForm?.elements.category_id || elements.productFilterCategory;
    if (activeProductFilterCategory) {
        activeProductFilterCategory.innerHTML = getChildCategoryOptions(state.filters.products?.parent_category_id || "", state.filters.products?.category_id || "");
    }
    const activeParentCategory = elements.productFilterForm?.elements.parent_category_id;
    if (activeParentCategory) {
        activeParentCategory.innerHTML = getParentCategoryOptions(state.filters.products?.parent_category_id || "");
    }
    fillSelectOptions(elements.productCategorySelect, state.categories);
    fillSelectOptions(elements.productEditorCategorySelect, state.categories);
    fillSelectOptions(elements.productImportCategory, state.categories);
    fillSelectOptions(elements.productImportSupplierSelect, state.suppliers || [], { includeBlank: true, blankLabel: "Chọn nhà cung cấp" });
}

export function getRenderableProducts() {
    const items = [...(state.products || [])];
    if (state.productWorkspace === "inventory" || state.productWorkspace === "import") {
        return items.sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0));
    }
    if (state.productWorkspace === "lowStock") {
        return getLowStockProducts();
    }
    if (state.productWorkspace === "publish") {
        const filtered = items.filter((product) => {
            const storeStatus = getStorePublishStatusCopy(product, state.publishStoreFilter);
            if (storeStatus.stage === "not_allocated") return false;
            if (state.publishStatusFilter === "published") return Boolean(storeStatus.isPublished);
            if (state.publishStatusFilter === "allocated") return storeStatus.stage === "allocated";
            if (state.publishStatusFilter === "unpublished") return !storeStatus.isPublished;
            return true;
        }).filter((product) => {
            if (state.publishZoneFilter === "all") return true;
            return getWarehouseZoneForProduct(product) === state.publishZoneFilter;
        });
        const stageOrder = { not_allocated: 0, allocated: 1, published: 2 };
        return filtered.sort((left, right) => (stageOrder[getStoreProductStage(left, state.publishStoreFilter)] ?? 0) - (stageOrder[getStoreProductStage(right, state.publishStoreFilter)] ?? 0));
    }
    return items;
}

export function getWarehouseZoneForProduct(product) {
    const text = [product.name, product.category_name, product.category?.name, product.slug, product.short_description].join(" ").toLowerCase();
    if (/(dong|đông|lanh|lạnh|frozen|hai san|hải sản|ca hoi|cá hồi|thit|thịt|fillet|seafood)/i.test(text)) return "frozen";
    if (/(rau|cu|củ|qua|quả|trai cay|trái cây|fruit|organic|vegetable|rau cu|rau củ)/i.test(text)) return "fresh";
    return "dry";
}

export function renderProducts() {
    const items = getRenderableProducts();
    const workspace = state.productWorkspace;
    const total = state.productPagination?.total || items.length;
    elements.productsMeta.textContent = `${formatNumber(total)} sản phẩm`;
    if (workspace === "inventory") return renderWarehouseWorkspace();
    if (workspace === "lowStock") return renderLowStockWorkspace(items);
    if (workspace === "publish") return renderStorePublishWorkspace(items);
    const table = workspace === "import"
        ? `<table class="list-table"><thead><tr><th>Sản phẩm</th><th>SKU</th><th>Tồn kho</th><th>Giá nhập</th><th>Trạng thái</th><th>Tác vụ</th></tr></thead><tbody>${items.map((product) => `<tr><td><div class="product-cell">${renderProductThumb(product)}<div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${getInlineProductMeta(product)}</span></div></div></td><td>${escapeHtml(product.sku || "-")}</td><td><strong>${formatNumber(product.stock_quantity)}</strong> ${escapeHtml(product.stock_unit || product.unit || "")}</td><td>${formatCurrency(parseImportReferencePrice(product))}</td><td>${statusPill(product.status, product.status_label)}</td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp.</td></tr>'}</tbody></table>`
        : `<table class="list-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Tác vụ</th></tr></thead><tbody>${items.map((product) => `<tr><td><div class="product-cell">${renderProductThumb(product)}<div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${escapeHtml(product.slug || "-")} • ${escapeHtml(product.sku || "-")}</span></div></div></td><td>${getInlineProductMeta(product)}</td><td>${formatCurrency(product.current_price || product.price)}</td><td>${formatNumber(product.stock_quantity)} ${escapeHtml(product.stock_unit || product.unit || "")}</td><td>${statusPill(product.status, product.status_label)}<div class="section-copy" style="margin-top:8px;">${product.is_published ? "Đã đưa lên sàn" : "Chưa đưa lên sàn"}</div></td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp.</td></tr>'}</tbody></table>`;
    elements.productsContent.innerHTML = table;
}

function renderProductFilterForm(isPublishWorkspace) {
    const filters = state.filters.products || {};
    const isInventoryWorkspace = state.productWorkspace === "inventory";
    const activeStore = getStoreBranch();
    const storeCounts = (state.products || []).reduce((counts, product) => {
        const stage = getStoreProductStage(product, activeStore.key);
        counts[stage] = (counts[stage] || 0) + 1;
        return counts;
    }, { not_allocated: 0, allocated: 0, published: 0 });
    elements.productFilterForm.innerHTML = `
      <label>
        <span>Tìm kiếm</span>
        <input name="keyword" value="${escapeHtml(filters.keyword || "")}" placeholder="Tên sản phẩm...">
      </label>
      <label>
        <span>Trạng thái</span>
        <select name="visibility">
          <option value="" ${String(filters.visibility || "") === "" ? "selected" : ""}>Tất cả</option>
          <option value="published" ${String(filters.visibility || "") === "published" ? "selected" : ""}>Đã đưa lên sàn</option>
          <option value="hidden" ${String(filters.visibility || "") === "hidden" ? "selected" : ""}>Ẩn khỏi sàn</option>
        </select>
      </label>
      <label>
        <span>Danh muc cha</span>
        <select name="parent_category_id" id="productFilterParentCategory">
          ${getParentCategoryOptions(filters.parent_category_id || "")}
        </select>
      </label>
      <label>
        <span>Danh muc con</span>
        <select name="category_id" id="productFilterCategory">
          ${getChildCategoryOptions(filters.parent_category_id || "", filters.category_id || "")}
        </select>
      </label>
      ${isInventoryWorkspace ? `
      <label>
        <span>Kho hàng</span>
        <select name="inventory_zone" data-inventory-zone-select>
          ${WAREHOUSE_ZONES.map((zone) => `<option value="${escapeHtml(zone.key)}" ${zone.key === state.inventoryZone ? "selected" : ""}>${escapeHtml(zone.label)} - ${escapeHtml(zone.name)}</option>`).join("")}
        </select>
      </label>
      ` : ""}
      ${isPublishWorkspace ? `
      <label>
        <span>Tại cửa hàng</span>
        <select class="publish-store-select" data-publish-status-select>
          <option value="all" ${state.publishStatusFilter === "all" || state.publishStatusFilter === "not_allocated" ? "selected" : ""}>Có trong chi nhánh</option>
          <option value="allocated" ${state.publishStatusFilter === "allocated" ? "selected" : ""}>Đã chuyển ${storeCounts.allocated ? `(${storeCounts.allocated})` : ""}</option>
          <option value="published" ${state.publishStatusFilter === "published" ? "selected" : ""}>Đang bán ${storeCounts.published ? `(${storeCounts.published})` : ""}</option>
        </select>
      </label>
      <label>
        <span>Loại kho</span>
        <select class="publish-store-select" data-publish-zone-select>
          ${getPublishZoneOptions().map((zone) => `<option value="${zone.key}" ${state.publishZoneFilter === zone.key ? "selected" : ""}>${escapeHtml(zone.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Cửa hàng</span>
        <select class="publish-store-select" data-publish-store-select>
          ${STORE_BRANCHES.map((store) => `<option value="${store.key}" ${state.publishStoreFilter === store.key ? "selected" : ""}>${escapeHtml(store.label)} - ${escapeHtml(store.name)}</option>`).join("")}
        </select>
      </label>
      ` : ""}
      <button class="primary-button" type="submit">Áp dụng</button>
      ${isPublishWorkspace ? buildPublishBranchSummary() : ""}
      ${isPublishWorkspace ? `<div class="publish-filter-inline">${buildPublishFilterChips()}</div>` : ""}
    `;
}

function updatePublishBranchCard(isPublishWorkspace) {
    if (!elements.publishBranchCard) return;
    const activeStore = getStoreBranch();
    elements.publishBranchCard.classList.toggle("hidden", !isPublishWorkspace);
    if (!isPublishWorkspace) return;
    if (elements.publishBranchName) elements.publishBranchName.textContent = activeStore.label || activeStore.name || "-";
    if (elements.publishBranchCount) elements.publishBranchCount.textContent = `Tổng số chi nhánh: ${STORE_BRANCHES.length}`;
}

export function updateProductWorkspace() {
    const workspace = PRODUCT_WORKSPACES[state.productWorkspace] || PRODUCT_WORKSPACES.catalog;
    const isInventoryWorkspace = state.productWorkspace === "inventory";
    const isPublishWorkspace = state.productWorkspace === "publish";
    const isLowStockWorkspace = state.productWorkspace === "lowStock";
    elements.productsPanelEyebrow.textContent = workspace.eyebrow;
    elements.productsPanelEyebrow.classList.toggle("hidden", !workspace.eyebrow);
    elements.productsPanelTitle.textContent = workspace.title;
    updatePublishBranchCard(isPublishWorkspace);
    elements.productsListTitle.textContent = workspace.listTitle;
    elements.productsListTitle.classList.toggle("hidden", !workspace.listTitle);
    elements.productsListCard.classList.toggle("low-stock-list-wrapper", isLowStockWorkspace);
    elements.productFilterCard.classList.toggle("hidden", !workspace.showFilter);
    elements.productFilterCard.classList.toggle("full-span", isInventoryWorkspace);
    elements.productFilterCard.classList.toggle("full-span", isPublishWorkspace);
    elements.productFilterCard.classList.toggle("full-span", isLowStockWorkspace);
    elements.productFilterCard.classList.toggle("inventory-filter-card", isInventoryWorkspace);
    elements.productFilterCard.classList.toggle("publish-filter-card", isPublishWorkspace);
    elements.productFilterCard.classList.toggle("low-stock-filter-card", isLowStockWorkspace);
    elements.productCreateCard.classList.toggle("hidden", !workspace.showCreate);
    elements.productImportCard.classList.toggle("hidden", !workspace.showImport);
    elements.productsListCard.classList.toggle("hidden", workspace.showImport);
    elements.productFilterForm.classList.toggle("inventory-filter-form", isInventoryWorkspace);
    elements.productFilterForm.classList.toggle("publish-filter-form", isPublishWorkspace);
    elements.productFilterForm.classList.toggle("low-stock-filter-form", isLowStockWorkspace);
    if (workspace.showFilter) renderProductFilterForm(isPublishWorkspace);
    const importPriceField = elements.productImportForm?.querySelector('input[name="price"]')?.closest("label");
    if (importPriceField) importPriceField.classList.add("hidden");
    if (workspace !== "publish") closePublishEditor();
    if (workspace.showImport) {
        syncProductCategorySelects();
        return;
    }
    syncProductCategorySelects();
    elements.productsListCard.classList.remove("hidden");
}

export function handleLowStockFilterChange(target) {
    const field = target?.dataset?.lowStockFilter;
    if (!field) return false;
    state.lowStockFilters = {
        ...(state.lowStockFilters || {}),
        [field]: target.value || ""
    };
    if (field === "parent_category_id") {
        state.lowStockFilters.category_id = "";
    }
    renderProducts();
    if (field === "keyword") {
        const nextInput = elements.productsContent.querySelector("[data-low-stock-filter='keyword']");
        if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(state.lowStockFilters.keyword.length, state.lowStockFilters.keyword.length);
        }
    }
    return true;
}

export function resetProductForm() {
    elements.productForm?.reset();
    if (!elements.productForm) return;
    elements.productForm.elements.id.value = "";
    elements.productForm.elements.stock_quantity.value = "0";
    elements.productForm.elements.stock_per_sale_unit.value = "1";
    elements.productForm.elements.status.value = "draft";
    elements.productFormTitle.textContent = "Tạo sản phẩm";
    if (state.categories[0]) elements.productForm.elements.category_id.value = String(state.categories[0].id);
}

export function resetProductEditorForm() {
    elements.productEditorForm?.reset();
    if (!elements.productEditorForm) return;
    productEditorImagePreview = "";
    elements.productEditorForm.elements.id.value = "";
    elements.productEditorForm.elements.thumbnail_url.value = "";
    elements.productEditorForm.elements.stock_quantity.value = "0";
    elements.productEditorForm.elements.stock_per_sale_unit.value = "1";
    elements.productEditorForm.elements.status.value = "draft";
    elements.productEditorTitle.textContent = "Cập nhật sản phẩm";
    if (state.categories[0]) elements.productEditorForm.elements.category_id.value = String(state.categories[0].id);
    if (elements.productEditorImageFile) elements.productEditorImageFile.value = "";
    if (elements.productEditorPreviewImage) elements.productEditorPreviewImage.src = defaultProductThumb();
    if (elements.productEditorPreviewName) elements.productEditorPreviewName.textContent = "-";
    if (elements.productEditorPreviewSku) elements.productEditorPreviewSku.textContent = "-";
}

export function resetProductImportForm() {
    if (!elements.productImportForm) return;
    elements.productImportForm.reset();
    state.productImportSourceId = "";
    state.productImportImageDataUrl = "";
    if (elements.productImportImageFile) elements.productImportImageFile.value = "";
    if (elements.productImportForm.elements.id) elements.productImportForm.elements.id.value = "";
    if (elements.productImportCategory && state.categories[0]) elements.productImportCategory.value = String(state.categories[0].id);
    if (elements.productImportSupplierSelect) elements.productImportSupplierSelect.value = "";
    if (elements.productImportPreview) {
        elements.productImportPreview.src = "";
        elements.productImportPreview.classList.add("hidden");
    }
    if (elements.productImportImageUrl) elements.productImportImageUrl.value = "";
    const submitButton = elements.productImportForm.querySelector(".product-intake-actions .primary-button");
    if (submitButton) submitButton.textContent = "Lưu sản phẩm";
}

export function prepareProductImportFromLowStock(productId) {
    const product = getProductById(productId);
    if (!product || !elements.productImportForm) return false;

    resetProductImportForm();
    syncProductCategorySelects();
    state.productImportSourceId = String(product.id);

    const currentStock = Number(product.stock_quantity || 0);
    const reorderLevel = getProductReorderLevel(product);
    const suggestedQuantity = Math.max(1, reorderLevel - currentStock + Math.ceil(reorderLevel * 0.5));
    const importCost = parseImportReferencePrice(product) || Number(product.price || 0);

    const fields = {
        id: product.id,
        category_id: product.category_id || product.category?.id || "",
        name: product.name || "",
        origin: product.origin || "",
        short_description: product.short_description || "",
        import_cost: importCost,
        sale_unit: getProductUnit(product),
        stock_quantity: suggestedQuantity,
        reorder_level: reorderLevel,
        production_date: toDateInputValue(product.production_date),
        expiration_date: toDateInputValue(product.expiration_date),
        thumbnail_url: product.thumbnail_url || "",
        status: product.status || "active"
    };

    Object.entries(fields).forEach(([key, value]) => {
        const field = elements.productImportForm.elements[key];
        if (!field) return;
        field.value = key === "import_cost"
            ? formatMoneyInputValue(value)
            : key === "stock_quantity"
                ? formatStockInputValue(value)
                : value;
    });

    if (elements.productImportForm.elements.is_featured) {
        elements.productImportForm.elements.is_featured.checked = Boolean(product.is_featured);
    }
    state.productImportImageDataUrl = product.thumbnail_url || "";
    updateProductImportPreview(product.thumbnail_url || "");
    const submitButton = elements.productImportForm.querySelector(".product-intake-actions .primary-button");
    if (submitButton) submitButton.textContent = "Nhập thêm vào kho tổng";
    return true;
}

export function hydrateProductForm(productId) {
    const product = getProductById(productId);
    if (!product || !elements.productForm) return;
    elements.productFormTitle.textContent = `Cập nhật #${product.id}`;
    const fields = { id: product.id, category_id: product.category_id, name: product.name || "", slug: product.slug || "", sku: product.sku || "", price: product.price || "", sale_price: product.sale_price || "", stock_quantity: product.stock_quantity || 0, stock_unit: product.stock_unit || "đơn vị", sale_unit: product.sale_unit || product.unit || "đơn vị", stock_per_sale_unit: product.stock_per_sale_unit || 1, thumbnail_url: product.thumbnail_url || "", short_description: product.short_description || "", description: product.description || "", status: product.status || "draft" };
    Object.entries(fields).forEach(([key, value]) => {
        if (elements.productForm.elements[key]) {
            elements.productForm.elements[key].value = ["price", "sale_price"].includes(key)
                ? formatMoneyInputValue(value)
                : key === "stock_quantity"
                    ? formatStockInputValue(value)
                    : value;
        }
    });
    elements.productForm.elements.is_published.checked = Boolean(product.is_published);
    elements.productForm.elements.is_featured.checked = Boolean(product.is_featured);
}

export function openProductEditor(productId) {
    const product = getProductById(productId);
    if (!product || !elements.productEditorForm || !elements.productEditorModal) return;

    resetProductEditorForm();
    syncProductCategorySelects();
    elements.productEditorTitle.textContent = `Cập nhật #${product.id}`;

    const fields = {
        id: product.id,
        category_id: product.category_id,
        name: product.name || "",
        slug: product.slug || "",
        sku: product.sku || "",
        price: product.price || "",
        sale_price: resolveRetailPriceValue(product) || "",
        stock_quantity: product.stock_quantity || 0,
        stock_unit: product.stock_unit || "đơn vị",
        sale_unit: product.sale_unit || product.unit || "đơn vị",
        stock_per_sale_unit: product.stock_per_sale_unit || 1,
        production_date: toDateInputValue(product.production_date),
        expiration_date: toDateInputValue(product.expiration_date),
        thumbnail_url: product.thumbnail_url || "",
        short_description: product.short_description || "",
        description: product.description || "",
        status: product.status || "draft"
    };

    Object.entries(fields).forEach(([key, value]) => {
        if (elements.productEditorForm.elements[key]) {
            elements.productEditorForm.elements[key].value = ["price", "sale_price"].includes(key)
                ? formatMoneyInputValue(value)
                : key === "stock_quantity"
                    ? formatStockInputValue(value)
                    : value;
        }
    });

    elements.productEditorForm.elements.is_published.checked = Boolean(product.is_published);
    elements.productEditorForm.elements.is_featured.checked = Boolean(product.is_featured);
    elements.productEditorPreviewImage.src = resolveMediaUrl(getProductImageSource(product), defaultProductThumb());
    elements.productEditorPreviewName.textContent = product.name || "-";
    elements.productEditorPreviewSku.textContent = product.sku || `SP-${product.id}`;
    elements.productEditorModal.classList.remove("hidden");
}

export function closeProductEditor() {
    if (!elements.productEditorModal) return;
    elements.productEditorModal.classList.add("hidden");
    resetProductEditorForm();
}

export async function submitProductEditor(raw) {
    const preparedRaw = await prepareProductImageUpload(raw, elements.productEditorImageFile);
    const payload = buildProductPayload(preparedRaw);
    await apiFetch(`/api/products/${raw.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });
    closeProductEditor();
    showToast("Đã cập nhật sản phẩm.");
    await Promise.all([loadProducts(), loadOverview()]);
    syncPublishDraft(raw.id, {
        retailPrice: payload.sale_price ?? Number(payload.price || 0),
        saleUnit: payload.sale_unit,
        listingQuantity: payload.stock_per_sale_unit,
        publishMode: payload.is_published ? "published" : "draft"
    });
}

export function syncProductEditorPreview() {
    if (!elements.productEditorForm) return;
    const name = elements.productEditorForm.elements.name?.value || "-";
    const sku = elements.productEditorForm.elements.sku?.value || "-";
    const imageUrl = productEditorImagePreview || elements.productEditorForm.elements.thumbnail_url?.value || "";

    if (elements.productEditorPreviewName) elements.productEditorPreviewName.textContent = name;
    if (elements.productEditorPreviewSku) elements.productEditorPreviewSku.textContent = sku;
    if (elements.productEditorPreviewImage) {
        elements.productEditorPreviewImage.src = resolveMediaUrl(imageUrl, defaultProductThumb());
    }
}

export function openPublishEditor(productId, storeKey = state.publishStoreFilter) {
    const product = getProductById(productId);
    if (!product || !elements.publishEditorModal || !elements.publishEditorForm) return;
    const draft = getPublishDraft(product);
    const activeStore = getStoreBranch(storeKey);
    const allocation = getStoreAllocation(product, activeStore.key);
    resetPublishEditorState();
    elements.publishEditorForm.elements.id.value = String(product.id);
    elements.publishEditorForm.elements.store_key.value = activeStore.key;
    elements.publishEditorForm.elements.store_quantity.value = String(Number(allocation?.allocated_quantity || 0));
    elements.publishEditorForm.elements.import_price_display.value = formatCurrency(parseImportReferencePrice(product));
    elements.publishEditorForm.elements.retail_price.value = formatMoneyInputValue(Math.max(0, Number(draft.retailPrice || 0)));
    elements.publishEditorForm.elements.sale_unit.value = draft.saleUnit || product.sale_unit || product.unit || "";
    elements.publishEditorForm.elements.listing_quantity.value = String(Math.max(0.001, Number(draft.listingQuantity || product.stock_per_sale_unit || 1)));
    elements.publishEditorForm.elements.publish_mode.value = allocation?.publish_mode || "draft";
    if (elements.publishEditorForm.elements.allocation_note) {
        elements.publishEditorForm.elements.allocation_note.value = `Khi lưu cho ${activeStore.label}, hệ thống sẽ chuyển đúng số lượng này từ kho tổng sang tồn riêng của cửa hàng. Chọn "Đang bán" nếu muốn đưa sản phẩm lên sàn ngay tại cửa hàng này.`;
    }
    elements.publishEditorTitle.textContent = `Chuyển hàng cho ${activeStore.label}`;
    elements.publishEditorSku.textContent = product.sku || `SP-${product.id}`;
    elements.publishEditorName.textContent = product.name || "-";
    elements.publishEditorImage.src = resolveMediaUrl(getProductImageSource(product), defaultProductThumb());
    elements.publishEditorStock.textContent = `${formatNumber(product.stock_quantity)} ${product.stock_unit || product.sale_unit || product.unit || ""}`.trim();
    elements.publishEditorStockNote.textContent = `Kho tổng hiện còn ${formatNumber(product.stock_quantity)} ${product.stock_unit || product.sale_unit || product.unit || ""}. Tồn hiện tại tại ${activeStore.label}: ${formatNumber(allocation?.allocated_quantity || 0)} ${product.stock_unit || product.sale_unit || product.unit || ""}.`;
    elements.publishEditorSubmit.textContent = "Lưu phân bổ cửa hàng";
    elements.publishEditorModal.classList.remove("hidden");
}

export function closePublishEditor() {
    if (!elements.publishEditorModal) return;
    elements.publishEditorModal.classList.add("hidden");
    resetPublishEditorState();
}

export async function submitPublishEditor(raw) {
    const product = getProductById(raw.id);
    if (!product) throw new Error("Không tìm thấy sản phẩm.");
    const payload = buildPublishPayload(product, raw);
    await apiFetch(`/api/products/${product.id}/store-allocation`, { method: "PUT", body: JSON.stringify(payload) });
    syncPublishDraft(product.id, {
        retailPrice: payload.sale_price,
        saleUnit: payload.sale_unit,
        listingQuantity: payload.stock_per_sale_unit,
        publishMode: payload.publish_mode
    });
    closePublishEditor();
    showToast(payload.is_published ? "Đã chuyển hàng và đưa sản phẩm lên bán tại cửa hàng." : "Đã lưu tồn riêng cho cửa hàng, chưa đưa lên bán.");
    await Promise.all([loadProducts(), loadOverview()]);
}

async function publishAllocatedStoreProduct(product, storeKey) {
    const allocation = getStoreAllocation(product, storeKey);
    if (!allocation || Number(allocation.allocated_quantity || 0) <= 0) {
        openPublishEditor(product.id, storeKey);
        return;
    }

    const activeStore = getStoreBranch(storeKey);
    if (!window.confirm(`Đưa "${product.name || "sản phẩm"}" lên bán tại ${activeStore.label || activeStore.name || "cửa hàng"}?`)) {
        return;
    }

    const draft = getPublishDraft(product);
    const payload = {
        store_key: storeKey,
        store_name: allocation.store_name || activeStore.name || activeStore.label || "",
        allocated_quantity: Number(allocation.allocated_quantity || 0),
        sale_price: draft.retailPrice,
        sale_unit: draft.saleUnit || product.sale_unit || product.unit || product.stock_unit || "",
        stock_per_sale_unit: draft.listingQuantity || product.stock_per_sale_unit || 1,
        publish_mode: "published",
        is_published: true
    };

    await apiFetch(`/api/products/${product.id}/store-allocation`, { method: "PUT", body: JSON.stringify(payload) });
    showToast("Đã đưa sản phẩm lên bán.");
    await Promise.all([loadProducts(), loadOverview()]);
}

async function hidePublishedStoreProduct(product, storeKey) {
    const allocation = getStoreAllocation(product, storeKey);
    if (!allocation || Number(allocation.allocated_quantity || 0) <= 0) {
        throw new Error("Sản phẩm chưa có hàng tại chi nhánh này.");
    }

    const activeStore = getStoreBranch(storeKey);
    if (!window.confirm(`Ẩn "${product.name || "sản phẩm"}" khỏi sàn tại ${activeStore.label || activeStore.name || "cửa hàng"}?`)) {
        return;
    }

    const draft = getPublishDraft(product);
    const payload = {
        store_key: storeKey,
        store_name: allocation.store_name || activeStore.name || activeStore.label || "",
        allocated_quantity: Number(allocation.allocated_quantity || 0),
        sale_price: draft.retailPrice,
        sale_unit: draft.saleUnit || product.sale_unit || product.unit || product.stock_unit || "",
        stock_per_sale_unit: draft.listingQuantity || product.stock_per_sale_unit || 1,
        publish_mode: "draft",
        is_published: false
    };

    await apiFetch(`/api/products/${product.id}/store-allocation`, { method: "PUT", body: JSON.stringify(payload) });
    showToast("Đã ẩn sản phẩm khỏi sàn tại chi nhánh, hàng vẫn giữ trong kho chi nhánh.");
    await Promise.all([loadProducts(), loadOverview()]);
}

export function buildProductPayload(raw) {
    const payload = { category_id: Number(raw.category_id), name: String(raw.name || "").trim(), price: Number(raw.price || 0), sale_price: raw.sale_price ? Number(raw.sale_price) : null, stock_quantity: parseStockInputValue(raw.stock_quantity), stock_unit: String(raw.stock_unit || "").trim(), sale_unit: String(raw.sale_unit || "").trim(), stock_per_sale_unit: raw.stock_per_sale_unit ? Number(raw.stock_per_sale_unit) : 1, production_date: String(raw.production_date || "").trim() || null, expiration_date: String(raw.expiration_date || "").trim() || null, thumbnail_url: normalizeProductImageUrl(raw.thumbnail_url), short_description: String(raw.short_description || "").trim(), description: String(raw.description || "").trim(), status: raw.status, is_published: Boolean(raw.is_published), is_featured: Boolean(raw.is_featured) };
    if (String(raw.slug || "").trim()) payload.slug = String(raw.slug).trim();
    if (String(raw.sku || "").trim()) payload.sku = String(raw.sku).trim();
    return payload;
}

export function buildInventoryImportPayload(raw) {
    const selectedSupplier = (state.suppliers || []).find((supplier) => Number(supplier.id) === Number(raw.supplier_id));
    const supplierName = selectedSupplier?.name ? String(selectedSupplier.name).trim() : "";
    const productionDate = String(raw.production_date || "").trim();
    const expirationDate = String(raw.expiration_date || "").trim();
    const dateDetailLines = [productionDate ? `Ngày sản xuất: ${productionDate}` : "", expirationDate ? `Ngày hết hạn: ${expirationDate}` : ""].filter(Boolean);
    const detailLines = [raw.origin ? `Xuất xứ: ${String(raw.origin).trim()}` : "", supplierName ? `Nhà cung cấp: ${supplierName}` : "", raw.reorder_level ? `Ngưỡng cảnh báo hết hàng: ${String(raw.reorder_level).trim()}` : "", raw.import_cost ? `Giá nhập tham chiếu: ${formatCurrency(raw.import_cost)}` : ""].filter(Boolean);
    return { category_id: Number(raw.category_id), name: String(raw.name || "").trim(), price: Number(raw.import_cost || 0), sale_price: null, stock_quantity: parseStockInputValue(raw.stock_quantity), stock_unit: String(raw.sale_unit || "kg").trim(), sale_unit: String(raw.sale_unit || "kg").trim(), stock_per_sale_unit: 1, thumbnail_url: normalizeProductImageUrl(raw.thumbnail_url), short_description: String(raw.short_description || "").trim(), description: detailLines.concat(dateDetailLines).join("\n"), production_date: productionDate || null, expiration_date: expirationDate || null, status: raw.status || "draft", is_published: false, is_featured: Boolean(raw.is_featured) };
}

export function buildInventoryRestockPayload(raw) {
    const product = getProductById(raw.id);
    if (!product) throw new Error("Không tìm thấy sản phẩm cần nhập thêm.");
    const importPayload = buildInventoryImportPayload(raw);
    const importQuantity = Number(importPayload.stock_quantity || 0);
    if (!Number.isFinite(importQuantity) || importQuantity <= 0) {
        throw new Error("Số lượng nhập thêm phải lớn hơn 0.");
    }

    const nextDescription = [product.description || "", importPayload.description ? `\n\nLần nhập thêm:\n${importPayload.description}` : ""]
        .join("")
        .trim();

    return {
        category_id: importPayload.category_id || Number(product.category_id || product.category?.id || 0),
        name: importPayload.name || product.name || "",
        price: Number(importPayload.price || product.price || 0),
        sale_price: product.sale_price ? Number(product.sale_price) : null,
        stock_quantity: Number(product.stock_quantity || 0) + importQuantity,
        stock_unit: importPayload.stock_unit || product.stock_unit || product.unit || product.sale_unit || "kg",
        sale_unit: importPayload.sale_unit || product.sale_unit || product.unit || product.stock_unit || "kg",
        stock_per_sale_unit: Number(product.stock_per_sale_unit || 1),
        production_date: importPayload.production_date || toDateInputValue(product.production_date) || null,
        expiration_date: importPayload.expiration_date || toDateInputValue(product.expiration_date) || null,
        thumbnail_url: importPayload.thumbnail_url || product.thumbnail_url || "",
        short_description: importPayload.short_description || product.short_description || "",
        description: nextDescription,
        status: importPayload.status || product.status || "active",
        is_published: Boolean(product.is_published),
        is_featured: Boolean(importPayload.is_featured || product.is_featured),
        ...(String(product.slug || "").trim() ? { slug: String(product.slug).trim() } : {}),
        ...(String(product.sku || "").trim() ? { sku: String(product.sku).trim() } : {})
    };
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

export function recordProductImportSupplier(raw, savedProduct = {}) {
    const selectedSupplier = (state.suppliers || []).find((supplier) => Number(supplier.id) === Number(raw.supplier_id));
    const supplierName = String(selectedSupplier?.name || raw.supplier_name || "").trim();
    if (!supplierName) return;

    const productId = Number(savedProduct?.id || raw.id || 0);
    const sku = String(savedProduct?.sku || raw.sku || "").trim();
    const productName = String(savedProduct?.name || raw.name || "").trim();
    const records = readProductImportSupplierRecords();
    const payload = {
        product_id: Number.isFinite(productId) && productId > 0 ? productId : null,
        sku,
        product_name: productName,
        supplier_id: Number(raw.supplier_id || selectedSupplier?.id || 0) || null,
        supplier_name: supplierName,
        imported_at: new Date().toISOString()
    };

    const nextRecords = [
        payload,
        ...records.filter((record) => {
            if (payload.product_id && Number(record.product_id) === Number(payload.product_id)) return false;
            if (payload.sku && String(record.sku || "").trim().toLowerCase() === payload.sku.toLowerCase()) return false;
            if (payload.product_name && String(record.product_name || "").trim().toLowerCase() === payload.product_name.toLowerCase()) return false;
            return true;
        })
    ].slice(0, 500);

    localStorage.setItem(STORAGE_KEYS.productImportSuppliers, JSON.stringify(nextRecords));
}

export async function handleProductAction(action, productId, extra = {}) {
    if (action === "edit-product") {
        openProductEditor(productId);
        return;
    }
    if (action === "open-publish-editor") {
        const product = getProductById(productId);
        if (!extra.storeKey && product && !product.is_published) {
            if (!window.confirm(`Đưa "${product.name || "sản phẩm"}" lên sàn bán?`)) return;
            await apiFetch(`/api/products/${productId}/publish`, { method: "PATCH" });
            showToast("Đã đưa sản phẩm lên sàn.");
            await Promise.all([loadProducts(), loadOverview()]);
            return;
        }
        if (extra.storeKey && product && getStoreProductStage(product, extra.storeKey) === "allocated") {
            await publishAllocatedStoreProduct(product, extra.storeKey);
            return;
        }
        openPublishEditor(productId, extra.storeKey || state.publishStoreFilter);
        return;
    }
    if (action === "hide-store-product") {
        const product = getProductById(productId);
        if (!product) throw new Error("Không tìm thấy sản phẩm.");
        await hidePublishedStoreProduct(product, extra.storeKey || state.publishStoreFilter);
        return;
    }
    if (action === "delete-product") {
        if (!window.confirm("Bạn chắc chắn muốn xóa sản phẩm này?")) return;
        await apiFetch(`/api/products/${productId}`, { method: "DELETE" });
        showToast("Đã xóa sản phẩm.");
        await loadProducts();
        return;
    }
    if (action === "publish-product" || action === "unpublish-product") {
        const product = getProductById(productId);
        if (action === "publish-product" && !window.confirm(`Đưa "${product?.name || "sản phẩm"}" lên sàn bán?`)) return;
        if (action === "unpublish-product" && !window.confirm(`Ẩn "${product?.name || "sản phẩm"}" khỏi sàn bán?`)) return;
        const endpoint = action === "publish-product" ? "publish" : "unpublish";
        const body = action === "unpublish-product" && extra.storeKey
            ? JSON.stringify({ store_key: extra.storeKey })
            : undefined;
        await apiFetch(`/api/products/${productId}/${endpoint}`, { method: "PATCH", body });
        showToast(action === "publish-product" ? "Đã đưa sản phẩm lên sàn." : "Đã gỡ sản phẩm khỏi sàn.");
        await Promise.all([loadProducts(), loadOverview()]);
    }
}

const PRODUCT_IMPORT_TEMPLATE_COLUMNS = [
    "Tên sản phẩm",
    "Danh mục",
    "Thương hiệu / Xuất xứ",
    "Mô tả ngắn",
    "Giá nhập (VND)",
    "Đơn vị tính",
    "Số lượng nhập kho",
    "Ngưỡng cảnh báo hết hàng",
    "Ngày sản xuất",
    "Ngày hết hạn",
    "Nhà cung cấp",
    "URL ảnh",
    "Trạng thái",
    "Nổi bật"
];

const PRODUCT_IMPORT_COLUMN_ALIASES = {
    name: ["ten san pham", "san pham", "name", "product name"],
    category: ["danh muc", "category", "category id", "category_id", "ma danh muc", "ten danh muc"],
    origin: ["thuong hieu xuat xu", "thuong hieu / xuat xu", "xuat xu", "origin", "brand"],
    short_description: ["mo ta ngan", "short description", "tom tat"],
    import_cost: ["gia nhap vnd", "gia nhap", "import cost", "cost", "price", "gia"],
    sale_unit: ["don vi tinh", "don vi", "sale unit", "unit"],
    stock_quantity: ["so luong nhap kho", "so luong", "ton kho", "stock quantity", "quantity"],
    reorder_level: ["nguong canh bao het hang", "nguong canh bao", "reorder level"],
    production_date: ["ngay san xuat", "production date", "nsx"],
    expiration_date: ["ngay het han", "han su dung", "expiration date", "hsd"],
    supplier: ["nha cung cap", "supplier", "supplier id", "ma nha cung cap", "ten nha cung cap"],
    thumbnail_url: ["url anh", "anh", "hinh anh", "thumbnail url", "image url"],
    status: ["trang thai", "status"],
    is_featured: ["noi bat", "featured", "is featured"]
};

function normalizeImportKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function resolveImportColumnKey(header) {
    const normalized = normalizeImportKey(header);
    return Object.entries(PRODUCT_IMPORT_COLUMN_ALIASES)
        .find(([, aliases]) => aliases.some((alias) => normalizeImportKey(alias) === normalized))?.[0] || "";
}

function parseImportNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let text = String(value || "").trim().replace(/[^\d,.-]/g, "");
    if (!text) return 0;
    const commaIndex = text.lastIndexOf(",");
    const dotIndex = text.lastIndexOf(".");
    if (commaIndex >= 0 && dotIndex >= 0) {
        text = commaIndex > dotIndex ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
    } else if (commaIndex >= 0) {
        const decimals = text.length - commaIndex - 1;
        text = decimals === 3 ? text.replace(/,/g, "") : text.replace(",", ".");
    } else if (dotIndex >= 0) {
        const decimals = text.length - dotIndex - 1;
        if (decimals === 3) text = text.replace(/\./g, "");
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
}

function toExcelDateInput(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
        const parsed = window.XLSX.SSF.parse_date_code(value);
        if (parsed?.y && parsed?.m && parsed?.d) {
            return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
    }
    const text = String(value || "").trim();
    const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashMatch) {
        return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
    }
    const isoMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }
    return "";
}

function parseImportBoolean(value) {
    const text = normalizeImportKey(value);
    return ["1", "co", "yes", "true", "noi bat", "x"].includes(text);
}

function normalizeImportStatus(value) {
    const text = normalizeImportKey(value);
    if (["active", "dang ban", "san sang ban", "ban"].includes(text)) return "active";
    if (["out of stock", "het hang"].includes(text)) return "out_of_stock";
    if (["archived", "luu tru", "an"].includes(text)) return "archived";
    return "draft";
}

function findImportRecord(items, value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const numericId = Number(text);
    if (Number.isInteger(numericId) && numericId > 0) {
        return items.find((item) => Number(item.id) === numericId) || null;
    }
    const normalized = normalizeImportKey(text);
    return items.find((item) => normalizeImportKey(item.name || item.label) === normalized) || null;
}

function mapProductImportRow(row, rowNumber) {
    const mapped = {};
    Object.entries(row || {}).forEach(([header, value]) => {
        const key = resolveImportColumnKey(header);
        if (key) mapped[key] = value;
    });

    const category = findImportRecord(state.categories || [], mapped.category);
    const supplier = findImportRecord(state.suppliers || [], mapped.supplier);
    const errors = [];
    const name = String(mapped.name || "").trim();
    const categoryText = String(mapped.category || "").trim();

    if (!name) errors.push("thiếu tên sản phẩm");
    if (!categoryText) errors.push("thiếu danh mục");
    if (categoryText && !category) errors.push(`không tìm thấy danh mục "${categoryText}"`);

    const supplierText = String(mapped.supplier || "").trim();
    if (supplierText && !supplier) errors.push(`không tìm thấy nhà cung cấp "${supplierText}"`);

    const raw = {
        name,
        category_id: category?.id || "",
        origin: String(mapped.origin || "").trim(),
        short_description: String(mapped.short_description || "").trim(),
        import_cost: parseImportNumber(mapped.import_cost),
        sale_unit: String(mapped.sale_unit || "kg").trim() || "kg",
        stock_quantity: parseImportNumber(mapped.stock_quantity),
        reorder_level: parseImportNumber(mapped.reorder_level) || "",
        production_date: toExcelDateInput(mapped.production_date),
        expiration_date: toExcelDateInput(mapped.expiration_date),
        supplier_id: supplier?.id || "",
        thumbnail_url: normalizeProductImageUrl(mapped.thumbnail_url),
        status: normalizeImportStatus(mapped.status),
        is_featured: parseImportBoolean(mapped.is_featured)
    };

    return { rowNumber, raw, errors };
}

function readProductImportWorkbook(file) {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) {
            reject(new Error("Chưa tải được thư viện đọc Excel. Hãy kiểm tra kết nối mạng rồi tải lại trang."));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const workbook = window.XLSX.read(reader.result, { type: "array", cellDates: true });
                const firstSheet = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheet];
                resolve(window.XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true }));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error("Không đọc được file Excel."));
        reader.readAsArrayBuffer(file);
    });
}

function setProductImportExcelResult(message, canSubmit = false) {
    if (elements.productImportExcelResult) {
        elements.productImportExcelResult.textContent = message;
    }
    if (elements.submitProductImportExcelButton) {
        elements.submitProductImportExcelButton.disabled = !canSubmit;
    }
}

export async function handleProductImportExcelFile(file) {
    state.productImportExcelRows = [];
    if (!file) {
        setProductImportExcelResult("Chưa chọn file Excel.", false);
        return;
    }
    let rows = [];
    try {
        rows = await readProductImportWorkbook(file);
    } catch (error) {
        setProductImportExcelResult(error.message || "Không đọc được file Excel.", false);
        throw error;
    }
    const mappedRows = rows.map((row, index) => mapProductImportRow(row, index + 2));
    const validRows = mappedRows.filter((row) => row.errors.length === 0);
    const invalidRows = mappedRows.filter((row) => row.errors.length > 0);
    state.productImportExcelRows = validRows.map((row) => row.raw);

    const errorPreview = invalidRows.slice(0, 3)
        .map((row) => `Dòng ${row.rowNumber}: ${row.errors.join(", ")}`)
        .join(" | ");
    const message = [
        `Đã đọc ${validRows.length} dòng hợp lệ`,
        invalidRows.length ? `${invalidRows.length} dòng lỗi. ${errorPreview}` : "không có lỗi."
    ].join(", ");
    setProductImportExcelResult(message, validRows.length > 0);
}

export async function submitProductImportExcel() {
    const rows = Array.isArray(state.productImportExcelRows) ? state.productImportExcelRows : [];
    if (!rows.length) {
        showToast("Vui lòng chọn file Excel có dữ liệu hợp lệ.", true);
        return;
    }

    let successCount = 0;
    const failedRows = [];
    for (const [index, raw] of rows.entries()) {
        try {
            const payload = buildInventoryImportPayload(raw);
            const savedProduct = await apiFetch("/api/products", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            recordProductImportSupplier(raw, savedProduct);
            successCount += 1;
        } catch (error) {
            failedRows.push(`Dòng ${index + 2}: ${error.message || "không nhập được"}`);
        }
    }

    await Promise.all([loadProducts(), loadOverview()]);
    state.productImportExcelRows = [];
    if (elements.productImportExcelFile) elements.productImportExcelFile.value = "";
    setProductImportExcelResult(
        failedRows.length
            ? `Đã nhập ${successCount}/${rows.length} sản phẩm. Lỗi: ${failedRows.slice(0, 3).join(" | ")}`
            : `Đã nhập thành công ${successCount} sản phẩm từ Excel.`,
        false
    );
    showToast(failedRows.length ? `Đã nhập ${successCount}/${rows.length} sản phẩm, còn dòng lỗi.` : "Đã nhập sản phẩm từ Excel.");
}

function downloadProductImportBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function downloadProductImportTemplate() {
    const category = (state.categories || [])[0];
    const supplier = (state.suppliers || [])[0];
    const sample = [
        PRODUCT_IMPORT_TEMPLATE_COLUMNS,
        [
            "Bưởi da xanh loại 1",
            category?.name || category?.id || "",
            "Hợp tác xã Bến Tre",
            "Bưởi tươi, vỏ xanh, ruột hồng.",
            12000,
            "kg",
            50,
            10,
            "01/06/2026",
            "30/06/2026",
            supplier?.name || supplier?.id || "",
            "https://example.com/buoi.jpg",
            "active",
            "Không"
        ]
    ];

    if (window.XLSX) {
        const worksheet = window.XLSX.utils.aoa_to_sheet(sample);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Nhap san pham");
        const array = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        downloadProductImportBlob(new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "mau-nhap-san-pham.xlsx");
        return;
    }

    const csv = sample.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadProductImportBlob(csv, "mau-nhap-san-pham.csv", "text/csv;charset=utf-8");
}

export function updateProductImportPreview(source) {
    if (!elements.productImportPreview) return;
    const value = String(source || "").trim();
    if (!value) {
        elements.productImportPreview.src = "";
        elements.productImportPreview.classList.add("hidden");
        return;
    }
    elements.productImportPreview.src = resolveMediaUrl(value, defaultProductThumb());
    elements.productImportPreview.classList.remove("hidden");
}

export function bindProductMediaEvents() {
    if (elements.productEditorImageFile) {
        elements.productEditorImageFile.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file || !elements.productEditorForm) return;

            const reader = new FileReader();
            reader.onload = () => {
                productEditorImagePreview = String(reader.result || "");
                syncProductEditorPreview();
            };
            reader.readAsDataURL(file);
        });
    }

    if (elements.productImportImageFile) {
        elements.productImportImageFile.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                state.productImportImageDataUrl = String(reader.result || "");
                updateProductImportPreview(state.productImportImageDataUrl);
            };
            reader.readAsDataURL(file);
        });
    }
    if (elements.productImportImageUrl) {
        elements.productImportImageUrl.addEventListener("input", (event) => {
            const value = String(event.target.value || "").trim();
            if (value && elements.productImportImageFile) elements.productImportImageFile.value = "";
            state.productImportImageDataUrl = value;
            updateProductImportPreview(value);
        });
    }
}
