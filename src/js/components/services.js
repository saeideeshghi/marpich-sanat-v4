/** Single-open service disclosures. HTML details remain readable without JS.
 * Keep each trigger's aria-controls equal to the details panel ID when using CMS.
 */
export function initServiceDisclosures(scope = document) {
    const services = [...scope.querySelectorAll("[data-service]")];
    const controls = [];
    const openOnly = (selected) => {
        for (const control of controls) control.setOpen(control === selected);
    };
    services.forEach((service) => {
        if (service.dataset.initialized) return;
        const trigger = service.querySelector("[data-service-toggle]");
        const panel = service.querySelector("[data-service-details]");
        const label = trigger?.querySelector("[data-service-label]");
        if (!trigger || !panel || !label) return;
        service.dataset.initialized = "true";
        trigger.setAttribute("role", "button");
        const setOpen = (open) => {
            trigger.setAttribute("aria-expanded", String(open));
            panel.hidden = !open;
            service.classList.toggle("is-open", open);
            label.textContent = open ? "بستن جزئیات" : "مطالعه بیشتر";
        };
        const toggle = (event) => {
            event.preventDefault();
            if (trigger.getAttribute("aria-expanded") === "true") setOpen(false);
            else openOnly(controls.find((control) => control.service === service));
        };
        trigger.addEventListener("click", toggle);
        trigger.addEventListener("keydown", (event) => {
            if (event.key === " ") toggle(event);
        });
        setOpen(false);
        controls.push({ service, panel, setOpen });
    });
    if (!controls.length) return;
    const revealHash = () => {
        let id;
        try {
            id = decodeURIComponent(location.hash.slice(1));
        } catch {
            return;
        }
        const match = controls.find(({ service, panel }) => service.id === id || panel.id === id);
        if (match) openOnly(match);
    };
    window.addEventListener("hashchange", revealHash);
    revealHash();
}
