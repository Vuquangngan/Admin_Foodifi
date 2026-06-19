import {
    STORE_BRANCHES,
    apiFetch,
    elements,
    escapeHtml,
    formatDate,
    resolveMediaUrl,
    saveSession,
    showToast,
    state
} from "./core.js";
import { renderAppIcon } from "./icons.js";

const PROFILE_EXTRA_KEY = "shopfood_admin_profile_extra";

let profileAvatarFile = null;

function defaultAvatar(name = "User") {
    const initials = String(name || "US")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "US";

    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#eaf5ea"/><circle cx="80" cy="62" r="28" fill="#0b713d"/><path d="M36 132c8-28 25-42 44-42s36 14 44 42" fill="#0b713d"/><text x="50%" y="145" text-anchor="middle" font-family="Arial" font-size="18" fill="#66806d">${initials}</text></svg>`
    )}`;
}

function getAvatarSource(user = state.user) {
    return resolveMediaUrl(user?.avatar_url, defaultAvatar(user?.username || user?.email || "User"));
}

function getRoleLabel(role) {
    if (role === "admin") return "Quản trị viên";
    if (role === "staff") return "Nhân viên";
    if (role === "customer") return "Khách hàng";
    return role || "-";
}

function readProfileExtras() {
    try {
        const parsed = JSON.parse(localStorage.getItem(PROFILE_EXTRA_KEY) || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
        localStorage.removeItem(PROFILE_EXTRA_KEY);
        return {};
    }
}

function saveProfileExtras(userId, extra) {
    const allExtras = readProfileExtras();
    allExtras[String(userId)] = {
        ...(allExtras[String(userId)] || {}),
        ...extra
    };
    localStorage.setItem(PROFILE_EXTRA_KEY, JSON.stringify(allExtras));
}

function getCurrentExtra() {
    const userId = String(state.user?.id || "");
    return readProfileExtras()[userId] || {};
}

function getBranchOptions(currentValue = "") {
    const branches = STORE_BRANCHES.length
        ? STORE_BRANCHES
        : [{ key: "main", name: "Lush Harvest - Hồ Chí Minh Central" }];

    return branches.map((branch) => {
        const value = branch.key || branch.name || branch.label;
        const label = branch.name || branch.label || value;
        return `<option value="${escapeHtml(value)}" ${String(currentValue) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
}

function getDateInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
}

async function uploadProfileAvatar(file) {
    if (!file) return "";
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
        || payload?.url
        || payload?.path
        || payload?.image_url
        || "";
}

function renderProfileAvatar(user) {
    return `
      <div class="profile-avatar-wrap">
        <img class="profile-avatar-image" data-profile-avatar-preview src="${escapeHtml(getAvatarSource(user))}" alt="${escapeHtml(user.username || user.email || "Avatar")}">
        <input class="hidden" id="profileAvatarFile" type="file" accept="image/png,image/jpeg,image/webp">
        <button class="profile-avatar-edit" type="button" data-profile-action="choose-avatar" aria-label="Đổi ảnh đại diện">${renderAppIcon("edit")}</button>
      </div>
    `;
}

