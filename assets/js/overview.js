import {
    addDays,
    buildRevenueSeries,
    countCustomersBetween,
    countOrdersBetween,
    elements,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatNumber,
    getGrowthMeta,
    resolveMediaUrl,
    startOfDay,
    state,
    statusPill,
    sumRevenueBetween
} from "./core.js";
import { renderAppIcon } from "./icons.js";

export function renderOverview() {
    if (!state.dashboard) {
        elements.overviewContent.innerHTML = `<div class="surface"><p>Chưa có dữ liệu dashboard.</p></div>`;
        return;
    }

    const summary = state.dashboard.summary || {};
    const recentDashboardOrders = state.dashboard.recent_orders || [];
    const statuses = state.dashboard.orders_by_status || [];
    const orders = (state.orders || []).length ? state.orders : recentDashboardOrders;
    const products = state.products || [];
    const topProducts = state.dashboard.top_products || [];
    const maxTotal = Math.max(1, ...statuses.map((item) => Number(item.total || 0)));
    const rangeDays = Number(state.overviewRangeDays || 30);
    const today = startOfDay(new Date());
    const currentRangeStart = addDays(today, -(rangeDays - 1));
    const previousRangeStart = addDays(currentRangeStart, -rangeDays);
    const currentRangeEnd = addDays(today, 1);
    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const revenueSource = paidOrders.length ? paidOrders : orders;
    const currentRevenue = sumRevenueBetween(revenueSource, currentRangeStart, currentRangeEnd);
    const previousRevenue = sumRevenueBetween(revenueSource, previousRangeStart, currentRangeStart);
    const currentOrders = countOrdersBetween(orders, currentRangeStart, currentRangeEnd);
    const previousOrders = countOrdersBetween(orders, previousRangeStart, currentRangeStart);
    const currentCustomers = countCustomersBetween(orders, currentRangeStart, currentRangeEnd);
    const previousCustomers = countCustomersBetween(orders, previousRangeStart, currentRangeStart);
    const activeCoupons = (state.coupons || []).filter((coupon) => {
        const isActive = Boolean(coupon.is_active);
        const now = new Date();
        const startDate = coupon.start_date ? new Date(coupon.start_date) : null;
        const endDate = coupon.end_date ? new Date(coupon.end_date) : null;
        const notStarted = startDate && startDate > now;
        const expired = endDate && endDate < now;
        return isActive && !notStarted && !expired;
    });
    const revenueGrowth = getGrowthMeta(currentRevenue, previousRevenue);
    const orderGrowth = getGrowthMeta(currentOrders, previousOrders);
    const couponGrowth = getGrowthMeta(activeCoupons.length, Math.max(activeCoupons.length - 1, 0));
    const customerGrowth = getGrowthMeta(currentCustomers, previousCustomers);
    const trendSeries = buildRevenueSeries(revenueSource, 7);
    const trendMax = Math.max(1, ...trendSeries.values);
    const lowStockProducts = [...products]
        .filter((product) => ["active", "out_of_stock", "draft"].includes(product.status))
        .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0))
        .slice(0, 3);
    const filteredRecentOrders = [...orders]
        .filter((order) => {
            const keyword = state.overviewSearch.trim().toLowerCase();
            if (!keyword) return true;

            return [order.order_code, order.customer_name, order.customer_phone]
                .some((value) => String(value || "").toLowerCase().includes(keyword));
        })
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
        .slice(0, 6);
    const rangeLabel = rangeDays === 7 ? "7 ngày qua" : "30 ngày qua";

    elements.overviewContent.innerHTML = `
      <section class="overview-hero">
        <div>
          <h1 class="overview-title">Tổng quan</h1>
        </div>
        <div class="overview-actions">
          <div class="range-switcher">
            <button class="range-chip ${rangeDays === 30 ? "active" : ""}" type="button" data-overview-range="30">30 ngày qua</button>
            <button class="range-chip ${rangeDays === 7 ? "active" : ""}" type="button" data-overview-range="7">7 ngày qua</button>
          </div>
        </div>
      </section>

      <div class="overview-metric-grid">
        ${[
            {
                icon: "chart",
                title: "Tổng doanh thu",
                value: formatCurrency(summary.total_revenue || currentRevenue),
                note: `${rangeLabel} ghi nhận ${formatCurrency(currentRevenue)}`,
                growth: revenueGrowth
            },
            {
                icon: "cart",
                title: "Tổng đơn hàng",
                value: formatNumber(summary.total_orders),
                note: `${formatNumber(summary.pending_orders)} đơn cần xử lý`,
                growth: orderGrowth
            },
            {
                icon: "ticket",
                title: "Voucher đang hoạt động",
                value: formatNumber(activeCoupons.length),
                note: `${formatNumber(summary.active_products)} sản phẩm đang bán`,
                growth: couponGrowth
            },
            {
                icon: "user",
                title: "Khách hàng mới",
                value: formatNumber(currentCustomers),
                note: `${formatNumber(summary.total_customers)} khách trong hệ thống`,
                growth: customerGrowth
            }
        ].map((card) => `
          <article class="overview-metric-card">
            <div class="overview-metric-head">
              <span class="overview-icon">${renderAppIcon(card.icon)}</span>
              <span class="overview-badge ${card.growth.tone}">${card.growth.value}</span>
            </div>
            <p class="overview-card-title">${card.title}</p>
            <strong class="overview-card-value">${card.value}</strong>
            <span class="section-copy">${card.note}</span>
          </article>
        `).join("")}
      </div>

      <div class="overview-main-grid">
        <article class="overview-chart-card">
          <div class="section-head">
            <div>
              <h3>Xu hướng doanh thu</h3>
              <p class="section-copy">Doanh thu 7 ngày gần nhất từ các đơn ${paidOrders.length ? "đã thanh toán" : "gần đây"}.</p>
            </div>
            <span class="overview-dot-menu">⋮</span>
          </div>
          <div class="overview-chart">
            ${trendSeries.values.map((value, index) => `
              <div class="overview-bar-col ${value === trendMax ? "active" : ""}">
                <span class="overview-bar-value">${formatNumber(Math.round(value))}</span>
                <div class="overview-bar-track">
                  <i class="overview-bar-fill" style="height:${Math.max(8, Math.round((value / trendMax) * 100))}%"></i>
                </div>
                <strong>${escapeHtml(trendSeries.labels[index])}</strong>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="overview-alert-card">
          <div class="section-head">
            <h3>Sắp hết hàng</h3>
            <button class="overview-link-button" type="button" data-view-jump="products">Xem tất cả</button>
          </div>
          <div class="overview-alert-list">
            ${lowStockProducts.map((product) => `
              <article class="overview-stock-item">
                <img class="overview-stock-thumb" src="${escapeHtml(resolveMediaUrl(product.thumbnail_url, "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='100%25' height='100%25' rx='18' fill='%23eef4ea'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%231a6b3d' font-family='Arial' font-size='14'%3ESP%3C/text%3E%3C/svg%3E"))}" alt="">
                <div class="overview-stock-copy">
                  <strong>${escapeHtml(product.name)}</strong>
                  <span>${escapeHtml(product.category_name || "-")}</span>
                </div>
                <div class="overview-stock-qty">
                  <strong>${formatNumber(product.stock_quantity)}</strong>
                  <span>${escapeHtml(product.stock_unit || product.unit || "đv")} còn lại</span>
                </div>
              </article>
            `).join("") || `<p class="section-copy">Chưa có sản phẩm sắp hết hàng.</p>`}
          </div>
          <div class="overview-status-summary">
            <h4>Trạng thái đơn hàng</h4>
            <div class="status-bars">
              ${statuses.map((item) => `
                <div class="status-bar">
                  <span>
                    <strong>${escapeHtml(item.status_label || item.status)}</strong>
                    <em>${formatNumber(item.total)}</em>
                  </span>
                  <div class="status-bar-track">
                    <i style="width:${Math.max(10, Math.round((Number(item.total || 0) / maxTotal) * 100))}%"></i>
                  </div>
                </div>
              `).join("") || "<p>Chưa có dữ liệu trạng thái.</p>"}
            </div>
          </div>
        </article>
      </div>

      <article class="overview-table-card">
        <div class="section-head">
          <div>
            <h3>Đơn hàng gần đây</h3>
            <p class="section-copy">Danh sách đơn hàng mới nhất theo từ khóa tìm kiếm.</p>
          </div>
          <input id="overviewOrderSearch" class="overview-search" type="search" placeholder="Tìm kiếm đơn hàng..." value="${escapeHtml(state.overviewSearch)}">
        </div>
        <div class="table-wrap">
          <table class="list-table overview-table">
            <thead>
              <tr>
                <th>Mã đơn hàng</th>
                <th>Khách hàng</th>
                <th>Ngày</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecentOrders.map((order) => `
                <tr>
                  <td><strong>${escapeHtml(order.order_code)}</strong></td>
                  <td>${escapeHtml(order.customer_name || "-")}</td>
                  <td>${formatDate(order.created_at)}</td>
                  <td>${formatCurrency(order.total_amount)}</td>
                  <td>${statusPill(order.status, order.status_label)}</td>
                </tr>
              `).join("") || `<tr><td colspan="5">Không có đơn hàng phù hợp.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="overview-footer-list">
          <div>
            <h4>Top sản phẩm</h4>
            <ul class="metric-list">
              ${topProducts.map((product) => `
                <li><strong>${escapeHtml(product.name)}</strong> • đã bán ${formatNumber(product.sold_quantity)} • đánh giá ${Number(product.average_rating || 0).toFixed(1)}</li>
              `).join("") || "<li>Chưa có dữ liệu sản phẩm nổi bật.</li>"}
            </ul>
          </div>
        </div>
      </article>
    `;
}

export function exportOverviewReport() {
    const rows = (state.orders || [])
        .slice()
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
        .map((order) => [
            order.order_code,
            order.customer_name || "",
            order.customer_phone || "",
            order.status_label || order.status || "",
            order.payment_status_label || order.payment_status || "",
            Number(order.total_amount || 0),
            order.created_at || ""
        ]);

    const csvLines = [
        ["Mã đơn", "Khách hàng", "Số điện thoại", "Trạng thái", "Thanh toán", "Tổng tiền", "Ngày tạo"].join(","),
        ...rows.map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    ];

    const blob = new Blob([`\uFEFF${csvLines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shopfood-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
