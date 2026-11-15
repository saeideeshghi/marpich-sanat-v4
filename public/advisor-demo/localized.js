// The demo uses sample responses and keeps the case in the current page.
const copyByLanguage = {
    en: {
        close: "Close advisor",
        title: "Let’s clarify your project requirements",
        subtitle: "Marpich Advisor · Interactive demo",
        tabs: ["Conversation", "Product options", "My requirements", "Expert review"],
        steps: ["Understand the need", "Review details", "Prepare a case"],
        intro: "Tell me about your space or ask a question about its ventilation. A short description is enough to start.",
        sample: "We need fresh air for a production workshop, with low noise.",
        useSample: "Try a sample project",
        faq: "What’s the difference between an air handling unit and a fan?",
        answer: "A fan moves air. An air handling unit uses a fan and adds functions such as filtration or temperature control. The right choice depends on your space and system design.",
        next: [
            "I’ve added that to your project summary. What matters most: fresh air, filtration, temperature control, or lower noise?",
            "I’ve updated the summary. If you know the size of the space or the installation constraints, add them next. You can also review the product options.",
            "Your notes are ready to review. Choose any relevant products, then open Expert review to see how the sample case is prepared.",
        ],
        input: "Describe your project or ask a question…",
        send: "Send",
        attach: "Attach a sample file",
        invalidFile: "Choose a PDF, JPG, or PNG no larger than 10 MB.",
        fileAdded: "The filename was added to the demo case. File contents are not uploaded.",
        options: "Select products you would like to discuss. An expert will assess which options fit.",
        products: [
            ["Air handling unit", "Fresh air, filtration and temperature control."],
            ["Industrial fan", "Air supply or extraction for an industrial space."],
            ["Duct silencer", "Helps reduce noise transmitted through the duct network."],
        ],
        summary: "Project notes",
        edit: "Update notes",
        empty: "Add a project description to see the summary here.",
        selected: "Selected products",
        files: "Sample attachments",
        name: "Full name",
        phone: "Phone number",
        consent: "Include these sample contact details in the demo case.",
        prepare: "Prepare sample case",
        caseReady: "Sample case prepared. Nothing was sent.",
    },
    ar: {
        close: "إغلاق المستشار",
        title: "لنحدّد احتياجات مشروعك معًا",
        subtitle: "مستشار ماربيتش · عرض تفاعلي",
        tabs: ["المحادثة", "خيارات المنتجات", "احتياجاتي", "مراجعة الخبير"],
        steps: ["تحديد الاحتياجات", "مراجعة التفاصيل", "إعداد الملف"],
        intro: "أخبرني عن المكان أو اطرح سؤالًا عن التهوية فيه. يكفي وصف قصير للبدء.",
        sample: "نحتاج إلى هواء نقي في ورشة إنتاج مع خفض الضوضاء.",
        useSample: "جرّب مشروعًا نموذجيًا",
        faq: "ما الفرق بين وحدة مناولة الهواء والمروحة؟",
        answer: "تحرّك المروحة الهواء. تستخدم وحدة مناولة الهواء مروحة وتضيف وظائف مثل الترشيح أو التحكم في درجة الحرارة. يعتمد الاختيار على المكان وتصميم النظام.",
        next: [
            "أضفت ما ذكرته إلى ملخص المشروع. ما الأولوية لديك: الهواء النقي أم الترشيح أم التحكم في الحرارة أم خفض الضوضاء؟",
            "حدّثت الملخص. أضف مساحة المكان أو قيود التركيب إذا كانت معروفة، أو انتقل إلى خيارات المنتجات.",
            "ملاحظاتك جاهزة للمراجعة. اختر المنتجات المناسبة للنقاش، ثم افتح مراجعة الخبير لترى كيفية إعداد الملف التجريبي.",
        ],
        input: "صِف مشروعك أو اطرح سؤالًا…",
        send: "إرسال",
        attach: "إرفاق ملف تجريبي",
        invalidFile: "اختر ملف PDF أو JPG أو PNG بحجم لا يتجاوز 10 ميغابايت.",
        fileAdded: "أضيف اسم الملف إلى الملف التجريبي. لا يُرفع محتوى الملف.",
        options: "اختر المنتجات التي تريد مناقشتها. يحدد الخبير الخيارات الملائمة للمشروع.",
        products: [
            ["وحدة مناولة الهواء", "لتوفير هواء نقي وترشيحه والتحكم في درجة حرارته."],
            ["مروحة صناعية", "لتزويد المساحات الصناعية بالهواء أو سحبه منها."],
            ["كاتم صوت لمجاري الهواء", "يساعد على خفض الضوضاء التي تنتقل عبر شبكة المجاري."],
        ],
        summary: "ملاحظات المشروع",
        edit: "تحديث الملاحظات",
        empty: "أضف وصفًا للمشروع ليظهر ملخصه هنا.",
        selected: "المنتجات المختارة",
        files: "المرفقات التجريبية",
        name: "الاسم الكامل",
        phone: "رقم الهاتف",
        consent: "إضافة بيانات الاتصال التجريبية إلى الملف.",
        prepare: "إعداد ملف تجريبي",
        caseReady: "تم إعداد الملف التجريبي. لم تُرسل أي بيانات.",
    },
};
const language = new URLSearchParams(location.search).get("site-lang") === "ar" ? "ar" : "en";
const walkthrough = {
    en: {
        start: "Walk through a sample project",
        next: "Next step",
        back: "Previous step",
        done: "Finish walkthrough",
        sampleContact: "Sample workshop",
        note: "The workshop is 400 m² with a 5 m ceiling. The design airflow is still unknown.",
        detail: [
            "Start with a workshop that needs fresh air and lower noise. The project details appear in the conversation.",
            "Review the air handling unit and duct silencer as options. The engineer checks whether they fit the site.",
            "Edit the project notes here. Missing design airflow remains an item for the engineer to confirm.",
            "Review what the engineer receives. Prepare the sample case below to see the confirmation and the next actions.",
        ],
        expertTitle: "Expert workspace",
        expertNote: "Add a sample review note…",
        expertActions: ["Request more details", "Record technical review", "Prepare sample proposal"],
        expertStatus: ["More details requested", "Technical review recorded", "Sample proposal prepared"],
        expertPrompt: "Review the open questions and record a technical review before preparing a proposal.",
        followup: ["Confirm the design airflow and site constraints", "Review the equipment options", "Prepare a proposal after technical review"],
    },
    ar: {
        start: "استعرض خطوات مشروع نموذجي",
        next: "الخطوة التالية",
        back: "الخطوة السابقة",
        done: "إنهاء الجولة",
        sampleContact: "ورشة نموذجية",
        note: "مساحة الورشة ٤٠٠ م² وارتفاع سقفها ٥ أمتار. معدل تدفق الهواء التصميمي غير معروف بعد.",
        detail: [
            "ابدأ بورشة تحتاج إلى هواء نقي وخفض الضوضاء. تظهر تفاصيل المشروع في المحادثة.",
            "راجع وحدة مناولة الهواء وكاتم صوت مجاري الهواء. يتحقق المهندس من ملاءمتهما للموقع.",
            "يمكنك تعديل ملاحظات المشروع هنا. يبقى معدل تدفق الهواء من النقاط التي يتحقق منها المهندس.",
            "راجع البيانات التي يراها المهندس. جهّز الملف التجريبي أدناه لعرض التأكيد والخطوات التالية.",
        ],
        expertTitle: "مساحة عمل الخبير",
        expertNote: "أضف ملاحظة مراجعة تجريبية…",
        expertActions: ["طلب تفاصيل إضافية", "تسجيل المراجعة الفنية", "إعداد عرض تجريبي"],
        expertStatus: ["تم طلب تفاصيل إضافية", "تم تسجيل المراجعة الفنية", "تم إعداد العرض التجريبي"],
        expertPrompt: "راجع النقاط المفتوحة وسجّل المراجعة الفنية قبل إعداد العرض.",
        followup: ["تأكيد تدفق الهواء وقيود الموقع", "مراجعة خيارات المعدات", "إعداد العرض بعد المراجعة الفنية"],
    },
}[language];
const copy = copyByLanguage[language];
document.documentElement.lang = language;
document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
document.documentElement.dataset.siteLanguage = language;
document.title = copy.title;

