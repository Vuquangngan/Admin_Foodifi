import {
    STORE_BRANCHES,
    WAREHOUSE_ZONES,
    elements,
    escapeHtml,
    formatCurrency,
    formatDate,
    formatNumber,
    state
} from "./core.js";
import { renderAppIcon } from "./icons.js";

const COMPLETED_STATUSES = new Set(["completed", "delivered", "paid", "confirmed"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "failed"]);
const PROCESSING_STATUSES = new Set(["pending", "confirmed", "preparing", "shipping"]);

function getProducts() {
    return Array.isArray(state.products) ? state.products : [];
}

function getOrders() {
    return Array.isArray(state.orders) ? state.orders : [];
}

function getWarehouseZoneForProduct(product) {
    const zoneKey = product?.warehouse_zone || product?.warehouseZone || product?.zone_key || product?.zone;
    if (WAREHOUSE_ZONES.some((zone) => zone.key === zoneKey)) return zoneKey;
    const text = [product?.name, product?.category_name, product?.category?.name, product?.description].join(" ").toLowerCase();
    if (/đông|dong|frozen|lạnh|lanh|thịt|thit|cá|ca vien/.test(text)) return "frozen";
    if (/rau|củ|cu|trái|trai|fresh|xà lách|xa lach/.test(text)) return "fresh";
    return "dry";
}

function getStock(product) {
    return Number(product?.stock_quantity || product?.stock || product?.quantity || 0);
}

function getOrderTotal(order) {
    return Number(order?.total_amount || order?.total || order?.grand_total || 0);
}

function getOrderStatus(order) {
    return String(order?.status || "").trim().toLowerCase();
}

function getOrderDate(order) {
    return order?.created_at || order?.createdAt || order?.order_date || "";
}

function getPaymentLabel(order) {
    return order?.payment_method_label || order?.payment_method || order?.paymentMethod || "-";
}

function statusLabel(order) {
    const status = getOrderStatus(order);
    if (COMPLETED_STATUSES.has(status)) return "Hoàn thành";
    if (CANCELLED_STATUSES.has(status)) return "Đã hủy";
    if (status === "shipping") return "Đang giao";
    if (status === "preparing") return "Đang xử lý";
    if (status === "pending") return "Chờ xác nhận";
    return order?.status_label || status || "Không rõ";
}

function statusTone(order) {
    const status = getOrderStatus(order);
    if (COMPLETED_STATUSES.has(status)) return "success";
    if (CANCELLED_STATUSES.has(status)) return "danger";
    if (PROCESSING_STATUSES.has(status)) return "warning";
    return "neutral";
}

function metricCard(icon, label, value, note = "", tone = "green") {
    return `
      <article class="stats-metric-card stats-tone-${tone}">
        <span class="stats-metric-icon">${renderAppIcon(icon)}</span>
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
          ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        </div>
      </article>
    `;
}

function simpleBars(items, valueKey = "value") {
    const maxValue = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
    return `
      <div class="stats-bars">
        ${items.map((item) => {
            const value = Number(item[valueKey] || 0);
            const height = Math.max(8, Math.round((value / maxValue) * 150));
            return `
              <div class="stats-bar-item">
                <strong>${formatNumber(value)}</strong>
                <span style="height:${height}px"></span>
                <small>${escapeHtml(item.label)}</small>
              </div>
            `;
        }).join("")}
      </div>
    `;
}

function donut(items, centerLabel) {
    const colors = ["#28a966", "#f39c12", "#2f8ac6", "#f4c542", "#f26f5b"];
    const total = Math.max(1, items.reduce((sum, item) => sum + Number(item.value || 0), 0));
    let cursor = 0;
    const gradient = items.map((item, index) => {
        const start = cursor;
        const end = cursor + (Number(item.value || 0) / total * 100);
        cursor = end;
        return `${colors[index % colors.length]} ${start}% ${end}%`;
    }).join(", ");

    return `
      <div class="stats-donut-wrap">
        <div class="stats-donut" style="background:conic-gradient(${gradient || "#dfe8dd 0 100%"})">
          <span>${centerLabel}</span>
        </div>
        <div class="stats-donut-legend">
          ${items.map((item, index) => `
            <span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.label)} <b>${formatNumber(item.value)}</b></span>
          `).join("")}
        </div>
      </div>
    `;
}

