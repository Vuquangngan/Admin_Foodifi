import {
    STORAGE_KEYS,
    elements,
    escapeHtml,
    formatDate,
    showToast,
    state
} from "./core.js";

const PAGE_SIZE = 10;

const ACTION_LABELS = {
    all: "Tất cả",
    create: "Thêm mới",
    update: "Chỉnh sửa",
    delete: "Xóa",
    login: "Đăng nhập",
    logout: "Đăng xuất",
    order: "Đơn hàng"
};

const ROLE_LABELS = {
    admin: "Quản trị viên",
    staff: "Nhân viên",
    customer: "Khách hàng",
    system: "Hệ thống"
};

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateValue(value) {
    const date = parseDate(value);
    return date ? date.toISOString() : "";
}

function getDateOnly(value) {
    const date = parseDate(value);
    if (!date) return "";
    return date.toISOString().slice(0, 10);
}

function isSameDateTime(first, second) {
    const firstDate = parseDate(first);
    const secondDate = parseDate(second);
    if (!firstDate || !secondDate) return false;
    return Math.abs(firstDate.getTime() - secondDate.getTime()) < 1000;
}

function getCurrentActor() {
    const user = state.user || {};
    return {
        name: user.username || user.full_name || user.name || user.email || "Quản trị viên",
        email: user.email || "",
        role: user.role || "admin"
    };
}

