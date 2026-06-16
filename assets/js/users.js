import {
    apiFetch,
    elements,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatNumber,
    resolveMediaUrl,
    showToast,
    state,
    statusPill
} from "./core.js";
import { renderStaffShiftWorkspace } from "./staff-shifts.js";

const USERS_PER_PAGE = 8;
const CUSTOMER_TIERS = [
    { key: "", label: "Tất cả" },
    { key: "dong", label: "Đồng" },
    { key: "bac", label: "Bạc" },
    { key: "vang", label: "Vàng" },
    { key: "bach_kim", label: "Bạch kim" },
    { key: "kim_cuong", label: "Kim cương" },
    { key: "vip", label: "VIP" }
];
const CUSTOMER_TIER_LABELS = new Map(CUSTOMER_TIERS.filter((tier) => tier.key).map((tier) => [tier.key, tier.label]));

function normalizeCustomerTierKey(value = "") {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_");
}

function getCustomerTierLabelByKey(value, fallback = "Đồng") {
    const normalizedKey = normalizeCustomerTierKey(value);
    const normalizedFallbackKey = normalizeCustomerTierKey(fallback);
    return CUSTOMER_TIER_LABELS.get(normalizedKey)
        || CUSTOMER_TIER_LABELS.get(normalizedFallbackKey)
        || fallback
        || "Đồng";
}

function getCustomerTierLabel(customer) {
    return getCustomerTierLabelByKey(customer?.membership_tier || customer?.membership_tier_label, customer?.membership_tier_label || "Đồng");
}

function getCustomerNextTierLabel(customer) {
    return getCustomerTierLabelByKey(
        customer?.next_membership_tier || customer?.next_membership_tier_label,
        customer?.next_membership_tier_label || ""
    );
}

let userAvatarFile = null;
let customerProfileContext = {
    customer: null,
    orders: []
};

function isCustomerWorkspace() {
    return state.userWorkspace === "customers";
}

function isShiftWorkspace() {
    return state.userWorkspace === "shifts";
}

function defaultUserAvatar(name = "User") {
    const initials = String(name || "US")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "US";

    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="30" fill="#edf5ea"/><circle cx="48" cy="36" r="16" fill="#0f7442" opacity=".86"/><path d="M24 74c5-12 15-18 24-18s19 6 24 18" fill="#0f7442" opacity=".86"/><text x="50%" y="90%" text-anchor="middle" font-family="Arial" font-size="12" fill="#6c7f70">${initials}</text></svg>`
    )}`;
}

function getAvatarSource(user) {
    return resolveMediaUrl(user?.avatar_url, defaultUserAvatar(user?.username || user?.email || "User"));
}

function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
    return String(value || "").replace(/\D+/g, "");
}

function sortOrdersByNewest(orders = []) {
    return [...orders].sort((left, right) => {
        const leftTime = new Date(left?.created_at || 0).getTime();
        const rightTime = new Date(right?.created_at || 0).getTime();
        return rightTime - leftTime;
    });
}

function filterOrdersForCustomer(orders = [], customer = null) {
    if (!customer) return [];
    const customerId = Number(customer.id);
    const customerEmail = normalizeEmail(customer.email);
    const customerPhone = normalizePhone(customer.phone);

    return orders.filter((order) => {
        const orderUserId = Number(order?.user_id || order?.user?.id || order?.customer_id);
        const orderEmail = normalizeEmail(order?.customer_email || order?.user?.email);
        const orderPhone = normalizePhone(order?.customer_phone || order?.shipping_phone || order?.user?.phone);

        if (customerId && orderUserId && customerId === orderUserId) {
            return true;
        }

        if (customerEmail && orderEmail && customerEmail === orderEmail) {
            return true;
        }

        if (customerPhone && orderPhone && customerPhone === orderPhone) {
            return true;
        }

        return false;
    });
}

async function loadCustomerOrders(customer) {
    const customerId = Number(customer?.id || 0);
    let orders = [];

    if (customerId) {
        try {
            const response = await apiFetch(`/api/orders?user_id=${customerId}`);
            orders = Array.isArray(response) ? response : [];
        } catch (error) {
            orders = [];
        }
    }

    if (!orders.length) {
        orders = filterOrdersForCustomer(Array.isArray(state.orders) ? state.orders : [], customer);
    }

    if (!orders.length) {
        try {
            const response = await apiFetch("/api/orders");
            orders = filterOrdersForCustomer(Array.isArray(response) ? response : [], customer);
        } catch (error) {
            orders = [];
        }
    }

    return sortOrdersByNewest(orders);
}

function getActiveCollection() {
    return isCustomerWorkspace() ? (state.customers || []) : (state.users || []);
}

function getActivePageState() {
    return isCustomerWorkspace() ? state.customerAdminPage : state.userAdminPage;
}