const state = { notes: [], products: new Set(), files: [], casePrepared: false };
const root = document.querySelector("#advisor");
const node = (tag, value = "", className = "") => {
    const element = document.createElement(tag);
    element.textContent = value;
    element.className = className;
    return element;
};
const append = (parent, ...children) => {
    parent.append(...children);
    return parent;
};
const button = (value, action, className) => {
    const element = node("button", value, className);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
};
const identity = append(node("div", "", "agent-identity"),
    node("span", "✧", "agent-mark"),
    append(node("span"), node("h2", copy.title), node("small", copy.subtitle)));
identity.firstElementChild.setAttribute("aria-hidden", "true");
const closeButton = button("×", () => {
    window.parent.postMessage({ type: "marpich:advisor-close" }, "*");
}, "icon-button");
closeButton.setAttribute("aria-label", copy.close);
closeButton.hidden = window.parent === window;
const tools = append(node("div", "", "advisor-tools"), closeButton);
const heading = append(node("header", "", "advisor-header"), identity, tools);
const stages = append(node("ol", "", "advisor-stage"), ...copy.steps.map((label) => node("li", label)));
const tabList = node("div", "", "localized-demo__tabs");
tabList.setAttribute("role", "tablist");
tabList.setAttribute("aria-label", copy.title);
const views = copy.tabs.map((title, index) => {
    const view = node("section", "", "localized-demo__view");
    view.id = "demo-view-" + index;
    view.setAttribute("role", "tabpanel");
    view.setAttribute("aria-labelledby", "demo-tab-" + index);
    const tab = button(title, () => selectView(index));
    tab.id = "demo-tab-" + index;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", view.id);
    tabList.append(tab);
    return view;
});
const [chat, products, summary, review] = views;
chat.classList.add("localized-demo__chat");
append(root, heading, stages, tabList, ...views);

