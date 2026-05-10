import { PRODUCT_WORKSPACES, WAREHOUSE_ZONES, apiFetch, elements, escapeHtml, fillSelectOptions, formatCurrency, formatNumber, resolveMediaUrl, showToast, state, statusPill } from "./core.js";
import { loadOverview, loadProducts } from "./data.js";

function defaultProductThumb() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23efe5d8'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%23765f4a' font-family='Arial' font-size='16'%3ESP%3C/text%3E%3C/svg%3E";
}

function getProductById(productId) {
    return state.products.find((item) => Number(item.id) === Number(productId));
}

function getInlineProductMeta(product) {
    return escapeHtml(product.category_name || product.category?.name || "-");
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

function getPublishDraft(product) {
    const saved = state.publishDrafts[product.id] || {};
    return {
        retailPrice: saved.retailPrice ?? Number(product.sale_price || product.price || 0),
        saleUnit: saved.saleUnit ?? String(product.sale_unit || product.unit || product.stock_unit || "").trim(),
        listingQuantity: saved.listingQuantity ?? Number(product.stock_per_sale_unit || 1),
        publishMode: saved.publishMode ?? (product.is_published ? "published" : "draft")
    };
}

function getPublishZoneOptions() {
    return [{ key: "all", label: "Tất cả kho" }, ...WAREHOUSE_ZONES.map((zone) => ({ key: zone.key, label: `${zone.label}: ${zone.name}` }))];
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
    const keyword = String(state.inventorySearch || "").trim().toLowerCase();
    return (state.products || []).filter((product) => getWarehouseZoneForProduct(product) === zoneKey).filter((product) => {
        if (!keyword) return true;
        return [product.name, product.sku, product.category_name, product.category?.name].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
}

function getWarehouseStatus(product) {
    const stock = Number(product.stock_quantity || 0);
    return stock <= 20 ? statusPill("pending", "Sắp hết") : statusPill("active", "Ổn định");
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
    return { price: retailPrice, sale_price: null, sale_unit: saleUnit, stock_per_sale_unit: listingQuantity, is_published: raw.publish_mode !== "draft" };
}

function resetPublishEditorState() {
    if (elements.publishEditorForm) {
        elements.publishEditorForm.reset();
        if (elements.publishEditorForm.elements.id) elements.publishEditorForm.elements.id.value = "";
    }
    if (elements.publishEditorTitle) elements.publishEditorTitle.textContent = "Thiết lập niêm yết sản phẩm";
    if (elements.publishEditorSku) elements.publishEditorSku.textContent = "-";
    if (elements.publishEditorName) elements.publishEditorName.textContent = "-";
    if (elements.publishEditorImage) elements.publishEditorImage.src = defaultProductThumb();
    if (elements.publishEditorStock) elements.publishEditorStock.textContent = "0";
    if (elements.publishEditorStockNote) elements.publishEditorStockNote.textContent = "Hệ thống sẽ tự trừ kho khi bán hàng.";
    if (elements.publishEditorSubmit) elements.publishEditorSubmit.textContent = "Lưu niêm yết";
}

function renderWarehouseWorkspace() {
    const activeZone = WAREHOUSE_ZONES.find((zone) => zone.key === state.inventoryZone) || WAREHOUSE_ZONES[0];
    const zoneProducts = getWarehouseProducts(activeZone.key);
    const totalProducts = state.products.length;
    const lowStockCount = state.products.filter((product) => Number(product.stock_quantity || 0) <= 20).length;
    const totalValue = state.products.reduce((sum, product) => sum + (Number(product.current_price || product.price || 0) * Number(product.stock_quantity || 0)), 0);
    const zoneWeightTons = zoneProducts.reduce((sum, product) => sum + estimateProductWeightTons(product), 0);
    const maxCapacityTons = 35;
    const capacity = Math.min(100, Math.max(0, Math.round((zoneWeightTons / maxCapacityTons) * 100)));

    elements.productsMeta.textContent = `${formatNumber(zoneProducts.length)} sản phẩm trong ${activeZone.label.toLowerCase()}`;
    elements.productsContent.innerHTML = `
      <section class="warehouse-shell">
        <div class="warehouse-toolbar">
          <label class="warehouse-search">
            <span>⌕</span>
            <input id="inventorySearchInput" type="search" placeholder="Tìm kiếm sản phẩm trong kho..." value="${escapeHtml(state.inventorySearch)}">
          </label>
          <div class="warehouse-zone-tabs">
            ${WAREHOUSE_ZONES.map((zone) => `<button class="warehouse-zone-tab ${zone.key === activeZone.key ? "active" : ""}" type="button" data-inventory-zone="${zone.key}">${escapeHtml(zone.label)}</button>`).join("")}
          </div>
        </div>
        <div class="warehouse-metric-grid">
          <article class="warehouse-metric-card"><span>Tổng sản phẩm</span><strong>${formatNumber(totalProducts)}</strong></article>
          <article class="warehouse-metric-card"><span>Hàng sắp hết</span><strong>${formatNumber(lowStockCount)}</strong></article>
          <article class="warehouse-metric-card accent"><span>Tổng giá trị tồn kho</span><strong>${formatCurrency(totalValue)}</strong><small>Cập nhật theo dữ liệu hiện tại</small></article>
        </div>
        <div class="warehouse-copy">
          <h3>Quản lý kho hàng</h3>
          <p>Hệ thống giám sát tồn kho thực tế tại 3 khu: đông lạnh, rau và trái cây, đồ khô.</p>
        </div>
        <article class="warehouse-zone-card ${escapeHtml(activeZone.tone)}">
          <div class="warehouse-zone-main">
            <span class="warehouse-zone-icon">${escapeHtml(activeZone.icon)}</span>
            <div class="warehouse-zone-copy">
              <div class="warehouse-zone-heading">
                <span class="warehouse-zone-badge">Hoạt động</span>
                <h4>${escapeHtml(activeZone.label)} - ${escapeHtml(activeZone.name)}</h4>
              </div>
              <p>${escapeHtml(activeZone.description)}</p>
              <p>Nhiệt độ ổn định: <strong>${escapeHtml(activeZone.temperature)}</strong> • Độ ẩm: <strong>${escapeHtml(activeZone.humidity)}</strong></p>
            </div>
          </div>
          <div class="warehouse-capacity">
            <span>Sức chứa</span>
            <strong>${capacity}%</strong>
            <small>${zoneWeightTons.toFixed(1)} / ${maxCapacityTons} tấn</small>
            <div class="warehouse-capacity-bar"><i style="width:${capacity}%"></i></div>
          </div>
        </article>
        <article class="surface warehouse-table-card">
          <table class="list-table warehouse-table">
            <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Tồn kho</th><th>Đơn vị</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              ${zoneProducts.map((product) => `<tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultProductThumb()))}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">SKU: ${escapeHtml(product.sku || "-")}</span></div></div></td><td>${escapeHtml(product.category_name || product.category?.name || "-")}</td><td><strong>${formatNumber(product.stock_quantity)}</strong></td><td>${escapeHtml(product.stock_unit || product.unit || product.sale_unit || "-")}</td><td>${getWarehouseStatus(product)}</td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp trong khu này.</td></tr>'}
            </tbody>
          </table>
        </article>
        <div class="warehouse-zone-notes">
          ${WAREHOUSE_ZONES.map((zone) => `<article class="warehouse-note-card ${zone.key === activeZone.key ? "active" : ""}"><span class="warehouse-note-icon">${escapeHtml(zone.icon)}</span><div><h4>${escapeHtml(zone.label)}: ${escapeHtml(zone.name)}</h4><p>${escapeHtml(zone.description)}</p></div></article>`).join("")}
        </div>
      </section>
    `;
}

function renderPublishWorkspace(items) {
    const zoneOptions = getPublishZoneOptions();
    const publishedCount = items.filter((product) => product.is_published).length;
    const unpublishedCount = items.length - publishedCount;
    elements.productsMeta.textContent = `${formatNumber(items.length)} sản phẩm theo bộ lọc hiện tại`;
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
        <table class="list-table publish-table">
          <thead><tr><th>Sản phẩm</th><th>Loại kho</th><th>Tồn kho</th><th>Giá nhập</th><th>Giá bán lẻ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            ${items.map((product) => {
                const draft = getPublishDraft(product);
                const publishStatus = getPublishStatusCopy(product);
                const zone = WAREHOUSE_ZONES.find((item) => item.key === getWarehouseZoneForProduct(product));
                return `<tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultProductThumb()))}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${getInlineProductMeta(product)} • SKU: ${escapeHtml(product.sku || "-")}</span></div></div></td><td><span class="status-pill ${escapeHtml(zone?.tone || "")}">${escapeHtml(zone ? `${zone.label}: ${zone.name}` : "Chưa phân loại")}</span></td><td><strong>${formatNumber(product.stock_quantity)}</strong> ${escapeHtml(product.stock_unit || product.sale_unit || product.unit || "")}</td><td>${formatCurrency(parseImportReferencePrice(product))}</td><td><strong>${formatCurrency(draft.retailPrice)}</strong><div class="section-copy" style="margin-top:8px;">${escapeHtml(String(draft.listingQuantity || 1))} ${escapeHtml(draft.saleUnit || "-")}</div></td><td>${publishStatus.pill}<div class="section-copy" style="margin-top:8px;">${publishStatus.note}</div></td><td><div class="publish-action-stack"><button class="chip-button" type="button" data-action="open-publish-editor" data-id="${product.id}">Cập nhật</button>${product.is_published ? `<button class="chip-button" type="button" data-action="unpublish-product" data-id="${product.id}" data-tone="danger">Gỡ xuống</button>` : `<button class="chip-button" type="button" data-action="edit-product" data-id="${product.id}">Đăng bán</button>`}</div></td></tr>`;
            }).join("") || '<tr><td colspan="7">Không có sản phẩm phù hợp.</td></tr>'}
          </tbody>
        </table>
      </section>
    `;
}

