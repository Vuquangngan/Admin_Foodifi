import {
    apiFetch,
    elements,
    escapeHtml,
    fillSelectOptions,
    formatNumber,
    resolveMediaUrl,
    showToast,
    state,
    statusPill
} from "./core.js";
import { loadCategories, loadOverview, loadProducts } from "./data.js";

const CATEGORY_ICON_PRESETS = {
    leaf: createCategoryPreset("🍃"),
    fruit: createCategoryPreset("🍊"),
    bakery: createCategoryPreset("🥐"),
    market: createCategoryPreset("🪪"),
    dessert: createCategoryPreset("🍦")
};

function createCategoryPreset(emoji) {
    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="#eef5e9"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-size="72">${emoji}</text></svg>`
    )}`;
}

function defaultCategoryThumb() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' rx='20' fill='%23edf4e8'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%230f7442' font-family='Arial' font-size='18'%3ECAT%3C/text%3E%3C/svg%3E";
}

function setCategoryPreview(value) {
    if (!elements.categoryImagePreview) return;

    const nextValue = String(value || "").trim();
    if (!nextValue) {
        elements.categoryImagePreview.src = "";
        elements.categoryImagePreview.classList.add("hidden");
        return;
    }

    elements.categoryImagePreview.src = nextValue;
    elements.categoryImagePreview.classList.remove("hidden");
}

function setActiveCategoryIcon(iconKey = "leaf") {
    elements.categoryIconButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.categoryIcon === iconKey);
    });
}

export function syncCategoryParentSelect() {
    fillSelectOptions(elements.categoryParentSelect, state.categories, { includeBlank: true, blankLabel: "Không có" });
}

export function openCategoryModal() {
    elements.categoryModal?.classList.remove("hidden");
}

export function closeCategoryModal() {
    elements.categoryModal?.classList.add("hidden");
}

export function resetCategoryForm() {
    if (!elements.categoryForm) return;

    elements.categoryForm.reset();
    elements.categoryForm.elements.id.value = "";
    elements.categoryForm.elements.image_url.value = CATEGORY_ICON_PRESETS.leaf;
    elements.categoryForm.elements.is_active.checked = true;
    elements.categoryFormTitle.textContent = "Thêm Danh Mục Mới";
    setActiveCategoryIcon("leaf");
    setCategoryPreview("");
}

export function hydrateCategoryForm(categoryId) {
    const category = state.categories.find((item) => Number(item.id) === Number(categoryId));
    if (!category || !elements.categoryForm) return;

    elements.categoryFormTitle.textContent = `Cập nhật ${category.name}`;
    const fields = {
        id: category.id,
        parent_id: category.parent_id || "",
        name: category.name || "",
        slug: category.slug || "",
        image_url: category.image_url || "",
        description: category.description || ""
    };

    Object.entries(fields).forEach(([key, value]) => {
        if (elements.categoryForm.elements[key]) {
            elements.categoryForm.elements[key].value = value;
        }
    });

    const presetEntry = Object.entries(CATEGORY_ICON_PRESETS)
        .find(([, preset]) => preset === String(category.image_url || "").trim());
    setActiveCategoryIcon(presetEntry?.[0] || "");
    setCategoryPreview(category.image_url || "");
    elements.categoryForm.elements.is_active.checked = Boolean(category.is_active);
    openCategoryModal();
}

export function buildCategoryPayload(raw) {
    const name = String(raw.name || "").trim();
    const slug = String(raw.slug || "").trim() || name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return {
        parent_id: raw.parent_id ? Number(raw.parent_id) : null,
        name,
        slug,
        image_url: String(raw.image_url || "").trim(),
        description: String(raw.description || "").trim(),
        is_active: Boolean(raw.is_active)
    };
}

