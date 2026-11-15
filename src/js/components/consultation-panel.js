import { initAdvisorFonts } from "./advisor-fonts.js";
import { initPendingForms } from "./pending-forms.js";

export function initConsultationPanel(scope = document) {
    const template = scope.querySelector("template[data-consultation-panel-template]");
    const launcher = scope.querySelector(".site-agent-cta");
    if (!template || !launcher) return;

    const triggers = [launcher, ...scope.querySelectorAll('a[href="#consultation"]')];
    const panel = template.content.firstElementChild.cloneNode(true);
    launcher.before(panel);
    initPendingForms(panel);

    const tabs = [...panel.querySelectorAll('[role="tab"]')];
    const demoTab = panel.querySelector("#agent-tab-demo");
    const demoFrame = panel.querySelector("#agent-demo iframe");
    initAdvisorFonts(demoFrame, document.documentElement.lang);
    const stages = [...panel.querySelectorAll(".site-agent-panel__stages li")];
    const composer = panel.querySelector(".site-agent-panel__composer");
    const input = composer.querySelector("textarea");
    const messages = panel.querySelector(".site-agent-panel__scroll");
    const request = panel.querySelector("[data-pending-form]");
    const summary = panel.querySelector("[data-agent-summary]");
    const expand = panel.querySelector("[data-agent-expand]");
    let opener = launcher;

    function selectTab(selected) {
        const demoSelected = selected === demoTab;
        panel.classList.toggle("is-demo", demoSelected);
        if (demoSelected && !demoFrame.hasAttribute("src")) {
            // Vite snapshots its generated public directory at startup. Serve the source copy in development.
            const siteLanguage = document.documentElement.lang;
            const directory = import.meta.env.DEV ? "public/advisor-demo/" : "advisor-demo/";
            const entry = siteLanguage === "fa" ? "index.html" : "localized.html";
            demoFrame.src =
                import.meta.env.BASE_URL + directory + entry + "?site-lang=" + encodeURIComponent(siteLanguage);
        }
        tabs.forEach((tab) => {
            const active = tab === selected;
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
            panel.querySelector("#" + tab.getAttribute("aria-controls")).hidden = !active;
        });
        const step = selected === tabs[2] ? 2 : summary.hidden ? 0 : 1;
        stages.forEach((stage, index) => {
            if (index === step) stage.setAttribute("aria-current", "step");
            else stage.removeAttribute("aria-current");
        });
    }

    function close() {
        panel.close();
        panel.hidden = true;
        panel.classList.remove("is-expanded");
        expand.setAttribute("aria-pressed", "false");
        triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
        if (opener.isConnected) opener.focus({ preventScroll: true });
    }

    for (const trigger of triggers) {
        trigger.setAttribute("aria-controls", panel.id);
        trigger.setAttribute("aria-expanded", "false");
        trigger.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (!panel.hidden) {
                close();
                return;
            }
            opener = trigger;
            panel.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            selectTab(demoTab);
            panel.showModal();
            demoFrame.focus({ preventScroll: true });
        });
    }

    panel.querySelector("[data-agent-close]").addEventListener("click", close);
    window.addEventListener("message", (event) => {
        if (event.source === demoFrame.contentWindow && event.data?.type === "marpich:advisor-close" && panel.open)
            close();
    });
    panel.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
    });
    expand.addEventListener("click", () => {
        expand.setAttribute("aria-pressed", String(panel.classList.toggle("is-expanded")));
    });
    panel.querySelector("[data-agent-help]").addEventListener("click", () => {
        selectTab(tabs[0]);
        messages.scrollTop = 0;
        messages.querySelector("[data-agent-compose]").focus({ preventScroll: true });
    });
    panel.querySelectorAll("[data-agent-compose]").forEach((button) => {
        button.addEventListener("click", () => input.focus());
    });
    panel.addEventListener("keydown", (event) => {
        const index = tabs.indexOf(event.target);
        if (index < 0) return;
        const rtl = document.documentElement.dir === "rtl";
        const offset = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (index + offset + tabs.length) % tabs.length;
        selectTab(tabs[next]);
        tabs[next].focus();
    });
    tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab)));

    composer.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (!message) return;
        const bubble = document.createElement("p");
        bubble.className = "site-agent-panel__bubble site-agent-panel__bubble--user";
        bubble.dir = "auto";
        bubble.textContent = message;
        messages.append(bubble);
        summary.textContent = [summary.textContent, message].filter(Boolean).join("\n\n");
        request.elements.description.value = summary.textContent;
        summary.hidden = false;
        panel.querySelector("[data-agent-empty]").hidden = true;
        request.hidden = false;
        input.value = "";
        selectTab(tabs[2]);
        tabs[2].focus({ preventScroll: true });
    });
}
