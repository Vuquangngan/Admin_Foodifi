import {
    STORE_BRANCHES,
    apiFetch,
    elements,
    escapeHtml,
    formatCurrency,
    formatMoneyInputValue,
    formatNumber,
    parseMoneyInputValue,
    parseVoucherDescription,
    resolveMediaUrl,
    showToast,
    state,
    statusPill
} from "./core.js";
import { renderSidebarMenu, setActivePanel } from "./auth-nav.js";
import { loadOrders, loadOverview, loadProducts } from "./data.js";

const DELIVERY_CONFIRM_DELAY_MS = 2 * 60 * 1000;
const RETURN_CONFIRM_DELAY_MS = 1 * 60 * 1000;

let orderRefreshTimerId = 0;
let orderDraftSequence = 1;
let createOrderDraft = null;
let orderProductPickerState = {
    isOpen: false,
    quantities: {},
    keyword: "",
    categoryId: "all"
};
const ORDER_ADMIN_NOTE_PREFIX = "[[ORDER_ADMIN_META]]";
const COMPLAINT_ADMIN_META_PREFIX = "[[COMPLAINT_ADMIN_META]]";
const HANOI_ROUTE_POINTS = [
    { key: "mieu-dam", label: "Miếu Đầm", lat: 21.0138, lng: 105.7812, terms: ["116 miếu đầm", "miếu đầm", "mieu dam", "mễ trì", "me tri", "nam từ liêm", "nam tu liem"] },
    { key: "cau-giay", label: "C?u Gi?y", lat: 21.0362, lng: 105.7908, terms: ["c?u gi?y", "cau giay", "duy t�n", "duy tan", "tr?n th�i t�ng", "tran thai tong", "xu�n th?y", "xuan thuy"] },
    { key: "ba-dinh", label: "Ba Đình", lat: 21.0343, lng: 105.8141, terms: ["ba đình", "ba dinh", "kim mã", "kim ma", "đội cấn", "doi can", "ngọc hà", "ngoc ha"] },
    { key: "dong-da", label: "�?ng �a", lat: 21.0186, lng: 105.8297, terms: ["d?ng da", "dong da", "th�i h�", "thai ha", "t�y son", "tay son", "ch�a b?c", "chua boc"] },
    { key: "hoan-kiem", label: "Hoàn Kiếm", lat: 21.0285, lng: 105.8542, terms: ["hoàn kiếm", "hoan kiem", "hàng bài", "hang bai", "tràng tiền", "trang tien", "hồ gươm", "ho guom"] },
    { key: "hai-ba-trung", label: "Hai Bà Trưng", lat: 21.0064, lng: 105.8603, terms: ["hai bà trưng", "hai ba trung", "minh khai", "bạch mai", "bach mai", "lò đúc", "lo duc"] },
    { key: "thanh-xuan", label: "Thanh Xu�n", lat: 20.9946, lng: 105.8074, terms: ["thanh xu�n", "thanh xuan", "nguy?n tr�i", "nguyen trai", "khuong d�nh", "khuong dinh"] },
    { key: "ha-dong", label: "Hà Đông", lat: 20.9712, lng: 105.7788, terms: ["hà đông", "ha dong", "văn quán", "van quan", "mộ lao", "mo lao"] },
    { key: "tay-ho", label: "T�y H?", lat: 21.0698, lng: 105.8235, terms: ["t�y h?", "tay ho", "xu�n la", "xuan la", "nh?t t�n", "nhat tan"] },
    { key: "long-bien", label: "Long Bi�n", lat: 21.0478, lng: 105.8910, terms: ["long bi�n", "long bien", "ng?c l�m", "ngoc lam", "gia th?y", "gia thuy"] }
];

function getDefaultSellerInfo() {
    return {
        seller_name: String(state.user?.username || state.user?.name || "").trim(),
        seller_phone: String(state.user?.phone || "").trim(),
        branch_key: "",
        branch_name: "",
        pickup_address: ""
    };
}

function createOrderDraftItem() {
    return {
        key: `draft-item-${orderDraftSequence++}`,
        product_id: "",
        quantity: 1
    };
}

function defaultOrderProductThumb() {
    return "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f5fbf2"/>
            <stop offset="100%" stop-color="#e2efe1"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="26" fill="url(#g)"/>
        <circle cx="42" cy="44" r="14" fill="#31a95f"/>
        <circle cx="74" cy="38" r="11" fill="#8dcf6b"/>
        <path d="M32 76c10-18 18-24 30-24s20 6 26 24H32z" fill="#17834a"/>
        <path d="M54 28c8-8 16-10 24-9-3 10-10 16-19 18" fill="none" stroke="#2a8f52" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `);
}

function getCouponDisplayLabel(coupon) {
    const title = parseVoucherDescription(coupon?.description).title;
    return title ? `${coupon.code} - ${title}` : String(coupon?.code || "");
}

function getDefaultCreateOrderDraft() {
    return {
        customer_name: "",
        customer_phone: "",
        shipping_address: "",
        ward: "",
        district: "",
        city: "",
        note: "",
        payment_method: "cod",
        payment_status: "unpaid",
        shipping_fee: 0,
        coupon_code: "",
        ...getDefaultSellerInfo(),
        items: []
    };
}

function ensureCreateOrderDraft() {
    if (!createOrderDraft) {
        createOrderDraft = getDefaultCreateOrderDraft();
    }

    if (!Array.isArray(createOrderDraft.items)) {
        createOrderDraft.items = [];
    }

    return createOrderDraft;
}

function buildOrderAdminNotePayload(customerNote, sellerInfo) {
    const note = String(customerNote || "").trim();
    const seller = {
        seller_name: String(sellerInfo?.seller_name || "").trim(),
        seller_phone: String(sellerInfo?.seller_phone || "").trim(),
        branch_key: String(sellerInfo?.branch_key || "").trim(),
        branch_name: String(sellerInfo?.branch_name || "").trim(),
        pickup_address: String(sellerInfo?.pickup_address || "").trim()
    };

    if (!note && !seller.seller_name && !seller.seller_phone && !seller.branch_key && !seller.branch_name && !seller.pickup_address) {
        return null;
    }

    return `${ORDER_ADMIN_NOTE_PREFIX}${JSON.stringify({ note, seller })}`;
}

function parseOrderAdminNotePayload(rawNote) {
    const value = String(rawNote || "");
    if (!value.startsWith(ORDER_ADMIN_NOTE_PREFIX)) {
        return {
            note: value.trim(),
            seller_name: "",
            seller_phone: "",
            branch_key: "",
            branch_name: "",
            pickup_address: ""
        };
    }

    try {
        const parsed = JSON.parse(value.slice(ORDER_ADMIN_NOTE_PREFIX.length));
        return {
            note: String(parsed?.note || "").trim(),
            seller_name: String(parsed?.seller?.seller_name || "").trim(),
            seller_phone: String(parsed?.seller?.seller_phone || "").trim(),
            branch_key: String(parsed?.seller?.branch_key || "").trim(),
            branch_name: String(parsed?.seller?.branch_name || "").trim(),
            pickup_address: String(parsed?.seller?.pickup_address || "").trim()
        };
    } catch (_error) {
        return {
            note: value.replace(ORDER_ADMIN_NOTE_PREFIX, "").trim(),
            seller_name: "",
            seller_phone: "",
            branch_key: "",
            branch_name: "",
            pickup_address: ""
        };
    }
}

function splitComplaintMeta(rawNote) {
    const source = String(rawNote || "");
    const markerIndex = source.indexOf(COMPLAINT_ADMIN_META_PREFIX);
    if (markerIndex === -1) {
        return {
            complaintNote: source.trim(),
            meta: {}
        };
    }

    const complaintNote = source.slice(0, markerIndex).trim();
    const rawMeta = source.slice(markerIndex + COMPLAINT_ADMIN_META_PREFIX.length).trim();

    try {
        return {
            complaintNote,
            meta: JSON.parse(rawMeta || "{}")
        };
    } catch (_error) {
        return {
            complaintNote,
            meta: {}
        };
    }
}

function parseComplaintPayload(rawNote) {
    const basePayload = parseOrderAdminNotePayload(rawNote);
    const { complaintNote, meta } = splitComplaintMeta(basePayload.note);
    const lines = complaintNote.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    let reason = "";
    let description = "";
    let readingDescription = false;
    let readingImages = false;
    const descriptionLines = [];
    const imageUrls = [];

    lines.forEach((line) => {
        const lowered = line.toLowerCase();
        if (lowered.startsWith("lý do:") || lowered.startsWith("ly do:")) {
            reason = line.split(":").slice(1).join(":").trim();
            readingDescription = false;
            readingImages = false;
            return;
        }

        if (lowered.startsWith("mô tả") || lowered.startsWith("mo ta")) {
            readingDescription = true;
            readingImages = false;
            const maybeInline = line.split(":").slice(1).join(":").trim();
            if (maybeInline) {
                descriptionLines.push(maybeInline);
            }
            return;
        }

        if (lowered.startsWith("hình ảnh minh chứng") || lowered.startsWith("hinh anh minh chung")) {
            readingDescription = false;
            readingImages = true;
            return;
        }

        if (readingImages && /^-\s*/.test(line)) {
            const imageUrl = line.replace(/^-\s*/, "").trim();
            if (imageUrl) {
                imageUrls.push(imageUrl);
            }
            return;
        }

        if (readingDescription) {
            descriptionLines.push(line);
        }
    });

    return {
        seller_name: basePayload.seller_name,
        seller_phone: basePayload.seller_phone,
        pickup_address: basePayload.pickup_address,
        complaintNote,
        reason,
        description: descriptionLines.join("\n").trim() || complaintNote,
        imageUrls,
        adminResponse: String(meta.response || "").trim(),
        resolution: String(meta.resolution || "").trim(),
        meta
    };
}

function buildComplaintNoteWithMeta(rawNote, metaPatch = {}) {
    const parsed = parseComplaintPayload(rawNote);
    const nextMeta = {
        ...parsed.meta,
        ...metaPatch
    };

    Object.keys(nextMeta).forEach((key) => {
        if (nextMeta[key] == null || nextMeta[key] === "") {
            delete nextMeta[key];
        }
    });

    if (!Object.keys(nextMeta).length) {
        return parsed.complaintNote;
    }

    return `${parsed.complaintNote}\n\n${COMPLAINT_ADMIN_META_PREFIX}${JSON.stringify(nextMeta)}`;
}

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function formatCountdown(milliseconds) {
    const safeValue = Math.max(0, Number(milliseconds) || 0);
    const totalSeconds = Math.ceil(safeValue / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getCountdownState(startAt, delayMs) {
    if (!startAt) {
        return {
            isAvailable: false,
            remainingMs: delayMs
        };
    }

    const startDate = new Date(startAt);
    if (Number.isNaN(startDate.getTime())) {
        return {
            isAvailable: false,
            remainingMs: delayMs
        };
    }

    const remainingMs = Math.max(0, delayMs - (Date.now() - startDate.getTime()));
    return {
        isAvailable: remainingMs === 0,
        remainingMs
    };
}

function getDeliveryState(order) {
    return getCountdownState(order?.shipped_at, DELIVERY_CONFIRM_DELAY_MS);
}

function getReturnState(order) {
    return getCountdownState(order?.return_started_at, RETURN_CONFIRM_DELAY_MS);
}

function captureOrderScrollState() {
    const tableScroll = elements.ordersContent?.querySelector(".orders-table-scroll");
    return {
        windowX: window.scrollX || 0,
        windowY: window.scrollY || 0,
        tableX: tableScroll?.scrollLeft || 0,
        tableY: tableScroll?.scrollTop || 0
    };
}

function restoreOrderScrollState(scrollState) {
    if (!scrollState) return;

    window.requestAnimationFrame(() => {
        const tableScroll = elements.ordersContent?.querySelector(".orders-table-scroll");
        if (tableScroll) {
            tableScroll.scrollLeft = scrollState.tableX;
            tableScroll.scrollTop = scrollState.tableY;
        }
        window.scrollTo(scrollState.windowX, scrollState.windowY);
    });
}

const GRAB_DEV_STATUS_COPY = {
    booking: "Đang đặt tài xế",
    driver_assigned: "Đã có tài xế",
    picked_up: "Đang giao bằng Grab",
    delivering: "Đang giao bằng Grab",
    delivered: "Grab đã giao tới khách",
    cancelled: "Đã hủy vận đơn"
};

function canCancelOrderBeforePickup(order) {
    if (!order || ["completed", "cancelled"].includes(order.status) || order.return_status) return false;
    return !["picked_up", "delivering", "delivered"].includes(order.shipping_status);
}

function getShippingProviderLabel(order) {
    if (!order?.shipping_provider) return "";
    return (order.shipping_provider_label || (order.shipping_provider === "grab_dev" ? "GrabExpress" : order.shipping_provider)).replace(/\s*Dev\b/gi, "");
}

function getShippingStatusLabel(order) {
    return order?.shipping_status_label || GRAB_DEV_STATUS_COPY[order?.shipping_status] || order?.shipping_status || "Chưa tạo vận đơn";
}

function getGrabDevNextActionLabel(order) {
    return ({
        booking: "Gán tài xế",
        driver_assigned: "Tài xế lấy hàng",
        picked_up: "Xác nhận Grab đã giao",
        delivering: "Xác nhận Grab đã giao"
    })[order?.shipping_status] || "Cập nhật Grab";
}

function buildGrabShipmentSummary(order, { compact = false } = {}) {
    if (!order?.tracking_code) {
        return compact ? "" : `
          <article class="order-shipping-card is-empty">
            <div>
              <span>GrabExpress</span>
              <strong>Chưa tạo vận đơn</strong>
              <small>Tạo vận đơn Grab để test luồng giao hàng.</small>
            </div>
          </article>
        `;
    }

    const providerLabel = getShippingProviderLabel(order);
    const statusLabel = getShippingStatusLabel(order);
    const detailRows = [
        order.shipping_estimated_minutes ? `Dự kiến ${formatNumber(order.shipping_estimated_minutes)} phút` : "",
        order.shipped_at ? `Bàn giao: ${formatDateTime(order.shipped_at)}` : "",
        order.delivered_at ? `Đã giao: ${formatDateTime(order.delivered_at)}` : ""
    ].filter(Boolean);

    if (compact) {
        return `
          <div class="orders-shipping-cell">
            <strong>${escapeHtml(providerLabel || "Đơn vị giao hàng")}</strong>
            <span class="section-copy">${escapeHtml(order.tracking_code)}</span>
            <span class="section-copy">${escapeHtml(statusLabel)}</span>
          </div>
        `;
    }

    return `
      <article class="order-shipping-card">
        <div class="order-shipping-card-head">
          <div>
            <span>Đơn vị giao hàng</span>
            <strong>${escapeHtml(providerLabel || "GrabExpress")}</strong>
          </div>
          ${statusPill(order.shipping_status === "cancelled" ? "cancelled" : "shipping", statusLabel)}
        </div>
        <div class="order-shipping-code">
          <span>Mã vận đơn</span>
          <strong>${escapeHtml(order.tracking_code)}</strong>
        </div>
        ${order.shipping_note ? `<p>${escapeHtml(order.shipping_note)}</p>` : ""}
        ${detailRows.length ? `<div class="order-shipping-meta">${detailRows.map((item) => `<small>${escapeHtml(item)}</small>`).join("")}</div>` : ""}
      </article>
    `;
}

function buildGrabShipmentDetailActions(order) {
    if (["completed", "cancelled"].includes(order?.status) || order?.return_status) return "";

    if (!order.tracking_code || order.shipping_status === "cancelled") {
        return `
          <div class="order-shipping-actions">
            ${buildOrderActionButton({
                action: "create-grab-shipment",
                id: order.id,
                label: "Tạo vận đơn GrabExpress"
            })}
          </div>
        `;
    }

    if (order.shipping_provider !== "grab_dev" || ["delivered", "cancelled"].includes(order.shipping_status)) {
        return "";
    }

    return `
      <div class="order-shipping-actions">
        ${buildOrderActionButton({
            action: "advance-grab-shipment",
            id: order.id,
            label: getGrabDevNextActionLabel(order)
        })}
        ${!["picked_up", "delivering"].includes(order.shipping_status) ? buildOrderActionButton({
            action: "cancel-grab-shipment",
            id: order.id,
            tone: "danger",
            label: "Hủy Grab"
        }) : ""}
      </div>
    `;
}

function matchesQuickFilter(order, filter) {
    switch (filter) {
        case "pending":
            return order.status === "pending";
        case "processing":
            return ["confirmed", "preparing"].includes(order.status);
        case "shipping":
            return order.status === "shipping" && !order.return_status;
        case "cancelled":
            return order.status === "cancelled";
        case "all":
        default:
            return true;
    }
}

function getVisibleOrders() {
    return (Array.isArray(state.orders) ? state.orders : []).filter((order) => matchesQuickFilter(order, state.orderQuickFilter || "all"));
}

function getOrderSummary(orders) {
    return {
        total: orders.length,
        pending: orders.filter((order) => order.status === "pending").length,
        processing: orders.filter((order) => ["confirmed", "preparing"].includes(order.status)).length,
        shipping: orders.filter((order) => order.status === "shipping" && !order.return_status).length,
        cancelled: orders.filter((order) => order.status === "cancelled").length
    };
}

function getComplaintOrders() {
    return (Array.isArray(state.orders) ? state.orders : [])
        .filter((order) => Boolean(order?.return_status))
        .sort((left, right) => new Date(right?.updated_at || right?.return_started_at || right?.created_at || 0).getTime() - new Date(left?.updated_at || left?.return_started_at || left?.created_at || 0).getTime());
}

function getComplaintQuickStatus(order) {
    if (order?.return_status === "returned") {
        return {
            key: "resolved",
            label: "Đã hoàn thành",
            pillKey: "completed"
        };
    }

    const returnState = getReturnState(order);
    if (!returnState.isAvailable) {
        return {
            key: "pending",
            label: "Chờ xử lý",
            pillKey: "pending"
        };
    }

    return {
        key: "reviewing",
        label: "Đang xem xét",
        pillKey: "shipping"
    };
}

function getComplaintFilterState() {
    const filters = state.complaintFilters || {};
    return {
        order_code: String(filters.order_code || "").trim(),
        status: String(filters.status || "").trim()
    };
}

function matchesComplaintFilter(order) {
    const filters = getComplaintFilterState();
    const orderCode = String(order?.order_code || `#${order?.id || ""}`).toLowerCase();
    const keyword = filters.order_code.toLowerCase();
    const status = getComplaintStatusUi(order).key;

    if (keyword && !orderCode.includes(keyword)) return false;
    if (filters.status && status !== filters.status) return false;
    return true;
}

