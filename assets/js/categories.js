import {
    apiFetch,
    elements,
    escapeHtml,
    fillSelectOptions,
    formatNumber,
    resolveMediaUrl,
    showToast,
    state,
    statusPill,
    uploadImageFile
} from "./core.js";
import { loadCategories, loadOverview, loadProducts } from "./data.js";
import { iconDataUri, renderAppIcon } from "./icons.js";

const CATEGORY_ICON_PRESETS = {
    leaf: iconDataUri("basket"),
    fruit: iconDataUri("store"),
    bakery: iconDataUri("package"),
    market: iconDataUri("receipt"),
    dessert: iconDataUri("grid")
};

function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
}

function isChildCategory(category) {
    return Boolean(Number(category?.parent_id || 0));
}

function getParentCategories(categories = state.categories || []) {
    return categories
        .filter((category) => !isChildCategory(category))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
}

function getChildrenForCategory(parentId, categories = state.categories || []) {
    return categories
        .filter((category) => Number(category?.parent_id || 0) === Number(parentId))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
}

function getCategoryDescendantIds(categoryId, categories = state.categories || []) {
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

function categoryMatchesFilters(category, filters) {
    const keyword = normalizeText(filters.keyword);
    const status = String(filters.status || "");

    if (status === "active" && !category.is_active) return false;
    if (status === "inactive" && category.is_active) return false;

    if (!keyword) return true;
    return [
        category.name,
        category.slug,
        category.description,
        category.parent?.name
    ].some((value) => normalizeText(value).includes(keyword));
}

function getVisibleCategoryRows(categories, filters) {
    const parentCategories = getParentCategories(categories);
    const parentIds = new Set(parentCategories.map((category) => Number(category.id)));
    const rows = [];

    parentCategories.forEach((parent) => {
        const children = getChildrenForCategory(parent.id, categories);
        const parentMatches = categoryMatchesFilters(parent, filters);
        const matchingChildren = children.filter((child) => categoryMatchesFilters(child, filters));
        const visibleChildren = parentMatches ? children : matchingChildren;

        if (!parentMatches && !matchingChildren.length) return;
        rows.push({ category: parent, level: 0, childCount: children.length, parent: null });
        visibleChildren.forEach((child) => {
            rows.push({ category: child, level: 1, childCount: 0, parent });
        });
    });

    categories
        .filter((category) => isChildCategory(category) && !parentIds.has(Number(category.parent_id || 0)))
        .filter((category) => categoryMatchesFilters(category, filters))
        .forEach((category) => rows.push({ category, level: 1, childCount: 0, parent: null }));

    return rows;
}

function defaultCategoryThumb() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' rx='20' fill='%23edf4e8'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' fill='%230f7442' font-family='Arial' font-size='18'%3ECAT%3C/text%3E%3C/svg%3E";
}

function getCategoryProductCount(category) {
    const backendCount = Number(
        category?.product_count ??
        category?.products_count ??
        category?.item_count ??
        category?.productCount ??
        category?.so_luong_san_pham ??
        NaN
    );
    if (Number.isFinite(backendCount) && backendCount >= 0 && isChildCategory(category)) {
        return backendCount;
    }

    const categoryId = Number(category?.id || 0);
    const descendantIds = getCategoryDescendantIds(categoryId);
    const categoryIds = new Set([categoryId, ...descendantIds]);
    const categoryName = normalizeText(category?.name);

    return (state.products || []).filter((product) => {
        const productCategoryId = Number(product?.category_id || product?.category?.id || 0);
        if (categoryId && categoryIds.has(productCategoryId)) return true;

        const productCategoryName = normalizeText(product?.category_name || product?.category?.name);
        return Boolean(categoryName) && productCategoryName === categoryName;
    }).length;
}

function getCategoryFilters() {
    if (!state.filters.categories) {
        state.filters.categories = {};
    }
    return state.filters.categories;
}

function buildCategoryFilterForm(filters) {
    const keyword = escapeHtml(filters.keyword || "");
    const status = String(filters.status || "");

    return `
      <form class="categories-filter-card" id="categoryFilterForm">
        <label class="categories-filter-search">
          <span>Lọc theo tên</span>
          <input name="keyword" value="${keyword}" placeholder="Nhập tên danh mục...">
        </label>
        <label>
          <span>Trạng thái</span>
          <select name="status">
            <option value="">Tất cả trạng thái</option>
            <option value="active" ${status === "active" ? "selected" : ""}>Đang hoạt động</option>
            <option value="inactive" ${status === "inactive" ? "selected" : ""}>Ngừng kinh doanh</option>
          </select>
        </label>
        <button class="primary-button" type="submit">Áp dụng</button>
      </form>
    `;
}

function setCategoryPreview(value) {
    if (!elements.categoryImagePreview) return;

    const nextValue = String(value || "").trim();
    if (!nextValue) {
        elements.categoryImagePreview.src = "";
        elements.categoryImagePreview.classList.add("hidden");
        return;
    }

    elements.categoryImagePreview.src = resolveMediaUrl(nextValue, defaultCategoryThumb());
    elements.categoryImagePreview.classList.remove("hidden");
}

function setActiveCategoryIcon(iconKey = "leaf") {
    elements.categoryIconButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.categoryIcon === iconKey);
    });
}

export function syncCategoryParentSelect() {
    if (!elements.categoryParentSelect) return;
    const currentId = Number(elements.categoryForm?.elements.id?.value || 0);
    const parentOptions = getParentCategories().filter((category) => Number(category.id) !== currentId);
    fillSelectOptions(elements.categoryParentSelect, parentOptions, {
        includeBlank: true,
        blankLabel: "Chọn danh mục cha"
    });
}

