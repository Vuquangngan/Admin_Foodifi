import {
    apiFetch,
    bindMoneyInputFormatting,
    collectFormData,
    elements,
    bindImageFallbacks,
    normalizeApiBase,
    refreshStoredSession,
    restoreSession,
    saveSession,
    showToast,
    state,
    uploadImageFile
} from "./core.js";
import {
    jumpToView,
    login,
    logout,
    registerAccount,
    renderSidebarMenu,
    selectSidebarItem,
    setActivePanel,
    setAdminPageTitle,
    setAuthMode,
    toggleSidebarSection,
    updateSessionUi
} from "./auth-nav.js";
import { exportOverviewReport, renderOverview } from "./overview.js";
import {
    bindProductMediaEvents,
    buildInventoryImportPayload,
    buildInventoryRestockPayload,
    buildProductPayload,
    closeProductEditor,
    closePublishEditor,
    handleLowStockFilterChange,
    handleProductAction,
    prepareProductImageUpload,
    resetProductEditorForm,
    renderProducts,
    resetProductForm,
    resetProductImportForm,
    adjustWarehouseCapacity,
    closeWarehouseCapacityEditor,
    downloadProductImportTemplate,
    handleProductImportExcelFile,
    openWarehouseCapacityEditor,
    prepareProductImportFromLowStock,
    recordProductImportSupplier,
    setWarehouseCapacity,
    syncProductEditorPreview,
    submitProductImportExcel,
    submitProductEditor,
    submitPublishEditor,
    updateProductWorkspace
} from "./products.js";
import {
    bindRecipeMediaEvents,
    closeRecipeCategoryModal,
    closeRecipeModal,
    handleRecipeAction,
    handleRecipeFilterInput,
    handleRecipeIngredientPick,
    handleRecipeIngredientSearch,
    handleRecipeStepImageChange,
    openRecipeCategoryModal,
    openRecipeModal,
    renderRecipes,
    submitRecipeCategoryForm,
    submitRecipeForm
} from "./recipes.js";
import {
    bindCategoryMediaEvents,
    buildCategoryPayload,
    closeCategoryModal,
    handleCategoryAction,
    openCategoryModal,
    renderCategories,
    resetCategoryForm
} from "./categories.js";
import {
    closeComplaintDetail,
    closeOrderDetail,
    exportCurrentOrderInvoice,
    handleCreateOrderBuilderAction,
    handleCreateOrderBuilderInput,
    handleOrderProductPickerInput,
    handleOrderAction,
    handleOrderBranchSelection,
    printCurrentOrderInvoice,
    renderOrders,
    resetCreateOrderDraft,
    submitCreateOrder,
    setOrderQuickFilter
} from "./orders.js";
import {
    handleChatAction,
    handleChatInput,
    submitChatComposer
} from "./chats.js";
import {
    closeBranchModal,
    handleBranchImportClick,
    handleBranchImportInput,
    handleBranchImage,
    handleBranchAction,
    openBranchModal,
    renderBranches,
    submitBranchShipmentCreateForm,
    submitBranchForm
} from "./branches.js";
import {
    bindSupplierMediaEvents,
    closeSupplierForm,
    handleSupplierAction,
    openSupplierForm,
    renderSuppliers,
    resetSupplierForm,
    submitSupplierForm
} from "./suppliers.js";
import {
    autoGenerateVoucherCode,
    closeVoucherForm,
    handleVoucherAction,
    loadVouchers,
    openVoucherForm,
    resetVoucherForm,
    setVoucherApplyScope,
    setVoucherSaveMode,
    submitVoucherForm,
    addVoucherAppliedProduct,
    removeVoucherAppliedProduct,
    handlePromotionAction,
    resetPromotionForm,
    submitPromotionForm,
    syncVoucherPreview,
    syncPromotionPreview
} from "./vouchers.js";
import {
    bindUserMediaEvents,
    closeCustomerProfile,
    closeUserForm,
    handleUserAction,
    openUserForm,
    resetUserForm,
    submitUserForm
} from "./users.js";
import { bindProfileEvents, renderProfile } from "./profile.js";
import {
    handleStaffShiftAction,
    handleStaffShiftFieldChange,
    renderStaffShiftWorkspace
} from "./staff-shifts.js";
import { handleStatsFilterSubmit, renderStats } from "./stats.js?v=20260616-stats-fix";
import {
    handleEmailMarketingAction,
    handleEmailMarketingFile,
    handleEmailMarketingInput
} from "./email-marketing.js";
import {
    clearActivityWarningNote,
    closeActivityWarningModal,
    exportActivityHistoryExcel,
    handleActivityFilterInput,
    handleActivityHistoryClick,
    submitActivityWarningForm
} from "./activity-history.js";
import { bindSettingsEvents } from "./settings.js";
import {
    bootstrapAdmin,
    loadCategories,
    loadCoupons,
    loadCustomers,
    loadOrders,
    loadOverview,
    loadProducts,
    loadSuppliers,
    loadUsers,
    withLoading
} from "./data.js";

let complaintFilterRenderTimer = null;

function handleStatsFilterEvent(event) {
    const form = event.target.closest?.("[data-stats-filter-form]");
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    handleStatsFilterSubmit(form);
}

async function performLogout() {
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
}