function getVisibleComplaints() {
    return getComplaintOrders().filter((order) => matchesComplaintFilter(order));
}

function buildComplaintTitle(order) {
    const firstItem = Array.isArray(order?.items) && order.items.length ? order.items[0] : null;
    const itemName = firstItem?.product_name || "đơn hàng";

    if (order?.return_status === "returned") {
        return `Đã xử lý hoàn/đổi cho ${itemName}`;
    }

    if (getComplaintQuickStatus(order).key === "reviewing") {
        return `Đang xem xét yêu cầu hoàn/đổi của ${itemName}`;
    }

    return `Khách hàng yêu cầu khiếu nại / hoàn tiền cho ${itemName}`;
}

function buildComplaintExcerpt(order) {
    const parsedNote = parseOrderAdminNotePayload(order?.note);
    if (parsedNote.note) {
        return parsedNote.note;
    }

    if (order?.return_status === "returned") {
        return "Yêu cầu hoàn hàng đã được xử lý thành công và chờ đối soát hoàn tiền.";
    }

    if (getComplaintQuickStatus(order).key === "reviewing") {
        return "Đơn khiếu nại đã đủ thời gian chờ, admin có thể kiểm tra và xác nhận xử lý.";
    }

    return "Khách hàng đã gửi yêu cầu khiếu nại / hoàn tiền cho đơn hàng này.";
}

function renderComplaintsTable(orders) {
    return `
      <article class="surface orders-table-card complaints-table-card">
        <div class="complaints-toolbar">
          <div>
            <h3>Danh sách khiếu nại</h3>
          </div>
          <button class="primary-button" type="button" data-action="export-complaints">Xuất báo cáo</button>
        </div>
        <div class="orders-table-scroll">
          <table class="list-table complaints-table">
            <thead>
              <tr>
                <th>Mã đơn hàng</th>
                <th>Khách hàng</th>
                <th>Nội dung khiếu nại</th>
                <th>Ngày gửi</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((order) => {
                  const complaintStatus = getComplaintQuickStatus(order);
                  return `
                    <tr>
                      <td>
                        <div class="orders-code-cell">
                          <strong>${escapeHtml(order.order_code || `#${order.id}`)}</strong>
                          <span class="section-copy">SP: ${formatNumber(order.item_count || 0)}</span>
                        </div>
                      </td>
                      <td>
                        <div class="complaint-customer-cell">
                          <strong>${escapeHtml(order.customer_name || "-")}</strong>
                          <span class="section-copy">${escapeHtml(order.customer_phone || "-")}</span>
                        </div>
                      </td>
                      <td>
                        <div class="complaint-subject-cell">
                          <strong>${escapeHtml(buildComplaintTitle(order))}</strong>
                          <span class="section-copy">${escapeHtml(buildComplaintExcerpt(order))}</span>
                        </div>
                      </td>
                      <td>
                        <div class="orders-date-cell">
                          <strong>${formatDateTime(order.return_started_at || order.updated_at || order.created_at)}</strong>
                          <span class="section-copy">${escapeHtml(order.return_started_at ? "Bắt đầu hoàn hàng" : "Đơn vừa cập nhật khiếu nại")}</span>
                        </div>
                      </td>
                      <td>${statusPill(complaintStatus.pillKey, complaintStatus.label)}</td>
                      <td>
                        <div class="orders-action-stack">
                          ${buildOrderActionButton({
                              action: "view-complaint",
                              id: order.id,
                              label: "Chi tiết"
                          })}
                          ${order.return_status === "shipping_back" ? buildOrderActionButton({
                              action: "order-special-action",
                              id: order.id,
                              special: "mark_returned",
                              label: getReturnState(order).isAvailable ? "Xác nhận xử lý" : `Chờ ${formatCountdown(getReturnState(order).remainingMs)}`,
                              disabled: !getReturnState(order).isAvailable,
                              title: "Hoàn tất khiếu nại và xác nhận hàng hoàn."
                          }) : ""}
                        </div>
                      </td>
                    </tr>
                  `;
              }).join("") || `<tr><td colspan="6">Chưa có khiếu nại nào cần xử lý.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
}

function buildComplaintTimeline(order) {
    const steps = [
        {
            label: "Đơn đã giao thành công",
            value: order.delivered_at || order.completed_at || order.updated_at,
            done: Boolean(order.delivered_at || order.completed_at)
        },
        {
            label: "Khách gửi khiếu nại",
            value: order.return_started_at || order.updated_at,
            done: Boolean(order.return_started_at || order.return_status)
        },
        {
            label: "Admin xem xét",
            value: getComplaintQuickStatus(order).key !== "pending" ? (order.updated_at || order.return_started_at) : null,
            done: getComplaintQuickStatus(order).key !== "pending"
        },
        {
            label: "Hoàn tất xử lý",
            value: order.return_completed_at || order.updated_at,
            done: order.return_status === "returned"
        }
    ];

    return `
      <div class="complaint-timeline">
        ${steps.map((step) => `
          <div class="complaint-timeline-item ${step.done ? "done" : ""}">
            <span class="complaint-timeline-dot"></span>
            <div>
              <strong>${escapeHtml(step.label)}</strong>
              <span>${escapeHtml(step.value ? formatDateTime(step.value) : "Chưa có mốc thời gian")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
}

function getComplaintStatusUi(order) {
    const complaint = parseComplaintPayload(order?.note);
    if (order?.refund_status === "refunded" || complaint.resolution === "refunded" || complaint.resolution === "reshipped" || order?.payment_status === "refunded") {
        return {
            key: "resolved",
            label: "Xử lý xong",
            pillKey: "completed"
        };
    }

    if (order?.refund_status === "rejected") {
        return {
            key: "resolved",
            label: "Từ chối hoàn tiền",
            pillKey: "cancelled"
        };
    }

    if (order?.refund_status === "requested" || order?.refund_status === "approved") {
        return {
            key: "reviewing",
            label: order.refund_status_label || "Chờ duyệt hoàn tiền",
            pillKey: "shipping"
        };
    }

    if (order?.return_status === "returned" && order?.refund_status !== "refunded" && order?.payment_status !== "refunded" && complaint.resolution !== "reshipped") {
        return {
            key: "reviewing",
            label: "Chờ hoàn tiền",
            pillKey: "shipping"
        };
    }

    if (order?.return_status === "returned") {
        return {
            key: "resolved",
            label: "Xử lý xong",
            pillKey: "completed"
        };
    }

    const returnState = getReturnState(order);
    if (!returnState.isAvailable) {
        return {
            key: "pending",
            label: "Ch\u1edd x\u1eed l\u00fd",
            pillKey: "pending"
        };
    }

    return {
        key: "reviewing",
        label: "\u0110ang xem x\u00e9t",
        pillKey: "shipping"
    };
}

function getRefundActionLabel(order) {
    if (order?.refund_status === "refunded" || order?.payment_status === "refunded") return "Đã hoàn tiền";
    if (order?.refund_status === "rejected") return "Duyệt hoàn tiền";
    return "Hoàn tiền";
}

function parseAdminCurrencyInput(value) {
    const normalized = String(value || "")
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
}

function openRefundAmountModal({ order, defaultAmount = 0, defaultReason = "" }) {
    return new Promise((resolve) => {
        const maxAmount = Math.max(0, Number(order?.total_amount || 0));
        const orderCode = order?.order_code || `#${order?.id || ""}`;
        const customerName = order?.customer_name || "Khách hàng";
        const fallbackReason = defaultReason || "Admin duyệt hoàn tiền theo khiếu nại.";
        const modal = document.createElement("div");

        modal.className = "modal-backdrop refund-modal-backdrop";
        modal.innerHTML = `
          <form class="modal-card refund-amount-modal" data-refund-modal-form>
            <div class="refund-amount-modal-header">
              <div>
                <span>Hoàn tiền khiếu nại</span>
                <h2>Nhập số tiền hoàn</h2>
              </div>
              <button class="order-product-picker-close" type="button" data-refund-modal-action="close" aria-label="Đóng popup">&times;</button>
            </div>

            <div class="refund-amount-summary">
              <div>
                <span>Đơn hàng</span>
                <strong>${escapeHtml(orderCode)}</strong>
              </div>
              <div>
                <span>Khách hàng</span>
                <strong>${escapeHtml(customerName)}</strong>
              </div>
              <div>
                <span>Tổng đơn</span>
                <strong>${formatCurrency(maxAmount)}</strong>
              </div>
            </div>

            <label class="refund-amount-field">
              <span>Số tiền hoàn</span>
              <input name="refund_amount" type="text" inputmode="numeric" value="${escapeHtml(formatMoneyInputValue(defaultAmount || maxAmount))}" autocomplete="off" required>
              <small>Không nhập quá tổng tiền đơn hàng.</small>
            </label>

            <label class="refund-amount-field">
              <span>Ghi chú xử lý</span>
              <textarea name="refund_reason" rows="3" placeholder="Ví dụ: Hoàn tiền do sản phẩm bị hỏng.">${escapeHtml(fallbackReason)}</textarea>
            </label>

            <div class="refund-amount-modal-actions">
              <button class="refund-reject-button" type="button" data-refund-modal-action="reject">Từ chối</button>
              <button class="ghost-button" type="button" data-refund-modal-action="close">Hủy</button>
              <button class="primary-button" type="submit">Xác nhận hoàn tiền</button>
            </div>
          </form>
        `;

        const form = modal.querySelector("[data-refund-modal-form]");
        const amountInput = form?.elements?.refund_amount;
        const reasonInput = form?.elements?.refund_reason;

        const close = (value) => {
            document.removeEventListener("keydown", handleEscape);
            modal.remove();
            resolve(value);
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                close(null);
            }
        };

        modal.addEventListener("click", (event) => {
            if (event.target === modal || event.target.closest("[data-refund-modal-action='close']")) {
                close(null);
                return;
            }

            if (event.target.closest("[data-refund-modal-action='reject']")) {
                const reasonValue = String(reasonInput?.value || "").trim();
                close({
                    action: "reject",
                    reason: !reasonValue || reasonValue === fallbackReason
                        ? "Admin từ chối yêu cầu hoàn tiền."
                        : reasonValue
                });
            }
        });

        amountInput?.addEventListener("blur", () => {
            amountInput.value = formatMoneyInputValue(amountInput.value);
        });

        form?.addEventListener("submit", (event) => {
            event.preventDefault();
            const refundAmount = parseAdminCurrencyInput(amountInput?.value);

            if (!refundAmount || refundAmount <= 0) {
                showToast("Số tiền hoàn không hợp lệ.", true);
                amountInput?.focus();
                return;
            }

            if (maxAmount > 0 && refundAmount > maxAmount) {
                showToast("Số tiền hoàn không được vượt quá tổng tiền đơn hàng.", true);
                amountInput?.focus();
                return;
            }

            close({
                action: "approve",
                amount: refundAmount,
                reason: String(reasonInput?.value || "").trim() || fallbackReason
            });
        });

        document.body.appendChild(modal);
        document.addEventListener("keydown", handleEscape);
        setTimeout(() => amountInput?.focus(), 0);
    });
}

function getComplaintTitleText(order) {
    const firstItem = Array.isArray(order?.items) && order.items.length ? order.items[0] : null;
    const itemName = firstItem?.product_name || "\u0111\u01a1n h\u00e0ng";
    const complaint = parseComplaintPayload(order?.note);

    if (getComplaintStatusUi(order).key === "resolved") {
        if (complaint.resolution === "reshipped") {
            return `Đã giao lại và xử lý xong cho ${itemName}`;
        }
        if (order?.refund_status === "refunded" || complaint.resolution === "refunded" || order?.payment_status === "refunded") {
            return `Đã hoàn tiền và xử lý xong cho ${itemName}`;
        }
        return `Đã xử lý hoàn/đổi cho ${itemName}`;
    }

    if (getComplaintStatusUi(order).key === "reviewing") {
        return `\u0110ang xem x\u00e9t y\u00eau c\u1ea7u ho\u00e0n/\u0111\u1ed5i c\u1ee7a ${itemName}`;
    }

    return `Kh\u00e1ch h\u00e0ng y\u00eau c\u1ea7u khi\u1ebfu n\u1ea1i / ho\u00e0n ti\u1ec1n cho ${itemName}`;
}

function getComplaintExcerptText(order) {
    const complaint = parseComplaintPayload(order?.note);
    const cleanedDescription = String(complaint.description || "")
        .replace(/\s+/g, " ")
        .trim();
    const cleanedReason = String(complaint.reason || "")
        .replace(/\s+/g, " ")
        .trim();

    if (getComplaintStatusUi(order).key === "resolved") {
        if (complaint.resolution === "reshipped") {
            return complaint.reship_order_code
                ? `Đã tạo đơn giao lại ${complaint.reship_order_code}. Khiếu nại đã được xử lý xong.`
                : "Đã tạo đơn giao lại. Khiếu nại đã được xử lý xong.";
        }
        if (order?.refund_status === "refunded" || complaint.resolution === "refunded" || order?.payment_status === "refunded") {
            return "Đơn đã hoàn tiền cho khách. Khiếu nại đã được xử lý xong.";
        }
        return "Yêu cầu hoàn/đổi đã được xử lý xong.";
    }

    if (cleanedDescription) {
        return cleanedDescription;
    }

    if (cleanedReason) {
        return cleanedReason;
    }

    if (complaint.complaintNote) {
        return complaint.complaintNote.replace(/\s+/g, " ").trim();
    }

    if (order?.return_status === "returned") {
        return "Y\u00eau c\u1ea7u ho\u00e0n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u1eed l\u00fd th\u00e0nh c\u00f4ng v\u00e0 ch\u1edd \u0111\u1ed1i so\u00e1t ho\u00e0n ti\u1ec1n.";
    }

    if (getComplaintStatusUi(order).key === "reviewing") {
        return "\u0110\u01a1n khi\u1ebfu n\u1ea1i \u0111\u00e3 \u0111\u1ee7 th\u1eddi gian ch\u1edd, admin c\u00f3 th\u1ec3 ki\u1ec3m tra v\u00e0 x\u00e1c nh\u1eadn x\u1eed l\u00fd.";
    }

    return "Kh\u00e1ch h\u00e0ng \u0111\u00e3 g\u1eedi y\u00eau c\u1ea7u khi\u1ebfu n\u1ea1i / ho\u00e0n ti\u1ec1n cho \u0111\u01a1n h\u00e0ng n\u00e0y.";
}