function setActivePageState(page) {
    if (isCustomerWorkspace()) {
        state.customerAdminPage = page;
        return;
    }
    state.userAdminPage = page;
}

function getUsersPageCount(total) {
    return Math.max(1, Math.ceil(total / USERS_PER_PAGE));
}

function getCurrentPageItems() {
    return getActiveCollection();
}

function getRoleLabel(role) {
    if (role === "admin") return "Quản trị";
    if (role === "staff") return "Nhân viên";
    if (role === "customer") return "Khách hàng";
    return role || "-";
}

function getStatusLabel(status) {
    if (status === "active") return "Hoạt động";
    if (status === "inactive") return "Tạm ngưng";
    if (status === "blocked") return "Bị khóa";
    return status || "-";
}

function getLastSeenLabel(user) {
    const dateValue = user?.updated_at || user?.created_at;
    if (!dateValue) return "Chưa có";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Chưa rõ";

    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return "Vừa xong";
    if (diffMinutes < 60) return `${formatNumber(diffMinutes)} phút trước`;
    if (diffMinutes < 1440) return `${formatNumber(Math.round(diffMinutes / 60))} giờ trước`;
    return `${formatNumber(Math.round(diffMinutes / 1440))} ngày trước`;
}

function canManageAdminAccount(targetUser) {
    return state.user?.role === "admin" || targetUser?.role !== "admin";
}

function getUserById(userId) {
    return getActiveCollection().find((user) => Number(user.id) === Number(userId)) || null;
}

function getCustomerTierThreshold(tierKey) {
    const tierIndex = CUSTOMER_TIERS.findIndex((tier) => tier.key === tierKey);
    if (tierIndex <= 0) return { currentMin: 0, nextMin: CUSTOMER_TIERS[1]?.minPoints || 0 };
    const normalizedTiers = [
        { key: "dong", minPoints: 0 },
        { key: "bac", minPoints: 500 },
        { key: "vang", minPoints: 2500 },
        { key: "bach_kim", minPoints: 5000 },
        { key: "kim_cuong", minPoints: 14000 },
        { key: "vip", minPoints: 20000 }
    ];
    const normalizedIndex = normalizedTiers.findIndex((tier) => tier.key === tierKey);
    return {
        currentMin: normalizedTiers[normalizedIndex]?.minPoints || 0,
        nextMin: normalizedTiers[normalizedIndex + 1]?.minPoints || null
    };
}

function calculateOrderLoyaltyPoints(orderValue) {
    const value = Number(orderValue || 0);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.ceil((value / 100000) * 50);
}

function canManageUserRoles() {
    return state.user?.role === "admin";
}

function syncRoleOptions(selectedRole = "staff") {
    const roleField = elements.userForm?.elements.role;
    if (!roleField) return;

    if (isCustomerWorkspace()) {
        roleField.innerHTML = '<option value="customer">Khách hàng</option>';
        roleField.value = "customer";
        roleField.disabled = true;
        return;
    }

    const canEditRole = canManageUserRoles();
    roleField.innerHTML = `
      <option value="staff">Nhân viên</option>
      ${canEditRole ? '<option value="admin">Quản trị</option>' : ""}
    `;
    roleField.value = canEditRole ? selectedRole : "staff";
    roleField.disabled = !canEditRole;
    roleField.title = canEditRole ? "" : "Chỉ tài khoản quản trị mới được thay đổi vai trò.";
}

function setPanelHeadings() {
    if (!elements.usersPanelTitle || !elements.openUserFormButton) return;

    if (isShiftWorkspace()) {
        elements.usersPanelTitle.textContent = "Qu\u1ea3n l\u00fd ca l\u00e0m vi\u1ec7c";
        if (elements.usersListTitle) {
            elements.usersListTitle.textContent = "L\u1ecbch ca l\u00e0m vi\u1ec7c";
            elements.usersListTitle.classList.remove("hidden");
            elements.usersListTitle.closest(".section-head")?.classList.remove("hidden");
        }
        elements.openUserFormButton.classList.add("hidden");
        return;
    }

    elements.openUserFormButton.classList.remove("hidden");

    if (isCustomerWorkspace()) {
        elements.usersPanelTitle.textContent = "Quản lý khách hàng";
        if (elements.usersListTitle) {
            elements.usersListTitle.textContent = "";
            elements.usersListTitle.classList.add("hidden");
            elements.usersListTitle.closest(".section-head")?.classList.add("hidden");
        }
        elements.openUserFormButton.textContent = "Thêm khách hàng";
        return;
    }

    elements.usersPanelTitle.textContent = "Quản lý admin và nhân viên";
    if (elements.usersListTitle) {
        elements.usersListTitle.textContent = "";
        elements.usersListTitle.classList.add("hidden");
        elements.usersListTitle.closest(".section-head")?.classList.add("hidden");
    }
    elements.openUserFormButton.textContent = "Tạo tài khoản mới";
}

