import {
    apiFetch,
    elements,
    escapeHtml,
    formatCurrency,
    resolveMediaUrl,
    showToast,
    state
} from "./core.js";

const CHAT_QUICK_REPLIES = [
    "Hẹn giờ giao hàng",
    "Chính sách đổi trả",
    "Xác nhận đơn hàng",
    "Gửi bảng giá sỉ",
    "Khuyến mãi hôm nay"
];

const CHAT_POLL_INTERVAL_MS = 8000;
const CHAT_PRODUCT_META_PREFIX = "[[CHAT_PRODUCT]]";

let chatPollTimerId = 0;
let isChatLoading = false;
let chatProductPickerOpen = false;
let chatProductPickerSearch = "";

function defaultChatAvatar(name = "KH") {
    const label = String(name || "KH").trim().slice(0, 2).toUpperCase();
    return "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#eff7eb"/>
            <stop offset="100%" stop-color="#d9ead7"/>
          </linearGradient>
        </defs>
        <rect width="80" height="80" rx="26" fill="url(#g)"/>
        <text x="50%" y="54%" text-anchor="middle" font-family="Arial" font-size="26" font-weight="700" fill="#157344">${label}</text>
      </svg>
    `);
}

function getConversationCustomer(conversation) {
    return conversation?.customer || conversation?.khach_hang || null;
}

function getConversationAssignedStaff(conversation) {
    return conversation?.assigned_staff || conversation?.nhan_vien_phu_trach || null;
}

function getChatConversationById(conversationId) {
    return (state.chatConversations || []).find((conversation) => Number(conversation.id) === Number(conversationId)) || null;
}

function getActiveChatConversation() {
    return getChatConversationById(state.chatCurrentConversationId);
}

function replaceConversation(nextConversation) {
    if (!nextConversation?.id) return;

    const conversations = Array.isArray(state.chatConversations) ? [...state.chatConversations] : [];
    const targetIndex = conversations.findIndex((conversation) => Number(conversation.id) === Number(nextConversation.id));

    if (targetIndex >= 0) {
        conversations[targetIndex] = nextConversation;
    } else {
        conversations.unshift(nextConversation);
    }

    conversations.sort((left, right) => {
        const leftTime = new Date(left.last_message_at || left.updated_at || 0).getTime();
        const rightTime = new Date(right.last_message_at || right.updated_at || 0).getTime();
        return rightTime - leftTime;
    });

    state.chatConversations = conversations;
}

function getFilteredChatConversations() {
    const keyword = String(state.chatSearch || "").trim().toLowerCase();
    const statusFilter = String(state.chatStatusFilter || "open");

    return (state.chatConversations || []).filter((conversation) => {
        if (statusFilter !== "all" && conversation.status !== statusFilter) {
            return false;
        }

        if (!keyword) return true;

        const customer = getConversationCustomer(conversation);
        const haystack = [
            customer?.username,
            customer?.email,
            conversation.subject,
            conversation.last_message_preview
        ].join(" ").toLowerCase();

        return haystack.includes(keyword);
    });
}

function syncChatSelection() {
    const filtered = getFilteredChatConversations();
    if (!filtered.length) {
        state.chatCurrentConversationId = null;
        state.chatMessages = [];
        return;
    }

    if (!getChatConversationById(state.chatCurrentConversationId) || !filtered.some((conversation) => Number(conversation.id) === Number(state.chatCurrentConversationId))) {
        state.chatCurrentConversationId = filtered[0].id;
        state.chatMessages = [];
    }
}

function formatChatClock(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function formatChatListTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return formatChatClock(date);

    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${Math.max(1, diffHours)} giờ trước`;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `${Math.max(1, diffDays)} ngày trước`;

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit"
    }).format(date);
}

function formatChatDayLabel(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return "Hôm nay";
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return "Hôm qua";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit"
    }).format(date);
}

function isOutgoingMessage(message) {
    return Number(message?.sender_id) === Number(state.user?.id);
}

function getMessageReadStateLabel(message) {
    if (!isOutgoingMessage(message)) return "";
    return message?.is_read ? "Đã xem" : "Đã gửi";
}

function getProductShareablePrice(product) {
    return Number(
        product?.current_price ||
        product?.sale_price ||
        product?.price ||
        0
    );
}

function getProductShareableImage(product) {
    if (product?.thumbnail_url) return product.thumbnail_url;
    if (Array.isArray(product?.images) && product.images[0]?.image_url) {
        return product.images[0].image_url;
    }
    return "";
}

function buildProductShareContent(product) {
    const payload = {
        id: Number(product.id),
        name: String(product.name || "").trim(),
        sku: String(product.sku || "").trim(),
        slug: String(product.slug || "").trim(),
        price: getProductShareablePrice(product),
        price_label: formatCurrency(getProductShareablePrice(product)),
        unit: String(product.sale_unit || product.stock_unit || "").trim(),
        image_url: getProductShareableImage(product)
    };

    const caption = `Sản phẩm tham khảo: ${payload.name}`;
    return `${caption}\n${CHAT_PRODUCT_META_PREFIX}${JSON.stringify(payload)}`;
}

function parseSharedProductMessage(rawContent) {
    const source = String(rawContent || "");
    const markerIndex = source.indexOf(CHAT_PRODUCT_META_PREFIX);

    if (markerIndex === -1) {
        return {
            text: source,
            product: null
        };
    }

    const text = source.slice(0, markerIndex).trim();
    const rawMeta = source.slice(markerIndex + CHAT_PRODUCT_META_PREFIX.length).trim();

    try {
        const product = JSON.parse(rawMeta);
        if (!product || !product.id || !product.name) {
            return { text, product: null };
        }
        return { text, product };
    } catch (_error) {
        return { text: source, product: null };
    }
}

function isImageUrl(url) {
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(String(url || ""));
}

function getShareableProducts() {
    return (Array.isArray(state.products) ? state.products : [])
        .filter((product) => product && product.id && product.name)
        .filter((product) => product.status !== "archived");
}