function renderComplaintFilterPanel() {
    const filters = getComplaintFilterState();
    return `
      <article class="surface complaint-filter-card">
        <div class="complaint-filter-grid">
          <label>
            <span>Tìm theo mã đơn hàng</span>
            <input
              name="order_code"
              value="${escapeHtml(filters.order_code)}"
              placeholder="Ví dụ: ORD-1778..."
              data-complaint-filter-field="order_code"
              autocomplete="off"
            >
          </label>
          <label>
            <span>Trạng thái khiếu nại</span>
            <select name="status" data-complaint-filter-field="status">
              <option value="" ${filters.status === "" ? "selected" : ""}>Tất cả trạng thái</option>
              <option value="pending" ${filters.status === "pending" ? "selected" : ""}>Chờ xử lý</option>
              <option value="reviewing" ${filters.status === "reviewing" ? "selected" : ""}>Đang xem xét</option>
              <option value="resolved" ${filters.status === "resolved" ? "selected" : ""}>Đã giải quyết</option>
            </select>
          </label>
        </div>
      </article>
    `;
}

function renderComplaintsTableClean(orders) {
    return `
      <article class="surface orders-table-card complaints-table-card">
        <div class="complaints-toolbar">
          <div>
            <h3>Danh s\u00e1ch khi\u1ebfu n\u1ea1i</h3>
          </div>
          <button class="primary-button" type="button" data-action="export-complaints">Xu\u1ea5t b\u00e1o c\u00e1o</button>
        </div>
        <div class="orders-table-scroll">
          <table class="list-table complaints-table">
            <thead>
              <tr>
                <th>M\u00e3 \u0111\u01a1n h\u00e0ng</th>
                <th>Kh\u00e1ch h\u00e0ng</th>
                <th>N\u1ed9i dung khi\u1ebfu n\u1ea1i</th>
                <th>Ng\u00e0y g\u1eedi</th>
                <th>Tr\u1ea1ng th\u00e1i</th>
                <th>Thao t\u00e1c</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((order) => {
                  const complaintStatus = getComplaintStatusUi(order);
                  const returnState = getReturnState(order);
                  return `
                    <tr>
                      <td>
                        <div class="orders-code-cell">
                          <strong>${escapeHtml(order.order_code || `#${order.id}`)}</strong>
                          <span class="section-copy">SP: ${formatNumber(order.item_count || 0)}</span>
                        </div>
                      </td>
                      <td>
                        <div class="complaint-customer-cell">
                          <strong>${escapeHtml(order.customer_name || "-")}</strong>
                          <span class="section-copy">${escapeHtml(order.customer_phone || "-")}</span>
                        </div>
                      </td>
                      <td>
                        <div class="complaint-subject-cell">
                          <span class="section-copy">${escapeHtml(getComplaintExcerptText(order))}</span>
                        </div>
                      </td>
                      <td>
                        <div class="orders-date-cell">
                          <strong>${formatDateTime(order.return_started_at || order.updated_at || order.created_at)}</strong>
                          <span class="section-copy">${escapeHtml(order.return_started_at ? "B\u1eaft \u0111\u1ea7u ho\u00e0n h\u00e0ng" : "\u0110\u01a1n v\u1eeba c\u1eadp nh\u1eadt khi\u1ebfu n\u1ea1i")}</span>
                        </div>
                      </td>
                      <td>${statusPill(complaintStatus.pillKey, complaintStatus.label)}</td>
                      <td>
                        <div class="orders-action-stack">
                          ${buildOrderActionButton({
                              action: "view-complaint",
                              id: order.id,
                              label: "Chi ti\u1ebft"
                          })}
                          ${order.return_status === "shipping_back" ? buildOrderActionButton({
                              action: "order-special-action",
                              id: order.id,
                              special: "mark_returned",
                              label: returnState.isAvailable ? "X\u00e1c nh\u1eadn x\u1eed l\u00fd" : `Ch\u1edd ${formatCountdown(returnState.remainingMs)}`,
                              disabled: !returnState.isAvailable,
                              title: "Ho\u00e0n t\u1ea5t khi\u1ebfu n\u1ea1i v\u00e0 x\u00e1c nh\u1eadn h\u00e0ng ho\u00e0n."
                          }) : ""}
                        </div>
                      </td>
                    </tr>
                  `;
              }).join("") || `<tr><td colspan="6">Ch\u01b0a c\u00f3 khi\u1ebfu n\u1ea1i n\u00e0o c\u1ea7n x\u1eed l\u00fd.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
}

function renderComplaintsWorkspace() {
    const complaintOrders = getComplaintOrders();
    const visibleComplaints = getVisibleComplaints();
    const filters = getComplaintFilterState();

    if (elements.complaintsMeta) {
        elements.complaintsMeta.textContent = !filters.order_code && !filters.status
            ? `${formatNumber(visibleComplaints.length)} khi\u1ebfu n\u1ea1i`
            : `${formatNumber(visibleComplaints.length)} / ${formatNumber(complaintOrders.length)} khi\u1ebfu n\u1ea1i`;
    }

    if (elements.complaintsContent) {
        elements.complaintsContent.innerHTML = `
          <section class="orders-dashboard complaints-dashboard">
            ${renderComplaintFilterPanel()}
            ${renderComplaintsTableClean(visibleComplaints)}
          </section>
        `;
    }

    scheduleOrderRefresh(complaintOrders);
}

function renderComplaintDetailView(order) {
    if (!elements.complaintDetailContent || !elements.complaintDetailTitle) return;

    const complaintStatus = getComplaintStatusUi(order);
    const complaint = parseComplaintPayload(order?.note);
    const items = Array.isArray(order?.items) ? order.items : [];
    const returnState = getReturnState(order);
    const isResolved = complaintStatus.key === "resolved";
    const isRefunded = order?.refund_status === "refunded" || order?.payment_status === "refunded";
    const showRefundMeta = complaint.resolution !== "reshipped" && (order.refund_status || order.payment_status === "refunded");
    const evidenceImages = complaint.imageUrls.length
        ? complaint.imageUrls
        : items
            .map((item) => {
                const product = getOrderProductById(item.product_id);
                return item.product_thumbnail_url
                    || item.thumbnail_url
                    || product?.thumbnail_url
                    || product?.images?.[0]?.image_url
                    || null;
            })
            .filter(Boolean);
    const timelineSteps = [
        {
            label: "\u0110\u01a1n \u0111\u00e3 giao th\u00e0nh c\u00f4ng",
            value: order.delivered_at || order.completed_at || order.updated_at,
            done: Boolean(order.delivered_at || order.completed_at)
        },
        {
            label: "Kh\u00e1ch g\u1eedi khi\u1ebfu n\u1ea1i",
            value: order.return_started_at || order.updated_at,
            done: Boolean(order.return_started_at || order.return_status)
        },
        {
            label: "Admin xem x\u00e9t",
            value: getComplaintStatusUi(order).key !== "pending" ? (order.updated_at || order.return_started_at) : null,
            done: getComplaintStatusUi(order).key !== "pending"
        },
        {
            label: "Ho\u00e0n t\u1ea5t x\u1eed l\u00fd",
            value: complaint.resolved_at || order.return_completed_at || order.refunded_at || order.updated_at,
            done: isResolved
        }
    ];

    elements.complaintDetailTitle.textContent = `Khi\u1ebfu n\u1ea1i ${order.order_code || `#${order.id}`}`;
    elements.complaintDetailContent.innerHTML = `
      <section class="complaint-detail-shell">
        <div class="complaint-detail-topbar">
          <div>
            <span class="complaint-detail-breadcrumb">Chi tiết khiếu nại</span>
            <h3>${escapeHtml(order.order_code || `#${order.id}`)}</h3>
          </div>
          <div class="complaint-detail-top-actions">
            ${isResolved ? "" : `<button class="ghost-button" type="button" data-action="complaint-reship" data-id="${order.id}">Giao lại</button>`}
            ${isResolved ? "" : `<button class="primary-button" type="button" data-action="complaint-refund" data-id="${order.id}" ${isRefunded ? "disabled" : ""}>${escapeHtml(getRefundActionLabel(order))}</button>`}
          </div>
        </div>

        <div class="complaint-detail-layout">
          <aside class="complaint-detail-sidebar">
            <article class="surface complaint-detail-panel complaint-detail-customer-card">
              <div class="complaint-customer-avatar">
                ${escapeHtml(String(order.customer_name || "KH").trim().split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase() || "KH")}
              </div>
              <div class="complaint-detail-stack">
                <span class="complaint-detail-label">Khách hàng</span>
                <strong>${escapeHtml(order.customer_name || "-")}</strong>
                <span>${escapeHtml(order.customer_phone || "-")}</span>
                <span>${escapeHtml([order.shipping_address, order.ward, order.district, order.city].filter(Boolean).join(", ") || "Chưa có địa chỉ chi tiết")}</span>
              </div>
            </article>

            <article class="surface complaint-detail-panel">
              <h4>Đơn hàng</h4>
              <div class="complaint-order-meta">
                <div><span>Mã đơn</span><strong>${escapeHtml(order.order_code || `#${order.id}`)}</strong></div>
                <div><span>Ngày mua</span><strong>${formatDateTime(order.created_at)}</strong></div>
                <div><span>Tổng tiền</span><strong>${formatCurrency(order.total_amount || 0)}</strong></div>
                <div><span>Trạng thái</span>${statusPill(complaintStatus.pillKey, complaintStatus.label)}</div>
                ${showRefundMeta ? `<div><span>Hoàn tiền</span><strong>${escapeHtml(order.refund_status_label || getRefundActionLabel(order))}</strong></div>` : ""}
                ${Number(order.refund_amount || 0) > 0 ? `<div><span>Số tiền hoàn</span><strong>${formatCurrency(order.refund_amount)}</strong></div>` : ""}
              </div>
            </article>

            <article class="surface complaint-detail-panel">
              <h4>Tiến độ xử lý</h4>
              <div class="complaint-timeline">
                ${timelineSteps.map((step) => `
                  <div class="complaint-timeline-item ${step.done ? "done" : ""}">
                    <span class="complaint-timeline-dot"></span>
                    <div>
                      <strong>${escapeHtml(step.label)}</strong>
                      <span>${escapeHtml(step.value ? formatDateTime(step.value) : "Chưa có mốc thời gian")}</span>
                    </div>
                  </div>
                `).join("")}
              </div>
            </article>
          </aside>

          <div class="complaint-detail-main">
            <article class="surface complaint-detail-panel">
              <div class="complaint-case-header">
                <div>
                  <div class="complaint-severity-pill">Mức độ: ${isResolved ? "xử lý xong" : "đang xử lý"}</div>
                  <h3>${escapeHtml(getComplaintTitleText(order))}</h3>
                </div>
                <div class="complaint-case-side">
                  <span>Lý do khiếu nại</span>
                  <strong>${escapeHtml(complaint.reason || "Chua ph�n lo?i")}</strong>
                </div>
              </div>

              <div class="complaint-message-box">
                <p>${escapeHtml(complaint.description || "Khách hàng chưa để lại mô tả chi tiết. Admin đang xử lý theo luồng hoàn/đổi của đơn hàng.")}</p>
              </div>

              <div class="complaint-evidence-section">
                <h4>Hình ảnh bằng chứng</h4>
                <div class="complaint-evidence-grid">
                  ${evidenceImages.length ? evidenceImages.map((imageUrl, index) => `
                    <button class="complaint-evidence-card" type="button" data-action="open-complaint-image" data-image-url="${escapeHtml(resolveMediaUrl(imageUrl))}" title="Mở ảnh ${index + 1}">
                      <img src="${escapeHtml(resolveMediaUrl(imageUrl))}" alt="Bằng chứng ${index + 1}">
                    </button>
                  `).join("") : `<div class="complaint-evidence-empty">Chưa có ảnh minh chứng. Đang dùng dữ liệu sản phẩm để đối chiếu.</div>`}
                </div>
              </div>
            </article>

            <article class="surface complaint-detail-panel">
              <div class="section-head">
                <h3>Sản phẩm liên quan</h3>
              </div>
              <div class="orders-table-scroll">
                <table class="list-table complaint-items-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Số lượng</th>
                      <th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map((item) => `
                      <tr>
                        <td>${escapeHtml(item.product_name || "-")}</td>
                        <td>${formatNumber(item.quantity || 0)}</td>
                        <td>${formatCurrency(item.line_total || 0)}</td>
                      </tr>
                    `).join("") || `<tr><td colspan="3">Không có sản phẩm trong đơn.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </article>

            <article class="surface complaint-detail-panel">
              <div class="section-head">
                <h3>Phản hồi của Admin</h3>
              </div>
              <textarea id="complaintAdminResponse" class="complaint-response-input" rows="4" placeholder="Nh?p n?i dung ph?n h?i cho kh�ch h�ng t?i d�y...">${escapeHtml(complaint.adminResponse || "")}</textarea>
              <div class="complaint-detail-actions">
                ${order.return_status === "shipping_back" ? buildOrderActionButton({
                    action: "order-special-action",
                    id: order.id,
                    special: "mark_returned",
                    label: returnState.isAvailable ? "Xác nhận xử lý xong" : `Chờ ${formatCountdown(returnState.remainingMs)}`,
                    disabled: !returnState.isAvailable,
                    tone: "accent"
                }) : ""}
              </div>
            </article>
          </div>
        </div>
      </section>
    `;
}

function exportComplaintsReport(orders) {
    const rows = [
        ["M\u00e3 \u0111\u01a1n h\u00e0ng", "Kh\u00e1ch h\u00e0ng", "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i", "N\u1ed9i dung khi\u1ebfu n\u1ea1i", "Ng\u00e0y g\u1eedi", "Tr\u1ea1ng th\u00e1i"]
    ];

    orders.forEach((order) => {
        rows.push([
            order.order_code || `#${order.id}`,
            order.customer_name || "",
            order.customer_phone || "",
            getComplaintExcerptText(order),
            formatDateTime(order.return_started_at || order.updated_at || order.created_at),
            getComplaintStatusUi(order).label
        ]);
    });

    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "bao-cao-khieu-nai.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
}

function getOrderStatusPresentation(order) {
    if (order.return_status === "shipping_back") {
        const returnState = getReturnState(order);
        return {
            pill: statusPill("shipping", "Đang hoàn hàng"),
            note: returnState.isAvailable
                ? "Đã đủ thời gian, admin có thể xác nhận hàng hoàn về kho."
                : `Chờ ${formatCountdown(returnState.remainingMs)} để xác nhận hàng hoàn về kho.`
        };
    }

    if (order.status === "shipping" && order.delivered_at && !order.customer_received_at) {
        return {
            pill: statusPill("completed", "Giao hàng thành công"),
            note: `Đã giao lúc ${formatDateTime(order.delivered_at)}. Chờ admin hoàn tất đơn.`
        };
    }

    if (order.status === "shipping" && !order.delivered_at) {
        const deliveryState = getDeliveryState(order);
        return {
            pill: statusPill("shipping", order.status_label || "Đang giao"),
            note: deliveryState.isAvailable
                ? "Đã đủ 2 phút, admin có thể xác nhận giao hàng thành công."
                : `Cần chờ ${formatCountdown(deliveryState.remainingMs)} trước khi xác nhận giao thành công.`
        };
    }

    if (order.status === "completed") {
        const completedAt = order.completed_at || order.customer_received_at || order.delivered_at;
        return {
            pill: statusPill("completed", order.status_label || "Hoàn thành"),
            note: completedAt ? `Hoàn tất lúc ${formatDateTime(completedAt)}.` : "Đơn hàng đã hoàn tất."
        };
    }

    if (order.status === "cancelled") {
        return {
            pill: statusPill("cancelled", order.status_label || "Đã hủy"),
            note: "Đơn hàng đã được hủy thủ công."
        };
    }

    return {
        pill: statusPill(order.status, order.status_label),
        note: ({
            pending: "Đơn đang chờ admin xác nhận.",
            confirmed: "Đơn đã xác nhận, chờ chuẩn bị hàng.",
            preparing: "Đơn đang được soạn và đóng gói."
        })[order.status] || "Đơn hàng đang được xử lý."
    };
}

function buildOrderActionButton({ label, disabled = false, tone = "", action = "", id = "", status = "", special = "", title = "" }) {
    const attributes = [
        `class="chip-button"`,
        `type="button"`
    ];

    if (action) attributes.push(`data-action="${action}"`);
    if (id) attributes.push(`data-id="${id}"`);
    if (status) attributes.push(`data-status="${status}"`);
    if (special) attributes.push(`data-special="${special}"`);
    if (tone) attributes.push(`data-tone="${tone}"`);
    if (title) attributes.push(`title="${escapeHtml(title)}"`);
    if (disabled) attributes.push("disabled");

    return `<button ${attributes.join(" ")}>${escapeHtml(label)}</button>`;
}

