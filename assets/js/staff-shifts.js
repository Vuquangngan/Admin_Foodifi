import {
    apiFetch,
    elements,
    escapeHtml,
    formatNumber,
    showToast,
    state,
    STORE_BRANCHES
} from "./core.js";

const SHIFT_STORAGE_KEY = "shopfood_admin_staff_shifts_v2";
const MAX_STAFF_PER_SHIFT = 3;
const SHIFT_SYNC_INTERVAL_MS = 5000;

const DEFAULT_SHIFTS = [
    { id: "morning", name: "Ca sáng", start: "06:00", end: "12:00", tone: "morning", enabled: true, appliesToDate: "" },
    { id: "afternoon", name: "Ca chiều", start: "12:00", end: "18:00", tone: "afternoon", enabled: true, appliesToDate: "" },
    { id: "evening", name: "Ca tối", start: "18:00", end: "22:00", tone: "evening", enabled: false, appliesToDate: "" }
];

const SHIFT_TONES = {
    morning: { label: "Ca sáng", className: "morning" },
    afternoon: { label: "Ca chiều", className: "afternoon" },
    evening: { label: "Ca tối", className: "evening" }
};

let shiftWorkspaceState = loadShiftWorkspaceState();
let shiftModalState = null;
let loadedScheduleKey = "";
let scheduleFetchPromise = null;
let shiftSyncTimer = null;

function formatBranchOptionLabel(branch) {
    const label = String(branch.label || branch.name || branch.key || "").trim();
    const name = String(branch.name || "").trim();
    return name && name !== label ? `${label} - ${name}` : label;
}

function getActiveShiftBranches() {
    return STORE_BRANCHES
        .filter((branch) => !["paused", "closed"].includes(String(branch.status || "active").trim().toLowerCase()))
        .map((branch) => ({
            id: String(branch.key || ""),
            label: formatBranchOptionLabel(branch)
        }))
        .filter((branch) => branch.id && branch.label);
}

function getDefaultBranchId() {
    return getActiveShiftBranches()[0]?.id || "";
}

function normalizeShiftBranchId(branchId) {
    const branches = getActiveShiftBranches();
    const nextBranchId = String(branchId || "").trim();
    return branches.some((branch) => branch.id === nextBranchId)
        ? nextBranchId
        : (branches[0]?.id || "");
}

function ensureActiveBranchSelection() {
    const branches = getActiveShiftBranches();
    const normalizedBranchId = normalizeShiftBranchId(shiftWorkspaceState.branchId);
    if (shiftWorkspaceState.branchId !== normalizedBranchId) {
        shiftWorkspaceState.branchId = normalizedBranchId;
        persistShiftWorkspaceState();
    }
    return branches;
}

function createDefaultState() {
    return {
        branchId: getDefaultBranchId(),
        weekOffset: 0,
        shifts: DEFAULT_SHIFTS.map((shift) => ({ ...shift })),
        assignments: {},
        holidays: []
    };
}

function normalizeAssignmentRecord(record) {
    if (typeof record === "number" || typeof record === "string") {
        return {
            userId: Number(record),
            status: "confirmed",
            source: "legacy",
            registeredAt: new Date().toISOString(),
            confirmedAt: new Date().toISOString(),
            confirmedBy: null
        };
    }

    const userId = Number(record?.userId ?? record?.user_id ?? record?.id ?? 0);
    if (!userId) return null;

    const source = record?.source || "manager";
    const confirmationSource = record?.confirmationSource || record?.confirmation_source || "";
    const rawStatus = record?.status === "pending" ? "pending" : "confirmed";
    const status = source === "manager" && rawStatus === "confirmed" && !confirmationSource
        ? "pending"
        : rawStatus;

    return {
        userId,
        status,
        source,
        registeredAt: record?.registeredAt || record?.registered_at || new Date().toISOString(),
        confirmedAt: status === "confirmed"
            ? (record?.confirmedAt || record?.confirmed_at || new Date().toISOString())
            : null,
        confirmedBy: status === "confirmed"
            ? (record?.confirmedBy || record?.confirmed_by || null)
            : null,
        confirmationSource: status === "confirmed" ? confirmationSource : "",
        user: record?.user || null
    };
}

function normalizeAssignments(assignments) {
    if (!assignments || typeof assignments !== "object") return {};

    return Object.fromEntries(
        Object.entries(assignments).map(([key, value]) => {
            const records = Array.isArray(value)
                ? value.map(normalizeAssignmentRecord).filter(Boolean)
                : [];
            return [key, records.slice(0, MAX_STAFF_PER_SHIFT)];
        })
    );
}

function normalizeHolidays(holidays) {
    return Array.isArray(holidays)
        ? [...new Set(holidays.map((dateKey) => String(dateKey || "").trim()).filter(Boolean))]
        : [];
}

function normalizeShifts(shifts) {
    if (!Array.isArray(shifts) || !shifts.length) {
        return DEFAULT_SHIFTS.map((shift) => ({ ...shift }));
    }

    return shifts.map((shift, index) => ({
        id: String(shift.id || `shift-${index + 1}`),
        name: String(shift.name || `Ca ${index + 1}`),
        start: String(shift.start || "08:00"),
        end: String(shift.end || "17:00"),
        tone: SHIFT_TONES[shift.tone] ? shift.tone : "morning",
        enabled: shift.enabled !== false,
        appliesToDate: String(shift.appliesToDate || shift.applies_to_date || "")
    }));
}

function loadShiftWorkspaceState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SHIFT_STORAGE_KEY) || "{}");
        return {
            branchId: normalizeShiftBranchId(parsed.branchId),
            weekOffset: Number.isFinite(parsed.weekOffset) ? parsed.weekOffset : 0,
            shifts: normalizeShifts(parsed.shifts),
            assignments: normalizeAssignments(parsed.assignments),
            holidays: normalizeHolidays(parsed.holidays)
        };
    } catch (_error) {
        return createDefaultState();
    }
}