function getFilteredShareableProducts() {
    const keyword = String(chatProductPickerSearch || "").trim().toLowerCase();
    if (!keyword) return getShareableProducts();

    return getShareableProducts().filter((product) => {
        const haystack = [
            product.name,
            product.sku,
            product.slug
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
    });
}

function buildSharedProductCardMarkup(product, ownMessage = false) {
    const imageUrl = resolveMediaUrl(product.image_url || getProductShareableImage(product), defaultChatAvatar(product.name || "SP"));
    const unitLabel = product.unit ? `/${product.unit}` : "";

    return `
      <article class="chat-product-card ${ownMessage ? "is-outgoing" : "is-incoming"}">
        <img class="chat-product-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Sản phẩm")}">
        <div class="chat-product-card-copy">
          <strong>${escapeHtml(product.name || "Sản phẩm tham khảo")}</strong>
          <span>${escapeHtml(product.sku || "Không có SKU")}</span>
          <b>${escapeHtml(product.price_label || formatCurrency(product.price || 0))}${escapeHtml(unitLabel)}</b>
        </div>
      </article>
    `;
}

function buildChatConversationCard(conversation) {
    const customer = getConversationCustomer(conversation);
    const assignedStaff = getConversationAssignedStaff(conversation);
    const isActive = Number(conversation.id) === Number(state.chatCurrentConversationId);
    const unreadCount = Number(conversation.unread_count || 0);
    const avatarUrl = resolveMediaUrl(customer?.avatar_url, defaultChatAvatar(customer?.username));

    return `
      <button class="chat-conversation-card ${isActive ? "is-active" : ""}" type="button" data-chat-action="select-conversation" data-id="${conversation.id}">
        <img class="chat-conversation-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(customer?.username || "Khách hàng")}">
        <div class="chat-conversation-copy">
          <div class="chat-conversation-top">
            <strong>${escapeHtml(customer?.username || "Khách hàng")}</strong>
            <span>${escapeHtml(formatChatListTime(conversation.last_message_at || conversation.updated_at || conversation.created_at))}</span>
          </div>
          <span class="chat-conversation-preview">${escapeHtml(conversation.last_message_preview || conversation.subject || "Bắt đầu hội thoại hỗ trợ")}</span>
          <div class="chat-conversation-meta">
            <span class="chat-status-dot ${conversation.status === "open" ? "is-open" : "is-closed"}"></span>
            <span>${escapeHtml(conversation.status === "open" ? `Đang mở${assignedStaff?.username ? ` • ${assignedStaff.username}` : ""}` : "Đã xử lý")}</span>
          </div>
        </div>
        ${unreadCount > 0 ? `<span class="chat-unread-badge">${unreadCount}</span>` : ""}
      </button>
    `;
}

function buildChatMessagesMarkup(messages) {
    if (!messages.length) {
        return `
          <div class="chat-empty-thread">
            <strong>Chưa có tin nhắn nào.</strong>
            <span>Hãy gửi phản hồi đầu tiên để bắt đầu hỗ trợ khách hàng.</span>
          </div>
        `;
    }

    let lastDayKey = "";

    return messages.map((message) => {
        const date = new Date(message.created_at || message.ngay_tao || Date.now());
        const dayKey = Number.isNaN(date.getTime()) ? String(message.id) : date.toDateString();
        const sender = message.sender || message.nguoi_gui || {};
        const own = isOutgoingMessage(message);
        const avatarUrl = resolveMediaUrl(sender.avatar_url, defaultChatAvatar(sender.username || "KH"));
        const readState = getMessageReadStateLabel(message);
        const parsedMessage = parseSharedProductMessage(message.content || "");
        const attachmentUrl = message.attachment_url ? resolveMediaUrl(message.attachment_url) : "";
        const messageType = String(message.message_type || "");
        const hasImageAttachment = attachmentUrl && (messageType === "image" || isImageUrl(attachmentUrl));
        const dividerMarkup = lastDayKey !== dayKey
            ? `<div class="chat-day-divider"><span>${escapeHtml(formatChatDayLabel(date))}</span></div>`
            : "";

        lastDayKey = dayKey;

        return `
          ${dividerMarkup}
          <div class="chat-message-row ${own ? "is-outgoing" : "is-incoming"}">
            ${own ? "" : `<img class="chat-message-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(sender.username || "Khách hàng")}">`}
            <article class="chat-message-bubble ${own ? "is-outgoing" : "is-incoming"}">
              ${parsedMessage.product ? buildSharedProductCardMarkup(parsedMessage.product, own) : ""}
              ${hasImageAttachment ? `<img class="chat-message-image" src="${escapeHtml(attachmentUrl)}" alt="Ảnh đính kèm">` : ""}
              ${parsedMessage.text ? `<p>${escapeHtml(parsedMessage.text)}</p>` : ""}
              ${attachmentUrl && !hasImageAttachment ? `<a class="chat-message-attachment" href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noreferrer">Mở tệp đính kèm</a>` : ""}
            </article>
          </div>
          <div class="chat-message-meta ${own ? "is-outgoing" : "is-incoming"}">
            <span>${escapeHtml(formatChatClock(message.created_at || message.ngay_tao))}</span>
            ${readState ? `<span>${escapeHtml(readState)}</span>` : ""}
          </div>
        `;
    }).join("");
}

function renderChatComposer(conversation) {
    const isClosed = conversation?.status === "closed";

    if (!conversation) {
        return `
          <div class="chat-composer-locked">
            <strong>Chọn một hội thoại ở bên trái để bắt đầu.</strong>
          </div>
        `;
    }

    if (isClosed) {
        return `
          <div class="chat-composer-locked">
            <strong>Hội thoại này đã được đánh dấu đã xử lý.</strong>
            <button class="ghost-button" type="button" data-chat-action="reopen-conversation">Mở lại hội thoại</button>
          </div>
        `;
    }

    return `
      <form class="chat-composer-form" id="chatComposerForm">
        <div class="chat-quick-replies">
          ${CHAT_QUICK_REPLIES.map((reply) => `<button class="chat-quick-reply" type="button" data-chat-action="insert-quick-reply" data-reply="${escapeHtml(reply)}">${escapeHtml(reply)}</button>`).join("")}
        </div>

        <div class="chat-composer-input-row">
          <button class="chat-icon-button" type="button" data-chat-action="attach-image" aria-label="Gửi ảnh">Ảnh</button>
          <button class="chat-icon-button" type="button" data-chat-action="open-product-picker" aria-label="Gửi sản phẩm">SP</button>
          <textarea name="content" rows="1" data-chat-input="draft" placeholder="Nhập tin nhắn hỗ trợ...">${escapeHtml(state.chatMessageDraft || "")}</textarea>
          <button class="chat-send-button" type="submit" ${!String(state.chatMessageDraft || "").trim() ? "disabled" : ""}>Gửi</button>
        </div>
      </form>
    `;
}

function buildChatProductPickerItem(product) {
    const imageUrl = resolveMediaUrl(getProductShareableImage(product), defaultChatAvatar(product.name || "SP"));
    return `
      <article class="chat-product-picker-item">
        <img class="chat-product-picker-item-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "Sản phẩm")}">
        <div class="chat-product-picker-item-copy">
          <strong>${escapeHtml(product.name || "Sản phẩm")}</strong>
          <span>${escapeHtml(product.sku || "Không có SKU")}</span>
          <b>${escapeHtml(formatCurrency(getProductShareablePrice(product)))}</b>
        </div>
        <button class="secondary-button" type="button" data-chat-action="send-product-reference" data-product-id="${product.id}">Gửi</button>
      </article>
    `;
}

function renderChatProductPicker() {
    if (!chatProductPickerOpen) return "";

    const products = getFilteredShareableProducts();
    return `
      <div class="chat-product-picker-overlay">
        <div class="chat-product-picker-modal" data-chat-modal="product-picker">
          <div class="chat-product-picker-header">
            <h3>Gửi sản phẩm tham khảo</h3>
            <button class="ghost-button" type="button" data-chat-action="close-product-picker">Đóng</button>
          </div>
          <label class="chat-product-picker-search">
            <span>⌕</span>
            <input type="search" data-chat-input="product-search" placeholder="Tìm theo tên hoặc SKU..." value="${escapeHtml(chatProductPickerSearch)}">
          </label>
          <div class="chat-product-picker-list">
            ${products.map((product) => buildChatProductPickerItem(product)).join("") || '<div class="chat-product-picker-empty">Không tìm thấy sản phẩm phù hợp.</div>'}
          </div>
        </div>
      </div>
    `;
}

function renderChatDetail() {
    const conversation = getActiveChatConversation();
    const customer = getConversationCustomer(conversation);
    const assignedStaff = getConversationAssignedStaff(conversation);
    const avatarUrl = resolveMediaUrl(customer?.avatar_url, defaultChatAvatar(customer?.username || "KH"));

    if (!conversation) {
        return `
          <section class="chat-detail-empty">
            <strong>Chưa có hội thoại phù hợp.</strong>
            <span>Khi khách hàng gửi tin nhắn, danh sách hội thoại sẽ xuất hiện ở đây.</span>
          </section>
        `;
    }

    return `
      <section class="chat-detail-shell">
        <header class="chat-detail-header">
          <div class="chat-detail-header-main">
            <img class="chat-detail-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(customer?.username || "Khách hàng")}">
            <div class="chat-detail-copy">
              <h3>${escapeHtml(customer?.username || "Khách hàng")}</h3>
              <p>${escapeHtml(conversation.status === "open" ? `Đang hoạt động${assignedStaff?.username ? ` • ${assignedStaff.username}` : ""}` : "Hội thoại đã xử lý")}</p>
            </div>
          </div>
          <div class="chat-detail-actions">
            <span class="chat-status-pill ${conversation.status === "open" ? "is-open" : "is-closed"}">${escapeHtml(conversation.status === "open" ? "Active" : "Resolved")}</span>
            <button class="ghost-button" type="button" data-chat-action="${conversation.status === "open" ? "resolve-conversation" : "reopen-conversation"}">
              ${escapeHtml(conversation.status === "open" ? "Đánh dấu đã xử lý" : "Mở lại")}
            </button>
          </div>
        </header>

        <div class="chat-message-thread" id="chatMessageThread">
          ${buildChatMessagesMarkup(state.chatMessages || [])}
        </div>

        ${renderChatComposer(conversation)}
      </section>
    `;
}

export function renderChats() {
    if (!elements.chatsContent) return;

    const conversations = getFilteredChatConversations();
    const openCount = (state.chatConversations || []).filter((conversation) => conversation.status === "open").length;
    const closedCount = (state.chatConversations || []).filter((conversation) => conversation.status === "closed").length;

    elements.chatsContent.innerHTML = `
      <section class="chat-workspace">
        <aside class="chat-sidebar">
          <div class="chat-sidebar-header">
            <div>
              <p class="eyebrow">Support</p>
              <h2>Chat khách hàng</h2>
              <p class="section-copy">Theo dõi hội thoại đang mở và phản hồi khách hàng ngay trong admin.</p>
            </div>
            <button class="secondary-button" type="button" data-chat-action="refresh-conversations">Làm mới</button>
          </div>

          <label class="chat-search-bar">
            <span>⌕</span>
            <input type="search" value="${escapeHtml(state.chatSearch || "")}" data-chat-input="search" placeholder="Tìm kiếm cuộc hội thoại...">
          </label>

          <div class="chat-filter-tabs">
            <button class="chat-filter-tab ${state.chatStatusFilter === "open" ? "is-active" : ""}" type="button" data-chat-action="set-status-filter" data-status="open">Active (${openCount})</button>
            <button class="chat-filter-tab ${state.chatStatusFilter === "closed" ? "is-active" : ""}" type="button" data-chat-action="set-status-filter" data-status="closed">Resolved (${closedCount})</button>
          </div>

          <div class="chat-conversation-list">
            ${conversations.map((conversation) => buildChatConversationCard(conversation)).join("") || '<article class="chat-empty-list"><strong>Không có hội thoại phù hợp.</strong><span>Thử đổi tab hoặc từ khóa tìm kiếm.</span></article>'}
          </div>
        </aside>

        <div class="chat-detail-panel">
          ${renderChatDetail()}
        </div>
      </section>
      ${renderChatProductPicker()}
    `;
}

async function markActiveConversationAsRead() {
    const conversation = getActiveChatConversation();
    if (!conversation) return;

    const hasUnreadFromCustomer = (state.chatMessages || []).some((message) => !isOutgoingMessage(message) && !message.is_read);
    if (!hasUnreadFromCustomer) return;

    await apiFetch(`/api/chat/conversations/${conversation.id}/read`, {
        method: "POST"
    });

    state.chatMessages = (state.chatMessages || []).map((message) => (
        isOutgoingMessage(message)
            ? message
            : { ...message, is_read: true, read_at: new Date().toISOString() }
    ));

    replaceConversation({
        ...conversation,
        unread_count: 0
    });
}

async function loadMessagesForActiveConversation() {
    const conversation = getActiveChatConversation();
    if (!conversation) {
        state.chatMessages = [];
        return;
    }

    const payload = await apiFetch(`/api/chat/conversations/${conversation.id}/messages?limit=100`);
    state.chatMessages = Array.isArray(payload?.messages) ? payload.messages : [];

    if (payload?.conversation) {
        replaceConversation(payload.conversation);
    }

    await markActiveConversationAsRead();
}

async function refreshChats({ loadMessages = true } = {}) {
    const conversations = await apiFetch("/api/chat/conversations");
    state.chatConversations = Array.isArray(conversations) ? conversations : [];
    syncChatSelection();

    if (loadMessages) {
        await loadMessagesForActiveConversation();
    }

    renderChats();
}

function scrollChatThreadToBottom() {
    const thread = document.querySelector("#chatMessageThread");
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
}

function scheduleChatPolling() {
    window.clearInterval(chatPollTimerId);
    chatPollTimerId = window.setInterval(async () => {
        if (elements.panels.chats?.classList.contains("hidden")) return;
        if (isChatLoading) return;

        try {
            isChatLoading = true;
            await refreshChats({ loadMessages: true });
        } catch (error) {
            console.warn("Không thể đồng bộ chat:", error);
        } finally {
            isChatLoading = false;
        }
    }, CHAT_POLL_INTERVAL_MS);
}

export async function activateChatsPanel() {
    try {
        isChatLoading = true;
        await refreshChats({ loadMessages: true });
        scheduleChatPolling();
        window.setTimeout(scrollChatThreadToBottom, 0);
    } catch (error) {
        showToast(error.message || "Không thể tải hội thoại khách hàng.", true);
    } finally {
        isChatLoading = false;
    }
}

export function deactivateChatsPanel() {
    window.clearInterval(chatPollTimerId);
}

async function uploadChatImageAndSend(activeConversation, file) {
    const formData = new FormData();
    formData.append("image", file);
    const uploadResult = await apiFetch("/api/uploads/images?folder=chat", {
        method: "POST",
        body: formData
    });

    const uploadedUrl = (
        uploadResult?.file?.url ||
        uploadResult?.hinh_anh?.url ||
        uploadResult?.file?.duong_dan ||
        uploadResult?.hinh_anh?.duong_dan ||
        uploadResult?.files?.[0]?.url ||
        uploadResult?.files?.[0]?.duong_dan
    );

    if (!uploadedUrl) {
        throw new Error("Tải ảnh thành công nhưng không lấy được đường dẫn ảnh.");
    }

    const caption = String(state.chatMessageDraft || "").trim();
    await apiFetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
            message_type: "image",
            content: caption || "Shop gửi bạn hình ảnh tham khảo.",
            attachment_url: uploadedUrl
        })
    });

    state.chatMessageDraft = "";
}

export async function handleChatAction(button) {
    const action = button.dataset.chatAction;
    const conversationId = button.dataset.id;
    const status = button.dataset.status;
    const reply = button.dataset.reply;
    const activeConversation = getActiveChatConversation();

    if (action === "refresh-conversations") {
        await activateChatsPanel();
        return;
    }

    if (action === "set-status-filter") {
        state.chatStatusFilter = status || "open";
        syncChatSelection();
        if (state.chatCurrentConversationId) {
            await loadMessagesForActiveConversation();
        }
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "select-conversation") {
        state.chatCurrentConversationId = Number(conversationId);
        state.chatMessageDraft = "";
        await loadMessagesForActiveConversation();
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "insert-quick-reply") {
        const prefix = state.chatMessageDraft && !state.chatMessageDraft.endsWith(" ") ? `${state.chatMessageDraft} ` : state.chatMessageDraft;
        state.chatMessageDraft = `${prefix}${reply || ""}`.trim();
        renderChats();
        return;
    }

    if (action === "open-product-picker") {
        chatProductPickerOpen = true;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "close-product-picker") {
        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "send-product-reference") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi sản phẩm.");
        }

        const productId = Number(button.dataset.productId);
        const product = getShareableProducts().find((item) => Number(item.id) === productId);
        if (!product) {
            throw new Error("Không tìm thấy sản phẩm để gửi.");
        }

        await apiFetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
            method: "POST",
            body: JSON.stringify({
                content: buildProductShareContent(product)
            })
        });

        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        state.chatMessageDraft = "";
        await refreshChats({ loadMessages: true });
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "attach-image") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi ảnh.");
        }

        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/jpeg,image/png,image/webp,image/gif";

        const file = await new Promise((resolve) => {
            picker.addEventListener("change", () => resolve(picker.files?.[0] || null), { once: true });
            picker.click();
        });

        if (!file) return;

        await uploadChatImageAndSend(activeConversation, file);
        await refreshChats({ loadMessages: true });
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "resolve-conversation" || action === "reopen-conversation") {
        if (!activeConversation) return;
        const nextStatus = action === "resolve-conversation" ? "closed" : "open";
        const updatedConversation = await apiFetch(`/api/chat/conversations/${activeConversation.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus })
        });
        replaceConversation(updatedConversation);
        if (nextStatus === "closed") {
            state.chatMessageDraft = "";
        }
        if (state.chatStatusFilter !== "all" && state.chatStatusFilter !== nextStatus) {
            syncChatSelection();
            await loadMessagesForActiveConversation();
        }
        renderChats();
        return;
    }
}