export function syncProductCategorySelects() {
    fillSelectOptions(elements.productFilterCategory, state.categories, { includeBlank: true, blankLabel: "Tất cả" });
    fillSelectOptions(elements.productCategorySelect, state.categories);
    fillSelectOptions(elements.productImportCategory, state.categories);
}

export function getRenderableProducts() {
    const items = [...(state.products || [])];
    if (state.productWorkspace === "inventory" || state.productWorkspace === "import") {
        return items.sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0));
    }
    if (state.productWorkspace === "publish") {
        const filtered = items.filter((product) => {
            if (state.publishStatusFilter === "published") return Boolean(product.is_published);
            if (state.publishStatusFilter === "unpublished") return !product.is_published;
            return true;
        }).filter((product) => {
            if (state.publishZoneFilter === "all") return true;
            return getWarehouseZoneForProduct(product) === state.publishZoneFilter;
        });
        return filtered.sort((left, right) => Number(left.is_published) - Number(right.is_published));
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
    if (workspace === "publish") return renderPublishWorkspace(items);
    const table = workspace === "import"
        ? `<table class="list-table"><thead><tr><th>Sản phẩm</th><th>SKU</th><th>Tồn kho</th><th>Giá nhập</th><th>Trạng thái</th><th>Tác vụ</th></tr></thead><tbody>${items.map((product) => `<tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultProductThumb()))}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${getInlineProductMeta(product)}</span></div></div></td><td>${escapeHtml(product.sku || "-")}</td><td><strong>${formatNumber(product.stock_quantity)}</strong> ${escapeHtml(product.stock_unit || product.unit || "")}</td><td>${formatCurrency(parseImportReferencePrice(product))}</td><td>${statusPill(product.status, product.status_label)}</td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp.</td></tr>'}</tbody></table>`
        : `<table class="list-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Tác vụ</th></tr></thead><tbody>${items.map((product) => `<tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultProductThumb()))}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><span class="section-copy">${escapeHtml(product.slug || "-")} • ${escapeHtml(product.sku || "-")}</span></div></div></td><td>${getInlineProductMeta(product)}</td><td>${formatCurrency(product.current_price || product.price)}</td><td>${formatNumber(product.stock_quantity)} ${escapeHtml(product.stock_unit || product.unit || "")}</td><td>${statusPill(product.status, product.status_label)}<div class="section-copy" style="margin-top:8px;">${product.is_published ? "Đã đưa lên sàn" : "Chưa đưa lên sàn"}</div></td><td>${buildProductActionButtons(product)}</td></tr>`).join("") || '<tr><td colspan="6">Không có sản phẩm phù hợp.</td></tr>'}</tbody></table>`;
    elements.productsContent.innerHTML = table;
}

