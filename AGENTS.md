# Project rules

- The current product uses 12 shared templates in Persian, English and Arabic (36 routes). Work from this repository; do not introduce separately designed localized homepages.
- Preserve the approved Persian layout, assets, customizer settings and motion. Keep English-only CSS in the locale output/overrides. Arabic keeps RTL and the existing Peyda family.
- Edit root templates, shared components and page data once. Localized HTML files are build entries, not duplicate content sources.
- Register every new message in the source and both locale dictionaries. Runtime interface messages also belong in runtime-source.json. Keep placeholders and technical identifiers unchanged.
- Run relevant checks, including check:localization and build:backend for locale changes. Use browser checks for direction, font, navigation and UI behavior. Do not claim browser verification unless a browser was actually used.
- Keep secrets, private certificates, caches, node_modules and generated dist out of Git. GitHub source publication is authorized for this version; do not enable automatic public-site deployment without a request.
- Do not create delegates or subagents unless the user explicitly asks for them.