export function handleChatInput(target) {
    const inputType = target.dataset.chatInput;

    if (inputType === "search") {
        state.chatSearch = String(target.value || "");
        renderChats();
        return;
    }

    if (inputType === "product-search") {
        chatProductPickerSearch = String(target.value || "");
        renderChats();
        return;
    }

    if (inputType === "draft") {
        state.chatMessageDraft = String(target.value || "");
        const sendButton = document.querySelector(".chat-send-button");
        if (sendButton) {
            sendButton.disabled = !String(state.chatMessageDraft || "").trim();
        }

        const activeConversation = getActiveChatConversation();
        if (activeConversation?.status === "open") {
            if (String(state.chatMessageDraft || "").trim()) {
                scheduleChatTyping(activeConversation.id);
            } else {
                stopChatTyping(activeConversation.id);
            }
        }
    }
}

export async function submitChatComposer() {
    const conversation = getActiveChatConversation();
    const content = String(state.chatMessageDraft || "").trim();

    if (!conversation) {
        throw new Error("Vui lòng chọn hội thoại cần phản hồi.");
    }

    if (conversation.status === "closed") {
        throw new Error("Hội thoại này đã được đánh dấu đã xử lý. Hãy mở lại trước khi gửi.");
    }

    if (!content) {
        throw new Error("Vui lòng nhập nội dung tin nhắn.");
    }

    const message = await apiFetch(`/api/chat/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content })
    });

    stopChatTyping(conversation.id);

    if (message?.conversation) {
        replaceConversation(message.conversation);
    }

    state.chatMessages = [...(state.chatMessages || []), message];
    state.chatMessageDraft = "";
    renderChats();
    window.setTimeout(scrollChatThreadToBottom, 0);
}

CHAT_QUICK_REPLIES.splice(0, CHAT_QUICK_REPLIES.length, "Hẹn giờ giao hàng", "Chính sách đổi trả", "Xác nhận đơn hàng", "Gửi bảng giá sỉ", "Khuyến mãi hôm nay");

const scoreChatRepairText = (value) => {
    const source = String(value || "");
    const badMarkers = ["Ã", "Ä", "áº", "á»", "Æ", "Â", "â", "Ð", "Ñ", "�"];
    const vietnameseMatches = source.match(/[ĂÂÊÔƠƯĐăâêôơưđáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g) || [];
    const markerPenalty = badMarkers.reduce((total, marker) => total + (source.split(marker).length - 1) * 12, 0);
    const replacementPenalty = (source.match(/�/g) || []).length * 20;
    return markerPenalty + replacementPenalty - vietnameseMatches.length * 3;
};

const repairChatText = (value) => {
    const source = String(value || "");
    if (!source) return "";

    const suspects = ["Ã", "Ä", "áº", "á»", "Æ", "Â", "â", "Ð", "Ñ", "�"];
    if (!suspects.some((marker) => source.includes(marker))) {
        return source;
    }

    const candidates = new Set([source]);
    for (let round = 0; round < 3; round += 1) {
        for (const current of [...candidates]) {
            try {
                const bytes = Uint8Array.from(Array.from(current, (char) => char.charCodeAt(0) & 0xff));
                const repaired = new TextDecoder("utf-8").decode(bytes).replace(/\u00a0/g, " ").trim();
                if (repaired) {
                    candidates.add(repaired);
                }
            } catch (_error) {
                // Keep the original variant if this decode path fails.
            }
        }
    }

    return [...candidates].sort((left, right) => scoreChatRepairText(left) - scoreChatRepairText(right))[0] || source;
};

const getChatPreviewText = (conversation) => {
    const parsedPreview = parseSharedProductMessage(conversation?.last_message_preview || "");
    return repairChatText(parsedPreview.text || parsedPreview.product?.name || conversation?.subject || "Bắt đầu hội thoại hỗ trợ");
};

formatChatListTime = function formatChatListTimePatched(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return formatChatClock(date);

    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `${Math.max(1, diffHours)} giờ trước`;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `${Math.max(1, diffDays)} ngày trước`;

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit"
    }).format(date);
};

formatChatDayLabel = function formatChatDayLabelPatched(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Hôm nay";

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";

    return new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit"
    }).format(date);
};

getMessageReadStateLabel = function getMessageReadStateLabelPatched(message) {
    if (!isOutgoingMessage(message)) return "";
    return message?.is_read ? "Đã xem" : "Đã gửi";
};

buildProductShareContent = function buildProductShareContentPatched(product) {
    const payload = {
        id: Number(product.id),
        name: repairChatText(String(product.name || "").trim()),
        sku: repairChatText(String(product.sku || "").trim()),
        slug: String(product.slug || "").trim(),
        price: getProductShareablePrice(product),
        price_label: formatCurrency(getProductShareablePrice(product)),
        unit: String(product.sale_unit || product.stock_unit || "").trim(),
        image_url: getProductShareableImage(product)
    };

    const caption = `Sản phẩm tham khảo: ${payload.name}`;
    return `${caption}\n${CHAT_PRODUCT_META_PREFIX}${JSON.stringify(payload)}`;
};

buildSharedProductCardMarkup = function buildSharedProductCardMarkupPatched(product, ownMessage = false) {
    const imageUrl = resolveMediaUrl(product.image_url || getProductShareableImage(product), defaultChatAvatar(product.name || "SP"));
    const unitLabel = product.unit ? `/${repairChatText(product.unit)}` : "";

    return `
      <article class="chat-product-card ${ownMessage ? "is-outgoing" : "is-incoming"}">
        <img class="chat-product-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(repairChatText(product.name || "Sản phẩm"))}">
        <div class="chat-product-card-copy">
          <strong>${escapeHtml(repairChatText(product.name || "Sản phẩm tham khảo"))}</strong>
          <span>${escapeHtml(repairChatText(product.sku || "Không có SKU"))}</span>
          <b>${escapeHtml(product.price_label || formatCurrency(product.price || 0))}${escapeHtml(unitLabel)}</b>
        </div>
      </article>
    `;
};

buildChatConversationCard = function buildChatConversationCardPatched(conversation) {
    const customer = getConversationCustomer(conversation);
    const assignedStaff = getConversationAssignedStaff(conversation);
    const isActive = Number(conversation.id) === Number(state.chatCurrentConversationId);
    const unreadCount = Number(conversation.unread_count || 0);
    const customerName = repairChatText(customer?.username || "Khách hàng");
    const assignedStaffName = repairChatText(assignedStaff?.username || "");
    const avatarUrl = resolveMediaUrl(customer?.avatar_url, defaultChatAvatar(customerName));
    const statusText = conversation.status === "open"
        ? `Đang mở${assignedStaffName ? ` • ${assignedStaffName}` : ""}`
        : "Đã xử lý";

    return `
      <button class="chat-conversation-card ${isActive ? "is-active" : ""}" type="button" data-chat-action="select-conversation" data-id="${conversation.id}">
        <img class="chat-conversation-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(customerName)}">
        <div class="chat-conversation-copy">
          <div class="chat-conversation-top">
            <strong>${escapeHtml(customerName)}</strong>
            <span>${escapeHtml(formatChatListTime(conversation.last_message_at || conversation.updated_at || conversation.created_at))}</span>
          </div>
          <span class="chat-conversation-preview">${escapeHtml(getChatPreviewText(conversation))}</span>
          <div class="chat-conversation-meta">
            <span class="chat-status-dot ${conversation.status === "open" ? "is-open" : "is-closed"}"></span>
            <span>${escapeHtml(statusText)}</span>
          </div>
        </div>
        ${unreadCount > 0 ? `<span class="chat-unread-badge">${unreadCount}</span>` : ""}
      </button>
    `;
};

buildChatMessagesMarkup = function buildChatMessagesMarkupPatched(messages) {
    if (!messages.length) {
        return `
          <div class="chat-empty-thread">
            <strong>Chưa có tin nhắn nào.</strong>
            <span>Hãy gửi phản hồi đầu tiên để bắt đầu hỗ trợ khách hàng.</span>
          </div>
        `;
    }

    let lastDayKey = "";

    return messages.map((message) => {
        const date = new Date(message.created_at || message.ngay_tao || Date.now());
        const dayKey = Number.isNaN(date.getTime()) ? String(message.id) : date.toDateString();
        const sender = message.sender || message.nguoi_gui || {};
        const own = isOutgoingMessage(message);
        const senderName = repairChatText(sender.username || "Khách hàng");
        const avatarUrl = resolveMediaUrl(sender.avatar_url, defaultChatAvatar(senderName || "KH"));
        const readState = getMessageReadStateLabel(message);
        const parsedMessage = parseSharedProductMessage(message.content || "");
        const attachmentUrl = message.attachment_url ? resolveMediaUrl(message.attachment_url) : "";
        const messageType = String(message.message_type || "");
        const hasImageAttachment = attachmentUrl && (messageType === "image" || isImageUrl(attachmentUrl));
        const dividerMarkup = lastDayKey !== dayKey
            ? `<div class="chat-day-divider"><span>${escapeHtml(formatChatDayLabel(date))}</span></div>`
            : "";

        lastDayKey = dayKey;

        return `
          ${dividerMarkup}
          <div class="chat-message-row ${own ? "is-outgoing" : "is-incoming"}">
            ${own ? "" : `<img class="chat-message-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(senderName)}">`}
            <article class="chat-message-bubble ${own ? "is-outgoing" : "is-incoming"}">
              ${parsedMessage.product ? buildSharedProductCardMarkup(parsedMessage.product, own) : ""}
              ${hasImageAttachment ? `<img class="chat-message-image" src="${escapeHtml(attachmentUrl)}" alt="Ảnh đính kèm">` : ""}
              ${parsedMessage.text ? `<p>${escapeHtml(repairChatText(parsedMessage.text))}</p>` : ""}
              ${attachmentUrl && !hasImageAttachment ? `<a class="chat-message-attachment" href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noreferrer">Mở tệp đính kèm</a>` : ""}
            </article>
          </div>
          <div class="chat-message-meta ${own ? "is-outgoing" : "is-incoming"}">
            <span>${escapeHtml(formatChatClock(message.created_at || message.ngay_tao))}</span>
            ${readState ? `<span>${escapeHtml(readState)}</span>` : ""}
          </div>
        `;
    }).join("");
};

renderChatDetail = function renderChatDetailPatched() {
    const conversation = getActiveChatConversation();
    if (!conversation) {
        return `
          <section class="chat-detail-empty">
            <strong>Chưa có hội thoại phù hợp.</strong>
            <span>Khi khách hàng gửi tin nhắn, danh sách hội thoại sẽ xuất hiện ở đây.</span>
          </section>
        `;
    }

    const customer = getConversationCustomer(conversation);
    const assignedStaff = getConversationAssignedStaff(conversation);
    const customerName = repairChatText(customer?.username || "Khách hàng");
    const assignedStaffName = repairChatText(assignedStaff?.username || "");
    const avatarUrl = resolveMediaUrl(customer?.avatar_url, defaultChatAvatar(customerName));

    return `
      <section class="chat-detail-shell">
        <header class="chat-detail-header">
          <div class="chat-detail-header-main">
            <img class="chat-detail-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(customerName)}">
            <div class="chat-detail-copy">
              <h3>${escapeHtml(customerName)}</h3>
              <p>${escapeHtml(conversation.status === "open" ? `Đang hoạt động${assignedStaffName ? ` • ${assignedStaffName}` : ""}` : "Hội thoại đã xử lý")}</p>
            </div>
          </div>
          <div class="chat-detail-actions">
            <span class="chat-status-pill ${conversation.status === "open" ? "is-open" : "is-closed"}">${escapeHtml(conversation.status === "open" ? "Đang mở" : "Đã xử lý")}</span>
            <button class="ghost-button" type="button" data-chat-action="${conversation.status === "open" ? "resolve-conversation" : "reopen-conversation"}">
              ${escapeHtml(conversation.status === "open" ? "Đánh dấu đã xử lý" : "Mở lại")}
            </button>
          </div>
        </header>

        <div class="chat-message-thread" id="chatMessageThread">
          ${buildChatMessagesMarkup(state.chatMessages || [])}
        </div>

        ${renderChatComposer(conversation)}
      </section>
    `;
};

let chatThreadScrollIntent = "preserve";
let chatComposerShouldFocus = false;

function captureChatThreadScrollState() {
    const thread = document.querySelector("#chatMessageThread");
    if (!thread) return null;

    return {
        scrollTop: thread.scrollTop,
        clientHeight: thread.clientHeight,
        scrollHeight: thread.scrollHeight,
        nearBottom: thread.scrollHeight - thread.clientHeight - thread.scrollTop < 48
    };
}

function restoreChatThreadScrollState(snapshot) {
    const thread = document.querySelector("#chatMessageThread");
    const intent = chatThreadScrollIntent;
    chatThreadScrollIntent = "preserve";

    if (thread) {
        if (intent === "bottom" || (intent === "auto" && snapshot?.nearBottom)) {
            thread.scrollTop = thread.scrollHeight;
        } else if (snapshot) {
            const maxScrollTop = Math.max(0, thread.scrollHeight - thread.clientHeight);
            thread.scrollTop = Math.min(snapshot.scrollTop, maxScrollTop);
        }
    }

    if (chatComposerShouldFocus) {
        const composer = document.querySelector('[data-chat-input="draft"]');
        if (composer) {
            composer.focus();
            const length = composer.value.length;
            composer.setSelectionRange(length, length);
        }
        chatComposerShouldFocus = false;
    }
}

renderChats = function renderChatsPatched() {
    if (!elements.chatsContent) return;

    const scrollSnapshot = captureChatThreadScrollState();
    const conversations = getFilteredChatConversations();
    const openCount = (state.chatConversations || []).filter((conversation) => conversation.status === "open").length;
    const closedCount = (state.chatConversations || []).filter((conversation) => conversation.status === "closed").length;

    elements.chatsContent.innerHTML = `
      <section class="chat-workspace">
        <aside class="chat-sidebar">
          <div class="chat-sidebar-header">
            <div>
              <p class="eyebrow">Support</p>
              <h2>Chat khách hàng</h2>
              <p class="section-copy">Theo dõi hội thoại đang mở và phản hồi khách hàng ngay trong admin.</p>
            </div>
            <button class="secondary-button" type="button" data-chat-action="refresh-conversations">Làm mới</button>
          </div>

          <label class="chat-search-bar">
            <span>⌕</span>
            <input type="search" value="${escapeHtml(state.chatSearch || "")}" data-chat-input="search" placeholder="Tìm kiếm cuộc hội thoại...">
          </label>

          <div class="chat-filter-tabs">
            <button class="chat-filter-tab ${state.chatStatusFilter === "open" ? "is-active" : ""}" type="button" data-chat-action="set-status-filter" data-status="open">Đang mở (${openCount})</button>
            <button class="chat-filter-tab ${state.chatStatusFilter === "closed" ? "is-active" : ""}" type="button" data-chat-action="set-status-filter" data-status="closed">Đã xử lý (${closedCount})</button>
          </div>

          <div class="chat-conversation-list">
            ${conversations.map((conversation) => buildChatConversationCard(conversation)).join("") || '<article class="chat-empty-list"><strong>Không có hội thoại phù hợp.</strong><span>Thử đổi tab hoặc từ khóa tìm kiếm.</span></article>'}
          </div>
        </aside>

        <div class="chat-detail-panel">
          ${renderChatDetail()}
        </div>
      </section>
      ${renderChatProductPicker()}
    `;

    window.requestAnimationFrame(() => restoreChatThreadScrollState(scrollSnapshot));
};

uploadChatImageAndSend = async function uploadChatImageAndSendPatched(activeConversation, file) {
    const formData = new FormData();
    formData.append("image", file);
    const uploadResult = await apiFetch("/api/uploads/images?folder=chat", {
        method: "POST",
        body: formData
    });

    const uploadedUrl = (
        uploadResult?.file?.url ||
        uploadResult?.hinh_anh?.url ||
        uploadResult?.file?.duong_dan ||
        uploadResult?.hinh_anh?.duong_dan ||
        uploadResult?.files?.[0]?.url ||
        uploadResult?.files?.[0]?.duong_dan
    );

    if (!uploadedUrl) {
        throw new Error("Tải ảnh thành công nhưng không lấy được đường dẫn ảnh.");
    }

    const caption = String(state.chatMessageDraft || "").trim();
    await apiFetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
            message_type: "image",
            content: caption || "Shop gửi bạn hình ảnh tham khảo.",
            attachment_url: uploadedUrl
        })
    });

    state.chatMessageDraft = "";
};

handleChatAction = async function handleChatActionPatched(button) {
    const action = button.dataset.chatAction;
    const conversationId = button.dataset.id;
    const status = button.dataset.status;
    const reply = button.dataset.reply;
    const activeConversation = getActiveChatConversation();

    if (action === "refresh-conversations") {
        await activateChatsPanel();
        return;
    }

    if (action === "set-status-filter") {
        state.chatStatusFilter = status || "open";
        syncChatSelection();
        if (state.chatCurrentConversationId) {
            await loadMessagesForActiveConversation();
        }
        chatThreadScrollIntent = "bottom";
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "select-conversation") {
        state.chatCurrentConversationId = Number(conversationId);
        state.chatMessageDraft = "";
        await loadMessagesForActiveConversation();
        chatThreadScrollIntent = "bottom";
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "insert-quick-reply") {
        const prefix = state.chatMessageDraft && !state.chatMessageDraft.endsWith(" ") ? `${state.chatMessageDraft} ` : state.chatMessageDraft;
        state.chatMessageDraft = `${prefix}${reply || ""}`.trim();
        chatComposerShouldFocus = true;
        renderChats();
        return;
    }

    if (action === "open-product-picker") {
        chatProductPickerOpen = true;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "close-product-picker") {
        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "send-product-reference") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi sản phẩm.");
        }

        const productId = Number(button.dataset.productId);
        const product = getShareableProducts().find((item) => Number(item.id) === productId);
        if (!product) {
            throw new Error("Không tìm thấy sản phẩm để gửi.");
        }

        await apiFetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
            method: "POST",
            body: JSON.stringify({
                content: buildProductShareContent(product)
            })
        });

        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        state.chatMessageDraft = "";
        await refreshChats({ loadMessages: true });
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "attach-image") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi ảnh.");
        }

        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/jpeg,image/png,image/webp,image/gif";

        const file = await new Promise((resolve) => {
            picker.addEventListener("change", () => resolve(picker.files?.[0] || null), { once: true });
            picker.click();
        });

        if (!file) return;

        await uploadChatImageAndSend(activeConversation, file);
        await refreshChats({ loadMessages: true });
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "resolve-conversation" || action === "reopen-conversation") {
        if (!activeConversation) return;
        const nextStatus = action === "resolve-conversation" ? "closed" : "open";
        const updatedConversation = await apiFetch(`/api/chat/conversations/${activeConversation.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus })
        });
        replaceConversation(updatedConversation);
        if (nextStatus === "closed") {
            state.chatMessageDraft = "";
        }
        if (state.chatStatusFilter !== "all" && state.chatStatusFilter !== nextStatus) {
            syncChatSelection();
            await loadMessagesForActiveConversation();
        }
        renderChats();
    }
};

