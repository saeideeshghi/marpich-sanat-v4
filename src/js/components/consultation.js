// The established design has separate desktop and mobile forms. Synchronize
// matching fields so a resize never drops a partially entered request.
export function initConsultationForms(scope = document) {
    scope.querySelectorAll("[data-consultation]").forEach((section) => {
        if (section.dataset.formSyncInitialized) return;
        section.dataset.formSyncInitialized = "true";
        const forms = [...section.querySelectorAll("form")];
        const syncField = (field) => {
            if (!field.name || field.type === "file") return;
            const isChoice = ["checkbox", "radio"].includes(field.type);
            forms.forEach((other) => {
                if (other === field.form) return;
                const target = [...other.elements].find(
                    (input) => input.name === field.name && (!isChoice || input.value === field.value),
                );
                if (!target) return;
                if (isChoice) target.checked = field.checked;
                else target.value = field.value;
            });
        };
        for (const form of forms) {
            for (const eventName of ["input", "change"]) {
                form.addEventListener(eventName, (event) => syncField(event.target));
            }
            // Native reset restores defaults after the reset event has fired.
            form.addEventListener("reset", (event) => {
                queueMicrotask(() => {
                    if (!event.defaultPrevented) [...form.elements].forEach(syncField);
                });
            });
        }
    });
}