function bindGlobalEvents() {
    bindMoneyInputFormatting(document);

    document.addEventListener("submit", handleStatsFilterEvent, true);
    document.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-stats-filter-apply]");
        if (!button) return;
        const form = button.closest("[data-stats-filter-form]");
        if (!form) return;
        event.preventDefault();
        event.stopPropagation();
        handleStatsFilterSubmit(form);
    }, true);

    let isAuthSubmitting = false;

    function showAuthInlineMessage(message, isError = true) {
        if (!elements.authSubtitle) {
            showToast(message, isError);
            return;
        }

        elements.authSubtitle.textContent = message || "";
        elements.authSubtitle.classList.toggle("hidden", !message);
        elements.authSubtitle.classList.toggle("auth-error-message", isError);
    }

    async function submitAuthForm(submitter = null) {
        if (isAuthSubmitting) return;

        isAuthSubmitting = true;
        const originalText = submitter?.textContent || "";
        if (submitter) {
            submitter.disabled = true;
            submitter.textContent = "Đang xử lý...";
        }

        try {
            showAuthInlineMessage("", false);
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
            updateSessionUi();
            setAdminPageTitle("Tổng quan");
            setActivePanel("overview");
            renderSidebarMenu();
            renderOverview();
            selectSidebarItem("overview-home");
            const hasLoadedData = await bootstrapAdmin();
            if (!hasLoadedData) {
                showToast("Đăng nhập thành công, nhưng một số dữ liệu chưa tải được.", true);
                return;
            }
            showToast("Đăng nhập thành công.");
        } catch (error) {
            const message = error?.message || "Không đăng nhập được. Vui lòng thử lại.";
            showAuthInlineMessage(message, true);
            showToast(message, true);
        } finally {
            isAuthSubmitting = false;
            if (submitter) {
                submitter.disabled = false;
                submitter.textContent = originalText;
            }
        }
    }

    elements.loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitAuthForm(event.submitter || elements.authSubmitButton);
    });

    elements.authSubmitButton?.addEventListener("click", async (event) => {
        event.preventDefault();
        await submitAuthForm(event.currentTarget);
    });

    elements.authTabs?.forEach((tab) => {
        tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
    });

    document.addEventListener("click", (event) => {
        const topbarMenuButton = event.target.closest("#adminTopbarMenuButton");
        if (topbarMenuButton) {
            elements.appShell?.classList.toggle("sidebar-collapsed");
            return;
        }

        const accountTrigger = event.target.closest("#adminAccountTrigger");
        if (accountTrigger) {
            const isOpen = elements.adminAccountDropdown?.classList.toggle("hidden") === false;
            accountTrigger.setAttribute("aria-expanded", String(isOpen));
            return;
        }

        const accountAction = event.target.closest("[data-admin-account-action]");
        if (accountAction) {
            elements.adminAccountDropdown?.classList.add("hidden");
            elements.adminAccountTrigger?.setAttribute("aria-expanded", "false");
            if (accountAction.dataset.adminAccountAction === "profile") {
                state.sidebarSection = "";
                state.sidebarItem = "";
                renderSidebarMenu();
                deactivateChatsPanel();
                setAdminPageTitle("Thông tin cá nhân");
                setActivePanel("profile");
                renderProfile();
                return;
            }
            if (accountAction.dataset.adminAccountAction === "logout") {
                performLogout();
                return;
            }
        }

        if (!event.target.closest("#adminAccountMenu")) {
            elements.adminAccountDropdown?.classList.add("hidden");
            elements.adminAccountTrigger?.setAttribute("aria-expanded", "false");
        }

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
            });
            showToast("Nếu email tồn tại, hệ thống sẽ gửi mật khẩu tạm thời.");
        });
    });

    elements.logoutButton?.addEventListener("click", performLogout);

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
        if (state.productWorkspace === "import") {
            resetProductImportForm();
            showToast("Đã làm mới form nhập sản phẩm.");
            return;
        }

        await Promise.all([loadProducts(), loadOverview()]);
    }));
    elements.refreshCategoriesButton.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadCategories(), loadProducts(), loadOverview()]);
    }));
    elements.refreshSuppliersButton?.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadSuppliers(), loadProducts()]);
    }));
    elements.refreshVouchersButton?.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        await Promise.all([loadVouchers(), loadProducts()]);
    }));
    elements.refreshUsersButton?.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        if (state.userWorkspace === "shifts") {
            await loadUsers();
            return;
        }
        if (state.userWorkspace === "customers") {
            await loadCustomers();
            return;
        }
        await loadUsers();
    }));
    elements.refreshShiftsButton?.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        if (!state.usersHydrated) {
            await loadUsers();
        }
        renderStaffShiftWorkspace();
    }));
    elements.refreshOrdersButton?.addEventListener("click", (event) => withLoading(event.currentTarget, async () => {
        if (state.orderWorkspace === "create") {
            resetCreateOrderDraft();
            await Promise.all([loadCoupons(), loadProducts(), loadOrders(), loadOverview()]);
            return;
        }

        await Promise.all([loadOrders(), loadOverview()]);
    }));

    elements.activitySearchInput?.addEventListener("input", handleActivityFilterInput);
    elements.activityDateFrom?.addEventListener("change", handleActivityFilterInput);
    elements.activityDateTo?.addEventListener("change", handleActivityFilterInput);
    elements.activityRoleFilter?.addEventListener("change", handleActivityFilterInput);
    elements.activityActionTabs?.addEventListener("click", handleActivityHistoryClick);
    elements.activityHistoryContent?.addEventListener("click", handleActivityHistoryClick);
    elements.activityExportButton?.addEventListener("click", exportActivityHistoryExcel);
    elements.closeActivityWarningButton?.addEventListener("click", closeActivityWarningModal);
    elements.clearActivityWarningButton?.addEventListener("click", clearActivityWarningNote);
    elements.activityWarningModal?.addEventListener("click", (event) => {
        if (event.target === elements.activityWarningModal) closeActivityWarningModal();
    });
    elements.activityWarningForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        submitActivityWarningForm();
    });

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
        const filters = collectFormData(elements.productFilterForm);
        if (filters.inventory_zone) {
            state.inventoryZone = filters.inventory_zone;
            delete filters.inventory_zone;
        }
        state.filters.products = filters;
        await withLoading(event.submitter, loadProducts);
    });

    elements.openRecipeModalButton?.addEventListener("click", () => {
        if (state.recipeWorkspace === "categories") {
            openRecipeCategoryModal();
            return;
        }
        openRecipeModal();
    });
    elements.closeRecipeModalButton?.addEventListener("click", closeRecipeModal);
    elements.cancelRecipeButton?.addEventListener("click", closeRecipeModal);
    elements.closeRecipeCategoryModalButton?.addEventListener("click", closeRecipeCategoryModal);
    elements.cancelRecipeCategoryButton?.addEventListener("click", closeRecipeCategoryModal);
    elements.recipeModal?.addEventListener("click", (event) => {
        if (event.target === elements.recipeModal) {
            closeRecipeModal();
            return;
        }
        handleRecipeAction(event);
    });
    elements.recipeModal?.addEventListener("change", handleRecipeStepImageChange);
    elements.recipeModal?.addEventListener("input", handleRecipeIngredientSearch);
    elements.recipeModal?.addEventListener("click", handleRecipeIngredientPick);
    elements.recipeCategoryModal?.addEventListener("click", (event) => {
        if (event.target === elements.recipeCategoryModal) {
            closeRecipeCategoryModal();
        }
    });
    elements.recipeForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        submitRecipeForm();
    });
    elements.recipeCategoryForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        submitRecipeCategoryForm();
    });
    elements.recipesContent?.addEventListener("click", handleRecipeAction);
    elements.recipeSearchInput?.addEventListener("input", handleRecipeFilterInput);
    elements.recipeCategoryFilter?.addEventListener("change", handleRecipeFilterInput);

    elements.productFilterForm.addEventListener("change", (event) => {
        const parentCategorySelect = event.target.closest("[name='parent_category_id']");
        if (parentCategorySelect) {
            state.filters.products = {
                ...state.filters.products,
                parent_category_id: parentCategorySelect.value || "",
                category_id: ""
            };
            renderProducts();
            return;
        }

        const statusSelect = event.target.closest("[data-publish-status-select]");
        if (statusSelect) {
            state.publishStatusFilter = statusSelect.value || "all";
            updateProductWorkspace();
            renderProducts();
            return;
        }

        const zoneSelect = event.target.closest("[data-publish-zone-select]");
        if (zoneSelect) {
            state.publishZoneFilter = zoneSelect.value || "all";
            updateProductWorkspace();
            renderProducts();
            return;
        }

        const storeSelect = event.target.closest("[data-publish-store-select]");
        if (!storeSelect) return;
        state.publishStoreFilter = storeSelect.value || "store_1";
        updateProductWorkspace();
        renderProducts();
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
            const isRestocking = Boolean(raw.id);
            const payload = isRestocking ? buildInventoryRestockPayload(raw) : buildInventoryImportPayload(raw);

            if (!payload.category_id || !payload.name) {
                showToast("Vui lòng nhập tên sản phẩm và danh mục.", true);
                return;
            }

            await withLoading(event.submitter, async () => {
                const preparedRaw = await prepareProductImageUpload(raw, elements.productImportImageFile);
                const preparedPayload = isRestocking ? buildInventoryRestockPayload(preparedRaw) : buildInventoryImportPayload(preparedRaw);
                const savedProduct = await apiFetch(isRestocking ? `/api/products/${raw.id}` : "/api/products", {
                    method: isRestocking ? "PUT" : "POST",
                    body: JSON.stringify(preparedPayload)
                });
                recordProductImportSupplier(preparedRaw, savedProduct);
                resetProductImportForm();
                await Promise.all([loadProducts(), loadOverview()]);
                showToast(isRestocking ? "Đã nhập thêm hàng vào kho tổng." : "Đã lưu sản phẩm mới.");
            });
        }, true);
    }

    elements.resetProductFormButton.addEventListener("click", resetProductForm);
    elements.resetProductEditorButton?.addEventListener("click", resetProductEditorForm);

    if (elements.resetProductImportButton) {
        elements.resetProductImportButton.addEventListener("click", resetProductImportForm);
    }

    elements.productImportExcelFile?.addEventListener("change", async (event) => {
        try {
            await handleProductImportExcelFile(event.target.files?.[0]);
        } catch (error) {
            showToast(error.message || "Không đọc được file Excel.", true);
        }
    });

    elements.submitProductImportExcelButton?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = "Đang nhập...";
        try {
            await submitProductImportExcel();
        } catch (error) {
            showToast(error.message || "Không nhập được sản phẩm từ Excel.", true);
            button.disabled = false;
        } finally {
            button.textContent = original;
            if (!state.productImportExcelRows?.length) button.disabled = true;
        }
    });

    elements.downloadProductImportTemplateButton?.addEventListener("click", downloadProductImportTemplate);

    if (elements.productEditorForm) {
        elements.productEditorForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const raw = collectFormData(elements.productEditorForm);
            await withLoading(event.submitter, async () => {
                await submitProductEditor(raw);
            });
        });
        elements.productEditorForm.addEventListener("input", (event) => {
            const name = event.target.name;
            if (name === "name" || name === "sku" || name === "thumbnail_url") {
                syncProductEditorPreview();
            }
        });
    }

    elements.closeProductEditorButton?.addEventListener("click", closeProductEditor);
    elements.productEditorModal?.addEventListener("click", (event) => {
        if (event.target === elements.productEditorModal) {
            closeProductEditor();
        }
    });

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
        const capacityBackdrop = event.target.closest("[data-warehouse-capacity-backdrop]");
        if (capacityBackdrop && event.target === capacityBackdrop) {
            closeWarehouseCapacityEditor();
            return;
        }

        const zoneButton = event.target.closest("[data-inventory-zone]");
        if (zoneButton) {
            state.inventoryZone = zoneButton.dataset.inventoryZone;
            renderProducts();
            return;
        }

        const capacityButton = event.target.closest("[data-warehouse-capacity-action]");
        if (capacityButton) {
            const zoneKey = capacityButton.dataset.zone || state.inventoryZone;
            const action = capacityButton.dataset.warehouseCapacityAction;
            if (action === "open") {
                openWarehouseCapacityEditor(zoneKey);
                return;
            }
            if (action === "close") {
                closeWarehouseCapacityEditor();
                return;
            }
            if (action === "save") {
                const form = capacityButton.closest("[data-warehouse-capacity-form]");
                const input = form?.querySelector("[data-warehouse-capacity-input]");
                setWarehouseCapacity(form?.dataset.zone || zoneKey, input?.value);
                closeWarehouseCapacityEditor();
                return;
            }
            const delta = action === "increase" ? 1 : -1;
            adjustWarehouseCapacity(zoneKey, delta);
            return;
        }

        const capacityCard = event.target.closest(".warehouse-zone-card .warehouse-capacity");
        if (capacityCard) {
            openWarehouseCapacityEditor(state.inventoryZone);
            return;
        }

        const lowStockImportButton = event.target.closest("[data-low-stock-action='import']");
        if (lowStockImportButton) {
            selectSidebarItem("product-import");
            prepareProductImportFromLowStock(lowStockImportButton.dataset.productId);
            showToast("Đã chuyển dữ liệu sang form nhập sản phẩm.");
            return;
        }

        const lowStockFilterButton = event.target.closest("[data-low-stock-action='filter']");
        if (lowStockFilterButton) {
            renderProducts();
            return;
        }

        const publishFilterButton = event.target.closest("[data-publish-filter]");
        if (publishFilterButton) {
            state.publishStatusFilter = publishFilterButton.dataset.publishFilter || "all";
            updateProductWorkspace();
            renderProducts();
            return;
        }

        const publishZoneButton = event.target.closest("[data-publish-zone]");
        if (publishZoneButton) {
            state.publishZoneFilter = publishZoneButton.dataset.publishZone || "all";
            updateProductWorkspace();
            renderProducts();
            return;
        }

        const publishStoreButton = event.target.closest("[data-publish-store]");
        if (publishStoreButton) {
            state.publishStoreFilter = publishStoreButton.dataset.publishStore || "store_1";
            updateProductWorkspace();
            renderProducts();
            return;
        }

        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleProductAction(button.dataset.action, button.dataset.id, {
            storeKey: button.dataset.storeKey || ""
        }));
    });

    elements.productsContent.addEventListener("change", (event) => {
        if (handleLowStockFilterChange(event.target)) return;

        const capacityInput = event.target.closest("[data-warehouse-capacity-input]");
        if (!capacityInput) return;
        if (capacityInput.closest("[data-warehouse-capacity-form]")) return;
        setWarehouseCapacity(capacityInput.dataset.zone || state.inventoryZone, capacityInput.value);
    });

    elements.productsContent.addEventListener("input", (event) => {
        handleLowStockFilterChange(event.target);
    });

    elements.categoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.categoryForm);
        const isEditing = Boolean(raw.id);

        await withLoading(event.submitter, async () => {
            const file = elements.categoryImageFile?.files?.[0];
            if (file && (!raw.image_url || String(raw.image_url).startsWith("data:"))) {
                raw.image_url = await uploadImageFile(file, "categories");
            }
            const payload = buildCategoryPayload(raw);
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

    elements.categoriesSummary?.addEventListener("submit", (event) => {
        const form = event.target.closest("#categoryFilterForm");
        if (!form) return;
        event.preventDefault();
        state.filters.categories = collectFormData(form);
        renderCategories();
    });

    elements.categoriesContent.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleCategoryAction(button.dataset.action, button.dataset.id));
    });

    elements.supplierFilterForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.filters.suppliers = collectFormData(elements.supplierFilterForm);
        await withLoading(event.submitter, loadSuppliers);
    });

    elements.openSupplierFormButton?.addEventListener("click", () => {
        resetSupplierForm();
        openSupplierForm();
    });

    elements.cancelSupplierFormButton?.addEventListener("click", closeSupplierForm);
    elements.supplierFormCard?.addEventListener("click", (event) => {
        if (event.target === elements.supplierFormCard) {
            closeSupplierForm();
        }
    });

    elements.supplierForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.supplierForm);
        await withLoading(event.submitter, async () => {
            await submitSupplierForm(raw);
        });
    });

    elements.openBranchFormButton?.addEventListener("click", openBranchModal);
    elements.closeBranchModalButton?.addEventListener("click", closeBranchModal);
    elements.cancelBranchFormButton?.addEventListener("click", closeBranchModal);
    elements.branchModal?.addEventListener("click", (event) => {
        if (event.target === elements.branchModal) closeBranchModal();
    });
    elements.branchImageInput?.addEventListener("change", (event) => {
        handleBranchImage(event.target.files?.[0]);
    });
    elements.branchForm?.querySelector(".branch-upload-box")?.addEventListener("click", () => {
        elements.branchImageInput?.click();
    });
    elements.branchForm?.querySelector(".branch-upload-box")?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        elements.branchImageInput?.click();
    });
    elements.branchForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.branchForm);
        await withLoading(event.submitter, async () => {
            await submitBranchForm(raw);
        });
    });
    elements.branchesContent?.addEventListener("click", async (event) => {
        if (await handleBranchImportClick(event)) return;

        const statusButton = event.target.closest("[data-branch-status]");
        if (statusButton) {
            state.branchStatusFilter = statusButton.dataset.branchStatus || "all";
            renderBranches();
            return;
        }

        const button = event.target.closest("[data-branch-action]");
        if (!button) return;
        handleBranchAction(button.dataset.branchAction, button.dataset.branchKey);
    });
    elements.branchesContent?.addEventListener("submit", async (event) => {
        if (await submitBranchShipmentCreateForm(event)) return;

        const form = event.target.closest("[data-branch-filter-form]");
        if (!form) return;
        event.preventDefault();
        const formData = new FormData(form);
        state.branchSearch = String(formData.get("keyword") || "").trim();
        state.branchStatusFilter = String(formData.get("status") || "all") || "all";
        renderBranches();
    });
    elements.branchesContent?.addEventListener("input", (event) => {
        if (handleBranchImportInput(event)) return;

        if (event.target.id === "branchSearchInput") return;
    });
    elements.branchesContent?.addEventListener("change", (event) => {
        handleBranchImportInput(event);
    });

    elements.userFilterForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (state.userWorkspace === "shifts") {
            return;
        }
        if (state.userWorkspace === "customers") {
            state.customerAdminPage = 1;
            state.filters.customers = {
                ...state.filters.customers,
                keyword: String(elements.userFilterForm.elements.keyword?.value || "").trim(),
                status: String(elements.userFilterForm.elements.status?.value || "").trim(),
                tier: String(elements.userFilterForm.elements.tier?.value || "").trim()
            };
            await withLoading(event.submitter, loadCustomers);
            return;
        }

        state.userAdminPage = 1;
        state.filters.users = collectFormData(elements.userFilterForm);
        await withLoading(event.submitter, loadUsers);
    });

    elements.openUserFormButton?.addEventListener("click", () => {
        resetUserForm();
        openUserForm();
    });

    elements.cancelUserFormButton?.addEventListener("click", closeUserForm);
    elements.resetUserFormButton?.addEventListener("click", resetUserForm);
    elements.resetUserFormButton?.addEventListener("click", closeUserForm);
    elements.userFormModal?.addEventListener("click", (event) => {
        if (event.target === elements.userFormModal) {
            closeUserForm();
        }
    });
    elements.closeCustomerProfileButton?.addEventListener("click", closeCustomerProfile);
    elements.customerProfileModal?.addEventListener("click", (event) => {
        if (event.target === elements.customerProfileModal) {
            closeCustomerProfile();
        }
    });

    elements.userForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.userForm);
        await withLoading(event.submitter, async () => {
            await submitUserForm(raw);
        });
    });

    elements.usersContent?.addEventListener("click", async (event) => {
        if (state.userWorkspace === "shifts") {
            const shiftButton = event.target.closest("[data-shift-action]");
            if (!shiftButton) return;
            await withLoading(shiftButton, () => handleStaffShiftAction(shiftButton.dataset.shiftAction, shiftButton));
            return;
        }

        const button = event.target.closest("[data-user-action]");
        if (!button) return;

        const action = button.dataset.userAction;
        if (action === "page") {
            handleUserAction(action, null, { page: button.dataset.page });
            return;
        }

        await withLoading(button, () => handleUserAction(action, button.dataset.id));
    });

    elements.usersContent?.addEventListener("change", (event) => {
        if (state.userWorkspace !== "shifts") return;
        handleStaffShiftFieldChange(event.target);
    });
    elements.shiftsContent?.addEventListener("click", async (event) => {
        const shiftButton = event.target.closest("[data-shift-action]");
        if (!shiftButton) return;
        await withLoading(shiftButton, () => handleStaffShiftAction(shiftButton.dataset.shiftAction, shiftButton));
    });
    elements.shiftsContent?.addEventListener("change", (event) => {
        handleStaffShiftFieldChange(event.target);
    });

    elements.emailMarketingContent?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-email-action]");
        if (!button) return;
        await withLoading(button, () => handleEmailMarketingAction(button));
    });

    elements.emailMarketingContent?.addEventListener("input", (event) => {
        handleEmailMarketingInput(event.target);
    });

    elements.emailMarketingContent?.addEventListener("change", (event) => {
        if (event.target.matches("[data-email-banner-file]")) {
            withLoading(null, () => handleEmailMarketingFile(event.target));
            return;
        }
        handleEmailMarketingInput(event.target);
    });

    elements.suppliersContent?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-supplier-action]");
        if (!button) return;
        await withLoading(button, () => handleSupplierAction(button.dataset.supplierAction, button.dataset.id));
    });

    document.addEventListener("click", async (event) => {
        const button = event.target.closest(".supplier-return-backdrop [data-supplier-action]");
        if (!button) return;
        event.preventDefault();
        await withLoading(button, () => handleSupplierAction(button.dataset.supplierAction, button.dataset.id));
    }, true);

    elements.voucherFilterForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.filters.vouchers = collectFormData(elements.voucherFilterForm);
        await withLoading(event.submitter, loadVouchers);
    });

    elements.openVoucherFormButton?.addEventListener("click", (event) => {
        withLoading(event.currentTarget, async () => {
            if (!Array.isArray(state.products) || !state.products.length) {
                await loadProducts();
            }
            if (!Array.isArray(state.categories) || !state.categories.length) {
                await loadCategories();
            }
            resetVoucherForm();
            openVoucherForm();
        });
    });

    elements.cancelVoucherFormButton?.addEventListener("click", closeVoucherForm);
    elements.voucherCodeAutoButton?.addEventListener("click", autoGenerateVoucherCode);

    elements.voucherAudienceButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (elements.voucherForm?.elements.audience) {
                elements.voucherForm.elements.audience.value = button.dataset.voucherAudience || "all";
            }
            elements.voucherAudienceButtons.forEach((item) => item.classList.toggle("active", item === button));
            syncVoucherPreview();
        });
    });
    elements.voucherAudienceSelect?.addEventListener("change", () => {
        const selected = Array.from(elements.voucherAudienceSelect.selectedOptions).map((option) => option.value);
        if (!selected.length || selected.includes("all")) {
            Array.from(elements.voucherAudienceSelect.options).forEach((option) => {
                option.selected = option.value === "all";
            });
        }
        if (elements.voucherForm?.elements.audience) {
            elements.voucherForm.elements.audience.value = Array.from(elements.voucherAudienceSelect.selectedOptions)
                .map((option) => option.value)
                .join(",");
        }
        syncVoucherPreview();
    });

    elements.voucherFormView?.addEventListener("click", (event) => {
        if (event.target === elements.voucherFormView) {
            closeVoucherForm();
            return;
        }

        const scopeButton = event.target.closest("[data-voucher-scope]");
        if (scopeButton) {
            event.preventDefault();
            setVoucherApplyScope(scopeButton.dataset.voucherScope || "products", ["all"]);
            return;
        }

        const applyButton = event.target.closest("[data-voucher-apply-action]");
        if (applyButton) {
            event.preventDefault();
            if (applyButton.dataset.voucherApplyAction === "add") {
                addVoucherAppliedProduct();
            } else if (applyButton.dataset.voucherApplyAction === "remove") {
                removeVoucherAppliedProduct(applyButton.dataset.index);
            }
            return;
        }

        const submitButton = event.target.closest("[data-voucher-save-mode]");
        if (!submitButton) return;
        setVoucherSaveMode(submitButton.dataset.voucherSaveMode);
    });

    elements.voucherForm?.addEventListener("input", () => {
        syncVoucherPreview();
    });

    elements.voucherForm?.addEventListener("change", () => {
        syncVoucherPreview();
    });

    elements.voucherForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.voucherForm);
        await withLoading(event.submitter, async () => {
            await submitVoucherForm(raw);
        });
    });

    elements.vouchersContent?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-voucher-action]");
        if (!button) return;
        await withLoading(button, async () => {
            if (button.dataset.voucherAction === "edit" && (!Array.isArray(state.products) || !state.products.length)) {
                await loadProducts();
            }
            if (button.dataset.voucherAction === "edit" && (!Array.isArray(state.categories) || !state.categories.length)) {
                await loadCategories();
            }
            await handleVoucherAction(button.dataset.voucherAction, button.dataset.id);
        });
    });

    elements.promotionBuilderView?.addEventListener("click", (event) => {
        const optionButton = event.target.closest("[data-promotion-select-value]");
        if (optionButton) {
            event.preventDefault();
            handlePromotionAction("select-option", optionButton);
            return;
        }

        const typeCard = event.target.closest(".promotion-type-card");
        if (typeCard) {
            elements.promotionBuilderView
                .querySelectorAll(".promotion-type-card")
                .forEach((card) => card.classList.toggle("active", card === typeCard));
            syncPromotionPreview();
        }

        const timeButton = event.target.closest("[data-promotion-time]");
        if (timeButton) {
            elements.promotionBuilderView
                .querySelectorAll("[data-promotion-time], [data-promotion-custom-time]")
                .forEach((button) => button.classList.toggle("active", button === timeButton));
            syncPromotionPreview();
            return;
        }

        const customTimeRow = event.target.closest("[data-promotion-custom-time]");
        if (customTimeRow && !event.target.closest("[data-promotion-action]")) {
            elements.promotionBuilderView
                .querySelectorAll("[data-promotion-time], [data-promotion-custom-time]")
                .forEach((item) => item.classList.toggle("active", item === customTimeRow));
            syncPromotionPreview();
        }

        const actionButton = event.target.closest("[data-promotion-action]");
        if (!actionButton) return;
        event.preventDefault();
        handlePromotionAction(actionButton.dataset.promotionAction, actionButton);
    });

    elements.promotionForm?.addEventListener("input", syncPromotionPreview);
    elements.promotionForm?.addEventListener("change", syncPromotionPreview);
    elements.promotionForm?.addEventListener("input", (event) => {
        const target = event.target.closest("[data-promotion-search-target], [data-promotion-extra-search]");
        if (!target) return;
        handlePromotionAction("open-combobox", target);
    });
    elements.promotionForm?.addEventListener("focusin", (event) => {
        const target = event.target.closest("[data-promotion-search-target], [data-promotion-extra-search]");
        if (!target) return;
        const root = target.closest("[data-promotion-combobox]");
        const hiddenInput = root?.dataset.promotionCombobox === "gift"
            ? elements.promotionForm?.elements.gift_product_id
            : root?.dataset.promotionCombobox === "apply"
                ? elements.promotionForm?.elements.apply_product_id
                : root?.querySelector("[data-promotion-product]");
        if (hiddenInput?.value === "all") target.select?.();
        handlePromotionAction("open-combobox", target);
    });
    elements.promotionForm?.addEventListener("change", (event) => {
        if (event.target.name !== "apply_scope") return;
        const hiddenInput = elements.promotionForm.elements.apply_product_id;
        const searchInput = elements.promotionForm.elements.apply_product_search;
        if (hiddenInput) hiddenInput.value = "all";
        if (searchInput) {
            searchInput.value = event.target.value === "categories" ? "Tất cả danh mục" : "Tất cả sản phẩm";
            searchInput.placeholder = event.target.value === "categories"
                ? "Nhấn để chọn hoặc nhập tên danh mục..."
                : "Nhấn để chọn hoặc nhập tên/mã sản phẩm...";
        }
        if (elements.promotionProductsList) elements.promotionProductsList.innerHTML = "";
        handlePromotionAction("refresh-selects");
    });
    document.addEventListener("pointerdown", (event) => {
        if (!elements.promotionFormView || elements.promotionFormView.classList.contains("hidden")) return;
        if (event.target.closest(".promotion-combobox")) return;
        if (event.target.closest(".promotion-combobox-menu")) return;
        handlePromotionAction("close-comboboxes");
    }, true);
    document.addEventListener("click", (event) => {
        const optionButton = event.target.closest("[data-promotion-select-value]");
        if (optionButton) {
            event.preventDefault();
            handlePromotionAction("select-option", optionButton);
            return;
        }

        if (event.target.closest(".promotion-combobox")) return;
        if (event.target.closest(".promotion-combobox-menu")) return;
        handlePromotionAction("close-comboboxes");
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        handlePromotionAction("close-comboboxes");
    });
    elements.promotionFormView?.addEventListener("scroll", () => {
        handlePromotionAction("close-comboboxes");
    }, true);
    elements.promotionForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const raw = collectFormData(elements.promotionForm);
        try {
            await withLoading(event.submitter, async () => submitPromotionForm(raw));
        } catch (error) {
            showToast(error.message || "Không lưu được chiến dịch khuyến mãi.", true);
        }
    });
    [elements.promotionStatusFilter, elements.promotionTypeFilter].forEach((filter) => {
        filter?.addEventListener("change", () => handlePromotionAction("refresh-list"));
    });
    elements.promotionSearchInput?.addEventListener("input", () => handlePromotionAction("refresh-list"));

    let orderFilterTimerId = null;
    const applyOrderFilters = async () => {
        state.orderQuickFilter = "all";
        state.filters.orders = collectFormData(elements.orderFilterForm);
        await withLoading(null, loadOrders);
    };
    const scheduleOrderFilters = () => {
        window.clearTimeout(orderFilterTimerId);
        orderFilterTimerId = window.setTimeout(applyOrderFilters, 350);
    };

    elements.orderFilterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await applyOrderFilters();
    });

    elements.orderFilterForm?.addEventListener("input", (event) => {
        if (event.target.matches("[name='order_code']")) {
            scheduleOrderFilters();
        }
    });

    elements.orderFilterForm?.addEventListener("change", async (event) => {
        if (event.target.matches("[name='payment_status']")) {
            window.clearTimeout(orderFilterTimerId);
            await applyOrderFilters();
        }
    });

    elements.orderFilterForm?.addEventListener("click", async (event) => {
        const statusButton = event.target.closest("[data-order-status-value]");
        if (!statusButton) return;
        const statusValue = statusButton.dataset.orderStatusValue || "";
        if (elements.orderFilterForm.elements.status) {
            elements.orderFilterForm.elements.status.value = statusValue;
        }
        elements.orderFilterForm
            .querySelectorAll("[data-order-status-value]")
            .forEach((button) => {
                button.classList.toggle("active", button === statusButton);
            });
        window.clearTimeout(orderFilterTimerId);
        await applyOrderFilters();
    });

    elements.ordersContent.addEventListener("click", async (event) => {
        const quickFilterButton = event.target.closest("[data-order-quick-filter]");
        if (quickFilterButton) {
            setOrderQuickFilter(quickFilterButton.dataset.orderQuickFilter);
            return;
        }

        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleOrderAction(button));
    });

    elements.complaintsContent?.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        await withLoading(button, () => handleOrderAction(button));
    });

    elements.complaintsContent?.addEventListener("input", (event) => {
        const field = event.target.closest("[data-complaint-filter-field]");
        if (!field) return;
        state.complaintFilters = {
            ...(state.complaintFilters || {}),
            [field.dataset.complaintFilterField]: field.value || ""
        };
        window.clearTimeout(complaintFilterRenderTimer);
        const fieldName = field.dataset.complaintFilterField;
        complaintFilterRenderTimer = window.setTimeout(() => {
            renderOrders();
            const nextField = elements.complaintsContent?.querySelector(`[data-complaint-filter-field="${fieldName}"]`);
            nextField?.focus();
            if (nextField?.setSelectionRange) {
                const end = String(nextField.value || "").length;
                nextField.setSelectionRange(end, end);
            }
        }, 220);
    });

    elements.complaintsContent?.addEventListener("change", (event) => {
        const field = event.target.closest("[data-complaint-filter-field]");
        if (!field) return;
        state.complaintFilters = {
            ...(state.complaintFilters || {}),
            [field.dataset.complaintFilterField]: field.value || ""
        };
        renderOrders();
    });

    elements.orderCreateContent?.addEventListener("click", async (event) => {
        const draftButton = event.target.closest("[data-create-order-action]");
        if (!draftButton) {
            if (event.target.classList.contains("modal-backdrop")) {
                handleCreateOrderBuilderAction({ dataset: { createOrderAction: "close-product-picker" } });
            }
            return;
        }
        handleCreateOrderBuilderAction(draftButton);
    });

    elements.orderCreateContent?.addEventListener("change", (event) => {
        if (!event.target.closest("#orderCreateForm")) return;
        handleCreateOrderBuilderInput(event.target);
    });

    elements.orderCreateContent?.addEventListener("input", (event) => {
        if (!(event.target instanceof HTMLInputElement)) return;
        handleOrderProductPickerInput(event.target);
    });

    elements.orderCreateContent?.addEventListener("submit", async (event) => {
        const form = event.target.closest("#orderCreateForm");
        if (!form) return;
        event.preventDefault();
        await withLoading(event.submitter, async () => {
            await submitCreateOrder();
        });
    });

    elements.chatsContent?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-chat-action]");
        if (!button) return;
        try {
            await handleChatAction(button);
        } catch (error) {
            showToast(error.message || "Không thể xử lý thao tác chat.", true);
        }
    });

    elements.chatsContent?.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
        handleChatInput(target);
    });

    elements.chatsContent?.addEventListener("submit", async (event) => {
        const form = event.target.closest("#chatComposerForm, #aiSupportForm");
        if (!form) return;
        event.preventDefault();
        try {
            await submitChatComposer();
        } catch (error) {
            showToast(error.message || "Không thể gửi tin nhắn.", true);
        }
    });

    elements.closeOrderDetailButton?.addEventListener("click", closeOrderDetail);
    elements.orderDetailModal?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (button) {
            withLoading(button, () => handleOrderAction(button));
            return;
        }

        if (event.target === elements.orderDetailModal) {
            closeOrderDetail();
        }
    });
    elements.orderDetailModal?.addEventListener("change", (event) => {
        const select = event.target.closest("[data-order-branch-select]");
        if (!select) return;
        select.disabled = true;
        handleOrderBranchSelection(select)
            .catch((error) => showToast(error.message || "Không thể cập nhật chi nhánh lấy hàng.", true))
            .finally(() => {
                select.disabled = false;
            });
    });
    elements.closeComplaintDetailButton?.addEventListener("click", closeComplaintDetail);
    elements.complaintDetailModal?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (button) {
            withLoading(button, () => handleOrderAction(button));
            return;
        }

        if (event.target === elements.complaintDetailModal) {
            closeComplaintDetail();
        }
    });
    elements.orderInvoicePrintButton?.addEventListener("click", printCurrentOrderInvoice);
    elements.orderInvoiceExportButton?.addEventListener("click", exportCurrentOrderInvoice);
    window.__foodifiMainReady = true;
}