submitChatComposer = async function submitChatComposerPatched() {
    const conversation = getActiveChatConversation();
    const content = String(state.chatMessageDraft || "").trim();

    if (!conversation) {
        throw new Error("Vui lòng chọn hội thoại cần phản hồi.");
    }

    if (conversation.status === "closed") {
        throw new Error("Hội thoại này đã được đánh dấu đã xử lý. Hãy mở lại trước khi gửi.");
    }

    if (!content) {
        throw new Error("Vui lòng nhập nội dung tin nhắn.");
    }

    const message = await apiFetch(`/api/chat/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content })
    });

    stopChatTyping(conversation.id);

    if (message?.conversation) {
        replaceConversation(message.conversation);
    }

    state.chatMessages = [...(state.chatMessages || []), message];
    state.chatMessageDraft = "";
    chatThreadScrollIntent = "bottom";
    renderChats();
    window.setTimeout(scrollChatThreadToBottom, 0);
};

let chatRealtimeSocket = null;
let chatRealtimeScriptPromise = null;
let joinedRealtimeConversationId = null;
let chatTypingConversationId = null;
let chatTypingStopTimerId = 0;

function getSocketIoScriptUrl() {
    return `${state.apiBase}/socket.io/socket.io.js`;
}

function ensureSocketIoClientLoaded() {
    if (window.io) return Promise.resolve(window.io);
    if (chatRealtimeScriptPromise) return chatRealtimeScriptPromise;

    chatRealtimeScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-chat-socket-client="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(window.io), { once: true });
            existing.addEventListener("error", () => reject(new Error("Không thể tải Socket.IO client.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = getSocketIoScriptUrl();
        script.async = true;
        script.dataset.chatSocketClient = "true";
        script.onload = () => resolve(window.io);
        script.onerror = () => reject(new Error("Không thể tải Socket.IO client."));
        document.head.appendChild(script);
    });

    return chatRealtimeScriptPromise;
}

function emitChatTyping(conversationId, isTyping) {
    if (!chatRealtimeSocket?.connected) return;

    const normalizedConversationId = Number(conversationId);
    if (!Number.isInteger(normalizedConversationId) || normalizedConversationId <= 0) return;

    chatRealtimeSocket.emit("chat:typing", {
        conversation_id: normalizedConversationId,
        is_typing: Boolean(isTyping)
    });
}

function stopChatTyping(conversationId = chatTypingConversationId) {
    window.clearTimeout(chatTypingStopTimerId);
    chatTypingStopTimerId = 0;

    const normalizedConversationId = Number(conversationId);
    if (!Number.isInteger(normalizedConversationId) || normalizedConversationId <= 0) {
        chatTypingConversationId = null;
        return;
    }

    emitChatTyping(normalizedConversationId, false);
    if (Number(chatTypingConversationId) === normalizedConversationId) {
        chatTypingConversationId = null;
    }
}

function scheduleChatTyping(conversationId) {
    const normalizedConversationId = Number(conversationId);
    if (!Number.isInteger(normalizedConversationId) || normalizedConversationId <= 0) return;

    if (chatTypingConversationId && Number(chatTypingConversationId) !== normalizedConversationId) {
        stopChatTyping(chatTypingConversationId);
    }

    chatTypingConversationId = normalizedConversationId;
    emitChatTyping(normalizedConversationId, true);

    window.clearTimeout(chatTypingStopTimerId);
    chatTypingStopTimerId = window.setTimeout(() => {
        stopChatTyping(normalizedConversationId);
    }, 1400);
}

function upsertChatMessage(nextMessage) {
    const currentMessages = Array.isArray(state.chatMessages) ? [...state.chatMessages] : [];
    const targetIndex = currentMessages.findIndex((message) => Number(message.id) === Number(nextMessage?.id));

    if (targetIndex >= 0) {
        currentMessages[targetIndex] = nextMessage;
    } else {
        currentMessages.push(nextMessage);
    }

    currentMessages.sort((left, right) => {
        const leftTime = new Date(left.created_at || left.ngay_tao || left.updated_at || 0).getTime();
        const rightTime = new Date(right.created_at || right.ngay_tao || right.updated_at || 0).getTime();
        return leftTime - rightTime;
    });

    state.chatMessages = currentMessages;
}

function applyRealtimeReadPayload(payload) {
    if (!payload?.conversation_id) return;
    if (Number(payload.conversation_id) !== Number(state.chatCurrentConversationId)) return;

    state.chatMessages = (state.chatMessages || []).map((message) => {
        if (Number(message.sender_id) === Number(payload.reader_id)) {
            return message;
        }
        return {
            ...message,
            is_read: true,
            read_at: new Date().toISOString()
        };
    });

    const activeConversation = getActiveChatConversation();
    if (activeConversation) {
        replaceConversation({
            ...activeConversation,
            unread_count: 0
        });
    }
}

async function joinRealtimeConversation(conversationId) {
    if (!chatRealtimeSocket || !chatRealtimeSocket.connected) return;

    const nextConversationId = Number(conversationId);
    if (!Number.isInteger(nextConversationId) || nextConversationId <= 0) return;

    if (joinedRealtimeConversationId && joinedRealtimeConversationId !== nextConversationId) {
        await new Promise((resolve) => {
            chatRealtimeSocket.emit("chat:leave", { conversation_id: joinedRealtimeConversationId }, () => resolve());
        });
    }

    if (joinedRealtimeConversationId === nextConversationId) return;

    await new Promise((resolve) => {
        chatRealtimeSocket.emit("chat:join", { conversation_id: nextConversationId }, () => resolve());
    });
    joinedRealtimeConversationId = nextConversationId;
}

async function connectChatRealtime() {
    if (!state.token) return;
    if (chatRealtimeSocket?.connected) {
        await joinRealtimeConversation(state.chatCurrentConversationId);
        return;
    }

    const ioFactory = await ensureSocketIoClientLoaded();
    if (typeof ioFactory !== "function") {
        throw new Error("Socket.IO client không sẵn sàng.");
    }

    if (chatRealtimeSocket) {
        chatRealtimeSocket.disconnect();
        chatRealtimeSocket = null;
    }

    chatRealtimeSocket = ioFactory(state.apiBase, {
        transports: ["websocket", "polling"],
        auth: {
            token: state.token
        }
    });

    chatRealtimeSocket.on("connect", async () => {
        await joinRealtimeConversation(state.chatCurrentConversationId);
    });

    chatRealtimeSocket.on("chat:message:new", async (message) => {
        const conversation = message?.conversation;
        if (conversation) {
            replaceConversation(conversation);
        }

        if (Number(message?.conversation_id) === Number(state.chatCurrentConversationId)) {
            upsertChatMessage(message);
            renderChats();
            window.setTimeout(scrollChatThreadToBottom, 0);
            try {
                await markActiveConversationAsRead();
            } catch (_error) {
                // keep UI responsive even if read sync fails
            }
            return;
        }

        renderChats();
    });

    chatRealtimeSocket.on("chat:conversation:updated", (conversation) => {
        if (!conversation?.id) return;
        replaceConversation(conversation);
        renderChats();
    });

    chatRealtimeSocket.on("chat:messages:read", (payload) => {
        applyRealtimeReadPayload(payload);
        renderChats();
    });

    chatRealtimeSocket.on("disconnect", () => {
        joinedRealtimeConversationId = null;
    });

    await joinRealtimeConversation(state.chatCurrentConversationId);
}

function disconnectChatRealtime() {
    joinedRealtimeConversationId = null;
    if (!chatRealtimeSocket) return;
    chatRealtimeSocket.disconnect();
    chatRealtimeSocket = null;
}

activateChatsPanel = async function activateChatsPanelPatched() {
    try {
        isChatLoading = true;
        await refreshChats({ loadMessages: true });
        scheduleChatPolling();
        await connectChatRealtime();
        window.setTimeout(scrollChatThreadToBottom, 0);
    } catch (error) {
        showToast(error.message || "Không thể tải hội thoại khách hàng.", true);
    } finally {
        isChatLoading = false;
    }
};

deactivateChatsPanel = function deactivateChatsPanelPatched() {
    window.clearInterval(chatPollTimerId);
    disconnectChatRealtime();
};

handleChatAction = async function handleChatActionRealtimePatched(button) {
    const action = button.dataset.chatAction;
    const conversationId = button.dataset.id;
    const status = button.dataset.status;
    const reply = button.dataset.reply;
    const activeConversation = getActiveChatConversation();

    if (action === "refresh-conversations") {
        await activateChatsPanel();
        return;
    }

    if (action === "set-status-filter") {
        state.chatStatusFilter = status || "open";
        syncChatSelection();
        if (state.chatCurrentConversationId) {
            await loadMessagesForActiveConversation();
            await joinRealtimeConversation(state.chatCurrentConversationId);
        }
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "select-conversation") {
        state.chatCurrentConversationId = Number(conversationId);
        state.chatMessageDraft = "";
        await loadMessagesForActiveConversation();
        await joinRealtimeConversation(state.chatCurrentConversationId);
        renderChats();
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "insert-quick-reply") {
        const prefix = state.chatMessageDraft && !state.chatMessageDraft.endsWith(" ") ? `${state.chatMessageDraft} ` : state.chatMessageDraft;
        state.chatMessageDraft = `${prefix}${reply || ""}`.trim();
        renderChats();
        return;
    }

    if (action === "open-product-picker") {
        chatProductPickerOpen = true;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "close-product-picker") {
        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        renderChats();
        return;
    }

    if (action === "send-product-reference") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi sản phẩm.");
        }

        const productId = Number(button.dataset.productId);
        const product = getShareableProducts().find((item) => Number(item.id) === productId);
        if (!product) {
            throw new Error("Không tìm thấy sản phẩm để gửi.");
        }

        await apiFetch(`/api/chat/conversations/${activeConversation.id}/messages`, {
            method: "POST",
            body: JSON.stringify({
                content: buildProductShareContent(product)
            })
        });

        chatProductPickerOpen = false;
        chatProductPickerSearch = "";
        state.chatMessageDraft = "";
        await refreshChats({ loadMessages: true });
        await joinRealtimeConversation(state.chatCurrentConversationId);
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "attach-image") {
        if (!activeConversation) return;
        if (activeConversation.status === "closed") {
            throw new Error("Hội thoại đã đóng, hãy mở lại trước khi gửi ảnh.");
        }

        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/jpeg,image/png,image/webp,image/gif";

        const file = await new Promise((resolve) => {
            picker.addEventListener("change", () => resolve(picker.files?.[0] || null), { once: true });
            picker.click();
        });

        if (!file) return;

        await uploadChatImageAndSend(activeConversation, file);
        await refreshChats({ loadMessages: true });
        await joinRealtimeConversation(state.chatCurrentConversationId);
        window.setTimeout(scrollChatThreadToBottom, 0);
        return;
    }

    if (action === "resolve-conversation" || action === "reopen-conversation") {
        if (!activeConversation) return;
        const nextStatus = action === "resolve-conversation" ? "closed" : "open";
        const updatedConversation = await apiFetch(`/api/chat/conversations/${activeConversation.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: nextStatus })
        });
        replaceConversation(updatedConversation);
        if (nextStatus === "closed") {
            state.chatMessageDraft = "";
        }
        if (state.chatStatusFilter !== "all" && state.chatStatusFilter !== nextStatus) {
            syncChatSelection();
            await loadMessagesForActiveConversation();
        }
        await joinRealtimeConversation(state.chatCurrentConversationId);
        renderChats();
    }
};