function buildOrderActionButtons(order) {
    const buttons = [
        buildOrderActionButton({
            action: "view-order",
            id: order.id,
            label: "Xem đơn hàng"
        })
    ];

    if (order.status === "pending") {
        buttons.push(buildOrderActionButton({
            action: "set-order-status",
            id: order.id,
            status: "confirmed",
            label: "Xác nhận đơn"
        }));
    }

    if (order.status === "confirmed") {
        buttons.push(buildOrderActionButton({
            action: "set-order-status",
            id: order.id,
            status: "preparing",
            label: "Bắt đầu xử lý"
        }));
    }

    if (order.status === "preparing") {
        buttons.push(buildOrderActionButton({
            action: "set-order-status",
            id: order.id,
            status: "shipping",
            label: "Bàn giao vận chuyển"
        }));
    }

    if (!["completed", "cancelled"].includes(order.status) && !order.return_status) {
        if (!order.tracking_code || order.shipping_status === "cancelled") {
            buttons.push(buildOrderActionButton({
                action: "create-grab-shipment",
                id: order.id,
                label: "Tạo vận đơn Grab"
            }));
        } else if (order.shipping_provider === "grab_dev" && !["delivered", "cancelled"].includes(order.shipping_status)) {
            buttons.push(buildOrderActionButton({
                action: "advance-grab-shipment",
                id: order.id,
                label: getGrabDevNextActionLabel(order)
            }));
            if (!["picked_up", "delivering"].includes(order.shipping_status)) {
                buttons.push(buildOrderActionButton({
                    action: "cancel-grab-shipment",
                    id: order.id,
                    tone: "danger",
                    label: "Hủy Grab"
                }));
            }
        }
    }

    if (order.status === "shipping" && !order.delivered_at && !order.return_status) {
        const deliveryState = getDeliveryState(order);
        buttons.push(buildOrderActionButton({
            action: "order-special-action",
            id: order.id,
            special: "mark_delivered",
            label: deliveryState.isAvailable ? "Xác nhận giao thành công" : `Chờ ${formatCountdown(deliveryState.remainingMs)}`,
            disabled: !deliveryState.isAvailable,
            title: deliveryState.isAvailable ? "Xác nhận đơn đã giao thành công." : "Nút này chỉ được bấm sau 2 phút kể từ lúc bàn giao vận chuyển."
        }));
    }

    if (order.status === "shipping" && order.delivered_at && !order.customer_received_at && !order.return_status) {
        buttons.push(buildOrderActionButton({
            action: "order-special-action",
            id: order.id,
            special: "confirm_received",
            label: "Hoàn tất đơn"
        }));
        buttons.push(buildOrderActionButton({
            action: "order-special-action",
            id: order.id,
            special: "request_return",
            tone: "danger",
            label: "Xử lý khiếu nại / hoàn tiền"
        }));
    }

    if (order.return_status === "shipping_back") {
        const returnState = getReturnState(order);
        buttons.push(buildOrderActionButton({
            action: "order-special-action",
            id: order.id,
            special: "mark_returned",
            label: returnState.isAvailable ? "Xác nhận hàng hoàn" : `Chờ ${formatCountdown(returnState.remainingMs)}`,
            disabled: !returnState.isAvailable,
            title: returnState.isAvailable ? "Xác nhận hàng hoàn về kho." : "Nút này chỉ được bấm sau 1 phút kể từ lúc bắt đầu hoàn hàng."
        }));
    }

    if (canCancelOrderBeforePickup(order)) {
        buttons.push(buildOrderActionButton({
            action: "set-order-status",
            id: order.id,
            status: "cancelled",
            tone: "danger",
            label: "Hủy đơn"
        }));
    }

    return buttons.join("");
}

function buildSummaryCard(filterKey, label, value, extraClass = "") {
    const isActive = (state.orderQuickFilter || "all") === filterKey;
    const classes = ["orders-summary-card"];
    if (isActive) classes.push("active");
    if (extraClass) classes.push(extraClass);
    return `
      <button class="${classes.join(" ")}" type="button" data-order-quick-filter="${filterKey}">
        <span>${escapeHtml(label)}</span>
        <strong>${formatNumber(value)}</strong>
      </button>
    `;
}

function getSellableProducts() {
    return (Array.isArray(state.products) ? state.products : [])
        .filter((product) => product && product.status === "active" && Boolean(product.is_published))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "vi"));
}

function getOrderPickerProducts() {
    return getSellableProducts().filter((product) => getAvailableOrderQuantity(product) > 0);
}

function getProductCategoryMeta(product) {
    const categoryId = product?.category_id != null ? String(product.category_id) : "";
    const fallbackName = String(product?.category_name || product?.category?.name || "Khác").trim() || "Khác";
    const matchedCategory = (Array.isArray(state.categories) ? state.categories : [])
        .find((category) => String(category?.id) === categoryId);

    return {
        id: categoryId || fallbackName.toLowerCase().replace(/\s+/g, "-"),
        name: String(matchedCategory?.name || fallbackName).trim() || "Khác"
    };
}

function getOrderProductById(productId) {
    return getSellableProducts().find((product) => Number(product.id) === Number(productId))
        || (Array.isArray(state.products) ? state.products : []).find((product) => Number(product.id) === Number(productId))
        || null;
}

function getStockPerSaleUnit(product) {
    const normalized = Number(product?.stock_per_sale_unit || 1);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
}

function getAvailableOrderQuantity(product) {
    const stockQuantity = Number(product?.stock_quantity || 0);
    if (stockQuantity <= 0) return 0;
    return Math.max(0, Math.floor((stockQuantity + Number.EPSILON) / getStockPerSaleUnit(product)));
}

