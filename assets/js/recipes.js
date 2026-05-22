import { apiFetch, elements, escapeHtml, resolveMediaUrl, showToast, state } from "./core.js";
import { renderAppIcon } from "./icons.js";

const DEFAULT_RECIPE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%23dfead9'/%3E%3Ccircle cx='48' cy='48' r='25' fill='%230d8d48' opacity='.18'/%3E%3Cpath d='M28 53c7-15 33-15 40 0' stroke='%230d8d48' stroke-width='6' fill='none' stroke-linecap='round'/%3E%3Ccircle cx='38' cy='39' r='5' fill='%23c9683e'/%3E%3Ccircle cx='52' cy='36' r='5' fill='%23f0a514'/%3E%3Ccircle cx='59' cy='48' r='5' fill='%230d8d48'/%3E%3C/svg%3E";
const DEFAULT_CATEGORY_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='260' viewBox='0 0 420 260'%3E%3Crect width='420' height='260' rx='30' fill='%23dfead9'/%3E%3Ccircle cx='104' cy='88' r='42' fill='%23f08b39' opacity='.7'/%3E%3Ccircle cx='176' cy='116' r='58' fill='%23128d4c' opacity='.35'/%3E%3Ccircle cx='290' cy='104' r='66' fill='%23f5ca45' opacity='.65'/%3E%3Cpath d='M70 190c92-58 188-52 282 0' stroke='%230d7f42' stroke-width='18' stroke-linecap='round' fill='none' opacity='.35'/%3E%3C/svg%3E";

const DIFFICULTY_LABELS = {
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó"
};

const DIFFICULTY_VALUES = {
    "Dễ": "easy",
    "Trung bình": "medium",
    "Khó": "hard",
    easy: "easy",
    medium: "medium",
    hard: "hard"
};

function normalizeDifficulty(value) {
    return DIFFICULTY_VALUES[String(value || "").trim()] || "easy";
}

function difficultyLabel(value) {
    return DIFFICULTY_LABELS[normalizeDifficulty(value)] || "Dễ";
}

function recipeStatusLabel(status) {
    return status === "draft" ? "Bản nháp" : "Đã xuất bản";
}

function normalizeImageUrlForSave(value, fallbackValue = "") {
    const rawValue = String(value || "").trim();
    if (rawValue && !rawValue.startsWith("data:")) return rawValue;

    const fallback = String(fallbackValue || "").trim();
    if (fallback && !fallback.startsWith("data:")) return fallback;

    return null;
}