function syncCategoryTypeFields() {
    if (!elements.categoryForm) return;

    const isChild = elements.categoryForm.elements.category_type?.value === "child";
    const parentField = elements.categoryForm.querySelector(".category-parent-field");
    parentField?.classList.toggle("hidden", !isChild);

    if (elements.categoryForm.elements.parent_id) {
        elements.categoryForm.elements.parent_id.required = isChild;
        if (!isChild) {
            elements.categoryForm.elements.parent_id.value = "";
        }
    }
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
    if (elements.categoryForm.elements.category_type) {
        elements.categoryForm.elements.category_type.value = "parent";
    }
    if (elements.categoryForm.elements.parent_id) {
        elements.categoryForm.elements.parent_id.value = "";
    }
    elements.categoryFormTitle.textContent = "Thêm danh mục mới";
    syncCategoryParentSelect();
    syncCategoryTypeFields();
    setActiveCategoryIcon("leaf");
    setCategoryPreview("");
}

export function hydrateCategoryForm(categoryId) {
    const category = state.categories.find((item) => Number(item.id) === Number(categoryId));
    if (!category || !elements.categoryForm) return;

    elements.categoryFormTitle.textContent = `Cập nhật ${category.name}`;
    elements.categoryForm.elements.id.value = category.id;
    syncCategoryParentSelect();

    const fields = {
        id: category.id,
        category_type: isChildCategory(category) ? "child" : "parent",
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

    syncCategoryTypeFields();
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
    const isChild = raw.category_type === "child";

    return {
        parent_id: isChild && raw.parent_id ? Number(raw.parent_id) : null,
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
    const allCategories = [...state.categories];
    const filters = getCategoryFilters();
    const categoryRows = getVisibleCategoryRows(allCategories, filters);
    const totalCategories = allCategories.length;
    const visibleCategories = categoryRows.length;

    elements.categoriesMeta.textContent = `${formatNumber(visibleCategories)} danh mục phù hợp`;
    elements.categoriesSummary.innerHTML = buildCategoryFilterForm(filters);

    const rows = categoryRows.map(({ category, level, childCount, parent }) => {
        const productCount = getCategoryProductCount(category);
        const imageUrl = resolveMediaUrl(category.image_url, defaultCategoryThumb());
        const typeText = level === 0 ? "Danh mục cha" : "Danh mục con";
        const typeClass = level === 0 ? "parent" : "child";
        const typeNote = level === 0
            ? `${formatNumber(childCount)} danh mục con`
            : `Thuộc ${escapeHtml(parent?.name || category.parent?.name || "danh mục cha")}`;
        const description = category.description || category.slug || "Chưa có mô tả";

        return `
          <tr class="${level === 1 ? "category-child-row" : "category-parent-row"}">
            <td><div class="categories-thumb-cell"><img class="categories-thumb" src="${escapeHtml(imageUrl)}" alt=""></div></td>
            <td>
              <div class="categories-name-cell ${level === 1 ? "is-child" : ""}">
                <strong>${escapeHtml(category.name)}</strong>
                <span>${escapeHtml(description)}</span>
              </div>
            </td>
            <td>
              <span class="category-type-pill ${typeClass}">${typeText}</span>
              <span class="category-type-note">${typeNote}</span>
            </td>
            <td><span class="categories-count-pill">${formatNumber(productCount)}</span></td>
            <td>${category.is_active ? statusPill("active", "Hoạt động") : statusPill("pending", "Ngừng kinh doanh")}</td>
            <td>
              <div class="categories-actions">
                <button class="icon-action-button" type="button" data-action="edit-category" data-id="${category.id}" title="Sửa">${renderAppIcon("edit")}</button>
                ${state.user?.role === "admin" ? `<button class="icon-action-button" type="button" data-action="delete-category" data-id="${category.id}" title="Xóa">${renderAppIcon("trash")}</button>` : ""}
              </div>
            </td>
          </tr>
        `;
    }).join("");

    elements.categoriesContent.innerHTML = `
      <div class="categories-table-wrap">
        <table class="list-table categories-table">
          <thead>
            <tr>
              <th>Biểu tượng</th>
              <th>Tên danh mục</th>
              <th>Phân cấp</th>
              <th>Số lượng</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6">Chưa có danh mục.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="categories-footer hidden">
        <span>Hiển thị ${visibleCategories ? `1-${formatNumber(visibleCategories)}` : "0"} trong ${formatNumber(totalCategories)} danh mục</span>
        <div class="categories-pagination">
          <button class="pagination-dot-button" type="button" disabled>&lsaquo;</button>
          <button class="pagination-dot-button active" type="button">1</button>
          <button class="pagination-dot-button" type="button" disabled>&rsaquo;</button>
        </div>
      </div>
    `;
}

export function bindCategoryMediaEvents() {
    elements.categoryForm?.elements.category_type?.addEventListener("change", syncCategoryTypeFields);

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
        elements.categoryImageFile.addEventListener("change", async (event) => {
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

            try {
                showToast("Đang tải ảnh danh mục lên hệ thống...");
                const uploadedUrl = await uploadImageFile(file, "categories");
                if (elements.categoryForm?.elements.image_url) {
                    elements.categoryForm.elements.image_url.value = uploadedUrl;
                }
                setCategoryPreview(uploadedUrl);
                showToast("Đã tải ảnh danh mục.");
            } catch (error) {
                event.target.value = "";
                showToast(error.message || "Không tải được ảnh danh mục.", true);
            }
        });
    }
}