async function initialize() {
    restoreSession();
    bindImageFallbacks();
    renderSidebarMenu();
    setAuthMode("login");
    updateProductWorkspace();
    resetProductForm();
    resetProductEditorForm();
    resetProductImportForm();
    resetCategoryForm();
    resetSupplierForm();
    resetVoucherForm();
    resetUserForm();
    resetCreateOrderDraft();
    bindProductMediaEvents();
    bindCategoryMediaEvents();
    bindSupplierMediaEvents();
    bindUserMediaEvents();
    bindRecipeMediaEvents();
    bindSettingsEvents();
    bindProfileEvents();
    bindGlobalEvents();

    if (!state.token || !state.user) {
        updateSessionUi();
        setActivePanel("login");
        return;
    }

    try {
        const restoredUser = await apiFetch("/api/users/me");
        if (!restoredUser || !["admin", "staff"].includes(restoredUser.role)) {
            throw new Error("Phiên đăng nhập không còn quyền truy cập admin.");
        }

        state.user = restoredUser;
        saveSession();
        updateSessionUi();
        selectSidebarItem("overview-home");
        const hasLoadedData = await bootstrapAdmin();
        showToast(hasLoadedData ? "Đã khôi phục phiên đăng nhập." : "Đã khôi phục phiên đăng nhập, nhưng một số dữ liệu chưa tải được.", !hasLoadedData);
        return;
    } catch (error) {
        if ((error.status === 401 || error.status === 403) && state.refreshToken) {
            try {
                const refreshed = await refreshStoredSession();
                if (refreshed) {
                    const restoredUser = await apiFetch("/api/users/me");
                    if (!restoredUser || !["admin", "staff"].includes(restoredUser.role)) {
                        throw new Error("Phiên đăng nhập không còn quyền truy cập admin.");
                    }

                    state.user = restoredUser;
                    saveSession();
                    updateSessionUi();
                    selectSidebarItem("overview-home");
                    const hasLoadedData = await bootstrapAdmin();
                    showToast(hasLoadedData ? "Đã tự khôi phục phiên đăng nhập." : "Đã tự khôi phục phiên đăng nhập, nhưng một số dữ liệu chưa tải được.", !hasLoadedData);
                    return;
                }
            } catch (refreshError) {
                console.warn("Khong the lam moi phien admin da luu:", refreshError);
            }
        }

        if (error.isNetworkError) {
            updateSessionUi();
            selectSidebarItem("overview-home");
            showToast("Chưa kiểm tra được phiên do backend chưa phản hồi. Tải lại sau vài giây nếu dữ liệu chưa hiện.", true);
            return;
        }

        console.warn("Khong the xac thuc phien admin da luu:", error);
        logout(false);
        updateSessionUi();
        setActivePanel("login");
        showToast("Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.", true);
    }
}

