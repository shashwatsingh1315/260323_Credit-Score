## 2024-05-18 - [Tokenized Sizing and Typography Refactor]
**Learning:** Found widespread use of hardcoded magic numbers for typography (`text-[10px]`, `text-[11px]`) and spacing/sizing (`w-[200px]`, `max-w-[200px]`, `min-h-[80px]`). This violates the core design token philosophy and breaks consistency.
**Action:** Replace all magic arbitrary values with exact or nearest matching Tailwind utility tokens (e.g., `text-tiny`, `w-48`, `min-h-20`). Documented in DESIGN_STYLE.md.