const chatLog = node("div", "", "chat-scroll");
chatLog.setAttribute("role", "log");
chatLog.setAttribute("aria-label", copy.tabs[0]);
const message = (role, value) => {
    const text = node("p", value, "localized-demo__message " + role);
    text.dir = "auto";
    chatLog.append(text);
    chatLog.scrollTop = chatLog.scrollHeight;
};
const submitNote = (value) => {
    const text = value.trim();
    if (!text) return;
    state.notes.push(text);
    state.casePrepared = false;
    message("user", text);
    message("assistant", copy.next[Math.min(state.notes.length - 1, copy.next.length - 1)]);
    updateStage();
};
const quick = append(node("div", "", "localized-demo__actions"),
    button(copy.useSample, () => submitNote(copy.sample)),
    button(copy.faq, () => {
        message("user", copy.faq);
        message("assistant", copy.answer);
    })
);
const field = node("textarea");
field.placeholder = copy.input;
field.setAttribute("aria-label", copy.input);
field.rows = 2;
field.maxLength = 1200;
const send = node("button", copy.send, "send-button");
send.type = "submit";
const form = append(node("form", "", "composer"), field, send);
form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitNote(field.value);
    field.value = "";
});
const file = node("input");
file.type = "file";
file.accept = ".pdf,.jpg,.jpeg,.png";
file.hidden = true;
file.addEventListener("change", () => {
    const [sample] = file.files;
    if (!sample) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(sample.name) || sample.size > 10 * 1024 * 1024) {
        message("assistant", copy.invalidFile);
    } else {
        state.files.push(sample.name);
        state.casePrepared = false;
        message("assistant", copy.fileAdded);
    }
    file.value = "";
});
quick.append(button(copy.attach, () => file.click()), file);
append(chat, chatLog, quick, form);
message("assistant", copy.intro);

append(products, node("p", copy.options), ...copy.products.map(([name, info], index) => {
    const input = node("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
        if (input.checked) state.products.add(index);
        else state.products.delete(index);
        state.casePrepared = false;
    });
    return append(node("label", "", "localized-demo__option"),
        input, append(node("span"), node("strong", name), node("small", info)));
}));

const notes = node("textarea");
notes.rows = 5;
notes.setAttribute("aria-label", copy.summary);
append(summary, node("h3", copy.summary), notes,
    button(copy.edit, () => {
        state.notes = notes.value.trim() ? [notes.value.trim()] : [];
        state.casePrepared = false;
        updateStage();
    }, "button"));
const reviewNotes = node("div");
const caseStatus = node("p");
const followup = append(node("ol"), ...walkthrough.followup.map((text) => node("li", text)));
followup.hidden = true;
caseStatus.setAttribute("role", "status");
const contactField = (label, type) => {
    const input = node("input");
    input.type = type;
    input.required = true;
    return append(node("label", "", "field"), node("span", label), input);
};
const consent = node("input");
consent.type = "checkbox";
consent.required = true;
const prepare = node("button", copy.prepare, "button");
prepare.type = "submit";
const reviewForm = append(node("form", "", "localized-demo__review"),
    contactField(copy.name, "text"), contactField(copy.phone, "tel"),
    append(node("label", "", "localized-demo__consent"), consent, node("span", copy.consent)), prepare);
reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.casePrepared = true;
    caseStatus.textContent = copy.caseReady;
    followup.hidden = false;
    updateStage();
});
const expertNote = node("textarea");
expertNote.placeholder = walkthrough.expertNote;
expertNote.setAttribute("aria-label", walkthrough.expertNote);
expertNote.rows = 2;
const expertHistory = node("ul");
expertHistory.setAttribute("aria-live", "polite");
const expertPrompt = node("p", walkthrough.expertPrompt);
const expertActions = append(node("div", "", "localized-demo__actions"));
const expert = append(node("section", "", "localized-demo__expert"),
    node("h3", walkthrough.expertTitle), followup, expertPrompt, expertNote, expertActions, expertHistory);
expert.hidden = true;
const decisions = walkthrough.expertActions.map((label, index) => button(label, () => {
    const note = expertNote.value.trim();
    append(expertHistory, node("li", [walkthrough.expertStatus[index], note].filter(Boolean).join(" — ")));
    expertNote.value = "";
    if (index < 2) decisions[2].disabled = index !== 1;
    if (index === 2) decisions[2].disabled = true;
}));
decisions[2].disabled = true;
expertActions.append(...decisions);
reviewForm.addEventListener("submit", () => {
    expertHistory.replaceChildren();
    expertNote.value = "";
    decisions[2].disabled = true;
    expert.hidden = false;
    expert.scrollIntoView({ block: "nearest" });
});
append(review, reviewNotes, reviewForm, caseStatus, expert);

function updateStage() {
    const current = state.casePrepared ? 2 : state.notes.length ? 1 : 0;
    [...stages.children].forEach((step, index) => {
        if (current === index) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
    });
}
function selectView(index) {
    views.forEach((view, i) => {
        view.hidden = i !== index;
        const tab = tabList.children[i];
        tab.tabIndex = i === index ? 0 : -1;
        tab.setAttribute("aria-selected", String(i === index));
    });
    if (index === 2) {
        notes.value = state.notes.join("\n\n");
        notes.placeholder = copy.empty;
    }
    if (index === 3) {
        reviewNotes.replaceChildren(node("h3", copy.summary), node("p", state.notes.join("\n") || copy.empty));
        if (state.products.size) append(reviewNotes, node("h3", copy.selected), node("p", [...state.products].map((i) => copy.products[i][0]).join(" · ")));
        if (state.files.length) append(reviewNotes, node("h3", copy.files), node("p", state.files.join(" · ")));
        caseStatus.textContent = state.casePrepared ? copy.caseReady : "";
        followup.hidden = !state.casePrepared;
        expert.hidden = !state.casePrepared;
    }
}
tabList.addEventListener("keydown", (event) => {
    const current = [...tabList.children].indexOf(event.target);
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    const offset = event.key === "ArrowRight" ? direction : event.key === "ArrowLeft" ? -direction : 0;
    if (current < 0 || !offset) return;
    event.preventDefault();
    const index = (current + offset + views.length) % views.length;
    selectView(index);
    tabList.children[index].focus();
});
const guide = node("section", "", "localized-demo__guide");
const instruction = node("p");
instruction.setAttribute("aria-live", "polite");
let currentStep = 0;
const back = button(walkthrough.back, () => showStep(currentStep - 1));
const next = button(walkthrough.next, () => {
    if (currentStep === views.length - 1) {
        guide.hidden = true;
        tabList.children[currentStep].focus();
        return;
    }
    showStep(currentStep + 1);
});
function showStep(index) {
    currentStep = index;
    instruction.textContent = walkthrough.detail[index];
    back.disabled = index === 0;
    next.textContent = index === views.length - 1 ? walkthrough.done : walkthrough.next;
    selectView(index);
    next.focus({ preventScroll: true });
}
append(guide, instruction, append(node("div", "", "localized-demo__actions"), back, next));
guide.hidden = true;
const start = button(walkthrough.start, () => {
    if (!state.notes.length) {
        submitNote(copy.sample);
        submitNote(walkthrough.note);
        const productOptions = products.querySelectorAll("input");
        for (const index of [0, 2]) {
            if (!productOptions[index].checked) productOptions[index].click();
        }
        const [name, phone] = reviewForm.querySelectorAll('input:not([type="checkbox"])');
        if (!name.value) name.value = walkthrough.sampleContact;
        if (!phone.value) phone.value = "000 000 0000";
    }
    guide.hidden = false;
    showStep(0);
}, "button");
tools.prepend(start);
tabList.after(guide);
selectView(0);
updateStage();