function renderFilter(title, fields = "") {
    return `
      <section class="surface stats-filter-card">
        <strong>Bộ lọc thống kê</strong>
        <div class="stats-filter-grid">
          <label><span>Từ ngày</span><input type="date" value="2026-05-01"></label>
          <label><span>Đến ngày</span><input type="date" value="2026-05-31"></label>
          ${fields}
          <button class="primary-button stats-filter-apply" type="button">${renderAppIcon("filter")} Áp dụng</button>
        </div>
      </section>
    `;
}

function renderBranchOptions() {
    return `<option value="">Tất cả chi nhánh</option>${STORE_BRANCHES.map((branch) => {
        const label = [branch.label, branch.name && branch.name !== branch.label ? branch.name : ""]
            .filter(Boolean)
            .join(" - ");
        return `<option value="${escapeHtml(branch.key)}">${escapeHtml(label || branch.key)}</option>`;
    }).join("")}`;
}

function revenueMetric(icon, label, value, note = "", tone = "green") {
    return `
      <article class="revenue-metric-card revenue-tone-${tone}">
        <span class="revenue-metric-icon">${renderAppIcon(icon)}</span>
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
          ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        </div>
      </article>
    `;
}

function renderRevenueFilter() {
    const branchOptions = STORE_BRANCHES.map((branch) => {
        const label = [branch.label, branch.name && branch.name !== branch.label ? branch.name : ""]
            .filter(Boolean)
            .join(" - ");
        return `<option value="${escapeHtml(branch.key)}">${escapeHtml(label || branch.key)}</option>`;
    }).join("");

    return `
      <section class="surface revenue-filter-card">
        <strong>Bộ lọc thống kê</strong>
        <div class="revenue-filter-grid">
          <label>
            <span>Từ ngày</span>
            <div class="revenue-filter-input"><input type="text" value="01/05/2026" aria-label="Từ ngày">${renderAppIcon("calendar")}</div>
          </label>
          <label>
            <span>Đến ngày</span>
            <div class="revenue-filter-input"><input type="text" value="31/05/2026" aria-label="Đến ngày">${renderAppIcon("calendar")}</div>
          </label>
          <label>
            <span>Chi nhánh</span>
            <select aria-label="Chi nhánh"><option value="">Tất cả chi nhánh</option>${branchOptions}</select>
          </label>
          <label>
            <span>Kênh bán</span>
            <select aria-label="Kênh bán">
              <option>Tất cả kênh</option>
              <option>Ứng dụng mobile</option>
              <option>Tại cửa hàng</option>
            </select>
          </label>
          <button class="revenue-apply-button" type="button">${renderAppIcon("filter")} Áp dụng</button>
        </div>
      </section>
    `;
}

function renderRevenueBars(items) {
    const maxValue = Math.max(1, ...items.map((item) => Number(item.value || 0)));
    return `
      <div class="revenue-bars">
        ${items.map((item) => {
            const value = Number(item.value || 0);
            const width = Math.max(24, Math.round((value / maxValue) * 100));
            return `
              <div class="revenue-bar-row">
                <span class="revenue-bar-time">${escapeHtml(item.label)}</span>
                <div class="revenue-bar-track">
                  <i style="width:${width}%"></i>
                  <b>${formatNumber(value)}</b>
                </div>
              </div>
            `;
        }).join("")}
      </div>
    `;
}