function bindEmergencyLoginHandler(error) {
    if (window.__foodifiEmergencyLoginBound) return;
    window.__foodifiEmergencyLoginBound = true;
    console.error("Khoi tao admin bi gian doan, kich hoat emergency login:", error);

    const form = document.querySelector("#loginForm");
    const button = document.querySelector("#authSubmitButton");
    const subtitle = document.querySelector("#authSubtitle");

    if (!form || !button) return;

    const renderError = (message) => {
        if (!subtitle) {
            showToast(message, true);
            return;
        }

        subtitle.textContent = message;
        subtitle.classList.remove("hidden");
        subtitle.classList.add("auth-error-message");
    };

    form.addEventListener("submit", async (event) => {
        if (window.__foodifiMainReady) return;
        event.preventDefault();

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Đang xử lý...";

        try {
            if (subtitle) {
                subtitle.textContent = "";
                subtitle.classList.add("hidden");
                subtitle.classList.remove("auth-error-message");
            }

            const formData = collectFormData(form);
            state.apiBase = normalizeApiBase(formData.apiBase || state.apiBase || "http://localhost:3000");
            await login(formData.email, formData.password);
            updateSessionUi();
            setAdminPageTitle("Tổng quan");
            renderSidebarMenu();
            setActivePanel("overview");
            renderOverview();
            selectSidebarItem("overview-home");
            await bootstrapAdmin();
            showToast("Đăng nhập thành công.");
            window.__foodifiMainReady = true;
        } catch (submitError) {
            renderError(submitError?.message || "Không đăng nhập được. Vui lòng thử lại.");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    button.addEventListener("click", (event) => {
        if (window.__foodifiMainReady) return;
        event.preventDefault();
        form.requestSubmit?.(button);
    });
}

initialize().catch((error) => {
    bindEmergencyLoginHandler(error);
    updateSessionUi();
    setActivePanel("login");
});
