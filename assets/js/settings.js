import { SIDEBAR_MENU, STORAGE_KEYS, escapeHtml, showToast, state } from "./core.js";
import { renderSidebarMenu } from "./auth-nav.js";
import { renderAppIcon } from "./icons.js";

const DEFAULT_SETTINGS = {
    storeName: "Garden Fresh",
    slogan: "Tươi ngon từ vườn đến bàn ăn...",
    supportEmail: "support@gardenfresh.vn",
    hotline: "1900 1234",
    address: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    timezone: "Asia/Ho_Chi_Minh",
    currency: "VND",
    language: "vi",
    weekdayOpen: "08:00",
    weekdayClose: "21:00",
    weekendOpen: "09:00",
    weekendClose: "22:00",
    maintenanceMode: false,
    emailNotifications: true,
    logoDataUrl: ""
};

const MENU_ICONS = [
    ["grid", "Bảng điều khiển"],
    ["package", "Sản phẩm / Kho hàng"],
    ["home", "Trang chủ"],
    ["bell", "Thông báo"],
    ["store", "Cửa hàng / Chi nhánh"],
    ["pin", "Địa chỉ"],
    ["chat", "Chat khách hàng"],
    ["user", "Tài khoản"],
    ["cart", "Đơn hàng"],
    ["receipt", "Hóa đơn / Danh sách"],
    ["ticket", "Voucher"],
    ["truck", "Giao hàng"],
    ["calendar", "Lịch ca làm việc"],
    ["users", "Khách hàng / Nhân sự"],
    ["chart", "Thống kê / Báo cáo"],
    ["wallet", "Thanh toán / Ví"],
    ["megaphone", "Khuyến mãi"],
    ["basket", "Nhà cung cấp / Danh mục"],
    ["shield", "Phân quyền / Bảo mật"],
    ["settings", "Cài đặt"]
];

const MENU_ICON_KEYS = new Set(MENU_ICONS.map(([icon]) => icon));
const LEGACY_MENU_ICON_MAP = {
    "▦": "grid",
    "◫": "package",
    "◌": "cart",
    "◨": "chat",
    "◧": "user",
    "▣": "basket",
    "⌂": "store",
    "🎟": "ticket",
    "⚙": "settings",
    "△": "chart",
    "◇": "megaphone",
    "✦": "grid"
};