function getProductRetailPrice(product) {
    const price = Number(product?.current_price || product?.sale_price || product?.price || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
}

function getDraftLineItems() {
    const draft = ensureCreateOrderDraft();

    return draft.items.map((item) => {
        const product = getOrderProductById(item.product_id);
        const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
        const availableQuantity = product ? getAvailableOrderQuantity(product) : 0;
        const unitPrice = product ? getProductRetailPrice(product) : 0;
        const lineTotal = unitPrice * quantity;

        return {
            ...item,
            product,
            quantity,
            availableQuantity,
            unitPrice,
            lineTotal
        };
    });
}

function resolveDraftCoupon(subtotal) {
    const draft = ensureCreateOrderDraft();
    const couponCode = String(draft.coupon_code || "").trim();
    if (!couponCode) {
        return { coupon: null, discountAmount: 0 };
    }

    const coupon = (Array.isArray(state.coupons) ? state.coupons : []).find((entry) => String(entry.code || "").trim() === couponCode);
    if (!coupon || coupon.is_active === false) {
        return { coupon: null, discountAmount: 0 };
    }

    const minimumOrderValue = Number(coupon.min_order_value || 0);
    if (minimumOrderValue > 0 && subtotal < minimumOrderValue) {
        return { coupon, discountAmount: 0 };
    }

    let discountAmount = 0;
    if (coupon.discount_type === "percentage") {
        discountAmount = subtotal * (Number(coupon.discount_value || 0) / 100);
        const maxDiscountValue = Number(coupon.max_discount_value || 0);
        if (maxDiscountValue > 0) {
            discountAmount = Math.min(discountAmount, maxDiscountValue);
        }
    } else {
        discountAmount = Number(coupon.discount_value || 0);
    }

    return {
        coupon,
        discountAmount: Number(Math.max(0, discountAmount).toFixed(0))
    };
}

function getDraftSummary() {
    const lineItems = getDraftLineItems();
    const validItems = lineItems.filter((item) => item.product && item.quantity > 0);
    const subtotal = validItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const shippingFee = Math.max(0, Number(ensureCreateOrderDraft().shipping_fee || 0));
    const { coupon, discountAmount } = resolveDraftCoupon(subtotal);
    const total = Math.max(0, subtotal + shippingFee - discountAmount);

    return {
        lineItems,
        validItems,
        subtotal,
        shippingFee,
        coupon,
        discountAmount,
        total
    };
}

function buildReshipDraftFromComplaint(order) {
    const complaint = parseComplaintPayload(order?.note);
    const existingSeller = parseOrderAdminNotePayload(order?.note);
    const fallbackSeller = getDefaultSellerInfo();
    const sourceItems = Array.isArray(order?.items) ? order.items : [];

    return {
        customer_name: String(order?.customer_name || "").trim(),
        customer_phone: String(order?.customer_phone || "").trim(),
        shipping_address: String(order?.shipping_address || "").trim(),
        ward: String(order?.ward || "").trim(),
        district: String(order?.district || "").trim(),
        city: String(order?.city || "").trim(),
        note: `Đơn giao lại từ khiếu nại ${order?.order_code || `#${order?.id || ""}`}${complaint.reason ? ` - ${complaint.reason}` : ""}`.trim(),
        payment_method: String(order?.payment_method || "cod").trim() || "cod",
        payment_status: String(order?.payment_status || "paid").trim() || "paid",
        shipping_fee: 0,
        coupon_code: "",
        reship_source_order_id: order?.id || null,
        seller_name: existingSeller.seller_name || fallbackSeller.seller_name,
        seller_phone: existingSeller.seller_phone || fallbackSeller.seller_phone,
        pickup_address: existingSeller.pickup_address || fallbackSeller.pickup_address,
        items: sourceItems
            .filter((item) => Number(item?.product_id) > 0)
            .map((item) => ({
                key: createOrderDraftItem().key,
                product_id: String(item.product_id),
                quantity: Math.max(1, Math.floor(Number(item.quantity || 1)))
            }))
    };
}

function openReshipCreateOrder(order) {
    createOrderDraft = buildReshipDraftFromComplaint(order);
    closeComplaintDetail();
    state.sidebarSection = "orders";
    state.sidebarItem = "orders-create";
    state.orderWorkspace = "create";
    state.expandedSections.orders = true;
    renderSidebarMenu();
    setActivePanel("orders");
    renderOrders();
    showToast("Đã đổ dữ liệu khiếu nại sang form tạo đơn hàng.");
}

function syncCreateOrderDraftFromForm() {
    const form = elements.orderCreateContent?.querySelector("#orderCreateForm");
    if (!form) return ensureCreateOrderDraft();

    const draft = ensureCreateOrderDraft();
    const formData = new FormData(form);

    draft.customer_name = String(formData.get("customer_name") || "").trim();
    draft.customer_phone = String(formData.get("customer_phone") || "").trim();
    draft.shipping_address = String(formData.get("shipping_address") || "").trim();
    draft.ward = String(formData.get("ward") || "").trim();
    draft.district = String(formData.get("district") || "").trim();
    draft.city = String(formData.get("city") || "").trim();
    draft.note = String(formData.get("note") || "").trim();
    draft.payment_method = String(formData.get("payment_method") || "cod");
    draft.payment_status = String(formData.get("payment_status") || "unpaid");
    draft.shipping_fee = Math.max(0, Number(parseMoneyInputValue(formData.get("shipping_fee")) || 0));
    draft.coupon_code = String(formData.get("coupon_code") || "").trim();
    draft.seller_name = String(formData.get("seller_name") || "").trim();
    draft.seller_phone = String(formData.get("seller_phone") || "").trim();
    draft.pickup_address = String(formData.get("pickup_address") || "").trim();
    draft.items = Array.from(form.querySelectorAll("[data-order-item-row]")).map((row) => ({
        key: row.dataset.key || createOrderDraftItem().key,
        product_id: String(row.querySelector("[name='product_id']")?.value || ""),
        quantity: Math.max(1, Math.floor(Number(row.querySelector("[name='quantity']")?.value || 1)))
    }));

    return draft;
}

function buildPaymentMethodOptionsLegacy(selectedValue) {
    return [
        ["cod", "Thanh toán khi nhận hàng"],
        ["bank_transfer", "Chuyển khoản"],
        ["online", "Thanh toán trực tuyến"]
    ].map(([value, label]) => `<option value="${value}" ${selectedValue === value ? "selected" : ""}>${label}</option>`).join("");
}

function buildPaymentStatusOptionsLegacy(selectedValue) {
    return [
        ["unpaid", "Chưa thanh toán"],
        ["pending", "Chờ thanh toán"],
        ["paid", "Đã thanh toán"]
    ].map(([value, label]) => `<option value="${value}" ${selectedValue === value ? "selected" : ""}>${label}</option>`).join("");
}

function buildCouponOptionsLegacy(selectedValue) {
    const activeCoupons = (Array.isArray(state.coupons) ? state.coupons : [])
        .filter((coupon) => coupon && coupon.is_active !== false);

    return [
        `<option value="">Không áp dụng</option>`,
        ...activeCoupons.map((coupon) => `<option value="${escapeHtml(coupon.code)}" ${selectedValue === coupon.code ? "selected" : ""}>${escapeHtml(coupon.code)}${coupon.description ? ` - ${escapeHtml(coupon.description)}` : ""}</option>`)
    ].join("");
}

function buildCreateOrderItemRowLegacy(item) {
    const product = item.product;
    const productOptions = [
        `<option value="">Chọn sản phẩm</option>`,
        ...getSellableProducts().map((entry) => `<option value="${entry.id}" ${Number(item.product_id) === Number(entry.id) ? "selected" : ""}>${escapeHtml(entry.name)}${entry.sku ? ` - ${escapeHtml(entry.sku)}` : ""}</option>`)
    ].join("");

    return `
      <div class="order-builder-item" data-order-item-row data-key="${escapeHtml(item.key)}">
        <label class="span-2">
          <span>Sản phẩm</span>
          <select name="product_id">${productOptions}</select>
        </label>
        <label>
          <span>Số lượng</span>
          <input name="quantity" type="number" min="1" step="1" value="${escapeHtml(String(item.quantity || 1))}">
        </label>
        <div class="order-builder-item-meta">
          <div><span>Tồn khả dụng</span><strong>${product ? `${formatNumber(item.availableQuantity)} ${escapeHtml(product.sale_unit || product.stock_unit || product.unit || "")}`.trim() : "-"}</strong></div>
          <div><span>Đơn giá</span><strong>${product ? formatCurrency(item.unitPrice) : "-"}</strong></div>
          <div><span>Thành tiền</span><strong>${product ? formatCurrency(item.lineTotal) : "-"}</strong></div>
        </div>
        <button class="chip-button" type="button" data-create-order-action="remove-item" data-key="${escapeHtml(item.key)}" ${ensureCreateOrderDraft().items.length === 1 ? "disabled" : ""}>Xóa dòng</button>
      </div>
    `;
}

function renderCreateOrderWorkspaceLegacy() {
    const draft = ensureCreateOrderDraft();
    const summary = getDraftSummary();
    const couponHint = draft.coupon_code && summary.coupon && summary.discountAmount === 0 && Number(summary.coupon.min_order_value || 0) > summary.subtotal
        ? `Mã ${summary.coupon.code} cần đơn tối thiểu ${formatCurrency(summary.coupon.min_order_value)}.`
        : summary.coupon && summary.discountAmount > 0
            ? `Đang áp dụng mã ${summary.coupon.code}.`
            : "Chưa áp dụng giảm giá.";

    elements.orderCreateContent.innerHTML = `
      <form id="orderCreateForm" class="order-create-layout">
        <section class="order-create-grid">
          <article class="surface order-create-section">
            <div class="section-head">
              <h3>Thông tin khách hàng</h3>
            </div>
            <div class="compact-grid">
              <label>
                <span>Họ tên người nhận</span>
                <input name="customer_name" value="${escapeHtml(draft.customer_name)}" placeholder="Ví dụ: Vũ Quang Ngạn" required>
              </label>
              <label>
                <span>Số điện thoại</span>
                <input name="customer_phone" value="${escapeHtml(draft.customer_phone)}" placeholder="Ví dụ: 0912345678" required>
              </label>
              <label class="span-2">
                <span>Địa chỉ giao hàng</span>
                <input name="shipping_address" value="${escapeHtml(draft.shipping_address)}" placeholder="Số nhà, tên đường..." required>
              </label>
              <label>
                <span>Phường / Xã</span>
                <input name="ward" value="${escapeHtml(draft.ward)}" placeholder="Ví dụ: Mỹ Đình 2">
              </label>
              <label>
                <span>Quận / Huyện</span>
                <input name="district" value="${escapeHtml(draft.district)}" placeholder="Ví dụ: Nam Từ Liêm">
              </label>
              <label class="span-2">
                <span>Tỉnh / Thành phố</span>
                <input name="city" value="${escapeHtml(draft.city)}" placeholder="Ví dụ: Hà Nội" required>
              </label>
              <label class="span-2">
                <span>Ghi chú đơn hàng</span>
                <textarea name="note" rows="3" placeholder="Thông tin thêm cho shipper hoặc kho xử lý...">${escapeHtml(draft.note)}</textarea>
              </label>
            </div>
          </article>

          <article class="surface order-create-section order-create-section-wide">
            <div class="section-head">
              <h3>Thông tin người bán</h3>
            </div>
            <div class="compact-grid">
              <label>
                <span>Họ và tên người bán</span>
                <input name="seller_name" value="${escapeHtml(draft.seller_name || "")}" placeholder="Ví dụ: Trần Minh B">
              </label>
              <label>
                <span>Số điện thoại người bán</span>
                <input name="seller_phone" value="${escapeHtml(draft.seller_phone || "")}" placeholder="Ví dụ: 0909888999">
              </label>
              <label class="span-2">
                <span>Địa chỉ lấy hàng</span>
                <input name="pickup_address" value="${escapeHtml(draft.pickup_address || "")}" placeholder="Ví dụ: 123 Đường Vườn Xanh, Quận 1, TP. Hồ Chí Minh">
              </label>
            </div>
          </article>

          <article class="surface order-create-section">
            <div class="section-head">
              <h3>Thanh toán và ưu đãi</h3>
            </div>
            <div class="compact-grid">
              <label>
                <span>Phương thức thanh toán</span>
                <select name="payment_method">${buildPaymentMethodOptionsLegacy(draft.payment_method)}</select>
              </label>
              <label>
                <span>Trạng thái thanh toán</span>
                <select name="payment_status">${buildPaymentStatusOptionsLegacy(draft.payment_status)}</select>
              </label>
              <label>
                <span>Phí vận chuyển</span>
                  <input name="shipping_fee" type="text" inputmode="numeric" data-money-input value="${escapeHtml(formatMoneyInputValue(draft.shipping_fee || 0))}">
              </label>
              <label>
                <span>Mã giảm giá</span>
                <select name="coupon_code">${buildCouponOptionsLegacy(draft.coupon_code)}</select>
              </label>
            </div>
            <p class="section-copy">${escapeHtml(couponHint)}</p>
          </article>
        </section>

        <section class="order-create-products">
            <div class="section-head">
              <h3>Sản phẩm trong đơn</h3>
              <div class="order-create-actions-inline">
              <button class="secondary-button" type="button" data-create-order-action="add-item">Thêm sản phẩm</button>
            </div>
          </div>
          <div class="order-builder-list">
            ${summary.lineItems.map((item) => buildCreateOrderItemRowLegacy(item)).join("")}
          </div>
        </section>

        <aside class="surface order-create-summary">
          <div class="section-head">
            <h3>Tóm tắt đơn hàng</h3>
          </div>
          <div class="order-create-summary-grid">
            <div><span>Số dòng sản phẩm</span><strong>${formatNumber(summary.validItems.length)}</strong></div>
            <div><span>Tổng số lượng bán</span><strong>${formatNumber(summary.validItems.reduce((sum, item) => sum + item.quantity, 0))}</strong></div>
            <div><span>Tạm tính</span><strong>${formatCurrency(summary.subtotal)}</strong></div>
            <div><span>Phí vận chuyển</span><strong>${formatCurrency(summary.shippingFee)}</strong></div>
            <div><span>Giảm giá</span><strong>${summary.discountAmount > 0 ? `- ${formatCurrency(summary.discountAmount)}` : formatCurrency(0)}</strong></div>
            <div class="grand"><span>Tổng thanh toán</span><strong>${formatCurrency(summary.total)}</strong></div>
          </div>
          <button class="primary-button order-create-submit" type="submit">Tạo đơn hàng</button>
        </aside>
      </form>
    `;
}

function buildPaymentMethodOptions(selectedValue) {
    return [
        ["cod", "Thanh toán khi nhận hàng"],
        ["bank_transfer", "Chuyển khoản"],
        ["online", "Thanh toán trực tuyến"]
    ].map(([value, label]) => `<option value="${value}" ${selectedValue === value ? "selected" : ""}>${label}</option>`).join("");
}

function buildPaymentStatusOptions(selectedValue) {
    return [
        ["unpaid", "Chưa thanh toán"],
        ["pending", "Chờ thanh toán"],
        ["paid", "Đã thanh toán"]
    ].map(([value, label]) => `<option value="${value}" ${selectedValue === value ? "selected" : ""}>${label}</option>`).join("");
}

function buildCouponOptions(selectedValue) {
    const activeCoupons = (Array.isArray(state.coupons) ? state.coupons : [])
        .filter((coupon) => coupon && coupon.is_active !== false);

    return [
        `<option value="">Không áp dụng</option>`,
        ...activeCoupons.map((coupon) => `<option value="${escapeHtml(coupon.code)}" ${selectedValue === coupon.code ? "selected" : ""}>${escapeHtml(coupon.code)}${coupon.description ? ` - ${escapeHtml(coupon.description)}` : ""}</option>`)
    ].join("");
}

function buildCreateOrderItemRow(item) {
    const product = item.product;
    if (!product) return "";
    const unit = product?.sale_unit || product?.stock_unit || product?.unit || "đơn vị";
    const quantity = Math.max(1, Number(item.quantity || 1));
    const productName = product?.name || "Chưa chọn sản phẩm";
    const productSku = product?.sku || "Chưa có SKU";

    return `
      <div class="order-builder-item" data-order-item-row data-key="${escapeHtml(item.key)}">
        <input name="product_id" type="hidden" value="${escapeHtml(String(product.id))}">

        <div class="order-builder-item-card">
          <div class="order-builder-item-product">
            <img class="order-builder-thumb" src="${escapeHtml(resolveMediaUrl(product?.thumbnail_url, defaultOrderProductThumb()))}" alt="${escapeHtml(productName)}">
            <div class="order-builder-item-copy">
              <strong>${escapeHtml(productName)}</strong>
              <span>SKU: ${escapeHtml(productSku)}</span>
              <span class="order-builder-item-price">${formatCurrency(item.unitPrice)} / ${escapeHtml(unit)}</span>
            </div>
          </div>

          <div class="order-builder-quantity">
            <span>Số lượng</span>
            <div class="order-builder-stepper">
              <button class="order-builder-stepper-button" type="button" data-create-order-action="decrease-quantity" data-key="${escapeHtml(item.key)}">-</button>
              <strong>${formatNumber(quantity)}</strong>
              <button class="order-builder-stepper-button" type="button" data-create-order-action="increase-quantity" data-key="${escapeHtml(item.key)}">+</button>
            </div>
            <input name="quantity" type="hidden" value="${escapeHtml(String(quantity))}">
          </div>

          <div class="order-builder-item-meta">
            <div><span>Tồn khả dụng</span><strong>${formatNumber(item.availableQuantity)} ${escapeHtml(unit)}</strong></div>
            <div><span>Thành tiền</span><strong>${formatCurrency(item.lineTotal)}</strong></div>
          </div>

          <button class="icon-action-button order-builder-remove" type="button" data-create-order-action="remove-item" data-key="${escapeHtml(item.key)}" aria-label="Xóa sản phẩm">×</button>
        </div>
      </div>
    `;
}

function renderCreateOrderWorkspace() {
    const draft = ensureCreateOrderDraft();
    const summary = getDraftSummary();
    const selectedLineItems = summary.lineItems.filter((item) => item.product);
    const couponHint = draft.coupon_code && summary.coupon && summary.discountAmount === 0 && Number(summary.coupon.min_order_value || 0) > summary.subtotal
        ? `Mã ${summary.coupon.code} cần đơn tối thiểu ${formatCurrency(summary.coupon.min_order_value)}.`
        : summary.coupon && summary.discountAmount > 0
            ? `Đang áp dụng mã ${summary.coupon.code}.`
            : "Chưa áp dụng giảm giá.";

    elements.orderCreateContent.innerHTML = `
      <form id="orderCreateForm" class="order-create-layout">
        <div class="order-create-shell">
          <section class="order-create-main">
            <div class="order-create-party-grid">
              <article class="surface order-create-section order-create-seller-section">
                <div class="section-head">
                  <h3>Thông tin người bán</h3>
                </div>
                <div class="compact-grid">
                  <label>
                    <span>Họ và tên người bán</span>
                    <input name="seller_name" value="${escapeHtml(draft.seller_name || "")}" placeholder="Ví dụ: Quản trị hệ thống">
                  </label>
                  <label>
                    <span>Số điện thoại người bán</span>
                    <input name="seller_phone" value="${escapeHtml(draft.seller_phone || "")}" placeholder="Ví dụ: 0909888999">
                  </label>
                  <label class="span-2">
                    <span>Địa chỉ lấy hàng</span>
                    <input name="pickup_address" value="${escapeHtml(draft.pickup_address || "")}" placeholder="Ví dụ: 123 Đường Vườn Xanh, Quận 1, TP. Hồ Chí Minh">
                  </label>
                </div>
              </article>

              <article class="surface order-create-section order-create-customer-section">
                <div class="section-head">
                  <h3>Thông tin khách hàng</h3>
                </div>
                <div class="compact-grid">
                  <label>
                    <span>Họ tên người nhận</span>
                    <input name="customer_name" value="${escapeHtml(draft.customer_name)}" placeholder="Ví dụ: Vũ Quang Ngạn" required>
                  </label>
                  <label>
                    <span>Số điện thoại</span>
                    <input name="customer_phone" value="${escapeHtml(draft.customer_phone)}" placeholder="Ví dụ: 0912345678" required>
                  </label>
                  <label class="span-2">
                    <span>Địa chỉ giao hàng</span>
                    <input name="shipping_address" value="${escapeHtml(draft.shipping_address)}" placeholder="Số nhà, tên đường..." required>
                  </label>
                  <label>
                    <span>Phường / Xã</span>
                    <input name="ward" value="${escapeHtml(draft.ward)}" placeholder="Ví dụ: Mỹ Đình 2">
                  </label>
                  <label>
                    <span>Quận / Huyện</span>
                    <input name="district" value="${escapeHtml(draft.district)}" placeholder="Ví dụ: Nam Từ Liêm">
                  </label>
                  <label class="span-2">
                    <span>Tỉnh / Thành phố</span>
                    <input name="city" value="${escapeHtml(draft.city)}" placeholder="Ví dụ: Hà Nội" required>
                  </label>
                  <label class="span-2">
                    <span>Ghi chú đơn hàng</span>
                    <textarea name="note" rows="3" placeholder="Thông tin thêm cho shipper hoặc kho xử lý...">${escapeHtml(draft.note)}</textarea>
                  </label>
                </div>
              </article>
            </div>

            <article class="surface order-create-section order-create-payment-section">
              <div class="section-head">
                <h3>Thanh toán và ưu đãi</h3>
              </div>
              <div class="compact-grid">
                <label>
                  <span>Phương thức thanh toán</span>
                  <select name="payment_method">${buildPaymentMethodOptions(draft.payment_method)}</select>
                </label>
                <label>
                  <span>Trạng thái thanh toán</span>
                  <select name="payment_status">${buildPaymentStatusOptions(draft.payment_status)}</select>
                </label>
                <label>
                  <span>Phí vận chuyển</span>
                  <input name="shipping_fee" type="text" inputmode="numeric" data-money-input value="${escapeHtml(formatMoneyInputValue(draft.shipping_fee || 0))}">
                </label>
                <label>
                  <span>Mã giảm giá</span>
                  <select name="coupon_code">${buildCouponOptions(draft.coupon_code)}</select>
                </label>
              </div>
              <p class="section-copy">${escapeHtml(couponHint)}</p>
            </article>

            <section class="surface order-create-products">
              <div class="section-head">
                <h3>Danh sách sản phẩm</h3>
                <div class="order-create-actions-inline">
                  <span class="status-pill tone-neutral">${formatNumber(selectedLineItems.length)} sản phẩm</span>
                </div>
              </div>
              <div class="order-builder-list">
                ${selectedLineItems.length ? selectedLineItems.map((item) => buildCreateOrderItemRow(item)).join("") : '<article class="surface order-builder-empty-state"><strong>Chưa có sản phẩm nào trong đơn.</strong><span>Nhấn nút bên dưới để mở popup chọn sản phẩm từ kho hàng.</span></article>'}
              </div>
              <button class="order-add-product-button" type="button" data-create-order-action="open-product-picker">
                <span class="order-add-product-icon">+</span>
                <span>Thêm sản phẩm từ kho</span>
              </button>
            </section>
          </section>

          <aside class="surface order-create-summary">
            <div class="section-head">
              <h3>Tóm tắt đơn hàng</h3>
            </div>
            <div class="order-create-summary-grid">
              <div><span>Số dòng sản phẩm</span><strong>${formatNumber(summary.validItems.length)}</strong></div>
              <div><span>Tổng số lượng bán</span><strong>${formatNumber(summary.validItems.reduce((sum, item) => sum + item.quantity, 0))}</strong></div>
              <div><span>Tạm tính</span><strong>${formatCurrency(summary.subtotal)}</strong></div>
              <div><span>Phí vận chuyển</span><strong>${formatCurrency(summary.shippingFee)}</strong></div>
              <div><span>Giảm giá</span><strong>${summary.discountAmount > 0 ? `- ${formatCurrency(summary.discountAmount)}` : formatCurrency(0)}</strong></div>
              <div class="grand"><span>Tổng thanh toán</span><strong>${formatCurrency(summary.total)}</strong></div>
            </div>
            <button class="primary-button order-create-submit" type="submit">Tạo đơn hàng</button>
          </aside>
        </div>
      </form>
      ${renderOrderProductPickerModal()}
    `;
}

function buildOrderProductPickerQuantitiesFromDraft() {
    return getDraftLineItems().reduce((accumulator, item) => {
        if (item.product?.id) {
            accumulator[item.product.id] = Math.max(1, Math.floor(Number(item.quantity || 1)));
        }
        return accumulator;
    }, {});
}

function getOrderProductPickerCount() {
    return Object.values(orderProductPickerState.quantities || {}).filter((quantity) => Number(quantity) > 0).length;
}

function getOrderProductPickerCategories() {
    const registry = new Map();

    getOrderPickerProducts().forEach((product) => {
        const category = getProductCategoryMeta(product);
        if (!registry.has(category.id)) {
            registry.set(category.id, {
                id: category.id,
                name: category.name,
                count: 0
            });
        }

        registry.get(category.id).count += 1;
    });

    return Array.from(registry.values()).sort((left, right) => left.name.localeCompare(right.name, "vi"));
}

function getOrderProductPickerFilteredProducts() {
    const keyword = String(orderProductPickerState.keyword || "").trim().toLowerCase();
    const categoryId = String(orderProductPickerState.categoryId || "all");

    return getOrderPickerProducts().filter((product) => {
        const category = getProductCategoryMeta(product);
        if (categoryId !== "all" && category.id !== categoryId) {
            return false;
        }

        if (!keyword) {
            return true;
        }

        const haystack = [
            product.name,
            product.sku,
            product.slug,
            product.category_name,
            product.category?.name
        ].join(" ").toLowerCase();

        return haystack.includes(keyword);
    });
}

function getOrderProductPickerQuantity(productId) {
    return Math.max(0, Math.floor(Number(orderProductPickerState.quantities?.[productId] || 0)));
}

function setOrderProductPickerQuantity(productId, nextQuantity) {
    const product = getOrderProductById(productId);
    if (!product) return;

    const availableQuantity = getAvailableOrderQuantity(product);
    const normalizedQuantity = Math.max(0, Math.min(availableQuantity, Math.floor(Number(nextQuantity) || 0)));

    if (normalizedQuantity <= 0) {
        delete orderProductPickerState.quantities[product.id];
        return;
    }

    orderProductPickerState.quantities[product.id] = normalizedQuantity;
}

function openOrderProductPicker() {
    syncCreateOrderDraftFromForm();
    orderProductPickerState = {
        isOpen: true,
        quantities: buildOrderProductPickerQuantitiesFromDraft(),
        keyword: "",
        categoryId: "all"
    };
}

function closeOrderProductPicker() {
    orderProductPickerState = {
        isOpen: false,
        quantities: {},
        keyword: "",
        categoryId: "all"
    };
}

function applyOrderProductPicker() {
    const nextItems = getSellableProducts()
        .filter((product) => getOrderProductPickerQuantity(product.id) > 0)
        .map((product) => ({
            key: createOrderDraftItem().key,
            product_id: String(product.id),
            quantity: getOrderProductPickerQuantity(product.id)
        }));

    ensureCreateOrderDraft().items = nextItems;
    closeOrderProductPicker();
}

function setOrderProductPickerKeyword(keyword) {
    orderProductPickerState.keyword = String(keyword || "");
}

function setOrderProductPickerCategory(categoryId) {
    orderProductPickerState.categoryId = String(categoryId || "all");
}

function buildOrderProductPickerCardLegacy(product) {
    const quantity = getOrderProductPickerQuantity(product.id);
    const availableQuantity = getAvailableOrderQuantity(product);
    const unit = product.sale_unit || product.stock_unit || product.unit || "đơn vị";
    const unitPrice = getProductRetailPrice(product);
    const lineTotal = unitPrice * quantity;

    return `
      <article class="surface order-product-picker-card">
        <div class="order-product-picker-card-main">
          <img class="order-builder-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultOrderProductThumb()))}" alt="${escapeHtml(product.name)}">
          <div class="order-builder-item-copy">
            <strong>${escapeHtml(product.name)}</strong>
            <span>SKU: ${escapeHtml(product.sku || `SP-${product.id}`)}</span>
            <span class="order-builder-item-price">${formatCurrency(unitPrice)} / ${escapeHtml(unit)}</span>
          </div>
        </div>

        <div class="order-product-picker-card-side">
          <div class="order-builder-item-meta">
            <div><span>Tồn khả dụng</span><strong>${formatNumber(availableQuantity)} ${escapeHtml(unit)}</strong></div>
            <div><span>Thành tiền</span><strong>${quantity > 0 ? formatCurrency(lineTotal) : "-"}</strong></div>
          </div>

          ${quantity > 0 ? `
            <div class="order-product-picker-stepper-wrap">
              <span>Số lượng</span>
              <div class="order-builder-stepper">
                <button class="order-builder-stepper-button" type="button" data-create-order-action="picker-decrease-quantity" data-product-id="${product.id}">-</button>
                <strong>${formatNumber(quantity)}</strong>
                <button class="order-builder-stepper-button" type="button" data-create-order-action="picker-increase-quantity" data-product-id="${product.id}">+</button>
              </div>
            </div>
          ` : `
            <button class="secondary-button order-product-picker-add-button" type="button" data-create-order-action="picker-add-product" data-product-id="${product.id}">
              <span class="order-add-product-icon">+</span>
              <span>Thêm sản phẩm</span>
            </button>
          `}
        </div>
      </article>
    `;
}

function renderOrderProductPickerModalLegacy() {
    if (!orderProductPickerState.isOpen) return "";

    const products = getSellableProducts();
    const selectedCount = getOrderProductPickerCount();

    return `
      <div class="modal-backdrop">
        <div class="modal-card order-product-picker-modal">
          <div class="order-product-picker-header">
            <div>
              <h2>Chọn sản phẩm trong kho</h2>
            </div>
            <div class="order-product-picker-header-actions">
              <span class="status-pill tone-neutral">${formatNumber(selectedCount)} sản phẩm</span>
              <button class="ghost-button" type="button" data-create-order-action="close-product-picker">Đóng</button>
            </div>
          </div>

          <div class="order-product-picker-grid">
            ${products.map((product) => buildOrderProductPickerCard(product)).join("") || '<div class="surface order-product-picker-empty">Chưa có sản phẩm đủ điều kiện bán trong kho.</div>'}
          </div>

          <div class="order-product-picker-footer">
            <button class="ghost-button" type="button" data-create-order-action="close-product-picker">Hủy</button>
            <button class="primary-button" type="button" data-create-order-action="apply-product-picker">Áp dụng vào đơn hàng</button>
          </div>
        </div>
      </div>
    `;
}

function buildOrderProductPickerCard(product) {
    const quantity = getOrderProductPickerQuantity(product.id);
    const availableQuantity = getAvailableOrderQuantity(product);
    const unit = product.sale_unit || product.stock_unit || product.unit || "đơn vị";
    const unitPrice = getProductRetailPrice(product);
    const category = getProductCategoryMeta(product);
    const isSelected = quantity > 0;

    return `
      <article class="surface order-product-picker-card ${isSelected ? "is-selected" : ""}">
        <div class="order-product-picker-media-wrap">
          <img class="order-product-picker-media" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, defaultOrderProductThumb()))}" alt="${escapeHtml(product.name)}">
          ${isSelected ? '<span class="order-product-picker-selected-badge">&#10003;</span>' : ""}
        </div>

        <div class="order-product-picker-card-content">
          <div class="order-product-picker-card-copy">
            <span class="order-product-picker-category">${escapeHtml(category.name)}</span>
            <strong>${escapeHtml(product.name)}</strong>
            <span>Kho: ${formatNumber(availableQuantity)} ${escapeHtml(unit)}</span>
          </div>

          <div class="order-product-picker-card-footer">
            <strong class="order-product-picker-price">${formatCurrency(unitPrice)}</strong>
            ${quantity > 0 ? `
              <div class="order-product-picker-stepper-wrap">
                <div class="order-builder-stepper order-product-picker-stepper">
                  <button class="order-builder-stepper-button" type="button" data-create-order-action="picker-decrease-quantity" data-product-id="${product.id}">-</button>
                  <strong>${formatNumber(quantity)}</strong>
                  <button class="order-builder-stepper-button" type="button" data-create-order-action="picker-increase-quantity" data-product-id="${product.id}">+</button>
                </div>
              </div>
            ` : `
              <button class="order-product-picker-add-button" type="button" data-create-order-action="picker-add-product" data-product-id="${product.id}" aria-label="Thêm ${escapeHtml(product.name)}">
                +
              </button>
            `}
          </div>
        </div>
      </article>
    `;
}

function renderOrderProductPickerModal() {
    if (!orderProductPickerState.isOpen) return "";

    const products = getOrderProductPickerFilteredProducts();
    const categories = getOrderProductPickerCategories();
    const selectedCount = getOrderProductPickerCount();
    const currentCategoryId = String(orderProductPickerState.categoryId || "all");
    const applyLabel = selectedCount > 0 ? `Xác nhận chọn (${formatNumber(selectedCount)})` : "Xác nhận chọn";

    return `
      <div class="modal-backdrop">
        <div class="modal-card order-product-picker-modal">
          <div class="order-product-picker-header">
            <div>
              <h2>Chọn sản phẩm</h2>
            </div>
            <button class="order-product-picker-close" type="button" data-create-order-action="close-product-picker" aria-label="Đóng popup">&times;</button>
          </div>

          <label class="order-product-picker-search">
            <span class="order-product-picker-search-icon">&#128269;</span>
            <input type="search" value="${escapeHtml(orderProductPickerState.keyword || "")}" data-order-picker-input="keyword" placeholder="Tìm kiếm tên sản phẩm, mã SKU...">
          </label>

          <div class="order-product-picker-filter-row">
            <button class="order-product-picker-chip ${currentCategoryId === "all" ? "is-active" : ""}" type="button" data-create-order-action="picker-set-category" data-category-id="all">Tất cả</button>
            ${categories.map((category) => `<button class="order-product-picker-chip ${currentCategoryId === String(category.id) ? "is-active" : ""}" type="button" data-create-order-action="picker-set-category" data-category-id="${escapeHtml(String(category.id))}">${escapeHtml(category.name)}</button>`).join("")}
          </div>

          <div class="order-product-picker-grid">
            ${products.map((product) => buildOrderProductPickerCard(product)).join("") || '<div class="surface order-product-picker-empty">Không có sản phẩm phù hợp với bộ lọc hiện tại.</div>'}
          </div>

          <div class="order-product-picker-footer">
            <div class="order-product-picker-selection-status">
              Đã chọn:
              <strong>${formatNumber(selectedCount)} sản phẩm</strong>
            </div>
            <div class="order-product-picker-footer-actions">
              <button class="ghost-button" type="button" data-create-order-action="close-product-picker">Hủy bỏ</button>
              <button class="primary-button order-product-picker-confirm" type="button" data-create-order-action="apply-product-picker" ${selectedCount === 0 ? "disabled" : ""}>${applyLabel}</button>
            </div>
          </div>
        </div>
      </div>
    `;
}

function buildInvoiceItemsRows(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
        return `<tr><td colspan="4">Không có sản phẩm trong đơn hàng.</td></tr>`;
    }

    return items.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.product_name || "Sản phẩm")}</strong>
          <div class="invoice-item-meta">Mã sản phẩm: #${escapeHtml(String(item.product_id || "-"))}</div>
        </td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatNumber(item.quantity)}</td>
        <td>${formatCurrency(item.line_total)}</td>
      </tr>
    `).join("");
}

function normalizeText(value) {
    return String(value || "").trim();
}

function getBranchDisplayName(branch) {
    return [branch?.label, branch?.name]
        .map(normalizeText)
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(" - ");
}

function getBranchFullAddress(branch) {
    return [branch?.address, branch?.city]
        .map(normalizeText)
        .filter(Boolean)
        .join(", ");
}

function normalizeRouteText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveHanoiRoutePoint(value) {
    const text = normalizeRouteText(value);
    if (!text) return null;

    return HANOI_ROUTE_POINTS.find((point) => (
        point.terms.some((term) => {
            const normalizedTerm = normalizeRouteText(term);
            return normalizedTerm && text.includes(normalizedTerm);
        })
    )) || null;
}

function getBranchRoutePoint(branch) {
    return resolveHanoiRoutePoint([
        branch?.address,
        branch?.city,
        branch?.label,
        branch?.name,
        branch?.manager
    ].filter(Boolean).join(" "));
}

function getOrderRoutePoint(order) {
    return resolveHanoiRoutePoint([
        order?.shipping_address,
        order?.ward,
        order?.district,
        order?.city
    ].filter(Boolean).join(" "));
}

function calculateRouteDistanceKm(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return Number.POSITIVE_INFINITY;

    const earthRadiusKm = 6371;
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const deltaLat = toRadians(toPoint.lat - fromPoint.lat);
    const deltaLng = toRadians(toPoint.lng - fromPoint.lng);
    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(toRadians(fromPoint.lat)) * Math.cos(toRadians(toPoint.lat)) * Math.sin(deltaLng / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getOrderItemProduct(item) {
    const productId = Number(item?.product_id || 0);
    if (productId) {
        const byId = (state.products || []).find((product) => Number(product.id) === productId);
        if (byId) return byId;
    }

    const productName = normalizeRouteText(item?.product_name);
    return (state.products || []).find((product) => (
        productName && normalizeRouteText(product?.name) === productName
    )) || null;
}

function getBranchStockCheck(branch, order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) {
        return { checked: false, hasStock: true, missing: [] };
    }

    if (!Array.isArray(state.products) || !state.products.length) {
        return { checked: false, hasStock: false, missing: [] };
    }

    const missing = [];
    items.forEach((item) => {
        const product = getOrderItemProduct(item);
        const allocation = (product?.store_allocations || []).find((entry) => String(entry.store_key) === String(branch?.key));
        const available = Number(allocation?.allocated_quantity || 0);
        const needed = Number(item?.quantity || 0);

        if (!product || !allocation || available < needed) {
            missing.push(item?.product_name || product?.name || "Sản phẩm");
        }
    });

    return {
        checked: true,
        hasStock: missing.length === 0,
        missing
    };
}

function getOrderBranchCandidates(order) {
    const customerPoint = getOrderRoutePoint(order);
    return STORE_BRANCHES.map((branch, index) => {
        const branchPoint = getBranchRoutePoint(branch);
        const distanceKm = calculateRouteDistanceKm(customerPoint, branchPoint);
        const stock = getBranchStockCheck(branch, order);
        return {
            branch,
            branchPoint,
            distanceKm,
            stock,
            index
        };
    });
}

function getRecommendedBranchCandidate(order) {
    const candidates = getOrderBranchCandidates(order);
    if (!candidates.length) return null;

    const sortable = (candidates.some((candidate) => candidate.stock.checked && candidate.stock.hasStock)
        ? candidates.filter((candidate) => candidate.stock.hasStock)
        : candidates
    ).slice();

    sortable.sort((left, right) => {
        const leftDistance = Number.isFinite(left.distanceKm) ? left.distanceKm : 9999;
        const rightDistance = Number.isFinite(right.distanceKm) ? right.distanceKm : 9999;
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        return left.index - right.index;
    });

    return sortable[0] || candidates[0];
}

function getBranchSellerInfo(branch, baseMeta = {}) {
    return {
        seller_name: normalizeText(branch?.manager) || normalizeText(baseMeta?.seller_name) || normalizeText(state.user?.username || state.user?.name),
        seller_phone: normalizeText(branch?.phone) || normalizeText(baseMeta?.seller_phone),
        branch_key: normalizeText(branch?.key),
        branch_name: getBranchDisplayName(branch),
        pickup_address: getBranchFullAddress(branch)
    };
}

function canEditOrderBranch(order) {
    if (!order || ["completed", "cancelled"].includes(order.status) || order.return_status) return false;
    if (["picked_up", "delivering", "delivered"].includes(order.shipping_status)) return false;
    return true;
}

function formatBranchDistance(candidate) {
    return Number.isFinite(candidate?.distanceKm)
        ? `${candidate.distanceKm.toFixed(candidate.distanceKm < 10 ? 1 : 0)} km`
        : "chưa định vị";
}

function buildOrderBranchRoutingCard(order, adminMeta) {
    const candidates = getOrderBranchCandidates(order);
    if (!candidates.length) return "";

    const recommended = getRecommendedBranchCandidate(order);
    const selectedKey = adminMeta.branch_key || recommended?.branch?.key || STORE_BRANCHES[0]?.key || "";
    const selectedCandidate = candidates.find((candidate) => String(candidate.branch.key) === String(selectedKey)) || recommended || candidates[0];
    const selectedBranch = selectedCandidate?.branch || null;
    const selectedAddress = getBranchFullAddress(selectedBranch);
    const customerPoint = getOrderRoutePoint(order);
    const canEdit = canEditOrderBranch(order);
    const stockLabel = selectedCandidate?.stock?.checked
        ? (selectedCandidate.stock.hasStock ? "Có đủ hàng cho đơn này" : `Thiếu: ${selectedCandidate.stock.missing.slice(0, 2).join(", ")}`)
        : "Chưa có dữ liệu tồn kho chi nhánh để kiểm tra";

    return `
      <section class="order-branch-routing-card">
        <div class="order-branch-routing-head">
          <div>
            <span>Chi nhánh lấy hàng</span>
            <strong>${escapeHtml(getBranchDisplayName(selectedBranch) || "Chưa chọn chi nhánh")}</strong>
          </div>
          ${recommended?.branch?.key === selectedKey ? `<em>Gợi ý gần nhất</em>` : `<em>Chọn thủ công</em>`}
        </div>
        <div class="order-branch-routing-grid">
          <label>
            Chọn chi nhánh xử lý
            <select data-order-branch-select data-id="${escapeHtml(String(order.id))}" ${canEdit ? "" : "disabled"}>
              ${candidates.map((candidate) => {
                  const branchName = getBranchDisplayName(candidate.branch) || candidate.branch.key;
                  const stockSuffix = candidate.stock.checked ? (candidate.stock.hasStock ? "có hàng" : "thiếu hàng") : "chưa kiểm kho";
                  return `<option value="${escapeHtml(candidate.branch.key)}" ${String(candidate.branch.key) === String(selectedKey) ? "selected" : ""}>${escapeHtml(branchName)} - ${escapeHtml(stockSuffix)}</option>`;
              }).join("")}
            </select>
          </label>
          <div class="order-branch-routing-info">
            <span>Khoảng cách</span>
            <strong>${escapeHtml(formatBranchDistance(selectedCandidate))}</strong>
            <small>${escapeHtml(customerPoint ? `Theo bản đồ nội bộ Hà Nội: ${customerPoint.label}` : "Chưa nhận diện được khu vực khách hàng.")}</small>
          </div>
          <div class="order-branch-routing-info">
            <span>Tồn kho</span>
            <strong>${escapeHtml(stockLabel)}</strong>
            <small>Ưu tiên chi nhánh gần khách và có hàng trước khi tạo vận đơn.</small>
          </div>
        </div>
        <p>${escapeHtml(selectedAddress || "Chi nhánh này chưa có địa chỉ. Vui lòng cập nhật ở Quản lý chi nhánh trước khi bàn giao vận chuyển.")}</p>
      </section>
    `;
}

function resolveInvoiceBranch(adminMeta) {
    const branchKey = normalizeText(adminMeta?.branch_key);
    if (branchKey) {
        const matchedByKey = STORE_BRANCHES.find((branch) => String(branch.key) === branchKey);
        if (matchedByKey) return matchedByKey;
    }

    const pickupAddress = normalizeText(adminMeta?.pickup_address);
    if (pickupAddress) {
        const matchedByPickup = STORE_BRANCHES.find((branch) => {
            const branchAddress = getBranchFullAddress(branch).toLowerCase();
            return branchAddress && (
                branchAddress.includes(pickupAddress.toLowerCase()) ||
                pickupAddress.toLowerCase().includes(branchAddress)
            );
        });
        if (matchedByPickup) return matchedByPickup;
    }

    return STORE_BRANCHES.find((branch) => getBranchFullAddress(branch)) || STORE_BRANCHES[0] || null;
}

function buildInvoiceBrandBlock(adminMeta) {
    const branch = resolveInvoiceBranch(adminMeta);
    const branchName = getBranchDisplayName(branch) || "FOODIFI";
    const branchAddress = getBranchFullAddress(branch);
    const branchPhone = normalizeText(branch?.phone);
    const manager = normalizeText(branch?.manager);

    return `
      <div class="invoice-brand-block">
        <h3>${escapeHtml(branchName)}</h3>
        ${branchAddress ? `<p>${escapeHtml(branchAddress)}</p>` : `<p>Chưa cập nhật địa chỉ chi nhánh</p>`}
        ${branchPhone ? `<p>${escapeHtml(branchPhone)}</p>` : ""}
        ${manager ? `<p>Quản lý: ${escapeHtml(manager)}</p>` : ""}
      </div>
    `;
}

function buildInvoicePreview(order) {
    const adminMeta = parseOrderAdminNotePayload(order.note);
    const statusPresentation = getOrderStatusPresentation(order);
    const discountLabel = order.coupon_code ? `Giảm giá (${order.coupon_code})` : "Giảm giá";
    const discountAmount = Number(order.discount_amount || 0);

    return `
      <div class="order-detail-shell">
        <div class="order-detail-summary-grid">
          <article class="order-detail-meta-card">
            <span>Trạng thái đơn</span>
            ${statusPresentation.pill}
            <small>${escapeHtml(statusPresentation.note)}</small>
          </article>
          <article class="order-detail-meta-card">
            <span>Thanh toán</span>
            ${statusPill(order.payment_status, order.payment_status_label)}
            <small>${escapeHtml(order.payment_method_label || order.payment_method || "-")}</small>
          </article>
          <article class="order-detail-meta-card">
            <span>Ngày đặt</span>
            <strong>${formatDateTime(order.created_at)}</strong>
            <small>${order.shipped_at ? `Bắt đầu giao: ${formatDateTime(order.shipped_at)}` : "Chưa giao vận chuyển"}</small>
          </article>
          <article class="order-detail-meta-card">
            <span>Vận đơn Grab</span>
            <strong>${escapeHtml(order.tracking_code || "Chưa tạo")}</strong>
            <small>${escapeHtml(order.tracking_code ? getShippingStatusLabel(order) : "Dùng GrabExpress để test giao hàng.")}</small>
          </article>
        </div>

        ${buildOrderBranchRoutingCard(order, adminMeta)}
        ${buildGrabShipmentSummary(order)}
        ${buildGrabShipmentDetailActions(order)}

        <section class="invoice-preview-sheet" id="invoicePreviewSheet">
          <div class="invoice-preview-top">
            ${buildInvoiceBrandBlock(adminMeta)}
            <div class="invoice-header-block">
              <p><strong>Số:</strong> ${escapeHtml(order.order_code || `#${order.id}`)}</p>
              <p><strong>Ngày:</strong> ${formatDateTime(order.created_at)}</p>
              <p><strong>Hạn thanh toán:</strong> ${escapeHtml(order.payment_method_label || "Khi nhận hàng")}</p>
            </div>
          </div>

          <div class="invoice-customer-section">
            <h4>Khách hàng</h4>
            <div class="invoice-customer-card">
              <strong>${escapeHtml(order.customer_name || "-")}</strong>
              <p>${escapeHtml(order.customer_phone || "-")}</p>
              <p>${escapeHtml(order.shipping_address || "-")}</p>
              <p>${escapeHtml([order.ward, order.district, order.city].filter(Boolean).join(", ") || "Chưa có địa chỉ chi tiết")}</p>
            </div>
          </div>

          ${(adminMeta.seller_name || adminMeta.seller_phone || adminMeta.branch_name || adminMeta.pickup_address) ? `
            <div class="invoice-customer-section">
              <h4>Người bán</h4>
              <div class="invoice-customer-card">
                <strong>${escapeHtml(adminMeta.branch_name || adminMeta.seller_name || "Chưa cập nhật")}</strong>
                ${adminMeta.seller_name && adminMeta.branch_name ? `<p>Người phụ trách: ${escapeHtml(adminMeta.seller_name)}</p>` : ""}
                <p>${escapeHtml(adminMeta.seller_phone || "-")}</p>
                <p>${escapeHtml(adminMeta.pickup_address || "Chưa có địa chỉ lấy hàng")}</p>
              </div>
            </div>
          ` : ""}

          <div class="invoice-items-section">
            <table class="invoice-items-table">
              <thead>
                <tr>
                  <th>Sản phẩm / mô tả</th>
                  <th>Đơn giá</th>
                  <th>Số lượng</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${buildInvoiceItemsRows(order)}
              </tbody>
            </table>
          </div>

          <div class="invoice-footer-section">
            <div class="invoice-note-block">
              <h4>Ghi chú đơn hàng</h4>
              <p>${escapeHtml(adminMeta.note || "Không có ghi chú thêm cho đơn hàng này.")}</p>
            </div>
            <div class="invoice-total-card">
              <div class="invoice-total-row">
                <span>Tạm tính</span>
                <strong>${formatCurrency(order.subtotal)}</strong>
              </div>
              <div class="invoice-total-row">
                <span>Phí vận chuyển</span>
                <strong>${formatCurrency(order.shipping_fee)}</strong>
              </div>
              <div class="invoice-total-row discount">
                <span>${escapeHtml(discountLabel)}</span>
                <strong>${discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)}</strong>
              </div>
              <div class="invoice-total-divider"></div>
              <div class="invoice-total-row grand">
                <span>Tổng cộng</span>
                <strong>${formatCurrency(order.total_amount)}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
}

