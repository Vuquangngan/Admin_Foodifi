import { apiFetch, elements, escapeHtml, fillSelectOptions, formatNumber, resolveMediaUrl, showToast, state, statusPill } from "./core.js";

let supplierLogoFile = null;

function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
}

function getSupplierNameFromProduct(product) {
    if (product?.supplier_name) return String(product.supplier_name).trim();
    const description = String(product?.description || "");
    const match = description.match(/Nh(?:à|a) cung c(?:ấ|a)p:\s*([^\n]+)/i);
    return match ? String(match[1] || "").trim() : "";
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
    elements.suppliersMeta.textContent = `${formatNumber(suppliers.length)} nhà cung cấp`;
    elements.suppliersContent.innerHTML = `
      <div class="suppliers-table-wrap">
        <table class="list-table suppliers-table">
          <thead>
            <tr>
              <th>Nhà cung cấp</th>
              <th>Mã số</th>
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
                    <td>${escapeHtml(supplier.code || "-")}</td>
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
            }).join("") || '<tr><td colspan="8">Chưa có nhà cung cấp phù hợp.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
}

export function syncSupplierSelects() {
    fillSelectOptions(elements.productImportSupplierSelect, state.suppliers || [], {
        includeBlank: true,
        blankLabel: "Chọn nhà cung cấp trong kho"
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

export async function handleSupplierAction(action, supplierId) {
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
    renderSupplierSummary();
    renderSupplierTable();
    if (state.supplierView !== "form") {
        elements.supplierFormCard?.classList.add("hidden");
    }
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