function inferMenuIcon(item = {}) {
    const text = [
        item.label,
        item.subtitle,
        item.route,
        item.id
    ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (/(don hang|order|khieu nai)/.test(text)) return "cart";
    if (/(san pham|kho hang|inventory|product|nhap san pham)/.test(text)) return "package";
    if (/(chat|hoi thoai|support)/.test(text)) return "chat";
    if (/(tai khoan|nguoi dung|user|admin|nhan vien|staff)/.test(text)) return "user";
    if (/(khach hang|customer)/.test(text)) return "users";
    if (/(chi nhanh|cua hang|branch|store)/.test(text)) return "store";
    if (/(voucher|coupon)/.test(text)) return "ticket";
    if (/(lich|ca lam|shift|calendar)/.test(text)) return "calendar";
    if (/(nha cung cap|supplier|danh muc|category)/.test(text)) return "basket";
    if (/(cai dat|setting|thiet lap)/.test(text)) return "settings";
    if (/(bao cao|thong ke|dashboard|tong quan|overview)/.test(text)) return "chart";
    if (/(giao hang|van don|delivery|ship|grab)/.test(text)) return "truck";
    if (/(thanh toan|vi|wallet|payment)/.test(text)) return "wallet";
    if (/(khuyen mai|marketing|broadcast)/.test(text)) return "megaphone";
    if (/(phan quyen|bao mat|role|permission)/.test(text)) return "shield";
    if (/(dia chi|address)/.test(text)) return "pin";
    return "grid";
}

function normalizeMenuIcon(icon, item = {}) {
    const value = String(icon || "").trim();
    if (MENU_ICON_KEYS.has(value)) return value;
    if (LEGACY_MENU_ICON_MAP[value]) return LEGACY_MENU_ICON_MAP[value];
    return inferMenuIcon(item);
}

function cleanMenuText(value) {
    return String(value || "")
        .replace(/&amp;/gi, " và ")
        .replace(/&#38;/gi, " và ")
        .replace(/\s*&\s*/g, " và ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function normalizeMenuMatchText(value) {
    return cleanMenuText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function isPromotionMenuText(value) {
    const text = normalizeMenuMatchText(value);
    return /(voucher|coupon|khuyen mai|quang ba|chien dich)/.test(text);
}

function isBranchImportRequestMenuText(value) {
    const text = normalizeMenuMatchText(value);
    return /(yeu cau nhap hang|nhap hang chi nhanh|branch import|import request)/.test(text);
}

function isBranchShipmentMenuText(value) {
    const text = normalizeMenuMatchText(value);
    return /(gui hang cho chi nhanh|duyet hang|duyet yeu cau|xuat hang chi nhanh|branch shipment)/.test(text);
}

function isAiSupportMenuText(value) {
    const text = normalizeMenuMatchText(value);
    return /(hoi dap ai|ho tro ai|ai support|gemini|tro ly ai)/.test(text);
}

function resolveCustomMenuTarget(item) {
    if (isProfileMenuText(item.label)) {
        return { panel: "profile", workspace: undefined, staticLink: false };
    }

    if (isAiSupportMenuText(item.label)) {
        return { panel: "chats", workspace: "aiSupport", staticLink: false };
    }

    if (isBranchImportRequestMenuText(item.label)) {
        return { panel: "branches", workspace: "importRequests", staticLink: false };
    }

    if (isBranchShipmentMenuText(item.label)) {
        return { panel: "branches", workspace: "shipments", staticLink: false };
    }

    return { panel: "overview", workspace: undefined, staticLink: true };
}

function isProfileMenuText(value) {
    const text = normalizeMenuMatchText(value);
    return /(thong tin ca nhan|ho so ca nhan|tai khoan ca nhan|profile|my account)/.test(text);
}

function isDuplicatePromotionChild(item) {
    const text = normalizeMenuMatchText(item?.label);
    return text === "danh sach chien dich"
        || text === "vouchers"
        || text === "voucher"
        || text === "khuyen mai"
        || text === "tao chien dich"
        || text === "tao voucher"
        || text === "tao chien dich email";
}

function getMenuSortPosition(item) {
    const id = String(item?.key || item?.id || "");
    const promotionOrder = {
        "vouchers-list": 1,
        "vouchers-create": 2,
        "email-campaign-create": 3
    };
    if (Object.prototype.hasOwnProperty.call(promotionOrder, id)) {
        return promotionOrder[id];
    }
    return Number(item?.position || 999);
}

function getRouteForMenuItem(item, section) {
    if (item?.key) return `/admin/${item.key}`;
    return `/admin/${section?.key || "dashboard"}`;
}

function buildMenuItemsFromSidebar() {
    return SIDEBAR_MENU.flatMap((section, sectionIndex) => {
        const sectionRow = {
            id: section.key,
            parentId: "",
            type: "main",
            label: cleanMenuText(section.label),
            subtitle: "MENU CHÍNH",
            icon: normalizeMenuIcon(section.icon, section),
            route: getRouteForMenuItem(null, section),
            position: sectionIndex + 1,
            isActive: true,
            locked: true,
            source: "sidebar"
        };

        const childRows = (section.items || []).map((item, childIndex) => ({
            id: item.key,
            parentId: section.key,
            type: "child",
            label: cleanMenuText(item.label),
            subtitle: cleanMenuText(section.label),
            icon: normalizeMenuIcon(section.icon, section),
            route: getRouteForMenuItem(item, section),
            position: childIndex + 1,
            isActive: true,
            locked: true,
            source: "sidebar"
        }));

        return [sectionRow, ...childRows];
    });
}

function normalizeMenuItemsForCurrentSidebar(items, sidebarItems) {
    const baseById = new Map(sidebarItems.map((item) => [String(item.id), item]));
    const duplicatePromotionSectionIds = new Set(items
        .filter((item) => item.source === "custom" && item.type !== "child" && isPromotionMenuText(item.label))
        .map((item) => String(item.id)));

    return items
        .map((item) => {
            const baseItem = baseById.get(String(item.id));
            if (baseItem) {
                const savedLabel = cleanMenuText(item.label);
                const savedSubtitle = cleanMenuText(item.subtitle);
                const savedIcon = normalizeMenuIcon(item.icon || baseItem.icon, item);
                const canMoveSidebarChild = ["branches-shipments"].includes(String(baseItem.id));
                const savedParentId = String(item.parentId || "");
                const nextParentId = canMoveSidebarChild && savedParentId ? savedParentId : baseItem.parentId;
                return {
                    ...baseItem,
                    isActive: item.isActive,
                    position: baseItem.type === "child" && baseItem.parentId === "vouchers"
                        ? getMenuSortPosition(baseItem)
                        : Number(item.position || baseItem.position || 999),
                    id: baseItem.id,
                    parentId: nextParentId,
                    type: baseItem.type,
                    label: savedLabel || baseItem.label,
                    subtitle: savedSubtitle || baseItem.subtitle,
                    icon: savedIcon,
                    route: baseItem.route,
                    source: "sidebar",
                    locked: true
                };
            }

            if (item.source === "custom" && item.type !== "child" && isPromotionMenuText(item.label)) {
                return null;
            }

            if (item.source === "custom" && item.type === "child") {
                const parentId = String(item.parentId || "");
                const parentIsPromotion = parentId === "vouchers" || duplicatePromotionSectionIds.has(parentId);
                if (parentIsPromotion && isDuplicatePromotionChild(item)) {
                    return null;
                }
                if (duplicatePromotionSectionIds.has(parentId)) {
                    return {
                        ...item,
                        parentId: "vouchers",
                        subtitle: "Quảng bá và Khuyến mãi",
                        icon: "megaphone"
                    };
                }
            }

            return item;
        })
        .filter(Boolean);
}

function readMenuItems() {
    const sidebarItems = buildMenuItemsFromSidebar();
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.menuSettings) || "[]");
        if (Array.isArray(saved) && saved.length) {
            const validSavedItems = saved.filter((item) => item.source === "sidebar" || item.source === "custom");
            const savedById = new Map(validSavedItems.map((item) => [String(item.id), item]));
            const mergedSidebarItems = sidebarItems.map((item) => ({
                ...item,
                ...(savedById.get(String(item.id)) || {}),
                parentId: ["branches-shipments"].includes(String(item.id)) && savedById.get(String(item.id))?.parentId
                    ? String(savedById.get(String(item.id)).parentId)
                    : item.parentId,
                source: "sidebar",
                locked: true
            })).map((item) => ({
                ...item,
                label: cleanMenuText(item.label),
                subtitle: cleanMenuText(item.subtitle),
                icon: normalizeMenuIcon(item.icon, item)
            }));
            const customItems = validSavedItems
                .filter((item) => item.source === "custom" && !sidebarItems.some((baseItem) => String(baseItem.id) === String(item.id)))
                .map((item) => ({
                    ...item,
                    label: cleanMenuText(item.label),
                    subtitle: cleanMenuText(item.subtitle),
                    icon: normalizeMenuIcon(item.icon, item)
                }));
            return normalizeMenuItemsForCurrentSidebar([...mergedSidebarItems, ...customItems], sidebarItems);
        }
    } catch {
        // fall back to defaults
    }
    return normalizeMenuItemsForCurrentSidebar(sidebarItems.map((item) => ({
        ...item,
        label: cleanMenuText(item.label),
        subtitle: cleanMenuText(item.subtitle),
        icon: normalizeMenuIcon(item.icon, item)
    })), sidebarItems);
}

export function getVisibleSidebarMenu() {
    const menuItems = readMenuItems();
    const menuState = new Map(menuItems.map((item) => [String(item.id), item]));
    const customItems = menuItems.filter((item) => item.source === "custom" && item.isActive);
    const duplicatePromotionSectionIds = new Set(customItems
        .filter((item) => item.type !== "child" && isPromotionMenuText(item.label))
        .map((item) => String(item.id)));
    const customChildrenByParent = customItems
        .filter((item) => item.type === "child")
        .reduce((groups, item) => {
            const parentId = String(item.parentId || "");
            if (!groups.has(parentId)) groups.set(parentId, []);
            groups.get(parentId).push(item);
            return groups;
        }, new Map());
    const promotionChildrenFromDuplicateSections = Array.from(duplicatePromotionSectionIds)
        .flatMap((parentId) => customChildrenByParent.get(parentId) || [])
        .filter((item) => !isDuplicatePromotionChild(item));

    const baseSections = SIDEBAR_MENU
        .map((section) => {
            const sectionState = menuState.get(String(section.key));
            if (sectionState && !sectionState.isActive) return null;

            const visibleItems = (section.items || []).filter((item) => {
                const itemState = menuState.get(String(item.key));
                return !itemState || itemState.isActive;
            }).sort((left, right) => getMenuSortPosition(left) - getMenuSortPosition(right));

            return {
                ...section,
                icon: section.key === "vouchers" ? "megaphone" : (sectionState?.icon || section.icon),
                label: section.key === "vouchers" ? "Quảng bá và Khuyến mãi" : (section.key === "chats" ? "Tin nhắn" : cleanMenuText(sectionState?.label || section.label)),
                position: Number(sectionState?.position || 999),
                items: [
                    ...visibleItems,
                    ...(section.key === "vouchers" ? promotionChildrenFromDuplicateSections
                    .sort((left, right) => getMenuSortPosition(left) - getMenuSortPosition(right))
                    .map((item) => ({
                        key: String(item.id),
                        label: cleanMenuText(item.label),
                        panel: "overview",
                        staticLink: true,
                        route: item.route
                    })) : []),
                    ...(customChildrenByParent.get(String(section.key)) || [])
                    .filter((item) => !(section.key === "branches" && (isBranchImportRequestMenuText(item.label) || isBranchShipmentMenuText(item.label))))
                    .map((item) => {
                        const target = resolveCustomMenuTarget(item);
                        return {
                            key: String(item.id),
                            label: cleanMenuText(item.label),
                            panel: target.panel,
                            workspace: target.workspace,
                            staticLink: target.staticLink,
                            route: item.route
                        };
                    })
                ]
            };
        })
        .filter(Boolean);

    const knownSectionKeys = new Set(SIDEBAR_MENU.map((section) => String(section.key)));
    const knownSectionLabels = new Set(SIDEBAR_MENU.map((section) => cleanMenuText(section.label).toLowerCase()));
    const customSections = customItems
        .filter((item) => (
            item.type !== "child"
            && !knownSectionKeys.has(String(item.id))
            && !knownSectionLabels.has(cleanMenuText(item.label).toLowerCase())
            && !isPromotionMenuText(item.label)
        ))
        .map((item) => ({
            key: String(item.id),
            label: cleanMenuText(item.label),
            icon: normalizeMenuIcon(item.icon, item),
            defaultExpanded: false,
            position: Number(item.position || 999),
            staticLink: !isProfileMenuText(item.label),
            panel: isProfileMenuText(item.label) ? "profile" : "overview",
            items: (customChildrenByParent.get(String(item.id)) || []).map((child) => {
                const target = resolveCustomMenuTarget(child);
                return {
                    key: String(child.id),
                    label: cleanMenuText(child.label),
                    panel: target.panel,
                    workspace: target.workspace,
                    staticLink: target.staticLink,
                    route: child.route
                };
            })
        }));

    return [...baseSections, ...customSections]
        .sort((left, right) => Number(left.position || 999) - Number(right.position || 999));
}

function saveMenuItems(items) {
    localStorage.setItem(STORAGE_KEYS.menuSettings, JSON.stringify(items));
}

function getMenuFilters() {
    if (!state.filters.settingsMenus) {
        state.filters.settingsMenus = {};
    }
    return state.filters.settingsMenus;
}

function getFilteredMenuItems(items) {
    const keyword = String(getMenuFilters().keyword || "").trim().toLowerCase();
    if (!keyword) return items;
    const matchedIds = new Set();
    items.forEach((item) => {
        const matches = [
        item.label,
        item.subtitle,
        item.route
        ].some((value) => String(value || "").toLowerCase().includes(keyword));
        if (matches) {
            matchedIds.add(String(item.id));
            if (item.parentId) matchedIds.add(String(item.parentId));
        }
    });

    items.forEach((item) => {
        if (matchedIds.has(String(item.parentId || ""))) {
            matchedIds.add(String(item.id));
        }
    });

    return items.filter((item) => matchedIds.has(String(item.id)));
}

function getOrderedMenuItems(items) {
    const parents = items
        .filter((item) => item.type !== "child")
        .sort((left, right) => Number(left.position || 999) - Number(right.position || 999));
    const childrenByParent = items
        .filter((item) => item.type === "child")
        .reduce((groups, item) => {
            const parentId = String(item.parentId || "");
            if (!groups.has(parentId)) groups.set(parentId, []);
            groups.get(parentId).push(item);
            return groups;
        }, new Map());

    return parents.flatMap((parent) => [
        parent,
        ...(childrenByParent.get(String(parent.id)) || [])
            .sort((left, right) => getMenuSortPosition(left) - getMenuSortPosition(right))
            .map((child) => ({
                ...child,
                parentLabel: parent.label,
                inheritedPosition: parent.position
            }))
    ]);
}

function normalizeMenuPositions(items, movingMainId = "", nextPosition = null) {
    const mainItems = items
        .filter((item) => item.type !== "child")
        .sort((left, right) => Number(left.position || 999) - Number(right.position || 999));
    const movingItem = movingMainId
        ? mainItems.find((item) => String(item.id) === String(movingMainId))
        : null;
    let orderedMainItems = mainItems.filter((item) => !movingItem || String(item.id) !== String(movingMainId));

    if (movingItem) {
        const safePosition = Math.max(1, Math.min(orderedMainItems.length + 1, Number(nextPosition || movingItem.position || 1)));
        orderedMainItems.splice(safePosition - 1, 0, movingItem);
    }

    const positionById = new Map();
    orderedMainItems.forEach((item, index) => {
        positionById.set(String(item.id), index + 1);
    });

    return items.map((item) => {
        if (item.type === "child") return item;
        return {
            ...item,
            position: positionById.get(String(item.id)) || Number(item.position || 1)
        };
    });
}

function getParentMenuOptions(items, selectedValue = "") {
    const parents = items.filter((item) => item.type === "main");
    return [
        `<option value="">Không có menu cha</option>`,
        ...parents.map((item) => `<option value="${escapeHtml(item.id)}" ${String(selectedValue) === String(item.id) ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    ].join("");
}

function getIconOptions(selectedValue = "") {
    const normalizedValue = normalizeMenuIcon(selectedValue);
    return MENU_ICONS
        .map(([icon, label]) => `<option value="${escapeHtml(icon)}" ${normalizedValue === icon ? "selected" : ""}>${escapeHtml(label)}</option>`)
        .join("");
}

function getMenuItemById(itemId) {
    return readMenuItems().find((item) => String(item.id) === String(itemId)) || null;
}

function createMenuId(label) {
    const base = String(label || "menu")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "menu";
    return `${base}-${Date.now()}`;
}

function createMenuSlug(label) {
    return String(label || "menu")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "menu";
}

function createMenuRoute(label, type = "main", parentId = "") {
    const slug = createMenuSlug(label);
    const prefix = type === "child" && parentId ? `/admin/${createMenuSlug(parentId)}` : "/admin";
    return `${prefix}/${slug}`;
}

function readSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.generalSettings) || "{}");
        return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.generalSettings, JSON.stringify(settings));
}

function option(value, label, currentValue) {
    return `<option value="${value}" ${String(currentValue) === value ? "selected" : ""}>${label}</option>`;
}

function checked(value) {
    return value ? "checked" : "";
}

function renderLogoUpload(settings) {
    if (settings.logoDataUrl) {
        return `
          <div class="settings-logo-preview">
            <img src="${escapeHtml(settings.logoDataUrl)}" alt="Logo cửa hàng">
            <span>Logo hiện tại</span>
          </div>
        `;
    }

    return `
      <div class="settings-logo-placeholder">
        <span>⇧</span>
        <strong>Tải lên Logo mới</strong>
        <small>Định dạng PNG, JPG. Tối đa 2MB.<br>Kích thước khuyên dùng 512×512px.</small>
      </div>
    `;
}

function setSettingsHeading(title, copy) {
    const titleElement = document.querySelector("#settingsPanel .settings-head h2");
    const copyElement = document.querySelector("#settingsPanel .settings-head .section-copy");
    if (titleElement) titleElement.textContent = title;
    if (copyElement) copyElement.textContent = copy;
}

function renderMenuRows(items) {
    return getOrderedMenuItems(items)
        .map((item, index) => {
            const icon = normalizeMenuIcon(item.icon, item);
            return `
          <tr class="${item.type === "child" ? "menu-manager-child-row" : "menu-manager-parent-row"}">
            <td>${index + 1}</td>
            <td><span class="menu-manager-icon">${renderAppIcon(icon)}</span></td>
            <td>
              <div class="menu-manager-name">
                <strong>${escapeHtml(item.label || "-")}</strong>
                ${item.type === "child" ? `<span>Menu con của ${escapeHtml(item.parentLabel || item.subtitle || "menu cha")}</span>` : ""}
              </div>
            </td>
            <td>${item.type === "child" ? '<span class="menu-manager-inherited-position">Theo menu cha</span>' : `<strong>${escapeHtml(String(item.position || "-"))}</strong>`}</td>
            <td>${item.isActive ? '<span class="status-pill active">Đang hiển thị</span>' : '<span class="status-pill pending">Đã ẩn</span>'}</td>
            <td>
              <div class="menu-manager-actions">
                <button class="icon-action-button" type="button" data-settings-menu-action="toggle" data-id="${escapeHtml(item.id)}" title="${item.isActive ? "Ẩn" : "Hiện"}">${renderAppIcon(item.isActive ? "eye" : "shield")}</button>
                <button class="icon-action-button" type="button" data-settings-menu-action="edit" data-id="${escapeHtml(item.id)}" title="Sửa">${renderAppIcon("edit")}</button>
                <button class="icon-action-button" type="button" data-settings-menu-action="delete" data-id="${escapeHtml(item.id)}" title="Xóa">${renderAppIcon("trash")}</button>
              </div>
            </td>
          </tr>
        `;
        }).join("");
}

function renderMenuSettings(container) {
    setSettingsHeading("Quản lý Menu chức năng", "");
    const items = normalizeMenuPositions(readMenuItems());
    const filters = getMenuFilters();
    const filteredItems = getFilteredMenuItems(items);
    const activeCount = items.filter((item) => item.isActive).length;
    const hiddenCount = items.length - activeCount;

    container.innerHTML = `
      <section class="menu-manager-head">
        <button class="primary-button menu-manager-add" type="button" data-settings-menu-action="open-create">+ Thêm menu mới</button>
      </section>

      <section class="menu-manager-stats">
        <article><span>Tổng số mục</span><strong>${items.length}</strong><small>chức năng</small></article>
        <article><span>Mục hoạt động</span><strong>${activeCount}</strong><small>đang hiển thị</small></article>
        <article><span>Mục bị ẩn</span><strong>${hiddenCount}</strong><small>trong kho lưu trữ</small></article>
      </section>

      <form class="menu-manager-filter" id="settingsMenuFilterForm">
        <label>
          <span>Lọc theo tên chức năng</span>
          <input name="keyword" value="${escapeHtml(filters.keyword || "")}" placeholder="Nhập tên chức năng...">
        </label>
        <button class="primary-button" type="submit">Tìm kiếm</button>
      </form>

      <section class="surface menu-manager-table-card">
        <div class="menu-manager-table-wrap">
          <table class="list-table menu-manager-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Biểu tượng</th>
                <th>Tên menu</th>
                <th>Vị trí</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>${renderMenuRows(filteredItems) || '<tr><td colspan="6">Không có menu phù hợp.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `;
}

export function renderSettings() {
    const container = document.querySelector("#settingsContent");
    if (!container) return;

    if (state.settingsWorkspace === "menus") {
        renderMenuSettings(container);
        return;
    }

    setSettingsHeading("Thiết lập chung", "");

    const settings = readSettings();
    container.innerHTML = `
      <form class="settings-form" id="generalSettingsForm">
        <section class="settings-card">
          <h3><span>ⓘ</span> Thông tin cơ bản</h3>
          <div class="settings-basic-grid">
            <div class="settings-field-stack">
              <label>
                <span>Tên cửa hàng</span>
                <input name="storeName" value="${escapeHtml(settings.storeName)}">
              </label>
              <label>
                <span>Slogan</span>
                <input name="slogan" value="${escapeHtml(settings.slogan)}">
              </label>
            </div>
            <label class="settings-logo-dropzone">
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" hidden>
              <input name="logoDataUrl" type="hidden" value="${escapeHtml(settings.logoDataUrl)}">
              ${renderLogoUpload(settings)}
            </label>
          </div>
        </section>

        <section class="settings-card">
          <h3><span>?</span> Thông tin liên hệ</h3>
          <div class="settings-grid two">
            <label>
              <span>Email hỗ trợ</span>
              <input name="supportEmail" type="email" value="${escapeHtml(settings.supportEmail)}">
            </label>
            <label>
              <span>Số điện thoại hotline</span>
              <input name="hotline" value="${escapeHtml(settings.hotline)}">
            </label>
            <label class="span-2">
              <span>Địa chỉ trụ sở chính</span>
              <input name="address" value="${escapeHtml(settings.address)}">
            </label>
          </div>
        </section>

        <section class="settings-card">
          <h3><span>◎</span> Cấu hình vùng & Ngôn ngữ</h3>
          <div class="settings-grid three">
            <label>
              <span>Múi giờ</span>
              <select name="timezone">
                ${option("Asia/Ho_Chi_Minh", "(GMT+7) Bangkok, Hà Nội", settings.timezone)}
                ${option("UTC", "(GMT+0) UTC", settings.timezone)}
                ${option("Asia/Bangkok", "(GMT+7) Bangkok", settings.timezone)}
              </select>
            </label>
            <label>
              <span>Đơn vị tiền tệ</span>
              <select name="currency">
                ${option("VND", "VND - ₫", settings.currency)}
                ${option("USD", "USD - $", settings.currency)}
              </select>
            </label>
            <label>
              <span>Ngôn ngữ mặc định</span>
              <select name="language">
                ${option("vi", "Tiếng Việt", settings.language)}
                ${option("en", "English", settings.language)}
              </select>
            </label>
          </div>
        </section>

        <section class="settings-card">
          <h3><span>◷</span> Giờ hoạt động</h3>
          <div class="settings-hours">
            <div class="settings-hour-row">
              <strong>Thứ Hai - Thứ Sáu</strong>
              <label><input name="weekdayOpen" type="time" value="${settings.weekdayOpen}"></label>
              <span>đến</span>
              <label><input name="weekdayClose" type="time" value="${settings.weekdayClose}"></label>
            </div>
            <div class="settings-hour-row">
              <strong>Thứ Bảy - Chủ Nhật</strong>
              <label><input name="weekendOpen" type="time" value="${settings.weekendOpen}"></label>
              <span>đến</span>
              <label><input name="weekendClose" type="time" value="${settings.weekendClose}"></label>
            </div>
          </div>
        </section>

        <section class="settings-card">
          <h3><span>≡</span> Trạng thái hệ thống</h3>
          <label class="settings-toggle-row">
            <span><strong>Chế độ bảo trì</strong><small>Tạm thời ngừng hoạt động cửa hàng để cập nhật hệ thống.</small></span>
            <input name="maintenanceMode" type="checkbox" ${checked(settings.maintenanceMode)}>
          </label>
          <label class="settings-toggle-row">
            <span><strong>Gửi thông báo email</strong><small>Tự động gửi thông báo cho quản trị viên khi có đơn hàng mới.</small></span>
            <input name="emailNotifications" type="checkbox" ${checked(settings.emailNotifications)}>
          </label>
        </section>

        <div class="settings-actions">
          <button class="ghost-button" type="reset">Hủy</button>
          <button class="primary-button" type="submit">Lưu thay đổi</button>
        </div>
      </form>
    `;
}

function renderSettingsPreservingMenuScroll() {
    const tableWrap = document.querySelector(".menu-manager-table-wrap");
    const tableScrollTop = tableWrap?.scrollTop || 0;
    const tableScrollLeft = tableWrap?.scrollLeft || 0;
    const pageScrollX = window.scrollX || 0;
    const pageScrollY = window.scrollY || 0;

    renderSettings();

    window.requestAnimationFrame(() => {
        const nextTableWrap = document.querySelector(".menu-manager-table-wrap");
        if (nextTableWrap) {
            nextTableWrap.scrollTop = tableScrollTop;
            nextTableWrap.scrollLeft = tableScrollLeft;
        }
        window.scrollTo(pageScrollX, pageScrollY);
    });
}

function collectSettings(form) {
    const data = new FormData(form);
    return {
        ...DEFAULT_SETTINGS,
        storeName: String(data.get("storeName") || "").trim(),
        slogan: String(data.get("slogan") || "").trim(),
        supportEmail: String(data.get("supportEmail") || "").trim(),
        hotline: String(data.get("hotline") || "").trim(),
        address: String(data.get("address") || "").trim(),
        timezone: String(data.get("timezone") || DEFAULT_SETTINGS.timezone),
        currency: String(data.get("currency") || DEFAULT_SETTINGS.currency),
        language: String(data.get("language") || DEFAULT_SETTINGS.language),
        weekdayOpen: String(data.get("weekdayOpen") || DEFAULT_SETTINGS.weekdayOpen),
        weekdayClose: String(data.get("weekdayClose") || DEFAULT_SETTINGS.weekdayClose),
        weekendOpen: String(data.get("weekendOpen") || DEFAULT_SETTINGS.weekendOpen),
        weekendClose: String(data.get("weekendClose") || DEFAULT_SETTINGS.weekendClose),
        maintenanceMode: Boolean(data.get("maintenanceMode")),
        emailNotifications: Boolean(data.get("emailNotifications")),
        logoDataUrl: String(data.get("logoDataUrl") || "")
    };
}

function closeMenuModal() {
    document.querySelector("#settingsMenuModal")?.remove();
}

function updateMenuRouteField(form) {
    if (!form) return;
    const routeInput = form.querySelector("[data-settings-menu-route]");
    const labelInput = form.querySelector("[name='label']");
    const typeInput = form.querySelector("[name='type']");
    const parentInput = form.querySelector("[name='parentId']");
    if (!routeInput || !labelInput || routeInput.dataset.userEdited === "true") return;

    routeInput.value = createMenuRoute(labelInput.value, typeInput?.value || "main", parentInput?.value || "");
}

function renderMenuModal(item = null) {
    const items = normalizeMenuPositions(readMenuItems());
    const isEditing = Boolean(item);
    const menuType = item?.type || "main";
    const active = item?.isActive ?? true;
    const isChild = menuType === "child";
    const mainMenuCount = items.filter((entry) => entry.type !== "child").length;
    const selectedIcon = normalizeMenuIcon(item?.icon, item || {});
    const routeValue = item?.route || createMenuRoute(item?.label || "", menuType, item?.parentId || "");

    closeMenuModal();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-backdrop settings-menu-modal-backdrop" id="settingsMenuModal">
        <div class="modal-card settings-menu-modal">
          <button class="modal-close-button" type="button" data-settings-menu-action="close-modal">×</button>
          <h2>${isEditing ? "Sửa menu chức năng" : "Thêm menu chức năng"}</h2>
          <form id="settingsMenuForm" class="settings-menu-form">
            <input type="hidden" name="id" value="${escapeHtml(item?.id || "")}">
            <label class="span-2">
              <span>Loại menu</span>
              <select name="type" data-settings-menu-type>
                <option value="main" ${menuType === "main" ? "selected" : ""}>Menu chính</option>
                <option value="child" ${menuType === "child" ? "selected" : ""}>Menu con</option>
              </select>
            </label>
            <label class="span-2 settings-menu-parent-field ${menuType === "child" ? "" : "hidden"}">
              <span>Menu cha</span>
              <select name="parentId">${getParentMenuOptions(items, item?.parentId || "")}</select>
            </label>
            <label>
              <span>Tên menu</span>
              <input name="label" value="${escapeHtml(item?.label || "")}" placeholder="Ví dụ: Khuyến mãi, Sản phẩm mới..." required>
            </label>
            <label class="settings-menu-icon-field">
              <span>Biểu tượng</span>
              <div class="settings-menu-icon-select-row">
                <span class="settings-menu-icon-preview" data-settings-menu-icon-preview>${renderAppIcon(selectedIcon)}</span>
                <select name="icon" data-settings-menu-icon-select>${getIconOptions(selectedIcon)}</select>
              </div>
            </label>
            <label>
              <span>Route</span>
              <input name="route" value="${escapeHtml(routeValue)}" placeholder="Tự tạo theo tên menu" readonly data-settings-menu-route>
            </label>
            <label class="settings-menu-position-field ${isChild ? "hidden" : ""}">
              <span>Vị trí hiển thị</span>
              <input name="position" type="number" min="1" max="${mainMenuCount + (isEditing ? 0 : 1)}" step="1" value="${escapeHtml(String(item?.position || mainMenuCount + 1))}" ${isChild ? "disabled" : ""}>
            </label>
            <label class="span-2">
              <span>Mô tả ngắn</span>
              <input name="subtitle" value="${escapeHtml(item?.subtitle || "")}" placeholder="Ví dụ: PROMOTION CENTER">
            </label>
            <label class="settings-menu-status span-2">
              <span><strong>Trạng thái</strong><small>Hiển thị trên thanh điều hướng</small></span>
              <input name="isActive" type="checkbox" ${checked(active)}>
            </label>
            <div class="settings-menu-modal-actions span-2">
              <button class="ghost-button" type="button" data-settings-menu-action="close-modal">Hủy</button>
              <button class="primary-button" type="submit">${isEditing ? "Lưu thay đổi" : "Lưu menu"}</button>
            </div>
          </form>
        </div>
      </div>
    `);
}

function collectMenuPayload(form) {
    const data = new FormData(form);
    const label = String(data.get("label") || "").trim();
    const type = String(data.get("type") || "main");
    const parentId = type === "child" ? String(data.get("parentId") || "").trim() : "";
    const route = String(data.get("route") || "").trim() || createMenuRoute(label, type, parentId);
    return {
        id: String(data.get("id") || "").trim() || createMenuId(label),
        parentId,
        type,
        label: cleanMenuText(label),
        subtitle: cleanMenuText(data.get("subtitle")) || (type === "child" ? "MENU CON" : "MENU CHÍNH"),
        icon: normalizeMenuIcon(String(data.get("icon") || ""), { label, route }),
        route,
        position: type === "child" ? 1 : Math.max(1, Number(data.get("position") || 1)),
        isActive: Boolean(data.get("isActive")),
        locked: false,
        source: "custom"
    };
}

function saveMenuPayload(payload) {
    if (!payload.label || !payload.route) {
        throw new Error("Vui lòng nhập tên menu và route.");
    }
    if (payload.type === "child" && !payload.parentId) {
        throw new Error("Vui lòng chọn menu cha cho menu con.");
    }
    let items = normalizeMenuPositions(readMenuItems());
    const index = items.findIndex((item) => String(item.id) === String(payload.id));
    if (index >= 0) {
        const previous = items[index];
        items[index] = { ...items[index], ...payload };
        if (previous.type !== "child" && payload.type !== "child") {
            items = normalizeMenuPositions(items, payload.id, payload.position);
        } else if (previous.type !== "child" && payload.type === "child") {
            items = normalizeMenuPositions(items.filter((item) => String(item.id) !== String(payload.id)));
            items.push({ ...payload, position: 1 });
        } else {
            items = normalizeMenuPositions(items);
        }
    } else {
        items.push(payload);
        if (payload.type !== "child") {
            items = normalizeMenuPositions(items, payload.id, payload.position);
        } else {
            items = normalizeMenuPositions(items);
        }
    }
    saveMenuItems(items);
}

function handleMenuAction(action, itemId) {
    const items = readMenuItems();
    const item = items.find((entry) => String(entry.id) === String(itemId));

    if (action === "open-create") {
        renderMenuModal();
        return;
    }

    if (action === "edit" && item) {
        renderMenuModal(item);
        return;
    }

    if (action === "toggle" && item) {
        item.isActive = !item.isActive;
        saveMenuItems(items);
        renderSidebarMenu();
        renderSettingsPreservingMenuScroll();
        return;
    }

    if (action === "delete" && item) {
        if (item.locked || item.source === "sidebar") {
            item.isActive = false;
            saveMenuItems(items);
            renderSidebarMenu();
            renderSettingsPreservingMenuScroll();
            return;
        }
        if (!window.confirm(`Xóa menu "${item.label}"?`)) return;
        saveMenuItems(items.filter((entry) => String(entry.id) !== String(itemId) && String(entry.parentId) !== String(itemId)));
        renderSidebarMenu();
        renderSettingsPreservingMenuScroll();
    }
}

export function bindSettingsEvents() {
    document.addEventListener("submit", (event) => {
        const form = event.target.closest("#generalSettingsForm");
        if (!form) return;
        event.preventDefault();
        saveSettings(collectSettings(form));
        renderSettings();
        showToast("Đã lưu thiết lập chung.");
    });

    document.addEventListener("submit", (event) => {
        const filterForm = event.target.closest("#settingsMenuFilterForm");
        if (filterForm) {
            event.preventDefault();
            const data = new FormData(filterForm);
            state.filters.settingsMenus = {
                keyword: String(data.get("keyword") || "").trim()
            };
            renderSettingsPreservingMenuScroll();
            return;
        }

        const menuForm = event.target.closest("#settingsMenuForm");
        if (!menuForm) return;
        event.preventDefault();
        try {
            saveMenuPayload(collectMenuPayload(menuForm));
            closeMenuModal();
            renderSidebarMenu();
            renderSettingsPreservingMenuScroll();
            showToast("Đã lưu menu chức năng.");
        } catch (error) {
            showToast(error.message || "Không thể lưu menu.", true);
        }
    });

    document.addEventListener("click", (event) => {
        const closeButton = event.target.closest("[data-settings-menu-action='close-modal']");
        if (closeButton || event.target?.id === "settingsMenuModal") {
            closeMenuModal();
            return;
        }

        const button = event.target.closest("[data-settings-menu-action]");
        if (!button) return;
        handleMenuAction(button.dataset.settingsMenuAction, button.dataset.id);
    });

    document.addEventListener("change", (event) => {
        const typeSelect = event.target.closest("[data-settings-menu-type]");
        const iconSelect = event.target.closest("[data-settings-menu-icon-select]");
        const parentSelect = event.target.closest("#settingsMenuForm [name='parentId']");

        if (typeSelect) {
            const form = typeSelect.closest("#settingsMenuForm");
            const isChild = typeSelect.value === "child";
            form?.querySelector(".settings-menu-parent-field")?.classList.toggle("hidden", !isChild);
            form?.querySelector(".settings-menu-position-field")?.classList.toggle("hidden", isChild);
            const positionInput = form?.querySelector("[name='position']");
            if (positionInput) positionInput.disabled = isChild;
            updateMenuRouteField(form);
        }

        if (iconSelect) {
            const preview = iconSelect.closest(".settings-menu-icon-select-row")?.querySelector("[data-settings-menu-icon-preview]");
            if (preview) {
                preview.innerHTML = renderAppIcon(normalizeMenuIcon(iconSelect.value));
            }
        }

        if (parentSelect) {
            updateMenuRouteField(parentSelect.closest("#settingsMenuForm"));
        }
    });

    document.addEventListener("input", (event) => {
        const labelInput = event.target.closest("#settingsMenuForm [name='label']");
        if (!labelInput) return;
        updateMenuRouteField(labelInput.closest("#settingsMenuForm"));
    });

    document.addEventListener("reset", (event) => {
        const form = event.target.closest("#generalSettingsForm");
        if (!form) return;
        window.setTimeout(renderSettings, 0);
    });

    document.addEventListener("change", (event) => {
        const input = event.target.closest("#generalSettingsForm input[name='logo']");
        if (!input) return;
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast("Logo tối đa 2MB.", true);
            input.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const form = input.closest("#generalSettingsForm");
            if (!form) return;
            form.elements.logoDataUrl.value = String(reader.result || "");
            const settings = collectSettings(form);
            settings.logoDataUrl = form.elements.logoDataUrl.value;
            saveSettings(settings);
            renderSettings();
        };
        reader.readAsDataURL(file);
    });
}