function renderFilterForm() {
    if (!elements.userFilterForm || !elements.usersToolbarCard) return;

    if (isShiftWorkspace()) {
        elements.usersToolbarCard.classList.add("hidden");
        return;
    }

    elements.usersToolbarCard.classList.remove("hidden");

    if (isCustomerWorkspace()) {
        const currentKeyword = escapeHtml(state.filters.customers.keyword || "");
        const currentStatus = String(state.filters.customers.status || "");
        const currentTier = String(state.filters.customers.tier || "");
        elements.userFilterForm.innerHTML = `
          <label class="span-2">
            <span>Tìm kiếm khách hàng</span>
            <input name="keyword" value="${currentKeyword}" placeholder="Tìm theo tên, email, số điện thoại hoặc mã khách hàng...">
          </label>
          <label>
            <span>Trạng thái</span>
            <select name="status">
              <option value="">Tất cả trạng thái</option>
              <option value="active" ${currentStatus === "active" ? "selected" : ""}>Đang hoạt động</option>
              <option value="inactive" ${currentStatus === "inactive" ? "selected" : ""}>Tạm ngưng</option>
              <option value="blocked" ${currentStatus === "blocked" ? "selected" : ""}>Bị khóa</option>
            </select>
          </label>
          <label class="customer-tier-select-field">
            <span>Hạng thành viên</span>
            <select name="tier">
              ${CUSTOMER_TIERS.map((tier) => `<option value="${escapeHtml(tier.key)}" ${currentTier === tier.key ? "selected" : ""}>${escapeHtml(tier.label)}</option>`).join("")}
            </select>
          </label>
          <button class="primary-button" type="submit">Áp dụng</button>
        `;
        return;
    }

    const currentKeyword = escapeHtml(state.filters.users.keyword || "");
    const currentRole = String(state.filters.users.role || "");
    const currentStatus = String(state.filters.users.status || "");
    elements.userFilterForm.innerHTML = `
      <label>
        <span>Từ khóa</span>
        <input name="keyword" value="${currentKeyword}" placeholder="Tìm theo tên, email hoặc số điện thoại...">
      </label>
      <label>
        <span>Vai trò</span>
        <select name="role">
          <option value="">Tất cả vai trò</option>
          <option value="admin" ${currentRole === "admin" ? "selected" : ""}>Quản trị</option>
          <option value="staff" ${currentRole === "staff" ? "selected" : ""}>Nhân viên</option>
        </select>
      </label>
      <label>
        <span>Trạng thái</span>
        <select name="status">
          <option value="">Tất cả trạng thái</option>
          <option value="active" ${currentStatus === "active" ? "selected" : ""}>Đang hoạt động</option>
          <option value="inactive" ${currentStatus === "inactive" ? "selected" : ""}>Tạm ngưng</option>
          <option value="blocked" ${currentStatus === "blocked" ? "selected" : ""}>Bị khóa</option>
        </select>
      </label>
      <button class="primary-button" type="submit">Áp dụng</button>
    `;
}

function buildStaffSummary() {
    return "";
}