function persistShiftWorkspaceState() {
    localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(shiftWorkspaceState));
}

function getStaffMembers() {
    return (state.users || []).filter((user) => ["admin", "staff"].includes(user.role));
}

function getShiftContentElement() {
    return elements.shiftsContent || elements.usersContent;
}

function getCurrentUserId() {
    return Number(state.user?.id || 0);
}

function isManagerUser() {
    return ["admin", "staff"].includes(state.user?.role);
}

function isAdminUser() {
    return state.user?.role === "admin";
}

function startOfWeek(date, offsetWeeks = 0) {
    const base = new Date(date);
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + diff + (offsetWeeks * 7));
    return base;
}

function buildWeekDates() {
    const start = startOfWeek(new Date(), shiftWorkspaceState.weekOffset);
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

function getWeekNumber(date) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 4 - (target.getDay() || 7));
    const yearStart = new Date(target.getFullYear(), 0, 1);
    return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function toDateKey(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDayName(date) {
    const label = new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatShiftDateLabel(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(`${dateLike}T00:00:00`);
    return new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function formatWeekLabel(dates) {
    if (!dates.length) return "";
    const start = dates[0];
    const end = dates[dates.length - 1];
    return `Tuần ${`${start.getDate()}`.padStart(2, "0")}/${`${start.getMonth() + 1}`.padStart(2, "0")} - ${`${end.getDate()}`.padStart(2, "0")}/${`${end.getMonth() + 1}`.padStart(2, "0")}`;
}

function formatWeekInputValue(date) {
    const week = `${getWeekNumber(date)}`.padStart(2, "0");
    return `${date.getFullYear()}-W${week}`;
}

function parseWeekInputValue(value) {
    const match = String(value || "").match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const week = Number(match[2]);
    if (!year || !week) return null;

    const januaryFourth = new Date(year, 0, 4);
    const monday = startOfWeek(januaryFourth, 0);
    monday.setDate(monday.getDate() + ((week - 1) * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function getCurrentWeekStartKey() {
    return toDateKey(buildWeekDates()[0]);
}

function getCurrentScheduleKey() {
    return `${shiftWorkspaceState.branchId}|${getCurrentWeekStartKey()}`;
}

function getCurrentWeekDateKeys() {
    return buildWeekDates().map(toDateKey);
}

function clearLoadedScheduleKey() {
    loadedScheduleKey = "";
}

function applySchedulePayload(payload) {
    if (!payload || typeof payload !== "object") return;

    const branchId = String(payload.branch_id || shiftWorkspaceState.branchId || "");
    if (branchId && branchId !== shiftWorkspaceState.branchId) return;
    const weekStart = String(payload.week_start || "");
    if (weekStart && weekStart !== getCurrentWeekStartKey()) return;

    shiftWorkspaceState = {
        ...shiftWorkspaceState,
        shifts: normalizeShifts(payload.shifts),
        assignments: normalizeAssignments(payload.assignments),
        holidays: normalizeHolidays(payload.holidays)
    };
    loadedScheduleKey = getCurrentScheduleKey();
    persistShiftWorkspaceState();
}

async function refreshShiftSchedule({ force = false, renderAfter = false, silent = false } = {}) {
    const branchId = shiftWorkspaceState.branchId;
    const weekStart = getCurrentWeekStartKey();
    if (!branchId || !weekStart) return null;

    const scheduleKey = getCurrentScheduleKey();
    if (!force && loadedScheduleKey === scheduleKey) return null;
    if (scheduleFetchPromise) return scheduleFetchPromise;

    scheduleFetchPromise = apiFetch(`/api/staff-shifts/schedule?branch_id=${encodeURIComponent(branchId)}&week_start=${encodeURIComponent(weekStart)}`)
        .then((payload) => {
            applySchedulePayload(payload);
            if (renderAfter) {
                renderStaffShiftWorkspace();
            }
            return payload;
        })
        .catch((error) => {
            if (!silent) {
                showToast(error.message || "Không tải được lịch ca từ backend.", true);
            }
            return null;
        })
        .finally(() => {
            scheduleFetchPromise = null;
        });

    return scheduleFetchPromise;
}

function requestShiftScheduleLoad() {
    window.setTimeout(() => {
        refreshShiftSchedule({ renderAfter: true, silent: true });
    }, 0);
}

function startShiftRealtimeSync() {
    if (shiftSyncTimer) return;
    shiftSyncTimer = window.setInterval(() => {
        refreshShiftSchedule({ force: true, renderAfter: true, silent: true });
    }, SHIFT_SYNC_INTERVAL_MS);
}

function assignmentKey(dateKey, shiftId) {
    return `${shiftWorkspaceState.branchId}|${dateKey}|${shiftId}`;
}

function getAssignmentRecords(dateKey, shiftId) {
    return shiftWorkspaceState.assignments[assignmentKey(dateKey, shiftId)] || [];
}

function isHolidayDate(dateKey) {
    return normalizeHolidays(shiftWorkspaceState.holidays).includes(String(dateKey || ""));
}

function setAssignmentRecords(dateKey, shiftId, records) {
    shiftWorkspaceState.assignments[assignmentKey(dateKey, shiftId)] = records
        .map(normalizeAssignmentRecord)
        .filter(Boolean)
        .slice(0, MAX_STAFF_PER_SHIFT);
    persistShiftWorkspaceState();
}

function removeAssignmentRecord(dateKey, shiftId, userId) {
    const nextRecords = getAssignmentRecords(dateKey, shiftId).filter((record) => Number(record.userId) !== Number(userId));
    setAssignmentRecords(dateKey, shiftId, nextRecords);
}

function getDetailedAssignments(dateKey, shiftId) {
    const userMap = new Map(getStaffMembers().map((user) => [Number(user.id), user]));
    return getAssignmentRecords(dateKey, shiftId)
        .map((record) => {
            const user = userMap.get(Number(record.userId)) || record.user;
            if (!user) return null;
            return { ...record, user };
        })
        .filter(Boolean);
}

function computeShiftHours(start, end) {
    const [startHour, startMinute] = String(start || "00:00").split(":").map(Number);
    const [endHour, endMinute] = String(end || "00:00").split(":").map(Number);
    const minutes = Math.max(0, ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute));
    return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} giờ / ca`;
}

function getBranchLabel() {
    const branches = getActiveShiftBranches();
    return branches.find((branch) => branch.id === shiftWorkspaceState.branchId)?.label || branches[0]?.label || "Chưa có chi nhánh hoạt động";
}

function summarizeAssignments() {
    const dates = buildWeekDates();
    const shifts = shiftWorkspaceState.shifts.filter((shift) => shift.enabled);

    let pendingCount = 0;
    let confirmedCount = 0;
    let emptySlots = 0;

    dates.forEach((date) => {
        const dateKey = toDateKey(date);
        shifts.forEach((shift) => {
            if (shift.appliesToDate && shift.appliesToDate !== dateKey) {
                return;
            }

            const records = getAssignmentRecords(dateKey, shift.id);
            pendingCount += records.filter((record) => record.status === "pending").length;
            confirmedCount += records.filter((record) => record.status === "confirmed").length;
            if (!records.length) {
                emptySlots += 1;
            }
        });
    });

    return { pendingCount, confirmedCount, emptySlots };
}

function buildPendingNotice() {
    const { pendingCount } = summarizeAssignments();
    if (!pendingCount) return "";

    return `
      <div class="shift-pending-notice">
        <strong>Có ${formatNumber(pendingCount)} lượt đăng ký đang chờ xác nhận.</strong>
      </div>
    `;
}

function buildShiftMember(item, dateKey, shiftId) {
    const statusLabel = item.status === "pending" ? "Chờ xác nhận" : "Đã xác nhận";
    const statusClass = item.status === "pending" ? "pending" : "confirmed";
    const employeeCode = item.user.code || `ID #${item.user.id}`;

    return `
      <article class="shift-member-pill is-${statusClass}">
        <span class="shift-member-avatar">${escapeHtml((item.user.username || "U").trim().charAt(0).toUpperCase())}</span>
        <div class="shift-member-copy">
          <strong>${escapeHtml(item.user.username || item.user.email || "Nhân viên")}</strong>
          <span>${escapeHtml(employeeCode)}</span>
        </div>
        <button type="button" class="shift-member-remove" title="${escapeHtml(statusLabel)}" aria-label="Xóa nhân viên khỏi ca" data-shift-action="remove-assignment" data-date="${dateKey}" data-shift-id="${shiftId}" data-user-id="${item.user.id}">×</button>
      </article>
    `;
}

function buildShiftCell(dateKey, shift) {
    if (isHolidayDate(dateKey)) {
        return `<div class="shift-cell-card is-disabled is-holiday"><div class="shift-cell-empty-copy">Ngày nghỉ lễ</div></div>`;
    }

    if (shift.appliesToDate && shift.appliesToDate !== dateKey) {
        return `<div class="shift-cell-card is-disabled"><div class="shift-cell-empty-copy">Không áp dụng ngày này</div></div>`;
    }

    const records = getDetailedAssignments(dateKey, shift.id);
    const pendingRecords = records.filter((item) => item.status === "pending");
    const currentUserId = getCurrentUserId();
    const isFull = records.length >= MAX_STAFF_PER_SHIFT;
    const existingSelfRecord = records.find((item) => Number(item.user.id) === currentUserId);
    const canSelfRegister = Boolean(currentUserId) && !existingSelfRecord && !isFull;
    const statusLabel = pendingRecords.length
        ? `${pendingRecords.length} chờ duyệt`
        : (isFull ? `Đã đủ ${MAX_STAFF_PER_SHIFT}/${MAX_STAFF_PER_SHIFT}` : `${records.length}/${MAX_STAFF_PER_SHIFT} nhân sự`);

    return `
      <div class="shift-cell-card ${records.length ? "has-users" : "is-empty"} ${pendingRecords.length ? "has-pending" : ""} ${isFull ? "is-full" : ""}">
        <div class="shift-cell-meta">
          ${pendingRecords.length ? `<span class="shift-status-pill pending">${statusLabel}</span>` : `<span class="shift-status-pill confirmed">${records.length ? statusLabel : "Trống"}</span>`}
        </div>
        <div class="shift-cell-members">
          ${records.length ? records.map((item) => buildShiftMember(item, dateKey, shift.id)).join("") : '<div class="shift-cell-empty-copy">Chưa có nhân sự</div>'}
        </div>
        <div class="shift-cell-actions">
          ${canSelfRegister ? `<button type="button" class="chip-button" data-shift-action="self-register" data-date="${dateKey}" data-shift-id="${shift.id}">Đăng ký: ${escapeHtml(state.user?.username || "Tôi")}</button>` : ""}
          ${isFull ? `<span class="shift-self-note">Ca đã đủ tối đa ${MAX_STAFF_PER_SHIFT} nhân viên</span>` : ""}
          ${existingSelfRecord?.status === "pending" ? '<span class="shift-self-note">Bạn đã đăng ký, chờ quản lý xác nhận</span>' : ""}
          <button type="button" class="chip-button" data-shift-action="open-assign-modal" data-date="${dateKey}" data-shift-id="${shift.id}">${records.length ? "Sửa nhân sự" : "Thêm nhân sự"}</button>
        </div>
      </div>
    `;
}

function buildShiftRow(shift, weekDates) {
    const tone = SHIFT_TONES[shift.tone] || SHIFT_TONES.morning;

    if (!shift.enabled) {
        return `
          <tr>
            <td class="shift-time-cell">
              <span class="shift-tone-pill ${tone.className}">${escapeHtml(shift.name)}</span>
              <strong>${escapeHtml(shift.start)} - ${escapeHtml(shift.end)}</strong>
              <small>${escapeHtml(computeShiftHours(shift.start, shift.end))}</small>
              ${shift.appliesToDate ? `<small>Ngày áp dụng: ${escapeHtml(formatShiftDateLabel(shift.appliesToDate))}</small>` : '<small>Ca lặp theo tuần</small>'}
              <button type="button" class="link-button shift-inline-action" data-shift-action="open-slot-modal" data-slot-id="${shift.id}">Chỉnh sửa</button>
            </td>
            <td class="shift-locked-cell" colspan="7">Ca này hiện chưa mở đăng ký cho tuần đang xem.</td>
          </tr>
        `;
    }

    return `
      <tr>
        <td class="shift-time-cell">
          <span class="shift-tone-pill ${tone.className}">${escapeHtml(shift.name)}</span>
          <strong>${escapeHtml(shift.start)} - ${escapeHtml(shift.end)}</strong>
          <small>${escapeHtml(computeShiftHours(shift.start, shift.end))}</small>
          ${shift.appliesToDate ? `<small>Ngày áp dụng: ${escapeHtml(formatShiftDateLabel(shift.appliesToDate))}</small>` : '<small>Ca lặp theo tuần</small>'}
          <button type="button" class="link-button shift-inline-action" data-shift-action="open-slot-modal" data-slot-id="${shift.id}">Chỉnh sửa</button>
        </td>
        ${weekDates.map((date) => {
            const dateKey = toDateKey(date);
            const todayKey = toDateKey(new Date());
            return `
              <td class="shift-day-cell ${dateKey === todayKey ? "is-today" : ""}">
                ${buildShiftCell(dateKey, shift)}
              </td>
            `;
        }).join("")}
      </tr>
    `;
}

function buildShiftModal() {
    if (!shiftModalState) return "";

    if (shiftModalState.type === "slot") {
        const slot = shiftModalState.slotId
            ? shiftWorkspaceState.shifts.find((item) => item.id === shiftModalState.slotId)
            : null;

        return `
          <div class="modal-backdrop shift-modal-backdrop">
            <div class="modal-card shift-modal-card">
              <div class="user-modal-header">
                <div>
                  <h2>${slot ? "Cập nhật ca làm việc" : "Tạo ca mới"}</h2>
                </div>
                <button class="user-modal-close" type="button" data-shift-action="close-modal">×</button>
              </div>
              <div class="compact-grid shift-modal-grid">
                <label>
                  <span>Tên ca</span>
                  <input id="shiftSlotNameInput" value="${escapeHtml(slot?.name || "")}" placeholder="Ví dụ: Ca giữa ngày">
                </label>
                <label>
                  <span>Tông màu</span>
                  <select id="shiftSlotToneInput">
                    ${Object.entries(SHIFT_TONES).map(([key, meta]) => `<option value="${key}" ${slot?.tone === key ? "selected" : ""}>${escapeHtml(meta.label)}</option>`).join("")}
                  </select>
                </label>
                <label>
                  <span>Ngày áp dụng</span>
                  <input id="shiftSlotDateInput" type="date" value="${escapeHtml(slot?.appliesToDate || "")}">
                </label>
                <label>
                  <span>Bắt đầu</span>
                  <input id="shiftSlotStartInput" type="time" value="${escapeHtml(slot?.start || "08:00")}">
                </label>
                <label>
                  <span>Kết thúc</span>
                  <input id="shiftSlotEndInput" type="time" value="${escapeHtml(slot?.end || "17:00")}">
                </label>
                <label class="toggle-row span-2">
                  <input id="shiftSlotEnabledInput" type="checkbox" ${slot ? (slot.enabled ? "checked" : "") : "checked"}>
                  <span>Mở đăng ký ca này</span>
                </label>
              </div>
              <div class="user-modal-footer">
                <div class="user-modal-actions">
                  ${slot ? `<button class="ghost-button user-footer-button shift-delete-button" type="button" data-shift-action="delete-slot" data-slot-id="${slot.id}">Xóa ca</button>` : ""}
                  <button class="ghost-button user-footer-button" type="button" data-shift-action="close-modal">Hủy</button>
                  <button class="primary-button user-footer-button" type="button" data-shift-action="save-slot" data-slot-id="${slot?.id || ""}">Lưu ca</button>
                </div>
              </div>
            </div>
          </div>
        `;
    }

    if (shiftModalState.type === "assign") {
        const shift = shiftWorkspaceState.shifts.find((item) => item.id === shiftModalState.shiftId);
        const selectedIds = new Set(getAssignmentRecords(shiftModalState.dateKey, shiftModalState.shiftId).map((record) => Number(record.userId)));
        const selectedCount = selectedIds.size;
        const isAtLimit = selectedCount >= MAX_STAFF_PER_SHIFT;

        return `
          <div class="modal-backdrop shift-modal-backdrop">
            <div class="modal-card shift-modal-card">
              <div class="user-modal-header">
                <div>
                  <h2>Phân công nhân sự</h2>
                </div>
                <button class="user-modal-close" type="button" data-shift-action="close-modal">×</button>
              </div>
              <div class="shift-assign-limit-note ${isAtLimit ? "is-full" : ""}">
                Đã chọn <strong>${formatNumber(selectedCount)}/${MAX_STAFF_PER_SHIFT}</strong> nhân viên cho ca này.
              </div>
              <div class="shift-assign-list">
                ${getStaffMembers().length ? getStaffMembers().map((user) => `
                  <label class="shift-assign-option">
                    <input type="checkbox" value="${user.id}" data-shift-picker="employee" ${selectedIds.has(Number(user.id)) ? "checked" : ""} ${isAtLimit && !selectedIds.has(Number(user.id)) ? "disabled" : ""}>
                    <span class="shift-assign-avatar">${escapeHtml((user.username || "U").trim().charAt(0).toUpperCase())}</span>
                    <span class="shift-assign-copy">
                      <strong>${escapeHtml(user.username || user.email || "Nhân viên")}</strong>
                      <small>${escapeHtml(user.phone || user.role || "Nhân sự nội bộ")}</small>
                    </span>
                  </label>
                `).join("") : '<div class="users-empty-state"><strong>Chưa có nhân viên nội bộ.</strong><span>Hãy tạo tài khoản nhân viên trước khi phân ca.</span></div>'}
              </div>
              <div class="user-modal-footer">
                <div class="user-modal-actions">
                  <button class="ghost-button user-footer-button" type="button" data-shift-action="close-modal">Hủy</button>
                  <button class="primary-button user-footer-button" type="button" data-shift-action="save-assignments" data-date="${shiftModalState.dateKey}" data-shift-id="${shiftModalState.shiftId}">Lưu phân công</button>
                </div>
              </div>
            </div>
          </div>
        `;
    }

    if (shiftModalState.type === "holidays") {
        const weekDates = buildWeekDates();
        const selectedHolidays = new Set(normalizeHolidays(shiftWorkspaceState.holidays));

        return `
          <div class="modal-backdrop shift-modal-backdrop">
            <div class="modal-card shift-modal-card">
              <div class="user-modal-header">
                <div>
                  <h2>Chỉnh ngày nghỉ lễ</h2>
                </div>
                <button class="user-modal-close" type="button" data-shift-action="close-modal">×</button>
              </div>
              <div class="shift-holiday-list">
                ${weekDates.map((date) => {
                    const dateKey = toDateKey(date);
                    return `
                      <label class="shift-holiday-option">
                        <input type="checkbox" value="${escapeHtml(dateKey)}" data-shift-picker="holiday" ${selectedHolidays.has(dateKey) ? "checked" : ""}>
                        <span>
                          <strong>${escapeHtml(formatDayName(date))}</strong>
                          <small>${escapeHtml(formatShiftDateLabel(dateKey))}</small>
                        </span>
                      </label>
                    `;
                }).join("")}
              </div>
              <div class="user-modal-footer">
                <div class="user-modal-actions">
                  <button class="ghost-button user-footer-button" type="button" data-shift-action="close-modal">Hủy</button>
                  <button class="primary-button user-footer-button" type="button" data-shift-action="save-holidays">Lưu ngày nghỉ</button>
                </div>
              </div>
            </div>
          </div>
        `;
    }

    return "";
}

async function sendShiftConfirmationEmails(users, shift, dateKey) {
    const employeeIds = users.map((user) => Number(user.id)).filter(Boolean);
    if (!employeeIds.length) return { sentCount: 0, failedCount: 0 };

    const payload = {
        branch_name: getBranchLabel(),
        shift_name: shift.name,
        shift_date: dateKey,
        shift_date_label: formatShiftDateLabel(dateKey),
        start_time: shift.start,
        end_time: shift.end,
        employee_ids: employeeIds
    };

    return apiFetch("/api/staff-shifts/confirm-notification", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

async function sendWeeklyShiftScheduleEmails(scheduleItems) {
    const schedules = scheduleItems.map((item) => ({
        employee_id: Number(item.user?.id || 0),
        shift_name: item.shift.name,
        shift_date: item.dateKey,
        shift_date_label: formatShiftDateLabel(item.dateKey),
        start_time: item.shift.start,
        end_time: item.shift.end
    })).filter((item) => item.employee_id);

    if (!schedules.length) return { sentCount: 0, failedCount: 0 };

    return apiFetch("/api/staff-shifts/confirm-notification", {
        method: "POST",
        body: JSON.stringify({
            branch_name: getBranchLabel(),
            schedules
        })
    });
}

function getEmailResultCounts(result) {
    return {
        sent: Number(result?.sentCount || result?.sent_count || 0),
        failed: Number(result?.failedCount || result?.failed_count || 0)
    };
}

function buildEmailResultNotice(result) {
    const counts = getEmailResultCounts(result);
    const parts = [`${counts.sent} thành công`];

    if (counts.failed) {
        parts.push(`${counts.failed} lỗi`);
    }

    return {
        ...counts,
        text: `Email: ${parts.join(", ")}.`
    };
}

function buildEmailFailureText(result) {
    const failed = Array.isArray(result?.failed) ? result.failed : [];
    const firstError = failed.find((item) => item?.error);
    if (!firstError) return "";
    return ` Lỗi đầu tiên: ${firstError.email || "email"} - ${firstError.error}.`;
}

export function renderStaffShiftWorkspace() {
    const weekDates = buildWeekDates();
    const activeBranches = ensureActiveBranchSelection();
    const currentBranchId = shiftWorkspaceState.branchId;
    const { pendingCount, confirmedCount } = summarizeAssignments();
    const hasScheduledStaff = pendingCount + confirmedCount > 0;
    const target = getShiftContentElement();
    if (!target) return;

    target.innerHTML = `
      <section class="staff-shifts-page">
        <article class="surface shift-board-card">
          <div class="shift-board-toolbar">
            <div class="shift-toolbar-controls">
              <label class="shift-toolbar-field">
                <span>Chi nhánh</span>
                <select data-shift-field="branch" ${activeBranches.length ? "" : "disabled"}>
                  ${activeBranches.length
                    ? activeBranches.map((branch) => `<option value="${branch.id}" ${branch.id === currentBranchId ? "selected" : ""}>${escapeHtml(branch.label)}</option>`).join("")
                    : '<option value="">Chưa có chi nhánh đang hoạt động</option>'}
                </select>
              </label>
              <div class="shift-week-switcher">
                <span>${escapeHtml(formatWeekLabel(weekDates))}</span>
                <div class="shift-week-actions">
                  <button class="chip-button" type="button" data-shift-action="prev-week">←</button>
                  <button class="chip-button" type="button" data-shift-action="reset-week">Tuần này</button>
                  <button class="chip-button" type="button" data-shift-action="next-week">→</button>
                </div>
              </div>
              <label class="shift-toolbar-field shift-week-picker">
                <span>Chọn tuần</span>
                <input type="week" data-shift-field="week" value="${escapeHtml(formatWeekInputValue(weekDates[0]))}">
              </label>
              <button class="chip-button shift-confirm-week-button" type="button" data-shift-action="confirm-week" ${hasScheduledStaff ? "" : "disabled"}>Xác nhận / gửi lịch tuần${pendingCount ? ` (${formatNumber(pendingCount)} chờ)` : ""}</button>
              <button class="chip-button" type="button" data-shift-action="open-holidays-modal">Chỉnh ngày nghỉ lễ</button>
              <button class="primary-button shift-create-button" type="button" data-shift-action="open-slot-modal">+ Tạo ca mới</button>
            </div>
          </div>
          ${buildPendingNotice()}

          <div class="shift-board-table-wrap">
            <table class="shift-board-table">
              <thead>
                <tr>
                  <th class="shift-time-head">Khung giờ</th>
                  ${weekDates.map((date) => {
                      const dateKey = toDateKey(date);
                      const todayKey = toDateKey(new Date());
                      return `
                        <th class="${dateKey === todayKey ? "is-today" : ""} ${isHolidayDate(dateKey) ? "is-holiday" : ""}">
                          <span>${escapeHtml(formatDayName(date))}</span>
                          <strong>${escapeHtml(`${date.getDate()}`)}</strong>
                          ${isHolidayDate(dateKey) ? '<em>Nghỉ lễ</em>' : ""}
                        </th>
                      `;
                  }).join("")}
                </tr>
              </thead>
              <tbody>
                ${shiftWorkspaceState.shifts.map((shift) => buildShiftRow(shift, weekDates)).join("")}
              </tbody>
            </table>
          </div>

          <div class="shift-board-footer">
            <div class="shift-board-legend">
              <span><i class="legend-dot morning"></i> Ca sáng</span>
              <span><i class="legend-dot afternoon"></i> Ca chiều</span>
              <span><i class="legend-dot evening"></i> Ca tối</span>
              <span><i class="legend-dot empty"></i> Chờ xác nhận / Ô trống</span>
            </div>
            <p class="section-copy">Nhân viên chỉ nhận email sau khi quản lý xác nhận ca.</p>
          </div>
        </article>
        ${buildShiftModal()}
      </section>
    `;
    requestShiftScheduleLoad();
    startShiftRealtimeSync();
}

export function handleStaffShiftFieldChange(target) {
    if (target?.dataset.shiftField === "branch") {
        shiftWorkspaceState.branchId = normalizeShiftBranchId(target.value);
        clearLoadedScheduleKey();
        persistShiftWorkspaceState();
        renderStaffShiftWorkspace();
        return;
    }

    if (target?.dataset.shiftField === "week") {
        const selectedWeekStart = parseWeekInputValue(target.value);
        if (!selectedWeekStart) return;

        const currentWeekStart = startOfWeek(new Date(), 0);
        const diffInWeeks = Math.round((selectedWeekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
        shiftWorkspaceState.weekOffset = diffInWeeks;
        clearLoadedScheduleKey();
        persistShiftWorkspaceState();
        renderStaffShiftWorkspace();
        return;
    }

    if (target?.dataset.shiftPicker === "employee") {
        const checkedInputs = Array.from(document.querySelectorAll("[data-shift-picker='employee']:checked"));
        if (checkedInputs.length > MAX_STAFF_PER_SHIFT) {
            target.checked = false;
            showToast(`Mỗi ca chỉ được tối đa ${MAX_STAFF_PER_SHIFT} nhân viên.`, true);
        }
    }
}

export async function handleStaffShiftAction(action, button) {
    if (!action) return;

    if (action === "prev-week") {
        shiftWorkspaceState.weekOffset -= 1;
        clearLoadedScheduleKey();
        persistShiftWorkspaceState();
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "next-week") {
        shiftWorkspaceState.weekOffset += 1;
        clearLoadedScheduleKey();
        persistShiftWorkspaceState();
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "reset-week") {
        shiftWorkspaceState.weekOffset = 0;
        clearLoadedScheduleKey();
        persistShiftWorkspaceState();
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "open-slot-modal") {
        shiftModalState = {
            type: "slot",
            slotId: button?.dataset.slotId || ""
        };
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "open-assign-modal") {
        const dateKey = String(button?.dataset.date || "");
        shiftModalState = {
            type: "assign",
            shiftId: button?.dataset.shiftId,
            dateKey,
            dateLabel: formatShiftDateLabel(dateKey)
        };
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "open-holidays-modal") {
        shiftModalState = { type: "holidays" };
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "close-modal") {
        shiftModalState = null;
        renderStaffShiftWorkspace();
        return;
    }

    if (action === "save-holidays") {
        const weekDateKeys = buildWeekDates().map(toDateKey);
        const selectedDateKeys = new Set(
            Array.from(document.querySelectorAll("[data-shift-picker='holiday']:checked"))
                .map((input) => String(input.value || "").trim())
                .filter(Boolean)
        );
        try {
            await apiFetch("/api/staff-shifts/holidays", {
                method: "PUT",
                body: JSON.stringify({
                    branch_id: shiftWorkspaceState.branchId,
                    week_dates: weekDateKeys,
                    dates: weekDateKeys.filter((dateKey) => selectedDateKeys.has(dateKey))
                })
            });
            shiftModalState = null;
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast("Đã cập nhật ngày nghỉ lễ trong tuần.");
        } catch (error) {
            showToast(error.message || "Không lưu được ngày nghỉ lễ.", true);
        }
        return;
    }

    if (action === "save-slot") {
        const name = String(document.querySelector("#shiftSlotNameInput")?.value || "").trim();
        const start = String(document.querySelector("#shiftSlotStartInput")?.value || "").trim();
        const end = String(document.querySelector("#shiftSlotEndInput")?.value || "").trim();
        const tone = String(document.querySelector("#shiftSlotToneInput")?.value || "morning").trim();
        const enabled = Boolean(document.querySelector("#shiftSlotEnabledInput")?.checked);
        const appliesToDate = String(document.querySelector("#shiftSlotDateInput")?.value || "").trim();
        const slotId = String(button?.dataset.slotId || "").trim();

        if (!name || !start || !end) {
            showToast("Vui lòng nhập đủ tên ca và khung giờ.", true);
            return;
        }

        try {
            await apiFetch(slotId ? `/api/staff-shifts/slots/${encodeURIComponent(slotId)}` : "/api/staff-shifts/slots", {
                method: slotId ? "PATCH" : "POST",
                body: JSON.stringify({
                    branch_id: shiftWorkspaceState.branchId,
                    id: slotId || `shift-${Date.now()}`,
                    name,
                    start,
                    end,
                    tone,
                    enabled,
                    appliesToDate
                })
            });
            shiftModalState = null;
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast(slotId ? "Đã cập nhật ca làm việc." : "Đã tạo ca làm việc mới.");
        } catch (error) {
            showToast(error.message || "Không lưu được ca làm việc.", true);
        }
        return;
    }

    if (action === "delete-slot") {
        const slotId = String(button?.dataset.slotId || "");
        if (!slotId) return;
        const slot = shiftWorkspaceState.shifts.find((shift) => shift.id === slotId);
        if (!window.confirm(`Bạn chắc chắn muốn xóa ${slot?.name || "ca làm việc"}? Toàn bộ phân công của ca này cũng sẽ bị xóa.`)) {
            return;
        }

        try {
            await apiFetch(`/api/staff-shifts/slots/${encodeURIComponent(slotId)}?branch_id=${encodeURIComponent(shiftWorkspaceState.branchId)}`, {
                method: "DELETE"
            });
            shiftModalState = null;
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast("Đã xóa ca làm việc.");
        } catch (error) {
            showToast(error.message || "Không xóa được ca làm việc.", true);
        }
        return;
    }

    if (action === "save-assignments") {
        const shiftId = String(button?.dataset.shiftId || "");
        const dateKey = String(button?.dataset.date || "");
        if (!shiftId || !dateKey) return;

        const checkedIds = Array.from(document.querySelectorAll("[data-shift-picker='employee']:checked"))
            .map((input) => Number(input.value))
            .filter(Boolean);
        if (checkedIds.length > MAX_STAFF_PER_SHIFT) {
            showToast(`Mỗi ca chỉ được tối đa ${MAX_STAFF_PER_SHIFT} nhân viên.`, true);
            return;
        }
        try {
            await apiFetch("/api/staff-shifts/assignments", {
                method: "PUT",
                body: JSON.stringify({
                    branch_id: shiftWorkspaceState.branchId,
                    date: dateKey,
                    shift_id: shiftId,
                    employee_ids: checkedIds
                })
            });
            shiftModalState = null;
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast("Đã cập nhật nhân sự trong ca. Bấm Xác nhận / gửi lịch tuần để gửi lại lịch mới cho nhân viên.");
        } catch (error) {
            showToast(error.message || "Không cập nhật được nhân sự trong ca.", true);
        }
        return;
    }

    if (action === "self-register") {
        const shiftId = String(button?.dataset.shiftId || "");
        const dateKey = String(button?.dataset.date || "");
        const currentUserId = getCurrentUserId();
        if (!shiftId || !dateKey || !currentUserId) return;

        const existing = getAssignmentRecords(dateKey, shiftId).find((record) => Number(record.userId) === currentUserId);
        if (existing) {
            showToast("Bạn đã đăng ký ca này rồi.");
            return;
        }

        const currentRecords = getAssignmentRecords(dateKey, shiftId);
        if (currentRecords.length >= MAX_STAFF_PER_SHIFT) {
            showToast(`Ca này đã đủ tối đa ${MAX_STAFF_PER_SHIFT} nhân viên.`, true);
            return;
        }

        try {
            await apiFetch("/api/staff-shifts/assignments/self", {
                method: "POST",
                body: JSON.stringify({
                    branch_id: shiftWorkspaceState.branchId,
                    date: dateKey,
                    shift_id: shiftId
                })
            });
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast("Đã đăng ký ca làm việc. Chờ quản lý xác nhận.");
        } catch (error) {
            showToast(error.message || "Không đăng ký được ca làm việc.", true);
        }
        return;
    }

    if (action === "confirm-week") {
        if (!isAdminUser()) {
            showToast("Chỉ quản trị viên mới có quyền xác nhận ca và gửi email.", true);
            return;
        }

        const weekDates = buildWeekDates();
        let confirmedCount = 0;
        let sentCount = 0;
        let failedCount = 0;
        const weeklyScheduleItems = [];
        let firstEmailError = "";

        for (const date of weekDates) {
            const dateKey = toDateKey(date);
            if (isHolidayDate(dateKey)) continue;

            for (const shift of shiftWorkspaceState.shifts.filter((item) => item.enabled)) {
                if (shift.appliesToDate && shift.appliesToDate !== dateKey) continue;

                const detailed = getDetailedAssignments(dateKey, shift.id);
                const pendingUsers = detailed.filter((item) => item.status === "pending");
                if (!detailed.length) continue;

                if (pendingUsers.length) {
                    try {
                        await apiFetch("/api/staff-shifts/assignments/confirm", {
                            method: "PATCH",
                            body: JSON.stringify({
                                branch_id: shiftWorkspaceState.branchId,
                                date: dateKey,
                                shift_id: shift.id,
                                employee_ids: pendingUsers.map((item) => Number(item.user.id)).filter(Boolean),
                                confirmation_source: "week"
                            })
                        });
                    } catch (error) {
                        showToast(error.message || "Không xác nhận được ca làm việc.", true);
                        return;
                    }
                }
                confirmedCount += pendingUsers.length;
                weeklyScheduleItems.push(...detailed.map((item) => ({
                    user: item.user,
                    shift,
                    dateKey
                })));
            }
        }

        clearLoadedScheduleKey();
        await refreshShiftSchedule({ force: true, renderAfter: true });
        if (!weeklyScheduleItems.length) {
            showToast("Tuần này chưa có ca nào để gửi email lịch làm việc.");
            return;
        }

        try {
            const emailResult = await sendWeeklyShiftScheduleEmails(weeklyScheduleItems);
            const emailCounts = getEmailResultCounts(emailResult);
            sentCount = emailCounts.sent;
            failedCount = emailCounts.failed;
            firstEmailError = buildEmailFailureText(emailResult);
        } catch (error) {
            const uniqueUserIds = new Set(weeklyScheduleItems.map((item) => Number(item.user?.id || 0)).filter(Boolean));
            failedCount = uniqueUserIds.size;
            const message = error.message || "Không gửi được email";
            firstEmailError = message.includes("Thiếu thông tin để gửi email xác nhận ca làm việc")
                ? " Lỗi đầu tiên: backend đang chạy bản cũ, hãy restart backend rồi gửi lại lịch tuần."
                : ` Lỗi đầu tiên: ${message}.`;
        }

        showToast(`Đã xác nhận ${confirmedCount} lượt đăng ký và gửi email lịch tuần. Email: ${sentCount} nhân viên thành công${failedCount ? `, ${failedCount} lỗi.` : "."}${firstEmailError}`);
        return;
    }

    if (action === "confirm-registrations") {
        const shiftId = String(button?.dataset.shiftId || "");
        const dateKey = String(button?.dataset.date || "");
        if (!shiftId || !dateKey) return;

        if (!isAdminUser()) {
            showToast("Chỉ quản trị viên mới có quyền xác nhận ca và gửi email.", true);
            return;
        }

        const shift = shiftWorkspaceState.shifts.find((item) => item.id === shiftId);
        const detailed = getDetailedAssignments(dateKey, shiftId);
        const pendingUsers = detailed.filter((item) => item.status === "pending");

        if (!shift || !pendingUsers.length) {
            showToast("Ca này không có nhân viên chờ xác nhận.", true);
            return;
        }

        try {
            await apiFetch("/api/staff-shifts/assignments/confirm", {
                method: "PATCH",
                body: JSON.stringify({
                    branch_id: shiftWorkspaceState.branchId,
                    date: dateKey,
                    shift_id: shiftId,
                    employee_ids: pendingUsers.map((item) => Number(item.user.id)).filter(Boolean),
                    confirmation_source: "slot"
                })
            });
        } catch (error) {
            showToast(error.message || "Không xác nhận được ca làm việc.", true);
            return;
        }

        let emailNotice = "";
        try {
            const emailResult = await sendShiftConfirmationEmails(pendingUsers.map((item) => item.user), shift, dateKey);
            emailNotice = ` ${buildEmailResultNotice(emailResult).text}${buildEmailFailureText(emailResult)}`;
        } catch (error) {
            emailNotice = ` Tuy nhiên email chưa gửi được: ${error.message || "lỗi không xác định"}.`;
        }

        clearLoadedScheduleKey();
        await refreshShiftSchedule({ force: true, renderAfter: true });
        showToast(`Đã xác nhận ca cho ${pendingUsers.length} nhân viên.${emailNotice}`);
        return;
    }

    if (action === "remove-assignment") {
        const shiftId = String(button?.dataset.shiftId || "");
        const dateKey = String(button?.dataset.date || "");
        const userId = Number(button?.dataset.userId || 0);
        if (!shiftId || !dateKey || !userId) return;
        try {
            const params = new URLSearchParams({
                branch_id: shiftWorkspaceState.branchId,
                date: dateKey,
                shift_id: shiftId,
                employee_id: String(userId)
            });
            await apiFetch(`/api/staff-shifts/assignments?${params.toString()}`, {
                method: "DELETE"
            });
            clearLoadedScheduleKey();
            await refreshShiftSchedule({ force: true, renderAfter: true });
            showToast("Đã gỡ nhân sự khỏi ca.");
        } catch (error) {
            showToast(error.message || "Không gỡ được nhân sự khỏi ca.", true);
        }
    }
}
