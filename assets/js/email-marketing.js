import {
    STORAGE_KEYS,
    apiFetch,
    collectFormData,
    elements,
    escapeHtml,
    formatNumber,
    resolveMediaUrl,
    showToast,
    state
} from "./core.js";
import { renderAppIcon } from "./icons.js";

const DEFAULT_CAMPAIGN = {
    campaign_name: "Ưu đãi rau củ tươi hôm nay",
    goal: "increase_sales",
    subject: "Tươi mát mỗi ngày - Ưu đãi riêng cho bạn",
    preheader: "Nhận ưu đãi mới nhất từ FOODIFI.",
    title: "Chào mừng bạn đến với FOODIFI!",
    summary: "Mùa này, chúng tôi chuẩn bị nhiều rau củ tươi ngon được chọn lọc mỗi ngày để bữa ăn gia đình luôn trọn vị.",
    cta_label: "Mua ngay",
    cta_url: "",
    banner_url: "",
    audience: "all",
    test_email: ""
};

const AUDIENCES = [
    {
        key: "all",
        icon: "users",
        title: "Tất cả khách hàng",
        description: "Gửi cho toàn bộ khách có email hợp lệ."
    },
    {
        key: "dong",
        icon: "shield",
        title: "Hạng Đồng",
        description: "Khách hàng ở hạng thành viên Đồng."
    },
    {
        key: "bac",
        icon: "shield",
        title: "Hạng Bạc",
        description: "Khách hàng ở hạng thành viên Bạc."
    },
    {
        key: "vang",
        icon: "shield",
        title: "Hạng Vàng",
        description: "Khách hàng ở hạng thành viên Vàng."
    },
    {
        key: "bach_kim",
        icon: "shield",
        title: "Hạng Bạch kim",
        description: "Khách hàng ở hạng thành viên Bạch kim."
    },
    {
        key: "kim_cuong",
        icon: "shield",
        title: "Hạng Kim cương",
        description: "Khách hàng ở hạng thành viên Kim cương."
    },
    {
        key: "vip",
        icon: "shield",
        title: "Hạng VIP",
        description: "Khách hàng ở hạng thành viên VIP."
    }
];

function loadDraft() {
    if (state.emailCampaignDraft) return state.emailCampaignDraft;

    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.emailCampaignDraft) || "null");
        state.emailCampaignDraft = { ...DEFAULT_CAMPAIGN, ...(parsed || {}) };
    } catch (_error) {
        localStorage.removeItem(STORAGE_KEYS.emailCampaignDraft);
        state.emailCampaignDraft = { ...DEFAULT_CAMPAIGN };
    }

    return state.emailCampaignDraft;
}

function saveDraft(draft) {
    state.emailCampaignDraft = { ...DEFAULT_CAMPAIGN, ...(draft || {}) };
    localStorage.setItem(STORAGE_KEYS.emailCampaignDraft, JSON.stringify(state.emailCampaignDraft));
    return state.emailCampaignDraft;
}

function getCustomers() {
    return Array.isArray(state.customers) ? state.customers : [];
}

function hasEmail(customer) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer?.email || "").trim());
}

function isActiveCustomer(customer) {
    return !customer?.status || customer.status === "active";
}

function getAudienceCustomers(audienceKey) {
    const customers = getCustomers().filter((customer) => hasEmail(customer) && isActiveCustomer(customer));

    const tierKeys = new Set(["dong", "bac", "vang", "bach_kim", "kim_cuong", "vip"]);
    if (tierKeys.has(audienceKey)) {
        return customers.filter((customer) => String(customer.membership_tier || "dong") === audienceKey);
    }

    return customers;
}

function collectDraftFromForm(form) {
    const raw = collectFormData(form);
    return saveDraft({
        campaign_name: String(raw.campaign_name || "").trim(),
        goal: String(raw.goal || "increase_sales"),
        subject: String(raw.subject || "").trim(),
        preheader: String(raw.preheader || "").trim(),
        title: String(raw.title || "").trim(),
        summary: String(raw.summary || "").trim(),
        cta_label: String(raw.cta_label || "").trim(),
        cta_url: String(raw.cta_url || "").trim(),
        banner_url: String(raw.banner_url || "").trim(),
        audience: String(raw.audience || "all"),
        test_email: String(raw.test_email || "").trim()
    });
}