const renderChatInboxWorkspace = renderChats;
const activateChatInboxPanel = activateChatsPanel;
const handleChatInboxAction = handleChatAction;
const handleChatInboxInput = handleChatInput;
const submitChatInboxComposer = submitChatComposer;

const AI_SUPPORT_SUGGESTIONS = [
    "Hướng dẫn khách đặt hàng trên app",
    "Chính sách đổi trả và hoàn tiền",
    "Cách dùng voucher trong Garden Fresh",
    "Gợi ý công thức từ rau củ đang có"
];

function normalizeAiSupportMessages() {
    if (!Array.isArray(state.aiSupportMessages)) {
        state.aiSupportMessages = [];
    }

    if (!state.aiSupportMessages.length) {
        state.aiSupportMessages = [{
            role: "assistant",
            content: "Chào bạn, tôi là trợ lý AI của Garden Fresh. Bạn có thể hỏi về sản phẩm, đơn hàng, voucher, công thức nấu ăn hoặc cách hỗ trợ khách hàng.",
            createdAt: new Date().toISOString()
        }];
    }
}

function buildAiSupportMessage(message) {
    const isUser = message.role === "user";
    return `
      <article class="ai-support-message ${isUser ? "is-user" : "is-assistant"}">
        <div class="ai-support-avatar">${isUser ? "AD" : "AI"}</div>
        <div class="ai-support-bubble">
          <p>${escapeHtml(message.content || "").replace(/\n/g, "<br>")}</p>
          <span>${escapeHtml(formatChatListTime(message.createdAt || new Date().toISOString()))}</span>
        </div>
      </article>
    `;
}