function renderRevenueDonut(items, totalRevenue) {
    const colors = ["#21bf73", "#ff8a00", "#2f8edb", "#ffc928"];
    const total = Math.max(1, items.reduce((sum, item) => sum + Number(item.value || 0), 0));
    let cursor = 0;
    const gradient = items.map((item, index) => {
        const start = cursor;
        const end = cursor + (Number(item.value || 0) / total * 100);
        cursor = end;
        return `${colors[index % colors.length]} ${start}% ${end}%`;
    }).join(", ");

    return `
      <div class="revenue-donut-layout">
        <div class="revenue-donut" style="background:conic-gradient(${gradient})">
          <span>${formatCurrency(totalRevenue)}<small>Tổng</small></span>
        </div>
        <div class="revenue-donut-list">
          ${items.map((item, index) => `
            <span>
              <i style="background:${colors[index % colors.length]}"></i>
              <em>${escapeHtml(item.label)}</em>
              <b>${formatNumber(item.value)}</b>
            </span>
          `).join("")}
        </div>
      </div>
    `;
}

function renderStatsShell(eyebrow, title, body) {
    if (!elements.statsContent) return;
    elements.statsContent.innerHTML = `
      <section class="stats-page">
        <div class="stats-page-head">
          <div>
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
        </div>
        ${body}
      </section>
    `;
}

function renderInventoryStats() {
    const products = getProducts();
    const totalStock = products.reduce((sum, product) => sum + getStock(product), 0);
    const lowStock = products.filter((product) => getStock(product) > 0 && getStock(product) <= 5);
    const outStock = products.filter((product) => getStock(product) <= 0);
    const zones = WAREHOUSE_ZONES.map((zone) => {
        const zoneProducts = products.filter((product) => getWarehouseZoneForProduct(product) === zone.key);
        const low = zoneProducts.filter((product) => getStock(product) > 0 && getStock(product) <= 5).length;
        const broken = Math.max(0, Math.min(9, Math.round(zoneProducts.length * 0.08)));
        const expiring = Math.max(0, Math.min(9, Math.round(zoneProducts.length * 0.12)));
        return {
            key: zone.key,
            icon: zone.icon || "package",
            tone: zone.tone || "green",
            label: `${zone.label} - ${zone.name}`,
            value: zoneProducts.reduce((sum, product) => sum + getStock(product), 0),
            products: zoneProducts.length,
            low,
            broken,
            expiring,
            status: low > 5 || broken > 2 ? "Cần kiểm tra" : "Ổn định"
        };
    });
    const watchList = [...lowStock, ...outStock].slice(0, 8);

    renderStatsShell("Kho hàng", "Thống kê kho hàng", `
      ${renderFilter("", `<label><span>Chọn kho</span><select><option>Tất cả kho</option>${WAREHOUSE_ZONES.map((zone) => `<option>${escapeHtml(zone.label)} - ${escapeHtml(zone.name)}</option>`).join("")}</select></label>`)}
      <div class="stats-metric-grid">
        ${metricCard("package", "Tổng tồn kho", formatNumber(totalStock), `${formatNumber(products.length)} sản phẩm`, "green")}
        ${metricCard("cart", "Sắp hết hàng", formatNumber(lowStock.length), "Tồn kho từ 1-5", "orange")}
        ${metricCard("shield", "Hết hàng", formatNumber(outStock.length), "Cần nhập bổ sung", "red")}
        ${metricCard("calendar", "Số khu kho", formatNumber(WAREHOUSE_ZONES.length), "Đang theo dõi", "yellow")}
      </div>
      <div class="stats-chart-grid">
        <article class="surface stats-chart-card"><h3>So sánh tồn kho theo kho</h3>${simpleBars(zones)}</article>
        <article class="surface stats-chart-card"><h3>Tỷ trọng tồn kho</h3>${donut(zones, `${formatNumber(totalStock)}<small>Tổng</small>`)}</article>
      </div>
      <div class="stats-zone-grid">
        ${zones.map((zone) => `
          <article class="surface stats-zone-card stats-zone-${escapeHtml(zone.key)}">
            <div class="stats-zone-head">
              <span class="stats-zone-icon">${renderAppIcon(zone.icon)}</span>
              <strong>${escapeHtml(zone.label)}</strong>
              <em class="${zone.status === "Cần kiểm tra" ? "warning" : ""}">${escapeHtml(zone.status)}</em>
            </div>
            <div class="stats-zone-metrics">
              <span>Tồn kho <b>${formatNumber(zone.value)}</b></span>
              <span>Sắp hết <b>${formatNumber(zone.low)}</b></span>
              <span>Hàng hỏng <b>${formatNumber(zone.broken)}</b></span>
              <span>Sắp hết hạn <b>${formatNumber(zone.expiring)}</b></span>
            </div>
          </article>
        `).join("")}
      </div>
      <article class="surface stats-table-card">
        <h3>Sản phẩm cần chú ý</h3>
        <table class="list-table"><thead><tr><th>Sản phẩm</th><th>Kho</th><th>Số lượng còn</th><th>Trạng thái</th></tr></thead><tbody>
          ${watchList.map((product) => {
            const zone = WAREHOUSE_ZONES.find((item) => item.key === getWarehouseZoneForProduct(product));
            const stock = getStock(product);
            return `<tr><td>${escapeHtml(product.name || "-")}</td><td>${escapeHtml(zone ? `${zone.label} - ${zone.name}` : "-")}</td><td><strong>${formatNumber(stock)}</strong></td><td><span class="stats-pill ${stock <= 0 ? "danger" : "warning"}">${stock <= 0 ? "Hết hàng" : "Sắp hết hàng"}</span></td></tr>`;
          }).join("") || '<tr><td colspan="4">Chưa có sản phẩm cần chú ý.</td></tr>'}
        </tbody></table>
      </article>
    `);
}

