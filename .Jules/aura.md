## DESIGN SYSTEM JOURNAL
## 2024-06-18 - Missing Micro Typography Token
**Learning:** Found widespread use of `text-[11px]` across `CollectionsClient.tsx` and other files for minor structural text and hints. This wasn't mapped in `tailwind.config.js`.
**Action:** Added `micro: ['11px', '16px']` to the Tailwind typography scale and replaced `text-[11px]` with `text-micro`. Replaced `text-[10px]` with `text-tiny`.
## 2024-06-18 - Replacing arbitrary bracket notations
**Learning:** Found arbitrary sizing like `w-[200px]`, `max-h-[400px]`, `min-w-[8rem]`, `w-[1px]` scattered across UI and application components, avoiding the established Tailwind spacing scales.
**Action:** Replaced bracket notations with standard Tailwind sizing tokens (e.g. `w-48`, `max-h-96`, `min-w-32`, `w-px`) to maintain spacing rhythm. Note: preserved structural CSS custom properties like `var(--radix-select-trigger-height)` in bracket notations as those are dynamic values injected by Radix UI.
