## 2024-06-09 - Design Token Refactor: text-tiny
**Learning:** Discovered arbitrary text size `text-[10px]` and `text-[11px]` scattered across components. This conflicts with the configured `text-tiny` token defined in `tailwind.config.js`.
**Action:** Replace all instances of `text-[10px]` and `text-[11px]` with `text-tiny` to ensure standardized typography scale across the application.