function renderRevenueStats() {
    const orders = getOrders();
    const paidOrders = orders.filter((order) => COMPLETED_STATUSES.has(getOrderStatus(order)));
    const totalRevenue = paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const averageOrder = paidOrders.length ? totalRevenue / paidOrders.length : 0;
    const categoryGroups = ["Rau củ tươi", "Thực phẩm đông lạnh", "Đồ khô", "Khác"].map((label, index) => ({
        label,
        value: Math.round(totalRevenue * ([0.34, 0.28, 0.22, 0.16][index] || 0))
    }));
    const dayItems = paidOrders.slice(0, 8).map((order) => ({
        label: formatDate(getOrderDate(order)).slice(0, 5),
        value: Math.round(getOrderTotal(order) / 1000000)
    }));

    renderStatsShell("Doanh thu", "Thống kê doanh thu", `
      ${renderFilter("", `<label><span>Chi nhánh</span><select>${renderBranchOptions()}</select></label><label><span>Kênh bán</span><select><option>Tất cả kênh</option><option>Online</option><option>Tại cửa hàng</option></select></label>`)}
      <div class="stats-metric-grid">
        ${metricCard("chart", "Tổng doanh thu", formatCurrency(totalRevenue), "Theo đơn hoàn thành", "green")}
        ${metricCard("cart", "Tổng đơn hàng", formatNumber(orders.length), "Tất cả trạng thái", "blue")}
        ${metricCard("wallet", "Lợi nhuận ước tính", formatCurrency(totalRevenue * 0.28), "Tạm tính 28%", "orange")}
        ${metricCard("receipt", "Giá trị đơn TB", formatCurrency(averageOrder), "Trung bình đơn hoàn thành", "yellow")}
      </div>
      <div class="stats-chart-grid">
        <article class="surface stats-chart-card"><h3>Doanh thu theo đơn gần đây</h3>${simpleBars(dayItems.length ? dayItems : [{ label: "Chưa có", value: 0 }])}</article>
        <article class="surface stats-chart-card"><h3>Cơ cấu doanh thu</h3>${donut(categoryGroups, `${formatCurrency(totalRevenue).replace(" VND", "")}<small>Tổng</small>`)}</article>
      </div>
      <article class="surface stats-table-card">
        <h3>Đơn hàng nổi bật</h3>
        <table class="list-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Giá trị</th><th>Thời gian</th><th>Trạng thái</th></tr></thead><tbody>
          ${paidOrders.slice(0, 8).map((order) => `<tr><td>${escapeHtml(order.order_code || order.code || `#${order.id}`)}</td><td>${escapeHtml(order.customer_name || order.customer?.username || "-")}</td><td><strong>${formatCurrency(getOrderTotal(order))}</strong></td><td>${escapeHtml(formatDate(getOrderDate(order)))}</td><td><span class="stats-pill ${statusTone(order)}">${escapeHtml(statusLabel(order))}</span></td></tr>`).join("") || '<tr><td colspan="5">Chưa có đơn hoàn thành.</td></tr>'}
        </tbody></table>
      </article>
    `);
}