async function uploadCampaignImage(file) {
    if (!file) return "";
    if (!file.type?.startsWith("image/")) {
        throw new Error("Vui lòng chọn tệp ảnh hợp lệ.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const payload = await apiFetch("/api/uploads/images?folder=email-campaigns", {
        method: "POST",
        body: formData
    });

    const uploadedUrl = (
        payload?.file?.url ||
        payload?.hinh_anh?.url ||
        payload?.file?.duong_dan ||
        payload?.hinh_anh?.duong_dan ||
        payload?.files?.[0]?.url ||
        payload?.files?.[0]?.duong_dan ||
        ""
    );

    if (!uploadedUrl) {
        throw new Error("Không lấy được đường dẫn ảnh sau khi tải lên.");
    }

    return uploadedUrl;
}

function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
}

function getDraft() {
    return { ...DEFAULT_CAMPAIGN, ...loadDraft() };
}

function renderAudienceCard(audience, draft) {
    const count = getAudienceCustomers(audience.key).length;
    const active = draft.audience === audience.key;

    return `
      <button class="email-audience-card ${active ? "active" : ""}" type="button" data-email-action="audience" data-audience="${escapeHtml(audience.key)}">
        <span class="email-audience-check"></span>
        <span class="email-audience-icon">${renderAppIcon(audience.icon)}</span>
        <strong>${escapeHtml(audience.title)}</strong>
        <small>${escapeHtml(audience.description)}</small>
        <em>${formatNumber(count)} khách hàng</em>
      </button>
    `;
}

function renderAudienceOptions(draft) {
    return AUDIENCES.map((audience) => {
        const count = getAudienceCustomers(audience.key).length;
        return `<option value="${escapeHtml(audience.key)}" ${draft.audience === audience.key ? "selected" : ""}>${escapeHtml(audience.title)} - ${formatNumber(count)} khách hàng</option>`;
    }).join("");
}

function getAudienceDescription(audienceKey) {
    const selected = AUDIENCES.find((audience) => audience.key === audienceKey) || AUDIENCES[0];
    return selected?.description || "";
}

function renderPreview(draft) {
    const banner = draft.banner_url
        ? `<img src="${escapeHtml(resolveMediaUrl(draft.banner_url))}" alt="Banner chiến dịch">`
        : `<div class="email-preview-hero"><strong>FOODIFI</strong><span>Fresh summer harvest</span></div>`;

    return `
      <div class="email-preview-phone" id="emailCampaignPreview">
        <div class="email-preview-brand">GARDEN FRESH</div>
        ${banner}
        <div class="email-preview-body">
          <h3 data-email-preview="title">${escapeHtml(draft.title || DEFAULT_CAMPAIGN.title)}</h3>
          <p data-email-preview="summary">${nl2br(draft.summary || DEFAULT_CAMPAIGN.summary)}</p>
          <a href="${escapeHtml(draft.cta_url || "#")}" data-email-preview="cta">${escapeHtml(draft.cta_label || "Mua ngay")}</a>
        </div>
        <div class="email-preview-footer">Bạn nhận email này vì đã đăng ký hoặc mua hàng tại FOODIFI.</div>
      </div>
    `;
}

function renderCompatibility(draft) {
    const bodySize = JSON.stringify(draft).length;
    const subjectLength = String(draft.subject || "").length;
    const spamScore = subjectLength > 90 || /free|miễn phí|100%/i.test(draft.subject || "") ? "B" : "A";

    return `
      <div class="email-health-grid">
        <article><span>Tương thích</span><strong>98%</strong><small>Tốt trên mobile</small></article>
        <article><span>Dung lượng</span><strong>${Math.max(1, Math.round(bodySize / 1024))}KB</strong><small>Nhẹ, dễ tải</small></article>
        <article><span>Điểm spam</span><strong>${spamScore}</strong><small>${spamScore === "A" ? "Rất tốt" : "Cần kiểm tra tiêu đề"}</small></article>
      </div>
    `;
}