function getInitials(name) {
    const text = String(name || "").trim();
    if (!text) return "GF";
    return text
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function isApiPathTarget(value) {
    const text = String(value || "").trim().toLowerCase();
    return text.startsWith("/api/") || text.startsWith("api/");
}

function formatActivityTarget(entry) {
    const targetType = String(entry?.targetType || "KhÃ´ng rÃµ").trim();
    const targetName = String(entry?.targetName || "").trim();
    if (!targetName || isApiPathTarget(targetName)) return targetType;
    return `${targetType}: ${targetName}`;
}

function createEntry({
    id,
    time,
    actor,
    action,
    targetType,
    targetName,
    detail = "",
    status = "success",
    warning = false,
    warningNote = ""
}) {
    const normalizedWarningNote = String(warningNote || "").trim();
    const savedWarningNote = String(state.activityWarningNotes?.[String(id || "")] || "").trim();
    const finalWarningNote = savedWarningNote || normalizedWarningNote;
    return {
        id: String(id || `${action}-${targetType}-${targetName}-${time || Date.now()}`),
        time: normalizeDateValue(time) || new Date().toISOString(),
        actor: actor || getCurrentActor(),
        action,
        targetType,
        targetName: String(targetName || "Không rõ"),
        detail: String(detail || ""),
        status,
        warning: Boolean(warning || finalWarningNote),
        warningNote: finalWarningNote
    };
}

function pushEntityEntries(entries, collection, options) {
    const actor = options.actor || getCurrentActor();
    asArray(collection).forEach((item) => {
        const id = item?.id || item?.code || item?.sku || item?.order_code || item?.name;
        const name = item?.name || item?.title || item?.code || item?.sku || item?.order_code || `#${id || ""}`;
        const createdAt = item?.created_at || item?.createdAt;
        const updatedAt = item?.updated_at || item?.updatedAt;

        if (createdAt) {
            entries.push(createEntry({
                id: `${options.key}-create-${id}`,
                time: createdAt,
                actor,
                action: "create",
                targetType: options.targetType,
                targetName: name,
                detail: options.createDetail || `Tạo ${options.targetType.toLowerCase()} mới`,
                status: "success"
            }));
        }

        if (updatedAt && (!createdAt || !isSameDateTime(createdAt, updatedAt))) {
            entries.push(createEntry({
                id: `${options.key}-update-${id}`,
                time: updatedAt,
                actor,
                action: "update",
                targetType: options.targetType,
                targetName: name,
                detail: options.updateDetail || `Cập nhật ${options.targetType.toLowerCase()}`,
                status: "success"
            }));
        }
    });
}

function buildOrderEntries(entries) {
    asArray(state.orders).forEach((order) => {
        const actor = {
            name: order.customer_name || order.user?.username || order.user?.email || "Khách hàng",
            email: order.customer_email || order.user?.email || "",
            role: "customer"
        };
        const code = order.order_code || order.code || `Đơn #${order.id}`;
        const status = order.status || order.order_status || "";
        const hasWarning = ["cancelled", "failed", "refunded", "refund_pending"].includes(String(status).toLowerCase());

        entries.push(createEntry({
            id: `order-${order.id || code}`,
            time: order.updated_at || order.created_at,
            actor,
            action: "order",
            targetType: "Đơn hàng",
            targetName: code,
            detail: status ? `Trạng thái: ${status}` : "Cập nhật đơn hàng",
            status: hasWarning ? "warning" : "success",
            warning: hasWarning,
            warningNote: hasWarning ? `Đơn hàng đang ở trạng thái cần theo dõi: ${status}.` : ""
        }));
    });
}

export function buildActivityHistoryEntries() {
    const entries = [];
    const actor = getCurrentActor();

    asArray(state.activityLogs).forEach((log) => {
        entries.push(createEntry({
            id: log.id,
            time: log.time,
            actor: log.actor,
            action: log.action,
            targetType: log.targetType,
            targetName: log.targetName,
            detail: log.detail,
            status: log.status || "success",
            warning: log.warning,
            warningNote: log.warningNote
        }));
    });

    if (state.user) {
        entries.push(createEntry({
            id: "current-session-login",
            time: new Date().toISOString(),
            actor,
            action: "login",
            targetType: "Hệ thống",
            targetName: "Web Admin",
            detail: "Phiên đăng nhập hiện tại",
            status: "success"
        }));
    }

    pushEntityEntries(entries, state.products, {
        key: "product",
        targetType: "Sản phẩm",
        actor,
        createDetail: "Thêm sản phẩm vào hệ thống",
        updateDetail: "Cập nhật thông tin hoặc tồn kho sản phẩm"
    });
    pushEntityEntries(entries, state.categories, {
        key: "category",
        targetType: "Danh mục sản phẩm",
        actor
    });
    pushEntityEntries(entries, state.suppliers, {
        key: "supplier",
        targetType: "Nhà cung cấp",
        actor
    });
    pushEntityEntries(entries, state.users, {
        key: "staff",
        targetType: "Tài khoản nhân sự",
        actor
    });
    pushEntityEntries(entries, state.customers, {
        key: "customer",
        targetType: "Tài khoản khách hàng",
        actor: { name: "Hệ thống", email: "", role: "system" }
    });
    pushEntityEntries(entries, state.vouchers.length ? state.vouchers : state.coupons, {
        key: "voucher",
        targetType: "Voucher",
        actor
    });
    pushEntityEntries(entries, state.recipes, {
        key: "recipe",
        targetType: "Công thức",
        actor
    });
    pushEntityEntries(entries, state.recipeCategories, {
        key: "recipe-category",
        targetType: "Danh mục công thức",
        actor
    });
    buildOrderEntries(entries);

    return entries.sort((first, second) => parseDate(second.time) - parseDate(first.time));
}

export function getFilteredActivityEntries() {
    const filters = state.activityHistoryFilters;
    const keyword = String(filters.keyword || "").trim().toLowerCase();
    const fromDate = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

    return buildActivityHistoryEntries().filter((entry) => {
        const entryDate = parseDate(entry.time);
        if (fromDate && entryDate && entryDate < fromDate) return false;
        if (toDate && entryDate && entryDate > toDate) return false;
        if (filters.role !== "all" && entry.actor.role !== filters.role) return false;
        if (filters.action !== "all" && entry.action !== filters.action) return false;

        if (!keyword) return true;
        const haystack = [
            entry.actor.name,
            entry.actor.email,
            ROLE_LABELS[entry.actor.role] || entry.actor.role,
            ACTION_LABELS[entry.action] || entry.action,
            entry.targetType,
            entry.targetName,
            entry.detail,
            entry.status
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
    });
}

function renderActivityRows(entries) {
    return entries.map((entry) => {
        const date = parseDate(entry.time);
        const actorName = entry.actor.name || "Không rõ";
        const roleLabel = ROLE_LABELS[entry.actor.role] || entry.actor.role || "Không rõ";
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const hasWarning = Boolean(entry.warning || entry.warningNote);
        const targetLabel = formatActivityTarget(entry);
        const warningNote = entry.warningNote || (hasWarning ? entry.detail : "Không có ghi chú cảnh báo cho thao tác này.");
        const statusLabel = entry.status === "failed" ? "Thất bại" : entry.status === "warning" ? "Cần chú ý" : "Thành công";

        return `
          <tr>
            <td class="activity-time-cell">
              <strong>${escapeHtml(formatDate(entry.time))}</strong>
              <small>${escapeHtml(date ? getDateOnly(date) : "")}</small>
            </td>
            <td>
              <div class="activity-user-cell">
                <span class="activity-avatar">${escapeHtml(getInitials(actorName))}</span>
                <span>
                  <strong>${escapeHtml(actorName)}</strong>
                  <small>${escapeHtml(roleLabel)}${entry.actor.email ? ` • ${escapeHtml(entry.actor.email)}` : ""}</small>
                </span>
              </div>
            </td>
            <td><span class="activity-action-badge ${escapeHtml(entry.action)}">${escapeHtml(actionLabel)}</span></td>
            <td class="activity-target-cell">
              <strong>${escapeHtml(targetLabel)}</strong>
              <small>${escapeHtml(entry.detail)}</small>
            </td>
            <td><span class="activity-status ${escapeHtml(entry.status)}">● ${escapeHtml(statusLabel)}</span></td>
            <td><span class="activity-flag ${entry.warning ? "warning" : ""}">${entry.warning ? "⚑" : "⚐"}</span></td>
          </tr>
          ${state.activityWarningOpenId === entry.id ? `
            <tr class="activity-warning-note-row">
              <td colspan="6">
                <div class="activity-warning-note ${hasWarning ? "warning" : ""}">
                  <strong>Ghi chú cảnh báo</strong>
                  <span>${escapeHtml(warningNote)}</span>
                </div>
              </td>
            </tr>
          ` : ""}
        `;
    }).join("");
}

function renderPagination(total, page, pageCount) {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    const compactPages = pages.length <= 7
        ? pages
        : [...new Set([1, Math.max(1, page - 1), page, Math.min(pageCount, page + 1), pageCount])].sort((a, b) => a - b);

    return `
      <div class="activity-footer">
        <p class="section-copy">Hiển thị ${total ? ((page - 1) * PAGE_SIZE) + 1 : 0} - ${Math.min(page * PAGE_SIZE, total)} trên tổng số ${total} thao tác</p>
        <div class="activity-pagination">
          <button class="activity-page-button" type="button" data-activity-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>
          ${compactPages.map((item, index) => {
              const previous = compactPages[index - 1];
              const gap = previous && item - previous > 1 ? `<span class="section-copy">...</span>` : "";
              return `${gap}<button class="activity-page-button ${item === page ? "active" : ""}" type="button" data-activity-page="${item}">${item}</button>`;
          }).join("")}
          <button class="activity-page-button" type="button" data-activity-page="${page + 1}" ${page >= pageCount ? "disabled" : ""}>›</button>
        </div>
      </div>
    `;
}

export function syncActivityFilterControls() {
    const filters = state.activityHistoryFilters;
    if (elements.activitySearchInput) elements.activitySearchInput.value = filters.keyword || "";
    if (elements.activityDateFrom) elements.activityDateFrom.value = filters.from || "";
    if (elements.activityDateTo) elements.activityDateTo.value = filters.to || "";
    if (elements.activityRoleFilter) elements.activityRoleFilter.value = filters.role || "all";

    elements.activityActionTabs?.querySelectorAll("[data-activity-action]").forEach((button) => {
        button.classList.toggle("active", button.dataset.activityAction === (filters.action || "all"));
    });
}

export function renderActivityHistory() {
    syncActivityFilterControls();

    const entries = getFilteredActivityEntries();
    const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, state.activityHistoryPage || 1), pageCount);
    state.activityHistoryPage = page;

    if (elements.activityHistoryMeta) {
        elements.activityHistoryMeta.textContent = `${entries.length} thao tác`;
    }

    if (!elements.activityHistoryContent) return;

    if (!entries.length) {
        elements.activityHistoryContent.innerHTML = '<div class="activity-empty">Chưa có thao tác phù hợp với bộ lọc hiện tại.</div>';
        return;
    }

    const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    elements.activityHistoryContent.innerHTML = `
      <div class="activity-table-wrap">
        <table class="list-table activity-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thực hiện</th>
              <th>Thao tác</th>
              <th>Đối tượng</th>
              <th>Trạng thái</th>
              <th>Cảnh báo</th>
            </tr>
          </thead>
          <tbody>${renderActivityRows(pageEntries)}</tbody>
        </table>
      </div>
      ${renderPagination(entries.length, page, pageCount)}
    `;
}