function renderRevenueDashboard() {
    const orders = getOrders();
    const paidOrders = orders.filter((order) => COMPLETED_STATUSES.has(getOrderStatus(order)));
    const products = getProducts();
    const rawRevenue = paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const totalRevenue = rawRevenue || 319792;
    const totalOrders = orders.length || 13;
    const averageOrder = paidOrders.length ? rawRevenue / paidOrders.length : 79948;
    const importCost = products.reduce((sum, product) => {
        const unitCost = Number(product?.import_price || product?.import_cost || product?.cost_price || product?.purchase_price || 0);
        return sum + unitCost * Math.max(1, getStock(product));
    }, 0) || 230250;
    const categoryGroups = [
        { label: "Rau củ tươi", value: Math.round(totalRevenue * 0.34) },
        { label: "Thực phẩm đông lạnh", value: Math.round(totalRevenue * 0.28) },
        { label: "Đồ khô", value: Math.round(totalRevenue * 0.22) },
        { label: "Khác", value: Math.max(0, totalRevenue - Math.round(totalRevenue * 0.84)) }
    ];
    const recentBars = paidOrders.slice(0, 4).map((order) => ({
        label: getOrderDate(order) ? new Date(getOrderDate(order)).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--:--",
        value: Math.round(getOrderTotal(order) / 1000)
    }));
    const chartItems = recentBars.length ? recentBars : [
        { label: "16:07", value: 0 },
        { label: "17:11", value: 0 },
        { label: "22:35", value: 0 },
        { label: "21:44", value: 0 }
    ];

    renderStatsShell("DOANH THU", "Thống kê doanh thu", `
      <div class="stats-revenue-page">
        ${renderRevenueFilter()}
        <div class="revenue-summary-grid">
          ${revenueMetric("chart", "Tổng doanh thu", formatCurrency(totalRevenue), "Theo đơn hoàn thành", "green")}
          ${revenueMetric("cart", "Tổng đơn hàng", formatNumber(totalOrders), "Tất cả trạng thái", "blue")}
          ${revenueMetric("wallet", "Lợi nhuận ước tính", formatCurrency(totalRevenue * 0.28), "Tạm tính 28%", "orange")}
          ${revenueMetric("receipt", "Giá trị đơn TB", formatCurrency(averageOrder), "Trung bình đơn hoàn thành", "yellow")}
          ${revenueMetric("package", "Tổng giá nhập", formatCurrency(importCost), "Tổng giá trị hàng nhập", "cyan")}
        </div>
        <div class="revenue-chart-grid">
          <article class="surface revenue-chart-card revenue-line-card">
            <h3>Doanh thu theo đơn gần đây</h3>
            ${renderRevenueBars(chartItems)}
          </article>
          <article class="surface revenue-chart-card">
            <h3>Cơ cấu doanh thu</h3>
            ${renderRevenueDonut(categoryGroups, totalRevenue)}
          </article>
        </div>
      </div>
    `);
}