export function renderProfile() {
    if (!elements.profileContent) return;

    const user = state.user || {};
    const extra = getCurrentExtra();
    const currentBranch = user.branch_id || extra.branch || STORE_BRANCHES[0]?.key || "main";
    const currentBirthDate = user.birth_date || extra.birth_date || "";
    const currentGender = user.gender || extra.gender || "male";
    const roleLabel = getRoleLabel(user.role);
    const joinedAt = user.created_at ? formatDate(user.created_at).replace(/\s+\d{1,2}:\d{2}.*$/, "") : "Chưa có";

    elements.profileContent.innerHTML = `
      <form class="profile-form" id="profileForm">
        <input type="hidden" name="avatar_url" value="${escapeHtml(user.avatar_url || "")}">
        <section class="profile-hero-card">
          ${renderProfileAvatar(user)}
          <div class="profile-identity">
            <h3>${escapeHtml(user.username || user.email || "Tài khoản")}</h3>
            <p>${renderAppIcon("shield")} ${escapeHtml(roleLabel)}</p>
            <div class="profile-badges">
              <span>Hoạt động</span>
            </div>
          </div>
        </section>

        <div class="profile-layout">
          <section class="profile-card">
            <h3>${renderAppIcon("user")} Chi tiết cá nhân</h3>
            <div class="profile-grid">
              <label class="span-2">
                <span>Họ và tên</span>
                <input name="username" value="${escapeHtml(user.username || "")}" required>
              </label>
              <label class="span-2">
                <span>Email</span>
                <input name="email" type="email" value="${escapeHtml(user.email || "")}" disabled>
              </label>
              <label>
                <span>Số điện thoại</span>
                <input name="phone" value="${escapeHtml(user.phone || "")}" placeholder="090 123 4567">
              </label>
              <label>
                <span>Ngày sinh</span>
                <input name="birth_date" type="date" value="${escapeHtml(getDateInputValue(currentBirthDate))}">
              </label>
              <div class="profile-gender span-2" role="group" aria-label="Giới tính">
                <label class="${currentGender !== "female" ? "active" : ""}">
                  <input type="radio" name="gender" value="male" ${currentGender !== "female" ? "checked" : ""}>
                  <span>Nam</span>
                </label>
                <label class="${currentGender === "female" ? "active" : ""}">
                  <input type="radio" name="gender" value="female" ${currentGender === "female" ? "checked" : ""}>
                  <span>Nữ</span>
                </label>
              </div>
            </div>
          </section>

          <div class="profile-side">
            <section class="profile-card">
              <h3>${renderAppIcon("receipt")} Thông tin chuyên môn</h3>
              <div class="profile-info-row">
                <span>Mã nhân viên</span>
                <strong>${escapeHtml(user.code || `LH-2026-${String(user.id || "000").padStart(3, "0")}`)}</strong>
              </div>
              <label class="profile-field">
                <span>Chi nhánh quản lý</span>
                <select name="branch">${getBranchOptions(currentBranch)}</select>
              </label>
              <div class="profile-info-row">
                <span>Ngày gia nhập</span>
                <strong>${escapeHtml(joinedAt)}</strong>
              </div>
            </section>

            <section class="profile-card profile-security-card">
              <div class="profile-security-icon">${renderAppIcon("lock")}</div>
              <div>
                <h3>Bảo mật tài khoản</h3>
                <p>Lần cuối thay đổi: 30 ngày trước</p>
              </div>
              <button class="profile-password-toggle" type="button" data-profile-action="toggle-password">Thay đổi mật khẩu →</button>
            </section>
          </div>
        </div>

        <section class="profile-card profile-password-card hidden" data-profile-password-card>
          <h3>${renderAppIcon("lock")} Đổi mật khẩu</h3>
          <div class="profile-grid three">
            <label>
              <span>Mật khẩu hiện tại</span>
              <input name="current_password" type="password" autocomplete="current-password">
            </label>
            <label>
              <span>Mật khẩu mới</span>
              <input name="new_password" type="password" autocomplete="new-password">
            </label>
            <label>
              <span>Xác nhận mật khẩu mới</span>
              <input name="confirm_new_password" type="password" autocomplete="new-password">
            </label>
          </div>
        </section>

        <div class="profile-actions">
          <button class="ghost-button" type="button" data-profile-action="reset">Hủy bỏ</button>
          <button class="primary-button" type="submit">Lưu thay đổi</button>
        </div>
      </form>
    `;
}