function buildInvoiceDocument(order) {
    const previewMarkup = buildInvoicePreview(order);
    let markup = previewMarkup;
    if (typeof document !== "undefined") {
        const template = document.createElement("template");
        template.innerHTML = previewMarkup.trim();
        markup = template.content.querySelector("#invoicePreviewSheet")?.outerHTML || previewMarkup;
    }

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Hoa don ${escapeHtml(order.order_code || `#${order.id}`)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; padding: 16px; font-family: Arial, Helvetica, sans-serif; background: #eef7ec; color: #1c281f; }
    .order-detail-summary-grid { display: none; }
    .order-detail-shell { padding: 0; }
    .invoice-preview-sheet { width: 100%; max-width: 1180px; box-sizing: border-box; margin: 0 auto; background: #fff; border-radius: 18px; padding: 18px 24px; box-shadow: none; border: 1px solid #dce8db; }
    .invoice-preview-top { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
    .invoice-brand-block h3 { margin: 0 0 10px; font-size: 1.9rem; color: #0d7f42; }
    .invoice-brand-block p, .invoice-header-block p, .invoice-customer-card p, .invoice-note-block p { margin: 0 0 4px; line-height: 1.4; font-size: 0.95rem; }
    .invoice-header-block { text-align: right; }
    .invoice-customer-section h4, .invoice-note-block h4 { margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.86rem; }
    .invoice-customer-card { width: 100%; max-width: none; padding: 14px 18px; border-radius: 18px; background: #eef7ec; }
    .invoice-customer-card strong { display: block; margin-bottom: 8px; font-size: 1.1rem; }
    .invoice-items-table { width: 100%; margin-top: 10px; table-layout: fixed; border-collapse: collapse; }
    .invoice-items-table th, .invoice-items-table td { padding: 10px 0; border-bottom: 1px solid #dce8db; text-align: left; vertical-align: top; font-size: 0.95rem; }
    .invoice-items-table th { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: #4f6856; }
    .invoice-items-table th:nth-child(1), .invoice-items-table td:nth-child(1) { width: 42%; }
    .invoice-items-table th:nth-child(2), .invoice-items-table td:nth-child(2), .invoice-items-table th:nth-child(4), .invoice-items-table td:nth-child(4) { width: 18%; text-align: right; }
    .invoice-items-table th:nth-child(3), .invoice-items-table td:nth-child(3) { width: 12%; text-align: center; }
    .invoice-item-meta { margin-top: 4px; color: #5f7565; font-size: 0.82rem; }
    .invoice-footer-section { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; }
    .invoice-note-block { flex: 1; }
    .invoice-total-card { width: 340px; margin-left: auto; }
    .invoice-total-row { display: grid; grid-template-columns: minmax(0, 1fr) 140px; align-items: baseline; gap: 16px; padding: 6px 0; font-size: 0.95rem; }
    .invoice-total-row strong { text-align: right; }
    .invoice-total-row.discount strong, .invoice-total-row.discount span { color: #bb6d2e; }
    .invoice-total-divider { height: 1px; background: #dce8db; margin: 6px 0 10px; }
    .invoice-total-row.grand span, .invoice-total-row.grand strong { color: #0d7f42; font-size: 1.3rem; font-weight: 800; }
    @media print { body { padding: 0; background: #fff; } .invoice-preview-sheet { max-width: none; } }
  </style>
</head>
<body>${markup}</body>
</html>`;
}

async function ensureOrderDetail(orderId) {
    if (state.currentOrderDetail && Number(state.currentOrderDetail.id) === Number(orderId)) {
        return state.currentOrderDetail;
    }

    state.currentOrderDetail = await apiFetch(`/api/orders/${orderId}`);
    return state.currentOrderDetail;
}

async function ensureProductsForBranchRouting() {
    if (Array.isArray(state.products) && state.products.length) return;
    try {
        await loadProducts();
    } catch (error) {
        console.warn("Khong the tai san pham de kiem tra ton kho chi nhanh:", error);
    }
}

async function persistOrderBranchSelection(orderId, branchKey, options = {}) {
    const order = options.order || await ensureOrderDetail(orderId);
    const branch = STORE_BRANCHES.find((item) => String(item.key) === String(branchKey));
    if (!branch) throw new Error("Chi nhánh không hợp lệ.");

    const adminMeta = parseOrderAdminNotePayload(order.note);
    const note = buildOrderAdminNotePayload(adminMeta.note, getBranchSellerInfo(branch, adminMeta));

    await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ note })
    });

    state.currentOrderDetail = null;
    return ensureOrderDetail(orderId);
}

async function ensureOrderBranchAssigned(orderId) {
    await ensureProductsForBranchRouting();

    const order = await ensureOrderDetail(orderId);
    const adminMeta = parseOrderAdminNotePayload(order.note);
    if (adminMeta.branch_key && STORE_BRANCHES.some((branch) => String(branch.key) === String(adminMeta.branch_key))) {
        return order;
    }

    const recommended = getRecommendedBranchCandidate(order);
    if (!recommended?.branch?.key) return order;

    return persistOrderBranchSelection(orderId, recommended.branch.key, { order });
}

function renderOrderDetailModal(order) {
    if (!elements.orderDetailContent) return;
    elements.orderDetailTitle.textContent = `Đơn hàng ${order.order_code || `#${order.id}`}`;
    elements.orderDetailContent.innerHTML = buildInvoicePreview(order);
}

function renderComplaintDetailModal(order) {
    if (!elements.complaintDetailContent || !elements.complaintDetailTitle) return;

    const complaintStatus = getComplaintQuickStatus(order);
    const parsedNote = parseOrderAdminNotePayload(order?.note);
    const items = Array.isArray(order?.items) ? order.items : [];

    elements.complaintDetailTitle.textContent = `Khiếu nại ${order.order_code || `#${order.id}`}`;
    elements.complaintDetailContent.innerHTML = `
      <section class="complaint-detail-shell">
        <div class="order-detail-summary-grid complaint-detail-grid">
          <article class="order-detail-meta-card complaint-detail-card">
            <span>Thông tin khiếu nại</span>
            ${statusPill(complaintStatus.pillKey, complaintStatus.label)}
            <strong>${escapeHtml(buildComplaintTitle(order))}</strong>
            <small>${escapeHtml(buildComplaintExcerpt(order))}</small>
          </article>
          <article class="order-detail-meta-card complaint-detail-card">
            <span>Khách hàng</span>
            <strong>${escapeHtml(order.customer_name || "-")}</strong>
            <small>${escapeHtml(order.customer_phone || "-")}</small>
            <small>${escapeHtml([order.shipping_address, order.ward, order.district, order.city].filter(Boolean).join(", ") || "Chưa có địa chỉ chi tiết")}</small>
          </article>
        </div>

        <article class="surface complaint-detail-section">
          <div class="section-head">
            <h3>Nội dung khách gửi</h3>
          </div>
          <div class="complaint-message-box">
            <p>${escapeHtml(parsedNote.note || "Khách hàng chưa để lại mô tả chi tiết. Admin đang xử lý theo luồng hoàn/đổi của đơn hàng.")}</p>
          </div>
        </article>

        <article class="surface complaint-detail-section">
          <div class="section-head">
            <h3>Tiến độ xử lý</h3>
          </div>
          ${buildComplaintTimeline(order)}
        </article>

        <article class="surface complaint-detail-section">
          <div class="section-head">
            <h3>Sản phẩm liên quan</h3>
          </div>
          <div class="orders-table-scroll">
            <table class="list-table complaint-items-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Số lượng</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.product_name || "-")}</td>
                    <td>${formatNumber(item.quantity || 0)}</td>
                    <td>${formatCurrency(item.line_total || 0)}</td>
                  </tr>
                `).join("") || `<tr><td colspan="3">Không có sản phẩm trong đơn.</td></tr>`}
              </tbody>
            </table>
          </div>
        </article>

        <div class="complaint-detail-actions">
          ${buildOrderActionButton({
              action: "complaint-reship",
              id: order.id,
                              label: "Giao lại"
          })}
          ${order.return_status === "shipping_back" ? buildOrderActionButton({
              action: "order-special-action",
              id: order.id,
              special: "mark_returned",
              label: getReturnState(order).isAvailable ? "Xác nhận xử lý xong" : `Chờ ${formatCountdown(getReturnState(order).remainingMs)}`,
              disabled: !getReturnState(order).isAvailable,
              tone: "accent"
          }) : ""}
        </div>
      </section>
    `;
}

export function closeOrderDetail() {
    state.currentOrderDetail = null;
    elements.orderDetailModal?.classList.add("hidden");
    if (elements.orderDetailContent) {
        elements.orderDetailContent.innerHTML = "";
    }
}

export function closeComplaintDetail() {
    state.currentComplaintDetail = null;
    elements.complaintDetailModal?.classList.add("hidden");
    if (elements.complaintDetailContent) {
        elements.complaintDetailContent.innerHTML = "";
    }
}

export async function openOrderDetail(orderId) {
    await ensureProductsForBranchRouting();
    const order = await ensureOrderDetail(orderId);
    renderOrderDetailModal(order);
    elements.orderDetailModal?.classList.remove("hidden");
}

export async function openComplaintDetail(orderId) {
    const order = await ensureOrderDetail(orderId);
    state.currentComplaintDetail = order;
    renderComplaintDetailView(order);
    elements.complaintDetailModal?.classList.remove("hidden");
}

export function exportCurrentOrderInvoice() {
    const order = state.currentOrderDetail;
    if (!order) return;

    const documentHtml = buildInvoiceDocument(order);
    const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${order.order_code || `don-hang-${order.id}`}-hoa-don.html`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    showToast("Đã xuất hóa đơn.");
}

export function printCurrentOrderInvoice() {
    const order = state.currentOrderDetail;
    if (!order) return;

    const invoiceWindow = window.open("", "_blank", "width=1024,height=900");
    if (!invoiceWindow) {
        showToast("Trình duyệt đang chặn cửa sổ in hóa đơn.", true);
        return;
    }

    invoiceWindow.document.open();
    invoiceWindow.document.write(buildInvoiceDocument(order));
    invoiceWindow.document.close();
    invoiceWindow.focus();
    window.setTimeout(() => invoiceWindow.print(), 300);
}

function renderOrderTable(orders) {
    return `
      <article class="surface orders-table-card">
        <div class="orders-table-scroll">
          <table class="list-table orders-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Địa chỉ</th>
                <th>Ngày đặt</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Vận đơn</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((order) => {
                  const statusPresentation = getOrderStatusPresentation(order);
                  return `
                    <tr>
                      <td>
                        <div class="orders-code-cell">
                          <strong>${escapeHtml(order.order_code || `#${order.id}`)}</strong>
                          <span class="section-copy">SP: ${formatNumber(order.item_count || 0)}</span>
                        </div>
                      </td>
                      <td>
                        <div class="orders-customer-cell">
                          <strong>${escapeHtml(order.customer_name || "-")}</strong>
                          <span class="section-copy">${escapeHtml(order.customer_phone || "-")}</span>
                        </div>
                      </td>
                      <td>
                        <div class="orders-address-cell">
                          <strong>${escapeHtml(order.shipping_address || "-")}</strong>
                          <span class="section-copy">${escapeHtml([order.ward, order.district, order.city].filter(Boolean).join(", ") || "Chưa có địa chỉ chi tiết")}</span>
                        </div>
                      </td>
                      <td>
                        <div class="orders-date-cell">
                          <strong>${formatDateTime(order.created_at)}</strong>
                          <span class="section-copy">${order.shipped_at ? `Bắt đầu giao: ${formatDateTime(order.shipped_at)}` : "Chưa bàn giao vận chuyển"}</span>
                        </div>
                      </td>
                      <td><strong>${formatCurrency(order.total_amount)}</strong></td>
                      <td>
                        <div class="orders-payment-cell">
                          ${statusPill(order.payment_status, order.payment_status_label)}
                          <span class="section-copy">${escapeHtml(order.payment_method_label || order.payment_method || "-")}</span>
                        </div>
                      </td>
                      <td>
                        ${buildGrabShipmentSummary(order, { compact: true }) || '<span class="section-copy">Chưa tạo vận đơn</span>'}
                      </td>
                      <td>
                        <div class="orders-status-cell">
                          ${statusPresentation.pill}
                          <span class="section-copy">${escapeHtml(statusPresentation.note)}</span>
                          ${order.return_status ? `<span class="section-copy">Hoàn hàng: ${escapeHtml(order.return_status_label || order.return_status)}</span>` : ""}
                        </div>
                      </td>
                      <td>
                        <div class="orders-action-stack">
                          ${buildOrderActionButtons(order)}
                        </div>
                      </td>
                    </tr>
                  `;
              }).join("") || `<tr><td colspan="9">Không có đơn hàng phù hợp.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
}

function scheduleOrderRefresh(orders) {
    window.clearTimeout(orderRefreshTimerId);

    const shouldRefresh = orders.some((order) => {
        if (order.status === "shipping" && !order.delivered_at && !order.return_status) {
            return !getDeliveryState(order).isAvailable;
        }
        if (order.return_status === "shipping_back") {
            return !getReturnState(order).isAvailable;
        }
        return false;
    });

    if (shouldRefresh && !elements.panels.orders?.classList.contains("hidden")) {
        orderRefreshTimerId = window.setTimeout(() => renderOrders(), 1000);
    }
}

export function setOrderQuickFilter(filter) {
    state.orderQuickFilter = filter || "all";
    renderOrders();
}

export function resetCreateOrderDraft() {
    createOrderDraft = getDefaultCreateOrderDraft();
    closeOrderProductPicker();
    if (state.orderWorkspace === "create") {
        renderOrders();
    }
}

export function handleCreateOrderBuilderAction(button) {
    syncCreateOrderDraftFromForm();
    const action = button.dataset.createOrderAction;
    const targetKey = button.dataset.key;
    const productId = button.dataset.productId;
    const categoryId = button.dataset.categoryId;

    if (action === "open-product-picker" || action === "add-item") {
        openOrderProductPicker();
        renderOrders();
        return;
    }

    if (action === "close-product-picker") {
        closeOrderProductPicker();
        renderOrders();
        return;
    }

    if (action === "apply-product-picker") {
        applyOrderProductPicker();
        renderOrders();
        return;
    }

    if (action === "picker-add-product") {
        setOrderProductPickerQuantity(productId, 1);
        renderOrders();
        return;
    }

    if (action === "picker-set-category") {
        setOrderProductPickerCategory(categoryId);
        renderOrders();
        return;
    }

    if (action === "picker-increase-quantity" || action === "picker-decrease-quantity") {
        const currentQuantity = getOrderProductPickerQuantity(productId);
        const nextQuantity = action === "picker-increase-quantity" ? currentQuantity + 1 : currentQuantity - 1;
        setOrderProductPickerQuantity(productId, nextQuantity);
        renderOrders();
        return;
    }

    if (action === "remove-item") {
        ensureCreateOrderDraft().items = ensureCreateOrderDraft().items.filter((item) => item.key !== targetKey);
    }

    if (action === "increase-quantity" || action === "decrease-quantity") {
        ensureCreateOrderDraft().items = ensureCreateOrderDraft().items.map((item) => {
            if (item.key !== targetKey) return item;
            const currentQuantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
            const nextQuantity = action === "increase-quantity" ? currentQuantity + 1 : Math.max(1, currentQuantity - 1);
            return { ...item, quantity: nextQuantity };
        });
    }

    if (action === "reset-draft") {
        createOrderDraft = getDefaultCreateOrderDraft();
        closeOrderProductPicker();
    }

    renderOrders();
}

export function handleOrderProductPickerInput(target) {
    if (target.dataset.orderPickerInput !== "keyword") return;
    setOrderProductPickerKeyword(target.value);
    renderOrders();
}

export function handleCreateOrderBuilderInput(target) {
    syncCreateOrderDraftFromForm();

    if (["product_id", "quantity", "shipping_fee", "coupon_code"].includes(target.name)) {
        renderOrders();
    }
}

export async function submitCreateOrder() {
    const draft = syncCreateOrderDraftFromForm();
    const summary = getDraftSummary();

    if (!draft.customer_name || !draft.customer_phone || !draft.shipping_address || !draft.city) {
        throw new Error("Vui lòng nhập đầy đủ thông tin người nhận và địa chỉ giao hàng.");
    }

    if (!summary.validItems.length) {
        throw new Error("Vui lòng chọn ít nhất một sản phẩm hợp lệ để tạo đơn.");
    }

    const invalidStockItem = summary.validItems.find((item) => item.quantity > item.availableQuantity);
    if (invalidStockItem) {
        throw new Error(`Sản phẩm ${invalidStockItem.product?.name || ""} không đủ tồn kho để tạo đơn.`);
    }

    const payload = {
        customer_name: draft.customer_name,
        customer_phone: draft.customer_phone,
        shipping_address: draft.shipping_address,
        ward: draft.ward || null,
        district: draft.district || null,
        city: draft.city,
        note: buildOrderAdminNotePayload(draft.note, {
            seller_name: draft.seller_name,
            seller_phone: draft.seller_phone,
            pickup_address: draft.pickup_address
        }),
        payment_method: draft.payment_method,
        payment_status: draft.payment_status,
        shipping_fee: Number(draft.shipping_fee || 0),
        coupon_code: draft.coupon_code || null,
        items: summary.validItems.map((item) => ({
            product_id: Number(item.product.id),
            quantity: Number(item.quantity)
        }))
    };

    const createdOrder = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    if (draft.reship_source_order_id) {
        const sourceOrder = state.currentComplaintDetail?.id && Number(state.currentComplaintDetail.id) === Number(draft.reship_source_order_id)
            ? state.currentComplaintDetail
            : await ensureOrderDetail(draft.reship_source_order_id);
        const nextComplaintNote = buildComplaintNoteWithMeta(sourceOrder.note, {
            response: `Đã tạo đơn giao lại ${createdOrder.order_code || `#${createdOrder.id}`}.`,
            resolution: "reshipped",
            reship_order_id: createdOrder.id,
            reship_order_code: createdOrder.order_code || `#${createdOrder.id}`,
            resolved_at: new Date().toISOString()
        });

        await apiFetch(`/api/orders/${draft.reship_source_order_id}/status`, {
            method: "PUT",
            body: JSON.stringify({ note: nextComplaintNote })
        });
        state.currentComplaintDetail = null;
        state.currentOrderDetail = null;
    }

    createOrderDraft = getDefaultCreateOrderDraft();
    await Promise.all([loadOrders(), loadOverview(), loadProducts()]);
    renderOrders();
    showToast(draft.reship_source_order_id
        ? `Đã tạo đơn giao lại ${createdOrder.order_code || `#${createdOrder.id}`} và chuyển khiếu nại sang xử lý xong.`
        : `Đã tạo đơn hàng ${createdOrder.order_code || `#${createdOrder.id}`}.`);
}

export function renderOrders() {
    const scrollState = captureOrderScrollState();
    const isCreateWorkspace = state.orderWorkspace === "create";
    const isComplaintWorkspace = state.orderWorkspace === "complaints";
    const allOrders = Array.isArray(state.orders) ? state.orders : [];
    const visibleOrders = getVisibleOrders();

    elements.orderFilterCard?.classList.toggle("hidden", isCreateWorkspace || isComplaintWorkspace);
    elements.orderListCard?.classList.toggle("hidden", isCreateWorkspace || isComplaintWorkspace);
    elements.orderCreateCard?.classList.toggle("hidden", !isCreateWorkspace);
    elements.orderComplaintsCard?.classList.toggle("hidden", !isComplaintWorkspace);

    if (isCreateWorkspace) {
        window.clearTimeout(orderRefreshTimerId);
        renderCreateOrderWorkspace();
        restoreOrderScrollState(scrollState);
        return;
    }

    if (isComplaintWorkspace) {
        renderComplaintsWorkspace();
        restoreOrderScrollState(scrollState);
        return;
    }

    elements.ordersMeta.textContent = state.orderQuickFilter === "all"
        ? `${formatNumber(visibleOrders.length)} đơn hàng`
        : `${formatNumber(visibleOrders.length)} / ${formatNumber(allOrders.length)} đơn hàng`;

    elements.ordersContent.innerHTML = `
      <section class="orders-dashboard">
        ${renderOrderTable(visibleOrders)}
      </section>
    `;

    restoreOrderScrollState(scrollState);
    scheduleOrderRefresh(allOrders);
}

export async function handleOrderBranchSelection(select) {
    const orderId = select?.dataset?.id;
    const branchKey = select?.value;
    if (!orderId || !branchKey) return;

    await ensureProductsForBranchRouting();
    const refreshedOrder = await persistOrderBranchSelection(orderId, branchKey);
    showToast("Đã cập nhật chi nhánh lấy hàng cho đơn.");
    await loadOrders();
    renderOrderDetailModal(refreshedOrder);
}

export async function handleOrderAction(button) {
    const action = button.dataset.action;
    const orderId = button.dataset.id;

    if (action === "view-order") {
        await openOrderDetail(orderId);
        return;
    }

    if (action === "view-complaint") {
        await openComplaintDetail(orderId);
        return;
    }

    if (action === "export-complaints") {
        exportComplaintsReport(getVisibleComplaints());
        showToast("Đã xuất báo cáo khiếu nại.");
        return;
    }

    if (action === "open-complaint-image") {
        const imageUrl = button.dataset.imageUrl;
        if (imageUrl) {
            window.open(imageUrl, "_blank", "noopener,noreferrer");
        }
        return;
    }

    if (!orderId) return;

    if (action === "complaint-reship") {
        const order = state.currentComplaintDetail?.id && String(state.currentComplaintDetail.id) === String(orderId)
            ? state.currentComplaintDetail
            : await ensureOrderDetail(orderId);
        openReshipCreateOrder(order);
        return;
    }

    if (action === "complaint-refund") {
        const order = state.currentComplaintDetail?.id && String(state.currentComplaintDetail.id) === String(orderId)
            ? state.currentComplaintDetail
            : await ensureOrderDetail(orderId);
        if (order.refund_status === "refunded" || order.payment_status === "refunded") {
            showToast("Đơn này đã hoàn tiền.");
            return;
        }
        const defaultAmount = Number(order.refund_amount || order.total_amount || 0);
        const responseValue = String(document.querySelector("#complaintAdminResponse")?.value || "").trim();
        const refundFormValue = await openRefundAmountModal({
            order,
            defaultAmount,
            defaultReason: responseValue || "Admin duyệt hoàn tiền theo khiếu nại."
        });
        if (!refundFormValue) return;

        const refundReason = refundFormValue.reason;
        if (refundFormValue.action === "reject") {
            const nextNote = buildComplaintNoteWithMeta(order.note, {
                response: responseValue || refundReason,
                resolution: "refund_rejected",
                refund_reason: refundReason,
                rejected_at: new Date().toISOString()
            });

            await apiFetch(`/api/orders/${orderId}/status`, {
                method: "PUT",
                body: JSON.stringify({
                    action: "reject_refund",
                    refund_reason: refundReason,
                    note: nextNote
                })
            });
            showToast("Đã từ chối yêu cầu hoàn tiền.");
            await Promise.all([loadOrders(), loadOverview()]);

            const refreshedOrder = await ensureOrderDetail(orderId);
            state.currentComplaintDetail = refreshedOrder;
            renderComplaintDetailView(refreshedOrder);
            return;
        }

        const refundAmount = refundFormValue.amount;
        const nextNote = buildComplaintNoteWithMeta(order.note, {
            response: responseValue || refundReason,
            resolution: "refunded",
            refund_amount: refundAmount,
            refund_reason: refundReason,
            resolved_at: new Date().toISOString()
        });

        await apiFetch(`/api/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({
                action: "approve_refund",
                refund_amount: refundAmount,
                refund_reason: refundReason,
                note: nextNote
            })
        });
        showToast("Đã hoàn tiền vào ví người dùng.");
        await Promise.all([loadOrders(), loadOverview()]);

        const refreshedOrder = await ensureOrderDetail(orderId);
        state.currentComplaintDetail = refreshedOrder;
        renderComplaintDetailView(refreshedOrder);
        return;
    }

    if (action === "create-grab-shipment") {
        const shipmentOrder = await ensureOrderBranchAssigned(orderId);
        const shipmentMeta = parseOrderAdminNotePayload(shipmentOrder.note);
        const pickupLabel = [shipmentMeta.branch_name, shipmentMeta.pickup_address].filter(Boolean).join(" - ");
        await apiFetch(`/api/orders/${orderId}/shipping/grab-dev`, {
            method: "POST",
            body: JSON.stringify({
                estimated_minutes: 45,
                note: pickupLabel
                    ? `GrabExpress lấy hàng tại ${pickupLabel}.`
                    : "Tạo vận đơn GrabExpress từ web admin."
            })
        });
        showToast("Đã tạo vận đơn GrabExpress.");
    } else if (action === "advance-grab-shipment") {
        await apiFetch(`/api/orders/${orderId}/shipping/grab-dev`, {
            method: "PUT",
            body: JSON.stringify({ action: "next" })
        });
        showToast("Đã cập nhật trạng thái Grab.");
    } else if (action === "cancel-grab-shipment") {
        if (!window.confirm("Bạn chắc chắn muốn hủy vận đơn Grab của đơn này?")) {
            return;
        }
        await apiFetch(`/api/orders/${orderId}/shipping/grab-dev`, {
            method: "PUT",
            body: JSON.stringify({ action: "cancel" })
        });
        showToast("Đã hủy vận đơn Grab.");
    } else if (button.dataset.special) {
        await apiFetch(`/api/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ action: button.dataset.special })
        });
        showToast("Đã cập nhật thao tác đơn hàng.");
    } else if (button.dataset.status) {
        if (["confirmed", "shipping"].includes(button.dataset.status)) {
            await ensureOrderBranchAssigned(orderId);
        }
        await apiFetch(`/api/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: button.dataset.status })
        });
        showToast("Đã cập nhật trạng thái đơn hàng.");
    }

    await Promise.all([loadOrders(), loadOverview()]);

    if (state.currentComplaintDetail?.id && String(state.currentComplaintDetail.id) === String(orderId)) {
        const refreshedOrder = await ensureOrderDetail(orderId);
        state.currentComplaintDetail = refreshedOrder;
        renderComplaintDetailView(refreshedOrder);
    }

    if (state.currentOrderDetail?.id && String(state.currentOrderDetail.id) === String(orderId)) {
        state.currentOrderDetail = null;
        const refreshedOrder = await ensureOrderDetail(orderId);
        renderOrderDetailModal(refreshedOrder);
    }
}