export function renderEmailMarketing() {
    if (!elements.emailMarketingContent) return;
    const draft = getDraft();
    const audienceCount = getAudienceCustomers(draft.audience).length;

    elements.emailMarketingContent.innerHTML = `
      <section class="email-marketing-page">
        <div class="email-marketing-head">
          <div class="email-marketing-actions">
            <button class="secondary-button" type="button" data-email-action="save-draft">Lưu nháp</button>

            <button class="primary-button" type="button" data-email-action="send-now">${renderAppIcon("mail")} Gửi ngay</button>
          </div>
        </div>

        <div class="email-builder-layout">
          <form class="email-builder-main" id="emailCampaignForm">
            <article class="surface email-builder-section">
              <span class="email-section-index">1</span>
              <h3>Thông tin chiến dịch</h3>
              <div class="compact-grid">
                <label>
                  <span>Tên chiến dịch</span>
                  <input name="campaign_name" value="${escapeHtml(draft.campaign_name)}" placeholder="Ví dụ: Ưu đãi mùa hè 2026" required>
                </label>
                <label>
                  <span>Mục tiêu</span>
                  <select name="goal">
                    <option value="increase_sales" ${draft.goal === "increase_sales" ? "selected" : ""}>Tăng doanh số</option>
                    <option value="reactivate" ${draft.goal === "reactivate" ? "selected" : ""}>Kéo khách quay lại</option>
                    <option value="new_product" ${draft.goal === "new_product" ? "selected" : ""}>Giới thiệu sản phẩm mới</option>
                    <option value="announcement" ${draft.goal === "announcement" ? "selected" : ""}>Thông báo cửa hàng</option>
                  </select>
                </label>
                <label class="span-2">
                  <span>Tiêu đề Email</span>
                  <input name="subject" value="${escapeHtml(draft.subject)}" placeholder="Tiêu đề khách sẽ thấy trong hộp thư" required>
                </label>
                <label class="span-2">
                  <span>Dòng mô tả ngắn</span>
                  <textarea name="preheader" rows="2" maxlength="140" placeholder="Dòng tóm tắt hiển thị dưới tiêu đề">${escapeHtml(draft.preheader)}</textarea>
                </label>
              </div>
            </article>

            <article class="surface email-builder-section">
              <span class="email-section-index">2</span>
              <h3>Đối tượng nhận Email</h3>
              <label class="email-audience-select-wrap">
                <span>Loại khách hàng</span>
                <select name="audience" id="emailAudienceSelect">
                  ${renderAudienceOptions(draft)}
                </select>
                <small id="emailAudienceDescription">${escapeHtml(getAudienceDescription(draft.audience))}</small>
              </label>
              <p class="email-audience-note">Đang chọn <strong id="emailAudienceCount">${formatNumber(audienceCount)}</strong> khách có email hợp lệ.</p>
            </article>

            <article class="surface email-builder-section">
              <span class="email-section-index">3</span>
              <h3>Thiết kế nội dung</h3>
              <div class="compact-grid">
                <label class="span-2">
                  <span>Ảnh banner</span>
                  <input name="banner_url" type="hidden" value="${escapeHtml(draft.banner_url)}">
                  <input class="hidden" name="banner_file" type="file" accept="image/*" data-email-banner-file>
                  <div class="email-image-link-picker">
                    <button class="secondary-button" type="button" data-email-action="choose-banner-file">${renderAppIcon("upload")} Chọn ảnh</button>
                    ${draft.banner_url ? `<button class="ghost-button" type="button" data-email-action="clear-banner-url">Xóa ảnh</button>` : ""}
                    <small>${draft.banner_url ? escapeHtml(draft.banner_url) : "Chưa chọn ảnh banner cho chiến dịch."}</small>
                  </div>
                </label>
                <label class="span-2">
                  <span>Tiêu đề trong email</span>
                  <input name="title" value="${escapeHtml(draft.title)}" required>
                </label>
                <label class="span-2">
                  <span>Nội dung chính</span>
                  <textarea name="summary" rows="6" required>${escapeHtml(draft.summary)}</textarea>
                </label>
                <label>
                  <span>Nút kêu gọi</span>
                  <input name="cta_label" value="${escapeHtml(draft.cta_label)}" placeholder="Mua ngay">
                </label>
                <input name="test_email" type="hidden" value="vuquangngan312@gmail.com">
              </div>
              <div class="email-quick-actions">
                <button type="button" data-email-action="insert-text" data-text="Hàng mới về trong hôm nay, số lượng có hạn.">Thêm hàng mới</button>
                <button type="button" data-email-action="insert-text" data-text="Mã ưu đãi chỉ áp dụng trong thời gian ngắn.">Mã giảm giá</button>
                <button type="button" data-email-action="insert-text" data-text="Đặt hàng trước 16:00 để được chuẩn bị trong ngày.">Nhắc mua hàng</button>
              </div>
            </article>
          </form>

          <aside class="email-preview-panel">
            <article class="surface email-preview-card">
              <div class="section-head">
                <h3>Xem trước</h3>
                <span class="email-device-toggle">${renderAppIcon("user")}${renderAppIcon("grid")}</span>
              </div>
              ${renderPreview(draft)}
            </article>
            ${renderCompatibility(draft)}
            <article class="email-tip-card">${renderAppIcon("shield")} Cá nhân hóa nội dung và chọn đúng nhóm khách để tăng tỷ lệ mở email.</article>
          </aside>
        </div>
      </section>
    `;
}