function getUploadedImageUrl(payload) {
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

async function uploadRecipeImage(file, folder = "recipes") {
    if (!file) return "";
    if (!file.type?.startsWith("image/")) {
        throw new Error("Vui lòng chọn tệp ảnh hợp lệ.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch(`/api/uploads/images?folder=${encodeURIComponent(folder)}`, {
        method: "POST",
        body: formData
    });

    const uploadedUrl = getUploadedImageUrl(payload);
    if (!uploadedUrl) {
        throw new Error("Không lấy được đường dẫn ảnh sau khi tải lên.");
    }

    return uploadedUrl;
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `cong-thuc-${Date.now()}`;
}

function normalizeCategory(category = {}) {
    return {
        id: category.id,
        name: category.name || category.ten_danh_muc || "",
        slug: category.slug || category.duong_dan_slug || "",
        description: category.description || category.mo_ta || "",
        image_url: category.image_url || category.duong_dan_anh || "",
        color_hex: category.color_hex || category.ma_mau || "#0d8d48",
        is_active: category.is_active !== false && category.dang_hien_thi !== false,
        recipe_count: Number(category.recipe_count ?? category.so_cong_thuc ?? 0)
    };
}

function normalizeIngredient(ingredient = {}) {
    const productId = ingredient.product_id ?? ingredient.ma_san_pham ?? "";
    return {
        id: ingredient.id,
        product_id: productId,
        ingredient_name: ingredient.ingredient_name || ingredient.ten_nguyen_lieu || ingredient.name || "",
        quantity: ingredient.quantity ?? ingredient.so_luong ?? "",
        unit: ingredient.unit || ingredient.don_vi || "gram",
        note: ingredient.note || ingredient.ghi_chu || "",
        sort_order: ingredient.sort_order || ingredient.thu_tu_hien_thi || 1,
        product_name: ingredient.product_name || ingredient.ten_san_pham || ingredient.product?.name || ingredient.san_pham?.name || ""
    };
}

function normalizeStep(step = {}, index = 0) {
    if (typeof step === "string") {
        return { step_number: index + 1, instruction: step, image_url: "" };
    }

    return {
        id: step.id,
        step_number: step.step_number || step.so_buoc || index + 1,
        instruction: step.instruction || step.huong_dan || "",
        image_url: step.image_url || step.duong_dan_anh || ""
    };
}

function normalizeRecipe(recipe = {}) {
    const category = normalizeCategory(recipe.recipe_category || recipe.danh_muc_cong_thuc || {});
    const categoryName = recipe.recipe_category_name || recipe.ten_danh_muc_cong_thuc || category.name || "";
    const ingredients = Array.isArray(recipe.ingredients || recipe.danh_sach_nguyen_lieu)
        ? (recipe.ingredients || recipe.danh_sach_nguyen_lieu).map(normalizeIngredient)
        : [];
    const steps = Array.isArray(recipe.steps || recipe.cac_buoc_thuc_hien)
        ? (recipe.steps || recipe.cac_buoc_thuc_hien).map(normalizeStep)
        : [];

    return {
        id: recipe.id,
        recipe_category_id: recipe.recipe_category_id ?? recipe.ma_danh_muc_cong_thuc ?? category.id ?? "",
        title: recipe.title || recipe.ten_cong_thuc || "",
        slug: recipe.slug || recipe.duong_dan_slug || "",
        description: recipe.description || recipe.mo_ta || "",
        image_url: recipe.image_url || recipe.duong_dan_anh || "",
        prep_time_minutes: Number(recipe.prep_time_minutes ?? recipe.thoi_gian_chuan_bi_phut ?? 0),
        cook_time_minutes: Number(recipe.cook_time_minutes ?? recipe.thoi_gian_nau_phut ?? 0),
        servings: Number(recipe.servings ?? recipe.khau_phan ?? 1),
        difficulty: normalizeDifficulty(recipe.difficulty || recipe.do_kho_ma),
        difficulty_label: recipe.difficulty_label || recipe.do_kho_hien_thi || difficultyLabel(recipe.difficulty),
        calories: recipe.calories ?? recipe.calo ?? null,
        status: recipe.status || recipe.trang_thai_ma || "published",
        status_label: recipe.status_label || recipe.trang_thai_hien_thi || recipeStatusLabel(recipe.status),
        recipe_category_name: categoryName,
        recipe_category: category,
        ingredients,
        steps
    };
}

function loadRecipeCategories() {
    return Array.isArray(state.recipeCategories) ? state.recipeCategories : [];
}

function loadRecipes() {
    return Array.isArray(state.recipes) ? state.recipes : [];
}

async function hydrateRecipeCategories(force = false) {
    if (state.recipeCategoriesHydrated && !force) return loadRecipeCategories();
    const categories = await apiFetch("/api/recipe-categories");
    state.recipeCategories = Array.isArray(categories) ? categories.map(normalizeCategory) : [];
    state.recipeCategoriesHydrated = true;
    return state.recipeCategories;
}

async function hydrateRecipes(force = false) {
    if (state.recipesHydrated && !force) return loadRecipes();
    const recipes = await apiFetch("/api/recipes");
    state.recipes = Array.isArray(recipes) ? recipes.map(normalizeRecipe) : [];
    state.recipesHydrated = true;
    return state.recipes;
}

async function hydrateRecipeData(force = false) {
    await Promise.all([
        hydrateRecipeCategories(force),
        hydrateRecipes(force)
    ]);
}

async function fetchRecipeDetail(recipeId) {
    const recipe = normalizeRecipe(await apiFetch(`/api/recipes/${recipeId}`));
    state.recipes = loadRecipes().some((item) => String(item.id) === String(recipe.id))
        ? state.recipes.map((item) => String(item.id) === String(recipe.id) ? recipe : item)
        : [recipe, ...state.recipes];
    return recipe;
}

function getRecipeById(recipeId) {
    return loadRecipes().find((recipe) => String(recipe.id) === String(recipeId));
}

function getRecipeCategoryById(categoryId) {
    return loadRecipeCategories().find((category) => String(category.id) === String(categoryId));
}

function getRecipeCountByCategory(category) {
    const categoryId = category?.id ?? category;
    const categoryName = category?.name ?? category;
    return loadRecipes().filter((recipe) => {
        if (String(recipe.recipe_category_id || "") === String(categoryId || "")) return true;
        return String(recipe.recipe_category_name || "") === String(categoryName || "");
    }).length;
}

function recipeCategoryOptions(selectedValue = "", includeAll = false) {
    const categories = loadRecipeCategories().filter((category) => category.is_active !== false);
    const allOption = includeAll ? `<option value="all">Tất cả danh mục</option>` : "";
    return `${allOption}${categories.map((category) => `<option value="${escapeHtml(category.id)}" ${String(selectedValue) === String(category.id) ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}`;
}

function getVisibleRecipes() {
    const keyword = String(state.recipeFilters?.keyword || "").trim().toLowerCase();
    const categoryId = String(state.recipeFilters?.category || "all");
    return loadRecipes().filter((recipe) => {
        if (categoryId !== "all" && String(recipe.recipe_category_id || "") !== categoryId) return false;
        if (!keyword) return true;
        return [
            recipe.title,
            recipe.description,
            recipe.recipe_category_name,
            ...(recipe.ingredients || []).map((item) => item.ingredient_name || item.product_name)
        ].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
}

function getVisibleRecipeCategories() {
    const keyword = String(state.recipeCategoryFilters?.keyword || "").trim().toLowerCase();
    return loadRecipeCategories().filter((category) => {
        if (!keyword) return true;
        return [category.name, category.description, category.slug, category.id].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
}

function statusBadge(status) {
    const published = status !== "draft";
    return `<span class="recipe-status ${published ? "published" : "draft"}">${published ? "Đã xuất bản" : "Bản nháp"}</span>`;
}

function difficultyDot(difficulty) {
    const key = normalizeDifficulty(difficulty);
    return `<span class="recipe-difficulty ${key}"><i></i>${escapeHtml(difficultyLabel(key))}</span>`;
}

function productOptions(selectedProductId = "", selectedName = "") {
    const products = Array.isArray(state.products) ? state.products : [];
    const hasSelected = selectedProductId && products.some((product) => String(product.id) === String(selectedProductId));
    const fallback = selectedName && !hasSelected ? `<option value="" data-name="${escapeHtml(selectedName)}">${escapeHtml(selectedName)}</option>` : "";
    return `${fallback}<option value="">Chọn nguyên liệu</option>${products.map((product) => `<option value="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name || "")}" ${String(selectedProductId) === String(product.id) ? "selected" : ""}>${escapeHtml(product.name || "")}</option>`).join("")}`;
}

function getProductById(productId) {
    return (state.products || []).find((product) => String(product.id) === String(productId)) || null;
}

function renderIngredientRow(item = {}) {
    const productName = item.product_name || item.ingredient_name || getProductById(item.product_id)?.name || "";
    return `
      <div class="recipe-repeat-row recipe-ingredient-row" data-recipe-ingredient-row>
        <label class="recipe-ingredient-picker">
          <span>Nguyên liệu</span>
          <input data-recipe-ingredient="name" value="${escapeHtml(productName)}" placeholder="Nhập tên sản phẩm để tìm..." autocomplete="off">
          <input type="hidden" data-recipe-ingredient="product_id" value="${escapeHtml(item.product_id || "")}">
          <div class="recipe-ingredient-suggestions hidden"></div>
        </label>
        <label>
          <span>Số lượng</span>
          <input data-recipe-ingredient="quantity" value="${escapeHtml(item.quantity || "")}" placeholder="100">
        </label>
        <label>
          <span>Đơn vị</span>
          <input data-recipe-ingredient="unit" value="${escapeHtml(item.unit || "gram")}" list="productUnitOptions">
        </label>
        <button type="button" data-recipe-action="remove-ingredient" aria-label="Xóa nguyên liệu">${renderAppIcon("trash")}</button>
      </div>
    `;
}

function renderStepRow(step = {}, index = 0) {
    const normalizedStep = normalizeStep(step, index);
    const imageUrl = normalizedStep.image_url || "";
    return `
      <div class="recipe-repeat-row recipe-step-row" data-recipe-step-row>
        <span class="recipe-step-number">${index + 1}</span>
        <div class="recipe-step-editor">
          <textarea data-recipe-step rows="3" placeholder="Giải thích bước này một cách rõ ràng...">${escapeHtml(normalizedStep.instruction || "")}</textarea>
          <div class="recipe-step-image-row">
            <label class="recipe-step-image-button">
              <input type="file" accept="image/*" data-recipe-step-image-file hidden>
              + Ảnh bước
            </label>
            <input data-recipe-step-image-url value="${escapeHtml(imageUrl)}" placeholder="Link ảnh bước thực hiện">
            ${imageUrl ? `<img src="${escapeHtml(resolveMediaUrl(imageUrl, ""))}" alt="">` : ""}
          </div>
        </div>
        <button type="button" data-recipe-action="remove-step" aria-label="Xóa bước">${renderAppIcon("trash")}</button>
      </div>
    `;
}

function renderRecipeFormLists(recipe = {}) {
    const ingredients = recipe.ingredients?.length ? recipe.ingredients : [{ ingredient_name: "", quantity: "", unit: "gram" }];
    const steps = recipe.steps?.length ? recipe.steps : [{ instruction: "" }];
    elements.recipeIngredients.innerHTML = ingredients.map(renderIngredientRow).join("");
    elements.recipeSteps.innerHTML = steps.map(renderStepRow).join("");
}

function syncRecipeCategoryControls(selected = "") {
    if (elements.recipeCategoryFilter) {
        elements.recipeCategoryFilter.innerHTML = recipeCategoryOptions(state.recipeFilters?.category || "all", true);
    }
    if (elements.recipeForm?.elements.category) {
        elements.recipeForm.elements.category.innerHTML = recipeCategoryOptions(selected || elements.recipeForm.elements.category.value || "", false);
    }
}

function collectRecipeForm() {
    const form = elements.recipeForm;
    const ingredients = Array.from(elements.recipeIngredients.querySelectorAll("[data-recipe-ingredient-row]")).map((row, index) => {
        const productIdInput = row.querySelector("[data-recipe-ingredient='product_id']");
        const ingredientName = row.querySelector("[data-recipe-ingredient='name']")?.value || getProductById(productIdInput?.value)?.name || "";
        return {
            product_id: productIdInput?.value ? Number(productIdInput.value) : null,
            ingredient_name: ingredientName.trim(),
            quantity: Number(row.querySelector("[data-recipe-ingredient='quantity']")?.value || 1),
            unit: row.querySelector("[data-recipe-ingredient='unit']")?.value || "gram",
            sort_order: index + 1
        };
    }).filter((item) => item.ingredient_name);

    const steps = Array.from(elements.recipeSteps.querySelectorAll("[data-recipe-step]"))
        .map((item, index) => ({
            step_number: index + 1,
            instruction: item.value.trim(),
            image_url: normalizeImageUrlForSave(item.closest("[data-recipe-step-row]")?.querySelector("[data-recipe-step-image-url]")?.value || "")
        }))
        .filter((step) => step.instruction);

    const title = form.elements.title.value.trim();
    const existingRecipe = state.recipeEditingId ? getRecipeById(state.recipeEditingId) : null;

    return {
        title,
        slug: existingRecipe?.slug || slugify(title),
        recipe_category_id: Number(form.elements.category.value || 0) || null,
        prep_time_minutes: Number(form.elements.prep_time.value || 0),
        cook_time_minutes: 0,
        servings: 1,
        description: form.elements.description.value.trim(),
        difficulty: normalizeDifficulty(form.elements.difficulty.value),
        status: form.elements.status.value || "published",
        image_url: normalizeImageUrlForSave(form.elements.image_url.value, state.recipeImageDataUrl),
        ingredients,
        steps
    };
}

function collectRecipeCategoryForm() {
    const form = elements.recipeCategoryForm;
    const name = form.elements.name.value.trim();
    const existingCategory = state.recipeCategoryEditingId ? getRecipeCategoryById(state.recipeCategoryEditingId) : null;
    return {
        name,
        slug: existingCategory?.slug || slugify(name),
        description: form.elements.description.value.trim(),
        image_url: normalizeImageUrlForSave(form.elements.image_url.value, state.recipeCategoryImageDataUrl),
        color_hex: form.elements.icon.value.trim() || existingCategory?.color_hex || "#0d8d48",
        is_active: Boolean(form.elements.is_active.checked)
    };
}

function renderRecipeLoading() {
    if (elements.recipesContent) {
        elements.recipesContent.innerHTML = '<div class="recipes-empty">Đang tải dữ liệu công thức từ hệ thống...</div>';
    }
}

function renderRecipeListWorkspace() {
    const recipes = getVisibleRecipes();
    if (elements.recipesPanelTitle) elements.recipesPanelTitle.textContent = "Quản lý công thức nấu ăn";
    if (elements.recipesPanelDescription) elements.recipesPanelDescription.textContent = "Tạo và quản lý công thức món ăn, nguyên liệu và hướng dẫn chế biến cho Garden Fresh.";
    if (elements.openRecipeModalButton) elements.openRecipeModalButton.textContent = "+ Thêm công thức mới";
    if (elements.recipeCategorySummary) elements.recipeCategorySummary.classList.add("hidden");
    if (elements.recipeSearchInput) {
        elements.recipeSearchInput.value = state.recipeFilters?.keyword || "";
        elements.recipeSearchInput.placeholder = "Tìm tên món, nguyên liệu...";
    }
    syncRecipeCategoryControls();
    if (elements.recipesMeta) elements.recipesMeta.textContent = `${recipes.length} công thức`;
    if (!elements.recipesContent) return;

    elements.recipesContent.innerHTML = `
      <div class="recipes-table-scroll">
        <table class="recipes-table">
          <thead>
            <tr>
              <th>Tên công thức</th>
              <th>Danh mục</th>
              <th>Thời gian</th>
              <th>Độ khó</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${recipes.map((recipe) => `
              <tr>
                <td>
                  <div class="recipe-name-cell">
                    <img src="${escapeHtml(resolveMediaUrl(recipe.image_url, DEFAULT_RECIPE_IMAGE))}" alt="">
                    <div>
                      <strong>${escapeHtml(recipe.title)}</strong>
                      <span>${escapeHtml(recipe.description || "Chưa có mô tả")}</span>
                    </div>
                  </div>
                </td>
                <td><span class="recipe-category">${escapeHtml(recipe.recipe_category_name || "Chưa phân loại")}</span></td>
                <td>${escapeHtml(String(recipe.prep_time_minutes || 0))} phút</td>
                <td>${difficultyDot(recipe.difficulty)}</td>
                <td>${statusBadge(recipe.status)}</td>
                <td>
                  <div class="recipe-actions">
                    <button type="button" data-recipe-action="edit" data-id="${escapeHtml(recipe.id)}">Sửa</button>
                    <button type="button" data-recipe-action="delete" data-id="${escapeHtml(recipe.id)}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join("") || '<tr><td colspan="6">Chưa có công thức phù hợp.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
}

function renderRecipeCategoryWorkspace() {
    const categories = getVisibleRecipeCategories();
    const allCategories = loadRecipeCategories();
    const activeCount = allCategories.filter((category) => category.is_active !== false).length;
    const totalTagged = loadRecipes().length;
    const popular = [...allCategories].sort((left, right) => getRecipeCountByCategory(right) - getRecipeCountByCategory(left))[0];

    if (elements.recipesPanelTitle) elements.recipesPanelTitle.textContent = "Quản lý danh mục công thức";
    if (elements.recipesPanelDescription) elements.recipesPanelDescription.textContent = "Phân loại công thức nấu ăn theo nhóm món, mùa vụ và nhu cầu sử dụng.";
    if (elements.openRecipeModalButton) elements.openRecipeModalButton.textContent = "+ Thêm danh mục mới";
    if (elements.recipeSearchInput) {
        elements.recipeSearchInput.value = state.recipeCategoryFilters?.keyword || "";
        elements.recipeSearchInput.placeholder = "Tìm kiếm danh mục...";
    }
    if (elements.recipeCategoryFilter) elements.recipeCategoryFilter.innerHTML = '<option value="all">Tất cả trạng thái</option>';
    if (elements.recipesMeta) elements.recipesMeta.textContent = `${categories.length} danh mục`;

    if (elements.recipeCategorySummary) {
        elements.recipeCategorySummary.classList.remove("hidden");
        elements.recipeCategorySummary.innerHTML = `
          <article class="recipe-category-stat">
            <span>Tổng danh mục</span>
            <strong>${allCategories.length}</strong>
            <small>đang quản lý</small>
          </article>
          <article class="recipe-category-stat">
            <span>Đang hoạt động</span>
            <strong>${activeCount}</strong>
            <small>${allCategories.length ? Math.round((activeCount / allCategories.length) * 100) : 0}%</small>
          </article>
          <article class="recipe-category-stat">
            <span>Công thức gắn mác</span>
            <strong>${totalTagged}</strong>
            <small>công thức</small>
          </article>
          <article class="recipe-category-stat accent">
            <span>Phổ biến nhất</span>
            <strong>${escapeHtml(popular?.name || "Chưa có")}</strong>
          </article>
        `;
    }

    elements.recipesContent.innerHTML = `
      <div class="recipes-table-scroll">
        <table class="recipes-table recipe-category-table">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Số công thức</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map((category) => `
              <tr>
                <td><img class="recipe-category-icon" src="${escapeHtml(resolveMediaUrl(category.image_url, DEFAULT_RECIPE_IMAGE))}" alt=""></td>
                <td>
                  <strong>${escapeHtml(category.name)}</strong>
                  <div class="section-copy">ID: ${escapeHtml(category.id)}</div>
                </td>
                <td>${escapeHtml(category.description || "Chưa có mô tả")}</td>
                <td><span class="recipe-category-count">${Number(category.recipe_count || getRecipeCountByCategory(category))}</span></td>
                <td><span class="recipe-status ${category.is_active === false ? "draft" : "published"}">${category.is_active === false ? "Tạm ẩn" : "Đang hoạt động"}</span></td>
                <td>
                  <div class="recipe-actions">
                    <button type="button" data-recipe-action="edit-category" data-id="${escapeHtml(category.id)}">Sửa</button>
                    <button type="button" data-recipe-action="delete-category" data-id="${escapeHtml(category.id)}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join("") || '<tr><td colspan="6">Chưa có danh mục phù hợp.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
}

export async function renderRecipes(force = false) {
    try {
        if ((!state.recipesHydrated || !state.recipeCategoriesHydrated || force) && elements.recipesContent) {
            renderRecipeLoading();
        }
        await hydrateRecipeData(force);
        if (state.recipeWorkspace === "categories") {
            renderRecipeCategoryWorkspace();
            return;
        }
        renderRecipeListWorkspace();
    } catch (error) {
        if (elements.recipesContent) {
            elements.recipesContent.innerHTML = `<div class="recipes-empty">Không tải được dữ liệu công thức: ${escapeHtml(error.message || "Lỗi không xác định")}</div>`;
        }
        showToast(error.message || "Không tải được dữ liệu công thức.", true);
    }
}

export async function openRecipeModal(recipeId = "") {
    await hydrateRecipeCategories();
    const recipe = recipeId ? await fetchRecipeDetail(recipeId) : null;
    state.recipeEditingId = recipe?.id || "";
    state.recipeImageDataUrl = recipe?.image_url || "";
    elements.recipeForm.reset();
    elements.recipeForm.elements.id.value = recipe?.id || "";
    elements.recipeModalTitle.textContent = recipe ? "Chỉnh sửa công thức" : "Thêm công thức mới";
    syncRecipeCategoryControls(recipe?.recipe_category_id || "");
    elements.recipeForm.elements.title.value = recipe?.title || "";
    elements.recipeForm.elements.category.value = recipe?.recipe_category_id || loadRecipeCategories().find((category) => category.is_active !== false)?.id || "";
    elements.recipeForm.elements.prep_time.value = recipe?.prep_time_minutes || 30;
    elements.recipeForm.elements.description.value = recipe?.description || "";
    elements.recipeForm.elements.difficulty.value = normalizeDifficulty(recipe?.difficulty || "easy");
    elements.recipeForm.elements.status.value = recipe?.status || "published";
    elements.recipeForm.elements.image_url.value = recipe?.image_url || "";
    elements.recipeImagePreview.src = resolveMediaUrl(recipe?.image_url, DEFAULT_RECIPE_IMAGE);
    renderRecipeFormLists(recipe || {});
    elements.recipeModal.classList.remove("hidden");
}

export function closeRecipeModal() {
    elements.recipeModal?.classList.add("hidden");
    state.recipeEditingId = "";
    state.recipeImageDataUrl = "";
}

export async function openRecipeCategoryModal(categoryId = "") {
    await hydrateRecipeCategories();
    const category = categoryId ? getRecipeCategoryById(categoryId) : null;
    state.recipeCategoryEditingId = category?.id || "";
    state.recipeCategoryImageDataUrl = category?.image_url || "";
    elements.recipeCategoryForm.reset();
    elements.recipeCategoryForm.elements.id.value = category?.id || "";
    elements.recipeCategoryModalTitle.textContent = category ? "Chỉnh sửa danh mục công thức" : "Thêm danh mục công thức";
    elements.recipeCategoryForm.elements.name.value = category?.name || "";
    elements.recipeCategoryForm.elements.description.value = category?.description || "";
    elements.recipeCategoryForm.elements.icon.value = category?.color_hex || "";
    elements.recipeCategoryForm.elements.image_url.value = category?.image_url || "";
    elements.recipeCategoryForm.elements.is_active.checked = category?.is_active !== false;
    elements.recipeCategoryImagePreview.src = resolveMediaUrl(category?.image_url, DEFAULT_CATEGORY_IMAGE);
    elements.recipeCategoryModal.classList.remove("hidden");
}

export function closeRecipeCategoryModal() {
    elements.recipeCategoryModal?.classList.add("hidden");
    state.recipeCategoryEditingId = "";
    state.recipeCategoryImageDataUrl = "";
}

export async function submitRecipeForm() {
    try {
        const payload = collectRecipeForm();
        if (!payload.title) {
            showToast("Vui lòng nhập tên công thức.", true);
            return;
        }
        if (!payload.recipe_category_id) {
            showToast("Vui lòng chọn danh mục công thức.", true);
            return;
        }
        if (!payload.ingredients.length) {
            showToast("Vui lòng thêm ít nhất một nguyên liệu.", true);
            return;
        }
        if (!payload.steps.length) {
            showToast("Vui lòng thêm ít nhất một bước thực hiện.", true);
            return;
        }

        const isEditing = Boolean(state.recipeEditingId);
        await apiFetch(isEditing ? `/api/recipes/${state.recipeEditingId}` : "/api/recipes", {
            method: isEditing ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });
        closeRecipeModal();
        await renderRecipes(true);
        showToast(isEditing ? "Đã cập nhật công thức." : "Đã thêm công thức mới.");
    } catch (error) {
        showToast(error.message || "Không lưu được công thức.", true);
    }
}

export async function submitRecipeCategoryForm() {
    try {
        const payload = collectRecipeCategoryForm();
        if (!payload.name) {
            showToast("Vui lòng nhập tên danh mục.", true);
            return;
        }
        const isEditing = Boolean(state.recipeCategoryEditingId);
        await apiFetch(isEditing ? `/api/recipe-categories/${state.recipeCategoryEditingId}` : "/api/recipe-categories", {
            method: isEditing ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });
        closeRecipeCategoryModal();
        await renderRecipes(true);
        showToast(isEditing ? "Đã cập nhật danh mục." : "Đã thêm danh mục công thức.");
    } catch (error) {
        showToast(error.message || "Không lưu được danh mục.", true);
    }
}

export function handleRecipeAction(event) {
    const button = event.target.closest("[data-recipe-action]");
    if (!button) return false;
    const action = button.dataset.recipeAction;
    if (action === "edit") {
        openRecipeModal(button.dataset.id);
        return true;
    }
    if (action === "delete") {
        if (!window.confirm("Bạn chắc chắn muốn xóa công thức này?")) return true;
        apiFetch(`/api/recipes/${button.dataset.id}`, { method: "DELETE" })
            .then(() => renderRecipes(true))
            .then(() => showToast("Đã xóa công thức."))
            .catch((error) => showToast(error.message || "Không xóa được công thức.", true));
        return true;
    }
    if (action === "edit-category") {
        openRecipeCategoryModal(button.dataset.id);
        return true;
    }
    if (action === "delete-category") {
        const category = getRecipeCategoryById(button.dataset.id);
        if (!category) return true;
        if (Number(category.recipe_count || getRecipeCountByCategory(category)) > 0) {
            showToast("Danh mục đang có công thức, không thể xóa.", true);
            return true;
        }
        if (!window.confirm("Bạn chắc chắn muốn xóa danh mục này?")) return true;
        apiFetch(`/api/recipe-categories/${button.dataset.id}`, { method: "DELETE" })
            .then(() => renderRecipes(true))
            .then(() => showToast("Đã xóa danh mục."))
            .catch((error) => showToast(error.message || "Không xóa được danh mục.", true));
        return true;
    }
    if (action === "add-ingredient") {
        elements.recipeIngredients.insertAdjacentHTML("beforeend", renderIngredientRow());
        return true;
    }
    if (action === "remove-ingredient") {
        button.closest("[data-recipe-ingredient-row]")?.remove();
        if (!elements.recipeIngredients.querySelector("[data-recipe-ingredient-row]")) {
            elements.recipeIngredients.insertAdjacentHTML("beforeend", renderIngredientRow());
        }
        return true;
    }
    if (action === "add-step") {
        elements.recipeSteps.insertAdjacentHTML("beforeend", renderStepRow({}, elements.recipeSteps.querySelectorAll("[data-recipe-step-row]").length));
        return true;
    }
    if (action === "remove-step") {
        button.closest("[data-recipe-step-row]")?.remove();
        if (!elements.recipeSteps.querySelector("[data-recipe-step-row]")) {
            elements.recipeSteps.insertAdjacentHTML("beforeend", renderStepRow({}, 0));
        }
        Array.from(elements.recipeSteps.querySelectorAll(".recipe-step-number")).forEach((item, index) => {
            item.textContent = String(index + 1);
        });
        return true;
    }
    return false;
}

export async function handleRecipeStepImageChange(event) {
    const input = event.target.closest("[data-recipe-step-image-file]");
    if (!input) return false;

    const file = input.files?.[0];
    if (!file) return true;

    try {
        const row = input.closest("[data-recipe-step-row]");
        const urlInput = row?.querySelector("[data-recipe-step-image-url]");
        showToast("Đang tải ảnh bước thực hiện...");
        const uploadedUrl = await uploadRecipeImage(file, "recipe-steps");
        if (urlInput) urlInput.value = uploadedUrl;

        const preview = row?.querySelector(".recipe-step-image-row img");
        if (preview) {
            preview.src = resolveMediaUrl(uploadedUrl, "");
        } else {
            row?.querySelector(".recipe-step-image-row")?.insertAdjacentHTML("beforeend", `<img src="${escapeHtml(resolveMediaUrl(uploadedUrl, ""))}" alt="">`);
        }
        showToast("Đã tải ảnh bước thực hiện.");
    } catch (error) {
        input.value = "";
        showToast(error.message || "Không tải được ảnh bước thực hiện.", true);
    }

    return true;
}

function renderIngredientSuggestions(row, keyword) {
    const suggestions = row?.querySelector(".recipe-ingredient-suggestions");
    if (!suggestions) return;

    const normalizedKeyword = String(keyword || "").trim().toLowerCase();
    const matches = normalizedKeyword
        ? (state.products || []).filter((product) => [
            product.name,
            product.sku,
            product.slug,
            product.category_name
        ].some((value) => String(value || "").toLowerCase().includes(normalizedKeyword))).slice(0, 8)
        : [];

    if (!matches.length) {
        suggestions.classList.add("hidden");
        suggestions.innerHTML = "";
        return;
    }

    suggestions.classList.remove("hidden");
    suggestions.innerHTML = matches.map((product) => `
      <button type="button" data-recipe-ingredient-product-id="${escapeHtml(product.id)}" data-recipe-ingredient-product-name="${escapeHtml(product.name || "")}">
        <strong>${escapeHtml(product.name || "")}</strong>
        <span>${escapeHtml(product.sku || product.category_name || "Sản phẩm trong kho")}</span>
      </button>
    `).join("");
}

export function handleRecipeIngredientSearch(event) {
    const input = event.target.closest("[data-recipe-ingredient='name']");
    if (!input) return false;

    const row = input.closest("[data-recipe-ingredient-row]");
    const productIdInput = row?.querySelector("[data-recipe-ingredient='product_id']");
    if (productIdInput) productIdInput.value = "";
    renderIngredientSuggestions(row, input.value);
    return true;
}

export function handleRecipeIngredientPick(event) {
    const button = event.target.closest("[data-recipe-ingredient-product-id]");
    if (!button) return false;

    const row = button.closest("[data-recipe-ingredient-row]");
    const nameInput = row?.querySelector("[data-recipe-ingredient='name']");
    const productIdInput = row?.querySelector("[data-recipe-ingredient='product_id']");
    const suggestions = row?.querySelector(".recipe-ingredient-suggestions");

    if (nameInput) nameInput.value = button.dataset.recipeIngredientProductName || "";
    if (productIdInput) productIdInput.value = button.dataset.recipeIngredientProductId || "";
    suggestions?.classList.add("hidden");
    suggestions.innerHTML = "";
    return true;
}

export function handleRecipeFilterInput(event) {
    if (event.target === elements.recipeSearchInput) {
        if (state.recipeWorkspace === "categories") {
            state.recipeCategoryFilters.keyword = event.target.value || "";
        } else {
            state.recipeFilters.keyword = event.target.value || "";
        }
        renderRecipes();
        elements.recipeSearchInput?.focus();
        const length = event.target.value.length;
        elements.recipeSearchInput?.setSelectionRange(length, length);
        return true;
    }
    if (event.target === elements.recipeCategoryFilter && state.recipeWorkspace !== "categories") {
        state.recipeFilters.category = event.target.value || "all";
        renderRecipes();
        return true;
    }
    return false;
}

export function bindRecipeMediaEvents() {
    elements.recipeImageFile?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            showToast("Đang tải ảnh công thức lên hệ thống...");
            const uploadedUrl = await uploadRecipeImage(file, "recipes");
            state.recipeImageDataUrl = uploadedUrl;
            elements.recipeImageUrl.value = uploadedUrl;
            elements.recipeImagePreview.src = resolveMediaUrl(uploadedUrl, DEFAULT_RECIPE_IMAGE);
            showToast("Đã tải ảnh công thức.");
        } catch (error) {
            event.target.value = "";
            showToast(error.message || "Không tải được ảnh công thức.", true);
        }
    });

    elements.recipeImageUrl?.addEventListener("input", (event) => {
        state.recipeImageDataUrl = event.target.value || "";
        elements.recipeImagePreview.src = resolveMediaUrl(state.recipeImageDataUrl, DEFAULT_RECIPE_IMAGE);
    });

    elements.recipeCategoryImageFile?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            showToast("Đang tải ảnh danh mục lên hệ thống...");
            const uploadedUrl = await uploadRecipeImage(file, "recipe-categories");
            state.recipeCategoryImageDataUrl = uploadedUrl;
            elements.recipeCategoryImageUrl.value = uploadedUrl;
            elements.recipeCategoryImagePreview.src = resolveMediaUrl(uploadedUrl, DEFAULT_CATEGORY_IMAGE);
            showToast("Đã tải ảnh danh mục.");
        } catch (error) {
            event.target.value = "";
            showToast(error.message || "Không tải được ảnh danh mục.", true);
        }
    });

    elements.recipeCategoryImageUrl?.addEventListener("input", (event) => {
        state.recipeCategoryImageDataUrl = event.target.value || "";
        elements.recipeCategoryImagePreview.src = resolveMediaUrl(state.recipeCategoryImageDataUrl, DEFAULT_CATEGORY_IMAGE);
    });
}