export function handleActivityFilterInput(event) {
    const target = event.target;
    if (!target) return;

    if (target === elements.activitySearchInput) {
        state.activityHistoryFilters.keyword = target.value || "";
    } else if (target === elements.activityDateFrom) {
        state.activityHistoryFilters.from = target.value || "";
    } else if (target === elements.activityDateTo) {
        state.activityHistoryFilters.to = target.value || "";
    } else if (target === elements.activityRoleFilter) {
        state.activityHistoryFilters.role = target.value || "all";
    } else {
        return;
    }

    state.activityHistoryPage = 1;
    renderActivityHistory();
}

export function handleActivityHistoryClick(event) {
    const warningFlag = event.target.closest(".activity-flag");
    if (warningFlag) {
        const row = warningFlag.closest("tr");
        const rows = Array.from(row?.parentElement?.querySelectorAll("tr:not(.activity-warning-note-row)") || []);
        const rowIndex = rows.indexOf(row);
        const pageEntries = getFilteredActivityEntries().slice((state.activityHistoryPage - 1) * PAGE_SIZE, state.activityHistoryPage * PAGE_SIZE);
        const entry = pageEntries[rowIndex];
        if (entry) {
            openActivityWarningModal(entry.id);
        }
        return;
    }

    const actionButton = event.target.closest("[data-activity-action]");
    if (actionButton) {
        state.activityHistoryFilters.action = actionButton.dataset.activityAction || "all";
        state.activityHistoryPage = 1;
        renderActivityHistory();
        return;
    }

    const pageButton = event.target.closest("[data-activity-page]");
    if (pageButton) {
        state.activityHistoryPage = Number(pageButton.dataset.activityPage || 1);
        renderActivityHistory();
    }
}

