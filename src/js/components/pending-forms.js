/* Shared fallback until consultation endpoints are available. */
export function initPendingForms() {
    document.querySelectorAll("[data-pending-form]").forEach((form) => {
        if (form.dataset.pendingInitialized) return;
        form.dataset.pendingInitialized = "true";
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            // A backend adapter claims this event synchronously with
            // preventDefault(), then owns loading/error/success UI. No endpoint
            // is assumed here. FormData belongs only to the submitted layout.
            const request = new CustomEvent("consultation:submit", {
                bubbles: true,
                cancelable: true,
                detail: { form, formData: new FormData(form) },
            });
            if (!form.dispatchEvent(request)) return;
            let status = form.querySelector("[data-pending-status]");
            if (!status) {
                status = document.createElement("p");
                status.dataset.pendingStatus = "";
                status.className = "pending-form-status";
                status.setAttribute("role", "status");
                form.append(status);
            }
            status.textContent = "ثبت آنلاین درخواست هنوز فعال نیست؛ لطفاً از راه‌های تماس با ما استفاده کنید.";
        });
    });
}