function scrollAiSupportThreadToBottom() {
    const thread = document.querySelector("#aiSupportThread");
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
}

function renderAiSupportWorkspace() {
    if (!elements.chatsContent) return;
    normalizeAiSupportMessages();

    elements.chatsContent.innerHTML = `
      <section class="ai-support-workspace">
        <header class="ai-support-hero">
          <div>
            <p class="eyebrow">Tin nhắn / Hỏi đáp AI</p>
            <h2>Hỏi đáp AI nội bộ</h2>
            <p class="section-copy">Trợ lý dùng dữ liệu backend Garden Fresh để hỗ trợ admin trả lời khách nhanh hơn. API key Gemini chỉ đặt ở backend.</p>
          </div>
          <button class="secondary-button" type="button" data-chat-action="ai-clear">Xóa hội thoại</button>
        </header>

        <div class="ai-support-layout">
          <aside class="ai-support-guide">
            <h3>Gợi ý câu hỏi</h3>
            <p>Chọn nhanh một mẫu hoặc nhập câu hỏi riêng ở khung bên phải.</p>
            <div class="ai-support-suggestions">
              ${AI_SUPPORT_SUGGESTIONS.map((prompt) => `
                <button type="button" data-chat-action="ai-suggest" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>
              `).join("")}
            </div>
            <div class="ai-support-note">
              <strong>Lưu ý</strong>
              <span>AI chỉ hỗ trợ soạn câu trả lời. Với thông tin nhạy cảm, admin vẫn cần kiểm tra lại trước khi gửi khách.</span>
            </div>
          </aside>

          <section class="ai-support-chat">
            <div class="ai-support-thread" id="aiSupportThread">
              ${state.aiSupportMessages.map((message) => buildAiSupportMessage(message)).join("")}
              ${state.aiSupportSending ? `
                <article class="ai-support-message is-assistant">
                  <div class="ai-support-avatar">AI</div>
                  <div class="ai-support-bubble is-loading"><p>Đang suy nghĩ...</p></div>
                </article>
              ` : ""}
            </div>

            <form class="ai-support-form" id="aiSupportForm">
              <textarea rows="3" data-chat-input="ai-draft" placeholder="Nhập câu hỏi cho AI...">${escapeHtml(state.aiSupportDraft || "")}</textarea>
              <button class="primary-button" type="submit" ${state.aiSupportSending || !String(state.aiSupportDraft || "").trim() ? "disabled" : ""}>
                ${state.aiSupportSending ? "Đang gửi..." : "Gửi câu hỏi"}
              </button>
            </form>
          </section>
        </div>
      </section>
    `;

    window.requestAnimationFrame(scrollAiSupportThreadToBottom);
}

