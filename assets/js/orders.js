import {
    apiFetch,
    elements,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatNumber,
    showToast,
    state,
    statusPill
} from "./core.js";
import { loadOrders, loadOverview } from "./data.js";

function buildOrderActionButtons(order) {
    const buttons = [];

    if (["pending", "confirmed", "preparing"].includes(order.status)) {
        const nextStatus = order.status === "pending" ? "confirmed" : order.status === "confirmed" ? "preparing" : "shipping";
        const nextLabel = order.status === "pending" ? "Xác nhận đơn" : order.status === "confirmed" ? "Bắt đầu chuẩn bị" : "Bàn giao vận chuyển";
        buttons.push(`<button class="chip-button" type="button" data-action="set-order-status" data-id="${order.id}" data-status="${nextStatus}">${nextLabel}</button>`);
    }

    if (order.status === "shipping" && !order.delivered_at && !order.return_status) {
        buttons.push(`<button class="chip-button" type="button" data-action="order-special-action" data-id="${order.id}" data-special="mark_delivered">Đánh dấu đã giao</button>`);
    }

    if (order.status === "shipping" && order.delivered_at && !order.customer_received_at && !order.return_status) {
        buttons.push(`<button class="chip-button" type="button" data-action="order-special-action" data-id="${order.id}" data-special="confirm_received">Khách đã nhận</button>`);
        buttons.push(`<button class="chip-button" type="button" data-action="order-special-action" data-id="${order.id}" data-special="request_return">Yêu cầu hoàn</button>`);
    }

    if (order.return_status === "shipping_back") {
        buttons.push(`<button class="chip-button" type="button" data-action="order-special-action" data-id="${order.id}" data-special="mark_returned">Đã hoàn về kho</button>`);
    }

    if (state.user?.role === "admin" && !["completed", "cancelled"].includes(order.status)) {
        buttons.push(`<button class="chip-button" type="button" data-action="set-order-status" data-id="${order.id}" data-status="cancelled" data-tone="danger">Hủy đơn</button>`);
    }

    return buttons.join("");
}

export function renderOrders() {
    elements.ordersMeta.textContent = `${formatNumber(state.orders.length)} đơn hàng`;
    elements.ordersContent.innerHTML = state.orders.map((order) => `
      <article class="stack-card">
        <div class="order-card-top">
          <div>
            <h3>${escapeHtml(order.order_code)}</h3>
            <p class="section-copy">${escapeHtml(order.customer_name || "-")} • ${escapeHtml(order.customer_phone || "-")} • ${formatDate(order.created_at)}</p>
          </div>
          <div class="action-row">${buildOrderActionButtons(order)}</div>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><strong>Trạng thái</strong><br>${statusPill(order.status, order.status_label)}</div>
          <div class="meta-item"><strong>Thanh toán</strong><br>${statusPill(order.payment_status, order.payment_status_label)}</div>
          <div class="meta-item"><strong>Tổng tiền</strong><br>${formatCurrency(order.total_amount)}</div>
          <div class="meta-item"><strong>Địa chỉ</strong><br>${escapeHtml(order.shipping_address || "-")}</div>
          <div class="meta-item"><strong>Số lượng SP</strong><br>${formatNumber(order.item_count)}</div>
          <div class="meta-item"><strong>Hoàn hàng</strong><br>${escapeHtml(order.return_status_label || "Không có")}</div>
        </div>
      </article>
    `).join("") || "<p>Không có đơn hàng phù hợp.</p>";
}

export async function handleOrderAction(button) {
    const orderId = button.dataset.id;

    if (button.dataset.special) {
        await apiFetch(`/api/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ action: button.dataset.special })
        });
        showToast("Đã cập nhật thao tác đơn hàng.");
    } else if (button.dataset.status) {
        await apiFetch(`/api/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: button.dataset.status })
        });
        showToast("Đã cập nhật trạng thái đơn hàng.");
    }

    await Promise.all([loadOrders(), loadOverview()]);
}
