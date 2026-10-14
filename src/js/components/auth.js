/* Modal state machine: login/register/request/forgot -> OTP -> reset or success.
 * Network and preview decisions belong to services/auth-api.js, not the views.
 * Keep names/data hooks from auth-modal.html; never persist credentials.
 * auth:success is a UI signal, not proof of authorization for server resources.
 */
import { authAPI, isAuthPreview } from "../services/auth-api.js";
import { retryAfterSeconds } from "../services/auth-response.js";

const normalizeDigits = (value) => value.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) % 16));
const normalizeIdentity = (value) => {
    const normalized = normalizeDigits(value).trim();
    if (normalized.includes("@")) return normalized;
    return normalized.replace(/[\s()-]/g, "").replace(/^(?:\+98|0098)/, "0");
};
const validIdentity = (value) => /^09\d{9}$/.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const maskIdentity = (value) => {
    if (!value.includes("@")) return `${value.slice(0, 4)}***${value.slice(-4)}`;
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
};

export function initAuth() {
    const dialog = document.querySelector("[data-auth-modal]");
    if (!dialog || dialog.dataset.initialized) return;
    dialog.dataset.initialized = "true";

    const panels = [...dialog.querySelectorAll("[data-auth-panel]")];
    const digits = [...dialog.querySelectorAll("[data-otp-digit]")];
    const status = dialog.querySelector("[data-auth-status]");
    const resend = dialog.querySelector("[data-resend]");
    let view = "login";
    let purpose = "login";
    let identifier = "";
    let challengeId = "";
    let resetToken = "";
    let remember = true;
    let previousFocus;
    let timer;
    let deadline = 0;
    let pending;
    let busy = false;
    let pointerOnBackdrop = false;

    function message(text = "", tone = "error") {
        status.textContent = text;
        status.dataset.tone = tone;
        status.hidden = !text;
    }

    function clearErrors() {
        dialog.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute("aria-invalid"));
        dialog.querySelectorAll(".auth-field-error").forEach((element) => {
            element.textContent = "";
            element.hidden = true;
        });
    }

    function fieldError(input, text) {
        input.setAttribute("aria-invalid", "true");
        const error = document.getElementById(input.getAttribute("aria-describedby"));
        error.textContent = text;
        error.hidden = false;
    }

    function setBusy(value) {
        busy = value;
        dialog.setAttribute("aria-busy", String(value));
        dialog.querySelectorAll("button:not([data-auth-close])").forEach((button) => {
            button.disabled = value;
        });
        // Freeze values while the request is in flight; closing still cancels it.
        dialog.querySelectorAll("input").forEach((input) => {
            input.disabled = value;
        });
        updateTimer();
        if (
            !value &&
            dialog.open &&
            (!dialog.contains(document.activeElement) ||
                document.activeElement === dialog ||
                !document.activeElement.getClientRects().length)
        ) {
            const target = view === "otp" ? digits[0] : document.getElementById(`auth-title-${view}`);
            target.focus({ preventScroll: true });
        }
    }

    function stopRequest() {
        pending?.abort();
        pending = undefined;
        setBusy(false);
    }

    function clearSecrets() {
        dialog.querySelectorAll('[name="password"], [name="confirmPassword"]').forEach((input) => {
            input.value = "";
            input.type = "password";
        });
        dialog.querySelectorAll("[data-password-toggle]").forEach((button) => {
            button.setAttribute("aria-pressed", "false");
            button.setAttribute("aria-label", "نمایش رمز عبور");
            button.querySelector("[data-eye-slash]").style.display = "";
        });
        digits.forEach((input) => {
            input.value = "";
        });
        resetToken = "";
    }

    function showView(next) {
        if (!panels.some((panel) => panel.dataset.authPanel === next)) return;
        const previous = view;
        view = next;
        dialog.dataset.view = next;
        panels.forEach((panel) => {
            panel.hidden = panel.dataset.authPanel !== next;
        });
        dialog.setAttribute("aria-labelledby", `auth-title-${next}`);
        clearErrors();
        message();
        if (previous !== next) clearSecrets();
        if (next !== "otp") {
            clearInterval(timer);
            timer = undefined;
        }
        const identityInput = dialog.querySelector(`[data-auth-panel="${next}"] [data-identifier]`);
        if (identityInput && identifier) identityInput.value = identifier;
        dialog.scrollTop = 0;
        if (dialog.open) {
            const target = next === "otp" ? digits[0] : document.getElementById(`auth-title-${next}`);
            target.focus({ preventScroll: true });
        }
    }

    function updateTimer() {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        resend.disabled = busy || remaining > 0;
        const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
        resend.textContent = remaining
            ? `ارسال مجدد در ${time.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit])}`
            : "ارسال مجدد";
        if (!remaining) {
            clearInterval(timer);
            timer = undefined;
        }
    }

    function startTimer(seconds = 60) {
        clearInterval(timer);
        deadline = Date.now() + Math.max(1, retryAfterSeconds(seconds)) * 1000;
        updateTimer();
        timer = setInterval(updateTimer, 1000);
    }

    function open(trigger) {
        if (dialog.open) return;
        // The menu handler closes first; restore to its visible hamburger on mobile.
        previousFocus = trigger.closest("[data-mobile-menu]") ? document.querySelector("[data-menu-open]") : trigger;
        showView(trigger.dataset.authOpen || "login");
        document.documentElement.classList.add("auth-open");
        document.body.classList.add("auth-open");
        dialog.showModal();
        document.getElementById(`auth-title-${view}`).focus({ preventScroll: true });
    }

    function cleanup() {
        stopRequest();
        clearInterval(timer);
        timer = undefined;
        deadline = 0;
        identifier = "";
        challengeId = "";
        purpose = "login";
        clearSecrets();
        dialog.querySelectorAll("form").forEach((form) => form.reset());
        clearErrors();
        message();
        document.documentElement.classList.remove("auth-open");
        document.body.classList.remove("auth-open");
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }

    async function run(task) {
        if (busy) return;
        message();
        const controller = new AbortController();
        pending = controller;
        setBusy(true);
        const timeout = setTimeout(() => controller.abort("timeout"), 20000);
        try {
            await task(controller.signal);
        } catch (error) {
            if (pending !== controller || !dialog.open) return;
            if (controller.signal.reason === "timeout") message("زمان پاسخ‌گویی تمام شد؛ دوباره تلاش کنید.");
            else if (error.name !== "AbortError") {
                message(error.message || "درخواست انجام نشد؛ دوباره تلاش کنید.");
                if (error.retryAfter && view === "otp") startTimer(error.retryAfter);
            }
        } finally {
            clearTimeout(timeout);
            if (pending === controller) {
                pending = undefined;
                setBusy(false);
            }
        }
    }

    function validate(form) {
        clearErrors();
        let firstInvalid;
        const data = Object.fromEntries(new FormData(form));
        for (const input of form.querySelectorAll("input[required]")) {
            let error = "";
            if (input.hasAttribute("data-identifier")) {
                input.value = normalizeIdentity(input.value);
                data.identifier = input.value;
                if (!validIdentity(input.value)) error = "شماره همراه معتبر (۰۹...) یا ایمیل صحیح وارد کنید.";
            } else if (input.name === "fullName") {
                data.fullName = input.value.trim();
                if (data.fullName.length < 2) error = "نام و نام خانوادگی را وارد کنید.";
            } else if (!input.value) error = "این فیلد را تکمیل کنید.";
            else if (input.minLength > 0 && input.value.length < input.minLength)
                error = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
            if (input.name === "confirmPassword" && input.value !== data.password)
                error = "تکرار رمز عبور مطابقت ندارد.";
            if (error) {
                fieldError(input, error);
                firstInvalid ||= input;
            }
        }
        if (firstInvalid) {
            firstInvalid.focus();
            return null;
        }
        delete data.confirmPassword;
        return data;
    }

    function displayCode(response) {
        challengeId = response.challengeId;
        showView("otp");
        digits.forEach((input) => {
            input.value = "";
        });
        const title = {
            login: "ورود با رمز یک‌بارمصرف",
            register: "تأیید حساب کاربری",
            reset: "تأیید بازیابی رمز عبور",
        };
        dialog.querySelector("#auth-title-otp").textContent = title[purpose];
        dialog.querySelector("[data-code-submit]").textContent = purpose === "login" ? "ورود" : "تأیید و ادامه";
        // bdi keeps masked phone numbers and emails readable in the RTL sentence.
        const destination = document.createElement("bdi");
        destination.dir = "ltr";
        destination.textContent = maskIdentity(identifier);
        const description = dialog.querySelector("[data-code-description]");
        description.replaceChildren("کد ۶ رقمی ارسال‌شده به ", destination, " را وارد کنید.");
        if (isAuthPreview) {
            description.textContent = "در پیش‌نمایش، کد ۱۲۳۴۵۶ را وارد کنید. پیامک یا ایمیلی ارسال نمی‌شود.";
        }
        startTimer(response.retryAfter);
    }

    function finish(response, text) {
        showView("login");
        clearSecrets();
        message(isAuthPreview ? "پیش‌نمایش با موفقیت بررسی شد؛ ورود یا ساخت حساب واقعی انجام نشده است." : text, "info");
        if (!isAuthPreview) {
            document.dispatchEvent(
                new CustomEvent("auth:success", { detail: { user: response.user || null, purpose } }),
            );
        }
    }

    function sendCode(nextPurpose, value) {
        purpose = nextPurpose;
        identifier = value;
        return run(async (signal) => {
            const response = await authAPI.requestCode({ identifier, purpose }, signal);
            if (!signal.aborted) displayCode(response);
        });
    }

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-auth-open]");
        if (trigger) {
            event.preventDefault();
            open(trigger);
        }
    });
    dialog.addEventListener("close", cleanup);
    dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        dialog.close();
    });
    dialog.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled)")].filter(
            (element) => element.getClientRects().length > 0,
        );
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    });
    window.addEventListener("pagehide", () => {
        if (dialog.open) {
            dialog.close();
            cleanup();
        }
    });
    dialog.addEventListener("pointerdown", (event) => {
        pointerOnBackdrop = event.target === dialog;
    });

    dialog.addEventListener("click", (event) => {
        const target = event.target;
        if (target.closest("[data-auth-close]") || (target === dialog && pointerOnBackdrop)) {
            dialog.close();
            return;
        }
        if (busy) return;
        const switcher = target.closest("[data-auth-view]");
        if (switcher) {
            const currentIdentity = dialog.querySelector(`[data-auth-panel="${view}"] [data-identifier]`);
            if (currentIdentity) identifier = normalizeIdentity(currentIdentity.value);
            showView(switcher.dataset.authView);
        }
        const toggle = target.closest("[data-password-toggle]");
        if (toggle) {
            const input = document.getElementById(toggle.dataset.passwordToggle);
            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            toggle.setAttribute("aria-pressed", String(visible));
            toggle.setAttribute("aria-label", visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور");
            toggle.querySelector("[data-eye-slash]").style.display = visible ? "none" : "";
        }
        if (target.closest("[data-login-otp]")) {
            const input = dialog.querySelector("#auth-login-identity");
            identifier = normalizeIdentity(input.value);
            remember = dialog.querySelector('[data-auth-form="login"] [name="remember"]').checked;
            if (validIdentity(identifier)) sendCode("login", identifier);
            else showView("request");
        }
        if (target.closest("[data-edit-identity]"))
            showView(purpose === "reset" ? "forgot" : purpose === "register" ? "register" : "request");
        if (target.closest("[data-resend]") && !resend.disabled) {
            run(async (signal) => {
                const response = await authAPI.requestCode({ identifier, purpose, challengeId }, signal);
                if (!signal.aborted) displayCode(response);
            });
        }
    });

    dialog.addEventListener("input", (event) => {
        const input = event.target;
        if (!input.matches("input") || input.hasAttribute("data-otp-digit")) return;
        input.removeAttribute("aria-invalid");
        const error = document.getElementById(input.getAttribute("aria-describedby"));
        if (error) {
            error.hidden = true;
            error.textContent = "";
        }
        message();
    });

    // A single input can accept a complete SMS autofill or pasted Persian/Arabic code.
    function distributeCode(value, index) {
        const code = normalizeDigits(value).replace(/\D/g, "");
        const start = code.length >= 6 ? 0 : index;
        if (!code) {
            digits[index].value = "";
            return;
        }
        const clipped = code.slice(0, 6 - start);
        clipped.split("").forEach((digit, offset) => {
            digits[start + offset].value = digit;
        });
        digits[Math.min(start + clipped.length, 5)].focus();
        clearErrors();
        message();
    }
    digits.forEach((input, index) => {
        let pastedCode;
        let pasteCleanup;
        input.placeholder = " ";
        input.addEventListener("focus", () => input.select());
        input.addEventListener("input", () => {
            clearTimeout(pasteCleanup);
            distributeCode(pastedCode ?? input.value, index);
            pastedCode = undefined;
        });
        input.addEventListener("paste", (event) => {
            // Let the browser perform its native paste/autofill action. The
            // following input event distributes the unmodified clipboard code.
            pastedCode = event.clipboardData?.getData("text").slice(0, 4096);
            clearTimeout(pasteCleanup);
            // Native event dispatch runs microtasks before its default input
            // action in some browsers; expire only after that action's task.
            pasteCleanup = setTimeout(() => {
                pastedCode = undefined;
            }, 0);
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" && !input.value && index > 0) {
                event.preventDefault();
                digits[index - 1].value = "";
                digits[index - 1].focus();
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                digits[Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1)))].focus();
            }
        });
    });

    dialog.addEventListener("submit", (event) => {
        const form = event.target.closest("[data-auth-form]");
        if (!form) return;
        event.preventDefault();
        if (busy) return;
        const action = form.dataset.authForm;
        const data = validate(form);
        if (!data) return;
        if (action === "login") {
            identifier = data.identifier;
            purpose = "login";
            remember = form.elements.remember.checked;
            run(async (signal) => {
                const response = await authAPI.login({ identifier, password: data.password, remember }, signal);
                if (!signal.aborted) finish(response, "با موفقیت وارد حساب کاربری شدید.");
            });
        } else if (action === "register") {
            identifier = data.identifier;
            purpose = "register";
            remember = false;
            run(async (signal) => {
                const response = await authAPI.register(data, signal);
                if (!signal.aborted) displayCode(response);
            });
        } else if (action === "forgot" || action === "request") {
            sendCode(action === "forgot" ? "reset" : "login", data.identifier);
        } else if (action === "otp") {
            const code = digits.map((input) => input.value).join("");
            if (!/^\d{6}$/.test(code)) {
                const empty = digits.find((input) => !input.value) || digits[0];
                fieldError(empty, "کد شش‌رقمی را کامل وارد کنید.");
                empty.focus();
                return;
            }
            run(async (signal) => {
                const response = await authAPI.verifyCode({ identifier, challengeId, purpose, code, remember }, signal);
                if (signal.aborted) return;
                if (purpose === "reset") {
                    showView("reset");
                    resetToken = response.resetToken;
                } else
                    finish(
                        response,
                        purpose === "register" ? "حساب کاربری شما تأیید شد." : "با موفقیت وارد حساب کاربری شدید.",
                    );
            });
        } else if (action === "reset") {
            run(async (signal) => {
                const response = await authAPI.resetPassword({ resetToken, password: data.password }, signal);
                if (signal.aborted) return;
                showView("login");
                clearSecrets();
                message(
                    isAuthPreview
                        ? "پیش‌نمایش تغییر رمز تکمیل شد؛ رمز واقعی تغییر نکرده است."
                        : "رمز عبور تغییر کرد؛ با رمز جدید وارد شوید.",
                    "info",
                );
            });
        }
    });
}