export function updateProductWorkspace() {
    const workspace = PRODUCT_WORKSPACES[state.productWorkspace] || PRODUCT_WORKSPACES.catalog;
    const isInventoryWorkspace = state.productWorkspace === "inventory";
    elements.productsPanelEyebrow.textContent = workspace.eyebrow;
    elements.productsPanelEyebrow.classList.toggle("hidden", !workspace.eyebrow);
    elements.productsPanelTitle.textContent = workspace.title;
    elements.productsPanelDescription.textContent = workspace.description;
    elements.productsListTitle.textContent = workspace.listTitle;
    elements.productFilterCard.classList.toggle("hidden", !workspace.showFilter);
    elements.productFilterCard.classList.toggle("full-span", isInventoryWorkspace);
    elements.productFilterCard.classList.toggle("inventory-filter-card", isInventoryWorkspace);
    elements.productCreateCard.classList.toggle("hidden", !workspace.showCreate);
    elements.productImportCard.classList.toggle("hidden", !workspace.showImport);
    elements.productsListCard.classList.toggle("hidden", workspace.showImport);
    elements.productFilterForm.classList.toggle("inventory-filter-form", isInventoryWorkspace);
    const importPriceField = elements.productImportForm?.querySelector('input[name="price"]')?.closest("label");
    if (importPriceField) importPriceField.classList.add("hidden");
    if (workspace !== "publish") closePublishEditor();
    if (workspace.showImport) {
        syncProductCategorySelects();
        return;
    }
    elements.productsListCard.classList.remove("hidden");
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

export function resetProductImportForm() {
    if (!elements.productImportForm) return;
    elements.productImportForm.reset();
    state.productImportImageDataUrl = "";
    if (elements.productImportCategory && state.categories[0]) elements.productImportCategory.value = String(state.categories[0].id);
    if (elements.productImportPreview) {
        elements.productImportPreview.src = "";
        elements.productImportPreview.classList.add("hidden");
    }
    if (elements.productImportImageUrl) elements.productImportImageUrl.value = "";
}

export function hydrateProductForm(productId) {
    const product = getProductById(productId);
    if (!product || !elements.productForm) return;
    elements.productFormTitle.textContent = `Cập nhật #${product.id}`;
    const fields = { id: product.id, category_id: product.category_id, name: product.name || "", slug: product.slug || "", sku: product.sku || "", price: product.price || "", sale_price: product.sale_price || "", stock_quantity: product.stock_quantity || 0, stock_unit: product.stock_unit || "đơn vị", sale_unit: product.sale_unit || product.unit || "đơn vị", stock_per_sale_unit: product.stock_per_sale_unit || 1, thumbnail_url: product.thumbnail_url || "", short_description: product.short_description || "", description: product.description || "", status: product.status || "draft" };
    Object.entries(fields).forEach(([key, value]) => {
        if (elements.productForm.elements[key]) elements.productForm.elements[key].value = value;
    });
    elements.productForm.elements.is_published.checked = Boolean(product.is_published);
    elements.productForm.elements.is_featured.checked = Boolean(product.is_featured);
}

export function openPublishEditor(productId) {
    const product = getProductById(productId);
    if (!product || !elements.publishEditorModal || !elements.publishEditorForm) return;
    const draft = getPublishDraft(product);
    resetPublishEditorState();
    elements.publishEditorForm.elements.id.value = String(product.id);
    elements.publishEditorForm.elements.import_price_display.value = formatCurrency(parseImportReferencePrice(product));
    elements.publishEditorForm.elements.retail_price.value = String(Math.max(0, Number(draft.retailPrice || 0)));
    elements.publishEditorForm.elements.sale_unit.value = draft.saleUnit || product.sale_unit || product.unit || "";
    elements.publishEditorForm.elements.listing_quantity.value = String(Math.max(0.001, Number(draft.listingQuantity || product.stock_per_sale_unit || 1)));
    elements.publishEditorForm.elements.publish_mode.value = draft.publishMode || (product.is_published ? "published" : "draft");
    elements.publishEditorTitle.textContent = "Cập nhật niêm yết sản phẩm";
    elements.publishEditorSku.textContent = product.sku || `SP-${product.id}`;
    elements.publishEditorName.textContent = product.name || "-";
    elements.publishEditorImage.src = resolveMediaUrl(product.thumbnail_url, defaultProductThumb());
    elements.publishEditorStock.textContent = `${formatNumber(product.stock_quantity)} ${product.stock_unit || product.sale_unit || product.unit || ""}`.trim();
    elements.publishEditorStockNote.textContent = `Loại kho: ${WAREHOUSE_ZONES.find((zone) => zone.key === getWarehouseZoneForProduct(product))?.name || "Chưa phân loại"}. Hệ thống sẽ tự trừ tồn kho theo số lượng bán thực tế.`;
    elements.publishEditorSubmit.textContent = "Lưu cập nhật niêm yết";
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
    await apiFetch(`/api/products/${product.id}`, { method: "PUT", body: JSON.stringify(payload) });
    state.publishDrafts[product.id] = { retailPrice: payload.price, saleUnit: payload.sale_unit, listingQuantity: payload.stock_per_sale_unit, publishMode: payload.is_published ? "published" : "draft" };
    closePublishEditor();
    showToast(payload.is_published ? "Đã cập nhật niêm yết sản phẩm." : "Đã lưu sản phẩm ở trạng thái nháp.");
    await Promise.all([loadProducts(), loadOverview()]);
}

export function buildProductPayload(raw) {
    const payload = { category_id: Number(raw.category_id), name: String(raw.name || "").trim(), price: Number(raw.price || 0), sale_price: raw.sale_price ? Number(raw.sale_price) : null, stock_quantity: raw.stock_quantity ? Number(raw.stock_quantity) : 0, stock_unit: String(raw.stock_unit || "").trim(), sale_unit: String(raw.sale_unit || "").trim(), stock_per_sale_unit: raw.stock_per_sale_unit ? Number(raw.stock_per_sale_unit) : 1, thumbnail_url: String(raw.thumbnail_url || "").trim(), short_description: String(raw.short_description || "").trim(), description: String(raw.description || "").trim(), status: raw.status, is_published: Boolean(raw.is_published), is_featured: Boolean(raw.is_featured) };
    if (String(raw.slug || "").trim()) payload.slug = String(raw.slug).trim();
    if (String(raw.sku || "").trim()) payload.sku = String(raw.sku).trim();
    return payload;
}

export function buildInventoryImportPayload(raw) {
    const detailLines = [raw.origin ? `Xuất xứ: ${String(raw.origin).trim()}` : "", raw.supplier_name ? `Nhà cung cấp: ${String(raw.supplier_name).trim()}` : "", raw.reorder_level ? `Ngưỡng cảnh báo hết hàng: ${String(raw.reorder_level).trim()}` : "", raw.import_cost ? `Giá nhập tham chiếu: ${formatCurrency(raw.import_cost)}` : ""].filter(Boolean);
    return { category_id: Number(raw.category_id), name: String(raw.name || "").trim(), price: Number(raw.import_cost || 0), sale_price: null, stock_quantity: raw.stock_quantity ? Number(raw.stock_quantity) : 0, stock_unit: String(raw.sale_unit || "kg").trim(), sale_unit: String(raw.sale_unit || "kg").trim(), stock_per_sale_unit: 1, thumbnail_url: String(raw.thumbnail_url || state.productImportImageDataUrl || "").trim(), short_description: String(raw.short_description || "").trim(), description: detailLines.join("\n"), status: raw.status || "draft", is_published: false, is_featured: Boolean(raw.is_featured) };
}

export async function handleProductAction(action, productId) {
    if (action === "edit-product") {
        hydrateProductForm(productId);
        return;
    }
    if (action === "open-publish-editor") {
        openPublishEditor(productId);
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
        const endpoint = action === "publish-product" ? "publish" : "unpublish";
        await apiFetch(`/api/products/${productId}/${endpoint}`, { method: "PATCH" });
        showToast(action === "publish-product" ? "Đã đưa sản phẩm lên sàn." : "Đã gỡ sản phẩm khỏi sàn.");
        await Promise.all([loadProducts(), loadOverview()]);
    }
}

export function updateProductImportPreview(source) {
    if (!elements.productImportPreview) return;
    const value = String(source || "").trim();
    if (!value) {
        elements.productImportPreview.src = "";
        elements.productImportPreview.classList.add("hidden");
        return;
    }
    elements.productImportPreview.src = value;
    elements.productImportPreview.classList.remove("hidden");
}

export function bindProductMediaEvents() {
    if (elements.productImportImageFile) {
        elements.productImportImageFile.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                state.productImportImageDataUrl = String(reader.result || "");
                if (elements.productImportImageUrl) elements.productImportImageUrl.value = state.productImportImageDataUrl;
                updateProductImportPreview(state.productImportImageDataUrl);
            };
            reader.readAsDataURL(file);
        });
    }
    if (elements.productImportImageUrl) {
        elements.productImportImageUrl.addEventListener("input", (event) => {
            const value = String(event.target.value || "").trim();
            state.productImportImageDataUrl = value;
            updateProductImportPreview(value);
        });
    }
}
