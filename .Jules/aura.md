## 2024-05-24 - Typography Scale Cleanup
**Learning:** Found multiple instances of hardcoded `text-[10px]` magic numbers, which violate our typography scale. We actually have a designated `text-tiny` token in `tailwind.config.js` (`10px` size with `14px` line-height).
**Action:** Replaced all `text-[10px]` with `text-tiny` across the application to enforce the tokenized typography scale. Created `DESIGN_STYLE.md` to document the primary layout and variables.

## 2024-05-24 - Semantic Color Implementation
**Learning:** Found multiple instances of hardcoded Tailwind color palettes (e.g. `bg-green-50`, `text-green-800`, `text-red-500`, `bg-amber-500/10`) which breaks Dark Mode support and visual consistency.
**Action:** Replace direct tailwind color palettes with semantic token mappings (`success`, `destructive`, `attention`, `warning`).