async function submitProfileForm(form, submitter) {
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const currentPassword = String(data.get("current_password") || "");
    const newPassword = String(data.get("new_password") || "");
    const confirmPassword = String(data.get("confirm_new_password") || "");

    if (!username) {
        throw new Error("Vui lòng nhập họ và tên.");
    }

    const wantsPasswordChange = currentPassword || newPassword || confirmPassword;
    if (wantsPasswordChange && !currentPassword) {
        throw new Error("Vui lòng nhập mật khẩu hiện tại.");
    }
    if (wantsPasswordChange && newPassword.length < 6) {
        throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
    }
    if (wantsPasswordChange && newPassword !== confirmPassword) {
        throw new Error("Xác nhận mật khẩu mới không khớp.");
    }

    const submitButton = submitter || form.querySelector("button[type='submit']");
    const previousText = submitButton?.textContent || "";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu...";
    }

    try {
        let avatarUrl = String(data.get("avatar_url") || "").trim();
        if (profileAvatarFile) {
            avatarUrl = await uploadProfileAvatar(profileAvatarFile);
        }

        const birthDateRaw = String(data.get("birth_date") || "").trim();
        const genderRaw = String(data.get("gender") || "").trim();
        const branchRaw = String(data.get("branch") || "").trim();

        const payload = {
            username,
            phone,
            avatar_url: avatarUrl,
            birth_date: birthDateRaw || null,
            gender: genderRaw || null,
            branch_id: branchRaw || null,
            role: state.user.role,
            status: state.user.status || "active"
        };

        if (state.user.code) {
            payload.code = state.user.code;
        }
        if (state.user.email) {
            payload.email = state.user.email;
        }
        if (wantsPasswordChange) {
            payload.current_password = currentPassword;
            payload.password = newPassword;
        }

        const updatedUser = await apiFetch(`/api/users/${state.user.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        state.user = updatedUser;
        saveSession();
        saveProfileExtras(state.user.id, {
            birth_date: String(data.get("birth_date") || ""),
            gender: String(data.get("gender") || "male"),
            branch: String(data.get("branch") || "")
        });

        profileAvatarFile = null;
        renderProfile();
        elements.profileModal?.classList.add("hidden");
        showToast("Đã cập nhật thông tin cá nhân.");
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = previousText;
        }
    }
}

export function bindProfileEvents() {
    elements.closeProfileModalButton?.addEventListener("click", () => {
        elements.profileModal?.classList.add("hidden");
    });

    elements.profileModal?.addEventListener("click", (event) => {
        if (event.target === elements.profileModal) {
            elements.profileModal.classList.add("hidden");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.profileModal && !elements.profileModal.classList.contains("hidden")) {
            elements.profileModal.classList.add("hidden");
        }
    });

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-profile-action]");
        if (!button) return;

        const action = button.dataset.profileAction;
        const form = button.closest("#profileForm");

        if (action === "choose-avatar") {
            form?.querySelector("#profileAvatarFile")?.click();
            return;
        }

        if (action === "toggle-password") {
            form?.querySelector("[data-profile-password-card]")?.classList.toggle("hidden");
            return;
        }

        if (action === "reset") {
            profileAvatarFile = null;
            elements.profileModal?.classList.add("hidden");
        }
    });

    document.addEventListener("change", (event) => {
        const input = event.target.closest("#profileAvatarFile");
        if (!input) return;

        const file = input.files?.[0] || null;
        profileAvatarFile = file;
        if (!file) return;

        const preview = input.closest("#profileForm")?.querySelector("[data-profile-avatar-preview]");
        if (preview) {
            preview.src = URL.createObjectURL(file);
        }
    });

    document.addEventListener("change", (event) => {
        const radio = event.target.closest(".profile-gender input[type='radio']");
        if (!radio) return;

        const wrap = radio.closest(".profile-gender");
        wrap?.querySelectorAll("label").forEach((label) => label.classList.toggle("active", label.contains(radio)));
    });

    document.addEventListener("submit", async (event) => {
        const form = event.target.closest("#profileForm");
        if (!form) return;
        event.preventDefault();

        try {
            await submitProfileForm(form, event.submitter);
        } catch (error) {
            showToast(error.message || "Không thể cập nhật thông tin cá nhân.", true);
        }
    });
}