function buildStaffRows() {
    const users = getCurrentPageItems();
    if (!users.length) {
        return `
          <div class="users-empty-state">
            <strong>Chưa có tài khoản nội bộ phù hợp.</strong>
            <span>Thử đổi bộ lọc hoặc tạo tài khoản mới cho admin và nhân viên.</span>
          </div>
        `;
    }

    return `
      <div class="users-table-wrap">
        <table class="list-table users-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Vai trò</th>
              <th>Liên hệ</th>
              <th>Cập nhật</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((user) => {
                const canManage = canManageAdminAccount(user);
                const canDelete = state.user?.role === "admin" && Number(user.id) !== Number(state.user?.id);
                const toggleLabel = user.status === "active" ? "Khóa" : "Kích hoạt";
                const toggleAction = user.status === "active" ? "block" : "activate";

                return `
                  <tr>
                    <td>
                      <div class="user-name-cell">
                        <img class="user-avatar" src="${escapeHtml(getAvatarSource(user))}" alt="${escapeHtml(user.username || user.email || "User")}">
                        <div class="user-copy">
                          <strong>${escapeHtml(user.username || "Chưa đặt tên")}</strong>
                          <span>${escapeHtml(user.email || "-")}</span>
                          <small>${escapeHtml(user.code || `ID #${user.id}`)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="user-role-stack">
                        <strong>${escapeHtml(user.role_label || getRoleLabel(user.role))}</strong>
                        <span>${escapeHtml(user.role || "-")}</span>
                      </div>
                    </td>
                    <td>
                      <div class="user-contact-stack">
                        <span>${escapeHtml(user.phone || "Chưa có số điện thoại")}</span>
                      </div>
                    </td>
                    <td>
                      <div class="user-updated-stack">
                        <strong>${escapeHtml(getLastSeenLabel(user))}</strong>
                        <span>${escapeHtml(formatDate(user.updated_at || user.created_at))}</span>
                      </div>
                    </td>
                    <td>${statusPill(user.status, user.status_label || getStatusLabel(user.status))}</td>
                    <td>
                      <div class="users-actions">
                        <button class="chip-button" type="button" data-user-action="edit" data-id="${user.id}">Sửa</button>
                        ${canManage && Number(user.id) !== Number(state.user?.id) ? `<button class="chip-button" type="button" data-user-action="${toggleAction}" data-id="${user.id}" data-tone="accent">${toggleLabel}</button>` : ""}
                        ${canDelete && canManage ? `<button class="chip-button" type="button" data-user-action="delete" data-id="${user.id}" data-tone="danger">Xóa</button>` : ""}
                      </div>
                    </td>
                  </tr>
                `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
}

function buildTierBadge(customer) {
    const key = normalizeCustomerTierKey(customer.membership_tier || customer.membership_tier_label || "dong");
    const label = getCustomerTierLabel(customer);
    return `<span class="customer-tier-badge ${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

function buildCustomerRows() {
    const customers = getCurrentPageItems();
    if (!customers.length) {
        return `
          <div class="users-empty-state">
            <strong>Chưa có khách hàng phù hợp.</strong>
            <span>Điểm được tính theo từng hóa đơn hoàn thành: 100.000 VND = 50 điểm, điểm lẻ được làm tròn lên.</span>
          </div>
        `;
    }

    return `
      <div class="users-table-wrap">
        <table class="list-table users-table customer-users-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Hạng thành viên</th>
              <th>Điểm tích lũy</th>
              <th>Đơn hoàn thành</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map((customer) => {
                const toggleLabel = customer.status === "active" ? "Khóa" : "Kích hoạt";
                const toggleAction = customer.status === "active" ? "block" : "activate";
                const canDelete = state.user?.role === "admin" && Number(customer.id) !== Number(state.user?.id);
                const hasNextTier = Boolean(customer.next_membership_tier || customer.next_membership_tier_label);
                const nextTierLabel = getCustomerNextTierLabel(customer);

                return `
                  <tr>
                    <td>
                      <div class="user-name-cell">
                        <img class="user-avatar" src="${escapeHtml(getAvatarSource(customer))}" alt="${escapeHtml(customer.username || customer.email || "Customer")}">
                        <div class="user-copy">
                          <strong>${escapeHtml(customer.username || "Chưa đặt tên")}</strong>
                          <span>${escapeHtml(customer.email || "-")}</span>
                          <small>${escapeHtml(customer.phone || customer.code || `ID #${customer.id}`)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="customer-tier-stack">
                        ${buildTierBadge(customer)}
                        <small>${escapeHtml(hasNextTier ? `Còn ${formatNumber(customer.points_to_next_tier || 0)} điểm để lên ${nextTierLabel}` : "Đã đạt hạng cao nhất")}</small>
                      </div>
                    </td>
                    <td>
                      <div class="customer-points-stack">
                        <strong>${formatNumber(customer.loyalty_points || 0)}</strong>
                      </div>
                    </td>
                    <td>
                      <div class="customer-points-stack">
                        <strong>${formatNumber(customer.completed_orders_count || 0)}</strong>
                      </div>
                    </td>
                    <td>${statusPill(customer.status, customer.status_label || getStatusLabel(customer.status))}</td>
                    <td>
                      <div class="users-actions">
                        <button class="chip-button" type="button" data-user-action="view-customer" data-id="${customer.id}" data-tone="accent">Hồ sơ</button>
                        <button class="chip-button" type="button" data-user-action="edit" data-id="${customer.id}">Sửa</button>
                        <button class="chip-button" type="button" data-user-action="${toggleAction}" data-id="${customer.id}" data-tone="accent">${toggleLabel}</button>
                        ${canDelete ? `<button class="chip-button" type="button" data-user-action="delete" data-id="${customer.id}" data-tone="danger">Xóa</button>` : ""}
                      </div>
                    </td>
                  </tr>
                `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
}

function renderCustomerProfileModal() {
    const customer = customerProfileContext.customer;
    const orders = customerProfileContext.orders || [];
    if (!customer || !elements.customerProfileContent) return;

    const avatarSource = getAvatarSource(customer);
    const completedOrders = orders.filter((order) => order.status === "completed");
    const averageSpend = completedOrders.length
        ? completedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) / completedOrders.length
        : 0;
    const lastOrder = orders[0] || null;
    const { currentMin, nextMin } = getCustomerTierThreshold(customer.membership_tier);
    const points = Number(customer.loyalty_points || 0);
    const progressPercent = nextMin
        ? Math.min(100, Math.max(0, ((points - currentMin) / Math.max(1, nextMin - currentMin)) * 100))
        : 100;
    const hasNextTier = Boolean(customer.next_membership_tier || customer.next_membership_tier_label);
    const nextTierLabel = getCustomerNextTierLabel(customer);

    if (elements.customerProfileTitle) {
        elements.customerProfileTitle.textContent = customer.username || "Hồ sơ khách hàng";
    }
    elements.customerProfileContent.innerHTML = `
      <div class="customer-profile-top">
        <article class="customer-profile-card">
          <div class="customer-profile-identity">
            <img class="customer-profile-avatar" src="${escapeHtml(avatarSource)}" alt="${escapeHtml(customer.username || "Customer")}">
            <div>
              <h3>${escapeHtml(customer.username || "Chưa đặt tên")}</h3>
              <p>${escapeHtml(customer.email || "-")}</p>
              <small>${escapeHtml(customer.phone || "Chưa có số điện thoại")}</small>
              <div style="margin-top:10px;">${statusPill(customer.status, customer.status_label || getStatusLabel(customer.status))}</div>
            </div>
          </div>
          <div class="customer-profile-detail-grid">
            <div class="customer-profile-detail-item"><span>Mã khách hàng</span><strong>${escapeHtml(customer.code || `CUS-${customer.id}`)}</strong></div>
            <div class="customer-profile-detail-item"><span>Hạng hiện tại</span><strong>${buildTierBadge(customer)}</strong></div>
            <div class="customer-profile-detail-item"><span>Ngày tham gia</span><strong>${escapeHtml(formatDate(customer.created_at))}</strong></div>
            <div class="customer-profile-detail-item"><span>Lần cập nhật gần nhất</span><strong>${escapeHtml(formatDate(customer.updated_at || customer.created_at))}</strong></div>
          </div>
        </article>

        <article class="customer-profile-card">
          <div class="customer-profile-metrics">
            <div class="customer-profile-metric"><span>Điểm tích lũy</span><strong>${formatNumber(customer.loyalty_points || 0)}</strong></div>
            <div class="customer-profile-metric"><span>Tổng chi tiêu</span><strong>${formatCurrency(customer.total_spent || 0)}</strong></div>
            <div class="customer-profile-metric"><span>Đơn hoàn thành</span><strong>${formatNumber(customer.completed_orders_count || 0)}</strong></div>
            <div class="customer-profile-metric"><span>Giá trị trung bình</span><strong>${formatCurrency(averageSpend)}</strong></div>
          </div>
          <div class="customer-tier-progress">
            <div class="customer-tier-progress-head">
              <strong>${escapeHtml(getCustomerTierLabel(customer))}</strong>
              <span>${hasNextTier ? `Còn ${formatNumber(customer.points_to_next_tier || 0)} điểm để lên ${escapeHtml(nextTierLabel)}` : "Đã đạt hạng cao nhất"}</span>
            </div>
            <div class="customer-tier-progress-bar"><i style="width:${progressPercent}%"></i></div>
            <p>${lastOrder ? `Đơn gần nhất: ${escapeHtml(lastOrder.order_code || "-")} - ${escapeHtml(formatDate(lastOrder.created_at))}` : "Khách hàng chưa có đơn hàng nào."}</p>
          </div>
        </article>
      </div>

      <article class="surface customer-history-card">
        <div class="section-head">
          <div>
            <h3>Lịch sử mua hàng</h3>
            <p class="section-copy">Chi tiết hóa đơn, tổng chi tiêu, điểm cộng và trạng thái xử lý của từng đơn.</p>
          </div>
        </div>
        ${orders.length ? `
          <div class="customer-history-table-wrap">
            <table class="list-table customer-history-table">
              <thead>
                <tr>
                  <th>Đơn hàng</th>
                  <th>Ngày tạo</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết chi tiêu</th>
                  <th>Điểm cộng</th>
                  <th>Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                ${orders.map((order) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(order.order_code || `#${order.id}`)}</strong>
                      <small>${escapeHtml(order.item_count || 0)} sản phẩm</small>
                    </td>
                    <td>${escapeHtml(formatDate(order.created_at))}</td>
                    <td>
                      <strong>${escapeHtml(order.payment_status_label || order.payment_status || "-")}</strong>
                      <small>${escapeHtml(order.payment_method_label || order.payment_method || "-")}</small>
                    </td>
                    <td>${statusPill(order.status, order.status_label || order.status)}</td>
                    <td>
                      <small>Tạm tính: ${escapeHtml(formatCurrency(order.subtotal || 0))}</small><br>
                      <small>Ship: ${escapeHtml(formatCurrency(order.shipping_fee || 0))}</small><br>
                      <small>Giảm giá: ${escapeHtml(formatCurrency(order.discount_amount || 0))}</small>
                    </td>
                    <td>
                      <strong>${order.status === "completed" ? `+${formatNumber(calculateOrderLoyaltyPoints(order.total_amount))}` : "0"}</strong>
                      <small>${order.status === "completed" ? "Đã cộng điểm" : "Chưa hoàn thành"}</small>
                    </td>
                    <td><strong>${escapeHtml(formatCurrency(order.total_amount || 0))}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : '<div class="customer-profile-empty">Khách hàng này chưa có lịch sử mua hàng.</div>'}
      </article>
    `;
}

function buildPagination({ showSummary = true } = {}) {
    return "";
}

function setUserFormHeadings(isEditing) {
    if (!elements.userFormTitle || !elements.userFormSubmitButton) return;

    if (isCustomerWorkspace()) {
        elements.userFormTitle.textContent = isEditing ? "Cập nhật thông tin khách hàng" : "Tạo khách hàng mới";
        elements.userFormSubmitButton.textContent = isEditing ? "Lưu khách hàng" : "Tạo khách hàng";
        return;
    }

    elements.userFormTitle.textContent = isEditing ? "Cập nhật tài khoản nhân viên" : "Tạo tài khoản nhân viên mới";
    elements.userFormSubmitButton.textContent = isEditing ? "Lưu tài khoản" : "Tạo tài khoản";
}

function applyUserFormWorkspaceMode() {
    const codeField = elements.userForm?.elements.code?.closest("label");
    const roleField = elements.userForm?.elements.role?.closest("label");
    if (codeField) codeField.classList.toggle("hidden", isCustomerWorkspace());
    if (roleField) roleField.classList.toggle("hidden", isCustomerWorkspace());
    if (roleField) roleField.classList.toggle("is-disabled", !isCustomerWorkspace() && !canManageUserRoles());
}

function setUserPasswordMode(isEditing) {
    if (!elements.userForm) return;
    const createFields = ["password", "confirm_password"];
    const editFields = ["current_password", "new_password", "confirm_new_password"];

    createFields.forEach((field) => {
        const input = elements.userForm.elements[field];
        input?.closest("label")?.classList.toggle("hidden", isEditing);
        if (input) {
            input.required = !isEditing;
            input.value = "";
        }
    });

    editFields.forEach((field) => {
        const input = elements.userForm.elements[field];
        input?.closest("label")?.classList.toggle("hidden", !isEditing);
        if (input) {
            input.required = false;
            input.value = "";
        }
    });
}

function setAvatarPreview(value) {
    if (!elements.userAvatarPreview || !elements.userAvatarPlaceholder) return;

    const nextValue = String(value || "").trim();
    if (!nextValue) {
        elements.userAvatarPreview.src = "";
        elements.userAvatarPreview.classList.add("hidden");
        elements.userAvatarPlaceholder.classList.remove("hidden");
        return;
    }

    elements.userAvatarPreview.src = nextValue;
    elements.userAvatarPreview.classList.remove("hidden");
    elements.userAvatarPlaceholder.classList.add("hidden");
}

function generateUserCode() {
    const year = new Date().getFullYear();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `LH-${year}-${suffix}`;
}

async function uploadUserAvatar(file) {
    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch("/api/uploads/images?folder=users", {
        method: "POST",
        body: formData
    });

    return payload?.file?.relative_url
        || payload?.file?.url
        || payload?.hinh_anh?.duong_dan_tuong_doi
        || payload?.hinh_anh?.duong_dan
        || "";
}

async function reloadWorkspaceState() {
    if (isCustomerWorkspace()) {
        const params = new URLSearchParams();
        Object.entries(state.filters.customers || {}).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
        state.customers = await apiFetch(`/api/users/customers${params.toString() ? `?${params.toString()}` : ""}`);
        state.customersHydrated = true;
        renderUsers();
        return;
    }

    const params = new URLSearchParams();
    Object.entries(state.filters.users || {}).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    params.set("scope", "staff");
    state.users = await apiFetch(`/api/users?${params.toString()}`);
    state.usersHydrated = true;
    renderUsers();
}

export function bindUserMediaEvents() {
    elements.userAvatarTrigger?.addEventListener("click", () => elements.userAvatarFile?.click());
    elements.userAvatarEditButton?.addEventListener("click", () => elements.userAvatarFile?.click());

    elements.userAvatarFile?.addEventListener("change", (event) => {
        const [file] = Array.from(event.target.files || []);
        userAvatarFile = file || null;
        if (!file) {
            setAvatarPreview(elements.userForm?.elements.avatar_url?.value || "");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(String(reader.result || ""));
        reader.readAsDataURL(file);
    });
}

export function closeCustomerProfile() {
    customerProfileContext = { customer: null, orders: [] };
    elements.customerProfileModal?.classList.add("hidden");
}

export async function openCustomerProfile(userId) {
    const customer = (state.customers || []).find((item) => Number(item.id) === Number(userId));
    if (!customer) {
        throw new Error("Không tìm thấy khách hàng cần xem hồ sơ.");
    }

    const orders = await loadCustomerOrders(customer);
    customerProfileContext = {
        customer,
        orders: Array.isArray(orders) ? orders : []
    };
    renderCustomerProfileModal();
    elements.customerProfileModal?.classList.remove("hidden");
}

export function closeUserForm() {
    elements.userFormModal?.classList.add("hidden");
}

export function resetUserForm() {
    if (!elements.userForm) return;

    userAvatarFile = null;
    elements.userForm.reset();
    elements.userForm.elements.id.value = "";
    if (elements.userForm.elements.code) {
        elements.userForm.elements.code.value = generateUserCode();
    }
    if (elements.userForm.elements.status) {
        elements.userForm.elements.status.value = "active";
    }
    if (elements.userForm.elements.avatar_url) {
        elements.userForm.elements.avatar_url.value = "";
    }
    if (elements.userAvatarFile) {
        elements.userAvatarFile.value = "";
    }
    syncRoleOptions(isCustomerWorkspace() ? "customer" : "staff");
    applyUserFormWorkspaceMode();
    setUserPasswordMode(false);
    setUserFormHeadings(false);
    setAvatarPreview("");
}

export async function openUserForm(userId = null) {
    if (!elements.userFormModal || !elements.userForm) return;

    resetUserForm();
    elements.userFormModal.classList.remove("hidden");

    if (!userId) {
        return;
    }

    const user = await apiFetch(`/api/users/${userId}`);
    ["id", "username", "email", "phone", "code", "avatar_url", "status"].forEach((field) => {
        if (elements.userForm.elements[field]) {
            elements.userForm.elements[field].value = user[field] || "";
        }
    });
    syncRoleOptions(user.role || (isCustomerWorkspace() ? "customer" : "staff"));
    setUserPasswordMode(true);
    setUserFormHeadings(true);
    applyUserFormWorkspaceMode();
    setAvatarPreview(resolveMediaUrl(user.avatar_url, ""));
}

function buildUserPayload(raw) {
    const isEditing = Boolean(raw.id);
    const username = String(raw.username || "").trim();
    const email = String(raw.email || "").trim().toLowerCase();
    const password = String(raw.password || "");
    const confirmPassword = String(raw.confirm_password || "");
    const currentPassword = String(raw.current_password || "");
    const newPassword = String(raw.new_password || "");
    const confirmNewPassword = String(raw.confirm_new_password || "");

    if (!username || !email) {
        throw new Error("Vui lòng nhập tên người dùng và email hợp lệ.");
    }

    if (!isEditing && password.length < 6) {
        throw new Error("Mật khẩu tài khoản mới phải có ít nhất 6 ký tự.");
    }

    if (!isEditing && password !== confirmPassword) {
        throw new Error("Xác nhận mật khẩu không khớp.");
    }

    const wantsPasswordChange = isEditing && (currentPassword || newPassword || confirmNewPassword);
    if (wantsPasswordChange && !currentPassword) {
        throw new Error("Vui lòng nhập mật khẩu cũ trước khi đổi mật khẩu.");
    }

    if (wantsPasswordChange && newPassword.length < 6) {
        throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
    }

    if (wantsPasswordChange && newPassword !== confirmNewPassword) {
        throw new Error("Xác nhận mật khẩu mới không khớp.");
    }

    const payload = {
        username,
        code: isCustomerWorkspace() ? "" : String(raw.code || "").trim(),
        email,
        phone: String(raw.phone || "").trim(),
        avatar_url: String(raw.avatar_url || "").trim(),
        role: isCustomerWorkspace()
            ? "customer"
            : (canManageUserRoles() ? (String(raw.role || "staff").trim() || "staff") : "staff"),
        status: String(raw.status || "active").trim() || "active"
    };

    if (!isEditing) {
        payload.password = password;
    } else if (wantsPasswordChange) {
        payload.current_password = currentPassword;
        payload.password = newPassword;
    }

    return payload;
}

export async function submitUserForm(raw) {
    if (userAvatarFile) {
        const uploadedAvatar = await uploadUserAvatar(userAvatarFile);
        if (uploadedAvatar && elements.userForm?.elements.avatar_url) {
            elements.userForm.elements.avatar_url.value = uploadedAvatar;
            raw.avatar_url = uploadedAvatar;
        }
    }

    const payload = buildUserPayload(raw);
    const isEditing = Boolean(raw.id);

    await apiFetch(isEditing ? `/api/users/${raw.id}` : "/api/users", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
    });

    closeUserForm();
    resetUserForm();
    setActivePageState(1);
    await reloadWorkspaceState();
    showToast(isCustomerWorkspace()
        ? (isEditing ? "Đã cập nhật khách hàng." : "Đã tạo khách hàng mới.")
        : (isEditing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản mới."));
}

export async function handleUserAction(action, userId, extra = {}) {
    if (action === "page") {
        setActivePageState(Number(extra.page || 1));
        renderUsers();
        return;
    }

    if (action === "edit") {
        await openUserForm(userId);
        return;
    }

    if (action === "view-customer") {
        await openCustomerProfile(userId);
        return;
    }

    const user = getUserById(userId);
    if (!user) {
        throw new Error("Không tìm thấy tài khoản cần thao tác.");
    }

    if (action === "activate" || action === "block") {
        const nextStatus = action === "activate" ? "active" : "blocked";
        const statusLabel = nextStatus === "active" ? "kích hoạt" : "khóa";
        if (!window.confirm(`Bạn có chắc muốn ${statusLabel} tài khoản ${user.username || user.email}?`)) {
            return;
        }

        await apiFetch(`/api/users/${user.id}`, {
            method: "PUT",
            body: JSON.stringify({ status: nextStatus })
        });
        await reloadWorkspaceState();
        showToast(nextStatus === "active" ? "Đã kích hoạt tài khoản." : "Đã khóa tài khoản.");
        return;
    }

    if (action === "delete") {
        if (!window.confirm(`Xóa tài khoản ${user.username || user.email}? Thao tác này không thể hoàn tác.`)) {
            return;
        }

        await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
        setActivePageState(Math.max(1, getActivePageState() || 1));
        await reloadWorkspaceState();
        showToast("Đã xóa tài khoản.");
    }
}

export function renderUsers() {
    if (!elements.usersContent) return;

    if (isShiftWorkspace() && !state.usersHydrated) {
        elements.usersContent.innerHTML = '<div class="users-empty-state"><strong>\u0110ang t\u1ea3i danh s\u00e1ch nh\u00e2n s\u1ef1...</strong><span>H\u1ec7 th\u1ed1ng \u0111ang n\u1ea1p nh\u00e2n vi\u00ean \u0111\u1ec3 hi\u1ec3n th\u1ecb v\u00e0o l\u1ecbch ca l\u00e0m vi\u1ec7c.</span></div>';
        reloadWorkspaceState().catch((error) => showToast(error.message || "Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch nh\u00e2n s\u1ef1.", true));
        return;
    }

    if (isCustomerWorkspace() && !state.customersHydrated) {
        elements.usersContent.innerHTML = '<div class="users-empty-state"><strong>Đang tải danh sách khách hàng...</strong><span>Hệ thống đang nạp các tài khoản khách hàng vào khu vực riêng này.</span></div>';
        reloadWorkspaceState().catch((error) => showToast(error.message || "Không thể tải danh sách khách hàng.", true));
        return;
    }

    if (!isCustomerWorkspace() && !state.usersHydrated) {
        elements.usersContent.innerHTML = '<div class="users-empty-state"><strong>Đang tải danh sách tài khoản nội bộ...</strong><span>Hệ thống đang nạp tài khoản admin và nhân viên.</span></div>';
        reloadWorkspaceState().catch((error) => showToast(error.message || "Không thể tải danh sách tài khoản.", true));
        return;
    }

    renderFilterForm();
    setPanelHeadings();

    if (isShiftWorkspace()) {
        if (elements.usersMeta) {
            elements.usersMeta.textContent = `${formatNumber((state.users || []).length)} nh\u00e2n s\u1ef1 s\u1eb5n s\u00e0ng ph\u00e2n ca`;
        }
        renderStaffShiftWorkspace();
        return;
    }

    const activeCollection = getActiveCollection();
    const pageCount = getUsersPageCount(activeCollection.length);
    setActivePageState(Math.min(Math.max(1, getActivePageState() || 1), pageCount));

    if (elements.usersMeta) {
        elements.usersMeta.textContent = "";
    }

    if (isCustomerWorkspace()) {
        elements.usersContent.innerHTML = `
          ${buildCustomerRows()}
          ${buildPagination()}
        `;
        return;
    }

    elements.usersContent.innerHTML = `
      ${buildStaffSummary()}
      <div class="surface users-table-card">
        ${buildStaffRows()}
        ${buildPagination({ showSummary: false })}
      </div>
    `;
}