async function submitAiSupportQuestion() {
    const message = String(state.aiSupportDraft || "").trim();
    if (!message) {
        throw new Error("Vui lòng nhập câu hỏi trước khi gửi.");
    }

    normalizeAiSupportMessages();
    state.aiSupportMessages = [
        ...state.aiSupportMessages,
        { role: "user", content: message, createdAt: new Date().toISOString() }
    ];
    state.aiSupportDraft = "";
    state.aiSupportSending = true;
    renderAiSupportWorkspace();

    try {
        const payload = await postAiSupportQuestion(message);
        const answer = payload?.answer || payload?.tra_loi || payload?.data?.answer || "AI chưa trả về nội dung phù hợp.";
        state.aiSupportMessages = [
            ...state.aiSupportMessages,
            { role: "assistant", content: answer, createdAt: new Date().toISOString() }
        ];
    } catch (error) {
        state.aiSupportMessages = [
            ...state.aiSupportMessages,
            { role: "assistant", content: error.message || "Không thể kết nối trợ lý AI.", createdAt: new Date().toISOString() }
        ];
        throw error;
    } finally {
        state.aiSupportSending = false;
        renderAiSupportWorkspace();
    }
}

async function postAiSupportQuestion(message) {
    const attempts = ["/api/ai/support", "/api/chat/ai-support", "/ai/support"];
    let lastError = null;

    for (const path of attempts) {
        try {
            return await apiFetch(path, {
                method: "POST",
                body: JSON.stringify({ message })
            });
        } catch (error) {
            lastError = error;
            const text = String(error?.message || "");
            if (!/không tìm thấy đường dẫn|not found|cannot post/i.test(text)) {
                throw error;
            }
        }
    }

    throw new Error("Backend chưa có route hỏi đáp AI. Hãy restart hoặc deploy lại backend sau khi thêm /api/ai/support.");
}

