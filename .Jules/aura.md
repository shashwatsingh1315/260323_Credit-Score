## 2024-04-24 - Initial Design System Standardization
**Learning:** Found multiple instances of arbitrary spacing (e.g. `w-[200px]`, `w-[100px]`), arbitrary typography (`text-[10px]`), and inline styles for interactive states (`style={{ opacity: 0.5 }}`).
**Action:** Replace arbitrary sizing with base-4 tokens (`w-52`, `text-tiny`), replace inline styles with Tailwind pseudo-classes (`disabled:opacity-50`), and strictly enforce the baseline tokens.