function updatePreview(draft) {
    const title = elements.emailMarketingContent?.querySelector("[data-email-preview='title']");
    const summary = elements.emailMarketingContent?.querySelector("[data-email-preview='summary']");
    const cta = elements.emailMarketingContent?.querySelector("[data-email-preview='cta']");
    const count = elements.emailMarketingContent?.querySelector("#emailAudienceCount");
    const audienceDescription = elements.emailMarketingContent?.querySelector("#emailAudienceDescription");
    const preview = elements.emailMarketingContent?.querySelector("#emailCampaignPreview");

    if (title) title.textContent = draft.title || DEFAULT_CAMPAIGN.title;
    if (summary) summary.innerHTML = nl2br(draft.summary || DEFAULT_CAMPAIGN.summary);
    if (cta) {
        cta.textContent = draft.cta_label || "Mua ngay";
        cta.setAttribute("href", draft.cta_url || "#");
    }
    if (count) count.textContent = formatNumber(getAudienceCustomers(draft.audience).length);
    if (audienceDescription) audienceDescription.textContent = getAudienceDescription(draft.audience);
    if (preview) {
        const currentMedia = preview.querySelector("img, .email-preview-hero");
        if (draft.banner_url) {
            const image = document.createElement("img");
            image.src = draft.banner_url;
            image.alt = "Ảnh chiến dịch";
            currentMedia?.replaceWith(image);
        } else if (currentMedia?.tagName === "IMG") {
            currentMedia.replaceWith(Object.assign(document.createElement("div"), {
                className: "email-preview-hero",
                innerHTML: "<strong>FOODIFI</strong><span>Fresh summer harvest</span>"
            }));
        }
    }
}

export function handleEmailMarketingInput(target) {
    const form = target?.closest?.("#emailCampaignForm");
    if (!form) return;
    const draft = collectDraftFromForm(form);
    updatePreview(draft);
}

export async function handleEmailMarketingFile(target) {
    if (!target?.matches?.("[data-email-banner-file]")) return false;
    const form = target.closest("#emailCampaignForm");
    const file = target.files?.[0];
    if (!form || !file) return true;

    const uploadedUrl = await uploadCampaignImage(file);
    form.elements.banner_url.value = uploadedUrl;
    collectDraftFromForm(form);
    showToast("Đã tải ảnh chiến dịch email.");
    renderEmailMarketing();
    return true;
}

async function sendEmailCampaign(mode, button) {
    const form = elements.emailMarketingContent?.querySelector("#emailCampaignForm");
    if (!form) return;

    const draft = collectDraftFromForm(form);
    if (!draft.campaign_name || !draft.subject || !draft.title || !draft.summary) {
        throw new Error("Vui lòng nhập đủ tên chiến dịch, tiêu đề email và nội dung.");
    }


    const payload = await apiFetch("/api/email-campaigns/send", {
        method: "POST",
        body: JSON.stringify({
            ...draft,
            mode,
            audience: draft.audience || "all",
            test_email: mode === "test" ? draft.test_email : ""
        })
    });

    const sent = Number(payload.sent || payload.da_gui || 0);
    const failed = Number(payload.failed || payload.loi || 0);
    showToast(mode === "test"
        ? `Đã gửi thử email tới ${draft.test_email}.`
        : `Đã gửi chiến dịch: ${sent} thành công, ${failed} lỗi.`);

    if (button) button.dataset.lastSent = String(sent);
}

export async function handleEmailMarketingAction(button) {
    const action = button?.dataset?.emailAction;
    if (!action) return;

    const form = elements.emailMarketingContent?.querySelector("#emailCampaignForm");

    if (action === "audience") {
        if (!form) return;
        form.elements.audience.value = button.dataset.audience || "all";
        elements.emailMarketingContent
            ?.querySelectorAll(".email-audience-card")
            .forEach((card) => card.classList.toggle("active", card === button));
        const draft = collectDraftFromForm(form);
        updatePreview(draft);
        return;
    }

    if (action === "insert-text") {
        const textarea = form?.elements.summary;
        if (!textarea) return;
        const insert = button.dataset.text || "";
        textarea.value = `${textarea.value.trim()}${textarea.value.trim() ? "\n\n" : ""}${insert}`;
        const draft = collectDraftFromForm(form);
        updatePreview(draft);
        textarea.focus();
        return;
    }

    if (action === "choose-banner-file") {
        form?.querySelector("[data-email-banner-file]")?.click();
        return;
    }

    if (action === "clear-banner-url") {
        const input = form?.elements.banner_url;
        if (!input) return;
        input.value = "";
        const draft = collectDraftFromForm(form);
        updatePreview(draft);
        renderEmailMarketing();
        return;
    }

    if (action === "save-draft") {
        if (form) collectDraftFromForm(form);
        showToast("Đã lưu bản nháp chiến dịch email.");
        return;
    }

    if (action === "send-test") {
        await sendEmailCampaign("test", button);
        return;
    }

    if (action === "send-now") {
        await sendEmailCampaign("send", button);
    }
}
