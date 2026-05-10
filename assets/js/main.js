import {
    apiFetch,
    collectFormData,
    elements,
    normalizeApiBase,
    restoreSession,
    showToast,
    state
} from "./core.js";
import {
    jumpToView,
    login,
    logout,
    registerAccount,
    renderSidebarMenu,
    selectSidebarItem,
    setActivePanel,
    setAuthMode,
    toggleSidebarSection,
    updateSessionUi
} from "./auth-nav.js";
import { exportOverviewReport, renderOverview } from "./overview.js";
import {
    bindProductMediaEvents,
    buildInventoryImportPayload,
    buildProductPayload,
    closePublishEditor,
    handleProductAction,
    renderProducts,
    resetProductForm,
    resetProductImportForm,
    submitPublishEditor,
    updateProductWorkspace
} from "./products.js";
import {
    bindCategoryMediaEvents,
    buildCategoryPayload,
    closeCategoryModal,
    handleCategoryAction,
    openCategoryModal,
    resetCategoryForm
} from "./categories.js";
import { handleOrderAction } from "./orders.js";
import {
    bootstrapAdmin,
    loadCategories,
    loadOrders,
    loadOverview,
    loadProducts,
    withLoading
} from "./data.js";

function bindGlobalEvents() {
    elements.loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await withLoading(event.submitter, async () => {
            const formData = collectFormData(elements.loginForm);
            state.apiBase = normalizeApiBase(formData.apiBase || state.apiBase || "http://localhost:3000");

            if (!state.apiBase) {
                throw new Error("Vui lòng nhập API base URL.");
            }

            if (state.authMode === "register") {
                if (!String(formData.username || "").trim()) {
                    throw new Error("Vui lòng nhập tên hiển thị.");
                }

                if (String(formData.password || "").length < 6) {
                    throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
                }

                if (String(formData.password || "") !== String(formData.confirm_password || "")) {
                    throw new Error("Mật khẩu xác nhận không khớp.");
                }

                await registerAccount(
                    String(formData.username || "").trim(),
                    String(formData.email || "").trim(),
                    String(formData.password || "")
                );
                setAuthMode("login");
                elements.passwordInput.value = "";
                elements.confirmPasswordInput.value = "";
                showToast("Đăng ký thành công. Hãy đăng nhập để tiếp tục.");
                return;
            }

            await login(formData.email, formData.password);
            selectSidebarItem("overview-home");
            await bootstrapAdmin();
            showToast("Đăng nhập thành công.");
        });
    });

    elements.authTabs.forEach((tab) => {
        tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
    });

    document.addEventListener("click", (event) => {
        const footerSwitch = event.target.closest("#authFooterSwitch");
        if (footerSwitch) {
            setAuthMode(state.authMode === "login" ? "register" : "login");
            return;
        }

        const passwordToggle = event.target.closest("[data-password-toggle]");
        if (passwordToggle) {
            const input = document.querySelector(`#${passwordToggle.dataset.passwordToggle}`);
            if (!input) return;
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            passwordToggle.textContent = isPassword ? "🙈" : "👁";
        }
    });

    elements.forgotPasswordButton.addEventListener("click", async () => {
        const email = String(elements.emailInput?.value || "").trim();
        if (!email) {
            showToast("Nhập email trước khi yêu cầu quên mật khẩu.", true);
            return;
        }

        await withLoading(elements.forgotPasswordButton, async () => {
            await apiFetch("/api/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email })
            });
            showToast("Nếu email tồn tại, hệ thống sẽ gửi mật khẩu tạm thời.");
        });
    });

    elements.logoutButton.addEventListener("click", async () => {
        try {
            if (state.refreshToken) {
                await apiFetch("/api/auth/logout", {
                    method: "POST",
                    body: JSON.stringify({ refresh_token: state.refreshToken })
                });
            }
        } catch (_error) {
            // local logout is enough
        } finally {
            logout(true);
        }
    });

    elements.navCard.addEventListener("click", (event) => {
        const sectionTrigger = event.target.closest("[data-section-toggle]");
        if (sectionTrigger) {
            toggleSidebarSection(sectionTrigger.dataset.sectionToggle);
            return;
        }

        const itemTrigger = event.target.closest("[data-nav-item]");
        if (itemTrigger) {
            selectSidebarItem(itemTrigger.dataset.navItem);
        }
    });

    elements.refreshProductsButton.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadProducts(), loadOverview()]);
    }));
    elements.refreshCategoriesButton.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadCategories(), loadProducts(), loadOverview()]);
    }));
    elements.refreshOrdersButton.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadOrders(), loadOverview()]);
    }));

    elements.overviewContent.addEventListener("click", (event) => {
        const rangeButton = event.target.closest("[data-overview-range]");
        if (rangeButton) {
            state.overviewRangeDays = Number(rangeButton.dataset.overviewRange);
            renderOverview();
            return;
        }

        const exportButton = event.target.closest("[data-export-overview]");
        if (exportButton) {
            exportOverviewReport();
            showToast("Đã xuất báo cáo CSV.");
            return;
        }

        const jumpButton = event.target.closest("[data-view-jump]");
        if (jumpButton) {
            jumpToView(jumpButton.dataset.viewJump);
        }
    });

    elements.overviewContent.addEventListener("input", (event) => {
        if (event.target.id !== "overviewOrderSearch") return;
        state.overviewSearch = event.target.value || "";
        renderOverview();
        const nextInput = elements.overviewContent.querySelector("#overviewOrderSearch");
        if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(state.overviewSearch.length, state.overviewSearch.length);
        }
    });

    elements.productFilterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.filters.products = collectFormData(elements.productFilterForm);
        await withLoading(event.submitter, loadProducts);
    });

    elements.productForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.productForm);
        const payload = buildProductPayload(raw);
        const isEditing = Boolean(raw.id);

        await withLoading(event.submitter, async () => {
            await apiFetch(isEditing ? `/api/products/${raw.id}` : "/api/products", {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify(payload)
            });
            resetProductForm();
            await Promise.all([loadProducts(), loadOverview()]);
            showToast(isEditing ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm.");
        });
    });

    if (elements.productImportForm) {
        elements.productImportForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const raw = collectFormData(elements.productImportForm);
            const payload = buildInventoryImportPayload(raw);

            if (!payload.category_id || !payload.name) {
                showToast("Vui lòng nhập tên sản phẩm và danh mục.", true);
                return;
            }

            await withLoading(event.submitter, async () => {
                await apiFetch("/api/products", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                resetProductImportForm();
                await Promise.all([loadProducts(), loadOverview()]);
                showToast("Đã lưu sản phẩm mới.");
            });
        }, true);
    }

    elements.resetProductFormButton.addEventListener("click", resetProductForm);

    if (elements.resetProductImportButton) {
        elements.resetProductImportButton.addEventListener("click", resetProductImportForm);
    }

    if (elements.publishEditorForm) {
        elements.publishEditorForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const raw = collectFormData(elements.publishEditorForm);
            await withLoading(event.submitter, async () => {
                await submitPublishEditor(raw);
            });
        });
    }

    elements.closePublishEditorButton?.addEventListener("click", closePublishEditor);
    elements.publishEditorCancelButton?.addEventListener("click", closePublishEditor);
    elements.publishEditorModal?.addEventListener("click", (event) => {
        if (event.target === elements.publishEditorModal) {
            closePublishEditor();
        }
    });

    elements.productsContent.addEventListener("click", async (event) => {
        const zoneButton = event.target.closest("[data-inventory-zone]");
        if (zoneButton) {
            state.inventoryZone = zoneButton.dataset.inventoryZone;
            renderProducts();
            return;
        }

        const publishFilterButton = event.target.closest("[data-publish-filter]");
        if (publishFilterButton) {
            state.publishStatusFilter = publishFilterButton.dataset.publishFilter || "all";
            renderProducts();
            return;
        }

        const publishZoneButton = event.target.closest("[data-publish-zone]");
        if (publishZoneButton) {
            state.publishZoneFilter = publishZoneButton.dataset.publishZone || "all";
            renderProducts();
            return;
        }

        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleProductAction(button.dataset.action, button.dataset.id));
    });

    elements.productsContent.addEventListener("input", (event) => {
        if (event.target.id !== "inventorySearchInput") return;

        state.inventorySearch = event.target.value || "";
        renderProducts();
        const nextInput = elements.productsContent.querySelector("#inventorySearchInput");
        if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(state.inventorySearch.length, state.inventorySearch.length);
        }
    });

    elements.categoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.categoryForm);
        const payload = buildCategoryPayload(raw);
        const isEditing = Boolean(raw.id);

        await withLoading(event.submitter, async () => {
            await apiFetch(isEditing ? `/api/categories/${raw.id}` : "/api/categories", {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify(payload)
            });
            resetCategoryForm();
            closeCategoryModal();
            await Promise.all([loadCategories(), loadProducts(), loadOverview()]);
            showToast(isEditing ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
        });
    });

    elements.openCategoryModalButton.addEventListener("click", () => {
        resetCategoryForm();
        openCategoryModal();
    });
    elements.closeCategoryModalButton.addEventListener("click", closeCategoryModal);
    elements.categoryModal.addEventListener("click", (event) => {
        if (event.target === elements.categoryModal) {
            closeCategoryModal();
        }
    });

    elements.categoriesContent.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleCategoryAction(button.dataset.action, button.dataset.id));
    });

    elements.orderFilterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.filters.orders = collectFormData(elements.orderFilterForm);
        await withLoading(event.submitter, loadOrders);
    });

    elements.ordersContent.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleOrderAction(button));
    });
}

async function initialize() {
    restoreSession();
    renderSidebarMenu();
    setAuthMode("login");
    updateSessionUi();
    updateProductWorkspace();
    resetProductForm();
    resetProductImportForm();
    resetCategoryForm();
    bindProductMediaEvents();
    bindCategoryMediaEvents();
    bindGlobalEvents();

    if (!state.token || !state.user) {
        setActivePanel("login");
        return;
    }

    try {
        selectSidebarItem("overview-home");
        await bootstrapAdmin();
        showToast("Đã khôi phục phiên đăng nhập.");
    } catch (error) {
        logout(false);
        showToast(`Phiên đăng nhập hết hạn: ${error.message}`, true);
    }
}

initialize();
