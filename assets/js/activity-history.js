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
    all: "Táº¥t cáº£",
    create: "ThÃªm má»›i",
    update: "Chá»‰nh sá»­a",
    delete: "XÃ³a",
    login: "ÄÄƒng nháº­p",
    logout: "ÄÄƒng xuáº¥t",
    order: "ÄÆ¡n hÃ ng"
};

const ROLE_LABELS = {
    admin: "Quáº£n trá»‹ viÃªn",
    staff: "NhÃ¢n viÃªn",
    customer: "KhÃ¡ch hÃ ng",
    system: "Há»‡ thá»‘ng"
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
        name: user.username || user.full_name || user.name || user.email || "Quáº£n trá»‹ viÃªn",
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
    const targetType = String(entry?.targetType || "KhÃƒÂ´ng rÃƒÂµ").trim();
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
        targetName: String(targetName || "KhÃ´ng rÃµ"),
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
                detail: options.createDetail || `Táº¡o ${options.targetType.toLowerCase()} má»›i`,
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
                detail: options.updateDetail || `Cáº­p nháº­t ${options.targetType.toLowerCase()}`,
                status: "success"
            }));
        }
    });
}

function buildOrderEntries(entries) {
    asArray(state.orders).forEach((order) => {
        const actor = {
            name: order.customer_name || order.user?.username || order.user?.email || "KhÃ¡ch hÃ ng",
            email: order.customer_email || order.user?.email || "",
            role: "customer"
        };
        const code = order.order_code || order.code || `ÄÆ¡n #${order.id}`;
        const status = order.status || order.order_status || "";
        const hasWarning = ["cancelled", "failed", "refunded", "refund_pending"].includes(String(status).toLowerCase());

        entries.push(createEntry({
            id: `order-${order.id || code}`,
            time: order.updated_at || order.created_at,
            actor,
            action: "order",
            targetType: "ÄÆ¡n hÃ ng",
            targetName: code,
            detail: status ? `Tráº¡ng thÃ¡i: ${status}` : "Cáº­p nháº­t Ä‘Æ¡n hÃ ng",
            status: hasWarning ? "warning" : "success",
            warning: hasWarning,
            warningNote: hasWarning ? `ÄÆ¡n hÃ ng Ä‘ang á»Ÿ tráº¡ng thÃ¡i cáº§n theo dÃµi: ${status}.` : ""
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
            targetType: "Há»‡ thá»‘ng",
            targetName: "Web Admin",
            detail: "PhiÃªn Ä‘Äƒng nháº­p hiá»‡n táº¡i",
            status: "success"
        }));
    }

    pushEntityEntries(entries, state.products, {
        key: "product",
        targetType: "Sáº£n pháº©m",
        actor,
        createDetail: "ThÃªm sáº£n pháº©m vÃ o há»‡ thá»‘ng",
        updateDetail: "Cáº­p nháº­t thÃ´ng tin hoáº·c tá»“n kho sáº£n pháº©m"
    });
    pushEntityEntries(entries, state.categories, {
        key: "category",
        targetType: "Danh má»¥c sáº£n pháº©m",
        actor
    });
    pushEntityEntries(entries, state.suppliers, {
        key: "supplier",
        targetType: "NhÃ  cung cáº¥p",
        actor
    });
    pushEntityEntries(entries, state.users, {
        key: "staff",
        targetType: "TÃ i khoáº£n nhÃ¢n sá»±",
        actor
    });
    pushEntityEntries(entries, state.customers, {
        key: "customer",
        targetType: "TÃ i khoáº£n khÃ¡ch hÃ ng",
        actor: { name: "Há»‡ thá»‘ng", email: "", role: "system" }
    });
    pushEntityEntries(entries, state.vouchers.length ? state.vouchers : state.coupons, {
        key: "voucher",
        targetType: "Voucher",
        actor
    });
    pushEntityEntries(entries, state.recipes, {
        key: "recipe",
        targetType: "CÃ´ng thá»©c",
        actor
    });
    pushEntityEntries(entries, state.recipeCategories, {
        key: "recipe-category",
        targetType: "Danh má»¥c cÃ´ng thá»©c",
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
        const actorName = entry.actor.name || "KhÃ´ng rÃµ";
        const roleLabel = ROLE_LABELS[entry.actor.role] || entry.actor.role || "KhÃ´ng rÃµ";
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const hasWarning = Boolean(entry.warning || entry.warningNote);
        const targetLabel = formatActivityTarget(entry);
        const warningNote = entry.warningNote || (hasWarning ? entry.detail : "KhÃ´ng cÃ³ ghi chÃº cáº£nh bÃ¡o cho thao tÃ¡c nÃ y.");
        const statusLabel = entry.status === "failed" ? "Tháº¥t báº¡i" : entry.status === "warning" ? "Cáº§n chÃº Ã½" : "ThÃ nh cÃ´ng";

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
                  <small>${escapeHtml(roleLabel)}${entry.actor.email ? ` â€¢ ${escapeHtml(entry.actor.email)}` : ""}</small>
                </span>
              </div>
            </td>
            <td><span class="activity-action-badge ${escapeHtml(entry.action)}">${escapeHtml(actionLabel)}</span></td>
            <td class="activity-target-cell">
              <strong>${escapeHtml(targetLabel)}</strong>
              <small>${escapeHtml(entry.detail)}</small>
            </td>
            <td><span class="activity-status ${escapeHtml(entry.status)}">â— ${escapeHtml(statusLabel)}</span></td>
            <td><span class="activity-flag ${entry.warning ? "warning" : ""}">${entry.warning ? "âš‘" : "âš"}</span></td>
          </tr>
          ${state.activityWarningOpenId === entry.id ? `
            <tr class="activity-warning-note-row">
              <td colspan="6">
                <div class="activity-warning-note ${hasWarning ? "warning" : ""}">
                  <strong>Ghi chÃº cáº£nh bÃ¡o</strong>
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
        <p class="section-copy">Hiá»ƒn thá»‹ ${total ? ((page - 1) * PAGE_SIZE) + 1 : 0} - ${Math.min(page * PAGE_SIZE, total)} trÃªn tá»•ng sá»‘ ${total} thao tÃ¡c</p>
        <div class="activity-pagination">
          <button class="activity-page-button" type="button" data-activity-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>â€¹</button>
          ${compactPages.map((item, index) => {
              const previous = compactPages[index - 1];
              const gap = previous && item - previous > 1 ? `<span class="section-copy">...</span>` : "";
              return `${gap}<button class="activity-page-button ${item === page ? "active" : ""}" type="button" data-activity-page="${item}">${item}</button>`;
          }).join("")}
          <button class="activity-page-button" type="button" data-activity-page="${page + 1}" ${page >= pageCount ? "disabled" : ""}>â€º</button>
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
        elements.activityHistoryMeta.textContent = `${entries.length} thao tÃ¡c`;
    }

    if (!elements.activityHistoryContent) return;

    if (!entries.length) {
        elements.activityHistoryContent.innerHTML = '<div class="activity-empty">ChÆ°a cÃ³ thao tÃ¡c phÃ¹ há»£p vá»›i bá»™ lá»c hiá»‡n táº¡i.</div>';
        return;
    }

    const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    elements.activityHistoryContent.innerHTML = `
      <div class="activity-table-wrap">
        <table class="list-table activity-table">
          <thead>
            <tr>
              <th>Thá»i gian</th>
              <th>NgÆ°á»i thá»±c hiá»‡n</th>
              <th>Thao tÃ¡c</th>
              <th>Äá»‘i tÆ°á»£ng</th>
              <th>Tráº¡ng thÃ¡i</th>
              <th>Cáº£nh bÃ¡o</th>
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
        showToast("Vui lÃ²ng nháº­p ghi chÃº cáº£nh bÃ¡o.", true);
        return;
    }

    state.activityWarningNotes = {
        ...(state.activityWarningNotes || {}),
        [entryId]: note
    };
    saveActivityWarningNotes();
    closeActivityWarningModal();
    renderActivityHistory();
    showToast("ÄÃ£ lÆ°u ghi chÃº vÃ  Ä‘Ã¡nh dáº¥u cáº£nh bÃ¡o.");
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
    showToast("ÄÃ£ bá» Ä‘Ã¡nh dáº¥u cáº£nh bÃ¡o.");
}

function escapeExcelCell(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

export function exportActivityHistoryExcel() {
    const entries = getFilteredActivityEntries();
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
        <td>${escapeExcelCell(entry.detail || entry.note || "")}</td>
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
