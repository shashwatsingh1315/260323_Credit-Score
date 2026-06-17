## 2024-04-20 - [Arbitrary Values Cleanup]
**Learning:** Found scattered instances of magic numbers across components and UI forms (e.g. `w-[200px]`, `h-[50vh]`, `max-h-[400px]`). This breaks the strict spacing scale and creates inconsistent rhythms.
**Action:** Replace all arbitrary Tailwind brackets with standard base-4/base-8 spacing tokens.