renderChats = function renderChatsWithAiSupport() {
    if (state.chatWorkspace === "aiSupport") {
        renderAiSupportWorkspace();
        return;
    }

    renderChatInboxWorkspace();
};

activateChatsPanel = async function activateChatsPanelWithWorkspace() {
    if (state.chatWorkspace === "aiSupport") {
        deactivateChatsPanel();
        renderAiSupportWorkspace();
        return;
    }

    await activateChatInboxPanel();
};

handleChatAction = async function handleChatActionWithAiSupport(button) {
    const action = button.dataset.chatAction;

    if (action === "ai-clear") {
        state.aiSupportMessages = [];
        state.aiSupportDraft = "";
        renderAiSupportWorkspace();
        return;
    }

    if (action === "ai-suggest") {
        state.aiSupportDraft = button.dataset.prompt || "";
        renderAiSupportWorkspace();
        const input = document.querySelector('[data-chat-input="ai-draft"]');
        input?.focus();
        return;
    }

    if (state.chatWorkspace === "aiSupport") {
        return;
    }

    await handleChatInboxAction(button);
};

handleChatInput = function handleChatInputWithAiSupport(target) {
    if (target.dataset.chatInput === "ai-draft") {
        state.aiSupportDraft = String(target.value || "");
        const sendButton = document.querySelector("#aiSupportForm .primary-button");
        if (sendButton) {
            sendButton.disabled = state.aiSupportSending || !String(state.aiSupportDraft || "").trim();
        }
        return;
    }

    handleChatInboxInput(target);
};

submitChatComposer = async function submitChatComposerWithAiSupport() {
    if (state.chatWorkspace === "aiSupport") {
        await submitAiSupportQuestion();
        return;
    }

    await submitChatInboxComposer();
};