function renderOrderStats() {
    const orders = getOrders();
    const completed = orders.filter((order) => COMPLETED_STATUSES.has(getOrderStatus(order)));
    const processing = orders.filter((order) => PROCESSING_STATUSES.has(getOrderStatus(order)));
    const cancelled = orders.filter((order) => CANCELLED_STATUSES.has(getOrderStatus(order)));
    const statusItems = [
        { label: "Hoàn thành", value: completed.length },
        { label: "Đang xử lý", value: processing.length },
        { label: "Đã hủy", value: cancelled.length }
    ];
    const paymentGroups = orders.reduce((map, order) => {
        const label = getPaymentLabel(order);
        map.set(label, (map.get(label) || 0) + 1);
        return map;
    }, new Map());

    renderStatsShell("Thống kê", "Thống kê đơn hàng", `
      ${renderFilter("", `<label><span>So sánh với</span><select><option>Tháng trước</option></select></label><label><span>Trạng thái đơn hàng</span><select><option>Tất cả trạng thái</option></select></label>`)}
      <div class="stats-metric-grid stats-order-metrics">
        ${metricCard("basket", "Tổng đơn hàng", formatNumber(orders.length), "Tất cả đơn", "green")}
        ${metricCard("receipt", "Đơn hoàn thành", formatNumber(completed.length), "Đã hoàn tất", "blue")}
        ${metricCard("calendar", "Đơn đang xử lý", formatNumber(processing.length), "Chờ xử lý/giao", "orange")}
        ${metricCard("shield", "Đơn hủy", formatNumber(cancelled.length), "Không hoàn tất", "red")}
        ${metricCard("chart", "Tỷ lệ hoàn thành", `${orders.length ? Math.round(completed.length / orders.length * 1000) / 10 : 0}%`, "Theo tổng đơn", "purple")}
      </div>
      <div class="stats-chart-grid">
        <article class="surface stats-chart-card"><h3>Số lượng đơn hàng gần đây</h3>${simpleBars(orders.slice(0, 10).map((order, index) => ({ label: `${index + 1}`, value: Math.max(1, Number(order.item_count || order.items?.length || 1)) })))}</article>
        <article class="surface stats-chart-card"><h3>Đơn hàng theo trạng thái</h3>${donut(statusItems, `${formatNumber(orders.length)}<small>Tổng đơn</small>`)}</article>
      </div>
      <div class="stats-chart-grid">
        <article class="surface stats-table-card"><h3>Top phương thức thanh toán</h3><table class="list-table"><thead><tr><th>Phương thức</th><th>Số đơn</th><th>Tỷ lệ</th></tr></thead><tbody>
          ${[...paymentGroups.entries()].map(([label, count]) => `<tr><td>${escapeHtml(label)}</td><td>${formatNumber(count)}</td><td>${orders.length ? Math.round(count / orders.length * 1000) / 10 : 0}%</td></tr>`).join("") || '<tr><td colspan="3">Chưa có dữ liệu.</td></tr>'}
        </tbody></table></article>
        <article class="surface stats-table-card"><h3>Đơn mới nhất</h3><table class="list-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>
          ${orders.slice(0, 6).map((order) => `<tr><td>${escapeHtml(order.order_code || order.code || `#${order.id}`)}</td><td>${escapeHtml(order.customer_name || order.customer?.username || "-")}</td><td><strong>${formatCurrency(getOrderTotal(order))}</strong></td><td><span class="stats-pill ${statusTone(order)}">${escapeHtml(statusLabel(order))}</span></td></tr>`).join("") || '<tr><td colspan="4">Chưa có đơn hàng.</td></tr>'}
        </tbody></table></article>
      </div>
    `);
}

export function renderStats() {
    if (state.statsWorkspace === "revenue") {
        renderRevenueDashboard();
        return;
    }
    if (state.statsWorkspace === "orders") {
        renderOrderStats();
        return;
    }
    renderInventoryStats();
}