export async function handleCategoryAction(action, categoryId) {
    if (action === "edit-category") {
        hydrateCategoryForm(categoryId);
        return;
    }

    if (action === "delete-category") {
        if (!window.confirm("Bạn chắc chắn muốn xóa danh mục này?")) return;
        await apiFetch(`/api/categories/${categoryId}`, { method: "DELETE" });
        showToast("Đã xóa danh mục.");
        await Promise.all([loadCategories(), loadProducts(), loadOverview()]);
    }
}

export function renderCategories() {
    const categories = [...state.categories];
    const totalCategories = categories.length;
    const activeCategories = categories.filter((category) => Boolean(category.is_active)).length;
    const totalProducts = state.products.length;

    elements.categoriesMeta.textContent = `${formatNumber(totalCategories)} danh mục`;
    elements.categoriesSummary.innerHTML = `
      <article class="categories-stat-card"><span>Tổng danh mục</span><strong>${formatNumber(totalCategories)}</strong></article>
      <article class="categories-stat-card"><span>Đang hoạt động</span><strong>${formatNumber(activeCategories)}</strong></article>
      <article class="categories-stat-card"><span>Tổng sản phẩm</span><strong>${formatNumber(totalProducts)}</strong></article>
    `;

    const rows = categories.map((category) => {
        const productCount = state.products.filter((product) => Number(product.category_id) === Number(category.id)).length;
        const imageUrl = resolveMediaUrl(category.image_url, defaultCategoryThumb());

        return `
          <tr>
            <td><div class="categories-thumb-cell"><img class="categories-thumb" src="${escapeHtml(imageUrl)}" alt=""></div></td>
            <td><div class="categories-name-cell"><strong>${escapeHtml(category.name)}</strong><span>${escapeHtml(category.description || category.slug || "Chưa có mô tả")}</span></div></td>
            <td><span class="categories-count-pill">${formatNumber(productCount)}</span></td>
            <td>${category.is_active ? statusPill("active", "Hoạt động") : statusPill("pending", "Ngừng kinh doanh")}</td>
            <td><div class="categories-actions"><button class="icon-action-button" type="button" data-action="edit-category" data-id="${category.id}" title="Sửa">✎</button>${state.user?.role === "admin" ? `<button class="icon-action-button" type="button" data-action="delete-category" data-id="${category.id}" title="Xóa">⋮</button>` : ""}</div></td>
          </tr>
        `;
    }).join("");

    elements.categoriesContent.innerHTML = `
      <div class="categories-table-wrap">
        <table class="list-table categories-table">
          <thead><tr><th>Biểu tượng</th><th>Tên danh mục</th><th>Số lượng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Chưa có danh mục.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="categories-footer">
        <span>Hiển thị 1-${formatNumber(totalCategories)} trong ${formatNumber(totalCategories)} danh mục</span>
        <div class="categories-pagination">
          <button class="pagination-dot-button" type="button" disabled>&lsaquo;</button>
          <button class="pagination-dot-button active" type="button">1</button>
          <button class="pagination-dot-button" type="button" disabled>2</button>
          <button class="pagination-dot-button" type="button" disabled>3</button>
          <button class="pagination-dot-button" type="button" disabled>&rsaquo;</button>
        </div>
      </div>
    `;
}

export function bindCategoryMediaEvents() {
    elements.categoryIconButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const iconKey = button.dataset.categoryIcon || "leaf";
            const preset = CATEGORY_ICON_PRESETS[iconKey];
            setActiveCategoryIcon(iconKey);
            if (elements.categoryForm?.elements.image_url) {
                elements.categoryForm.elements.image_url.value = preset;
            }
            setCategoryPreview("");
        });
    });

    if (elements.categoryImageFile) {
        elements.categoryImageFile.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || "");
                if (elements.categoryForm?.elements.image_url) {
                    elements.categoryForm.elements.image_url.value = result;
                }
                setActiveCategoryIcon("");
                setCategoryPreview(result);
            };
            reader.readAsDataURL(file);
        });
    }
}