function getActivityEntryById(entryId) {
    return buildActivityHistoryEntries().find((entry) => String(entry.id) === String(entryId)) || null;
}
function saveActivityWarningNotes() {
    localStorage.setItem(STORAGE_KEYS.activityWarningNotes, JSON.stringify(state.activityWarningNotes || {}));
}

export function openActivityWarningModal(entryId) {
    const entry = getActivityEntryById(entryId);
    if (!entry || !elements.activityWarningModal || !elements.activityWarningForm) return;

    state.activityWarningEditingId = String(entry.id);
    elements.activityWarningForm.elements.entry_id.value = String(entry.id);
    elements.activityWarningForm.elements.note.value = entry.warningNote || "";
    if (elements.activityWarningTarget) {
        elements.activityWarningTarget.textContent = formatActivityTarget(entry);
    }
    elements.activityWarningModal.classList.remove("hidden");
    elements.activityWarningForm.elements.note.focus();
}

export function closeActivityWarningModal() {
    state.activityWarningEditingId = "";
    elements.activityWarningModal?.classList.add("hidden");
}

export function submitActivityWarningForm() {
    const form = elements.activityWarningForm;
    if (!form) return;

    const entryId = String(form.elements.entry_id.value || state.activityWarningEditingId || "");
    const note = String(form.elements.note.value || "").trim();
    if (!entryId) return;
    if (!note) {
        showToast("Vui lòng nhập ghi chú cảnh báo.", true);
        return;
    }

    state.activityWarningNotes = {
        ...(state.activityWarningNotes || {}),
        [entryId]: note
    };
    saveActivityWarningNotes();
    closeActivityWarningModal();
    renderActivityHistory();
    showToast("Đã lưu ghi chú và đánh dấu cảnh báo.");
}

export function clearActivityWarningNote() {
    const entryId = String(elements.activityWarningForm?.elements.entry_id.value || state.activityWarningEditingId || "");
    if (!entryId) return;

    const nextNotes = { ...(state.activityWarningNotes || {}) };
    delete nextNotes[entryId];
    state.activityWarningNotes = nextNotes;
    saveActivityWarningNotes();
    closeActivityWarningModal();
    renderActivityHistory();
    showToast("Đã bỏ đánh dấu cảnh báo.");
}

function escapeExcelCell(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

        <td>${escapeExcelCell(formatActivityTarget(entry))}</td>
    if (!entries.length) {
        showToast("Không có dữ liệu để xuất Excel.", true);
        return;
    }

    const rows = entries.map((entry) => `
      <tr>
        <td>${escapeExcelCell(formatDate(entry.time))}</td>
        <td>${escapeExcelCell(entry.actor.name || "")}</td>
        <td>${escapeExcelCell(ROLE_LABELS[entry.actor.role] || entry.actor.role || "")}</td>
        <td>${escapeExcelCell(ACTION_LABELS[entry.action] || entry.action)}</td>
        <td>${escapeExcelCell(formatActivityTarget(entry))}</td>
        <td>${escapeExcelCell(entry.status === "failed" ? "Thất bại" : entry.status === "warning" ? "Cần chú ý" : "Thành công")}</td>
        <td>${entry.warning ? "Có" : "Không"}</td>
      </tr>
    `).join("");

    const html = `
      <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Vai trò</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Chi tiết</th>
                <th>Trạng thái</th>
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lich-su-thao-tac-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã xuất báo cáo Excel.");
}
