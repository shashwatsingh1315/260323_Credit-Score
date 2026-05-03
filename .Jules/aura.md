## 2025-05-03 - [Magic Numbers & Inline Styles Cleanup]
**Learning:** Found usage of arbitrary spacing bracket notation (e.g., `w-[200px]`, `min-h-[80px]`, `h-[50vh]`) and inline opacity styling (`style={{ opacity: canGoNext(1) ? 1 : 0.5 }}`). These conflict with the rigorous base-4 rhythm and declarative utility-class tokens we must enforce.
**Action:** Replace arbitrary sizing brackets with closest Tailwind tokens (`w-48` or `w-52` for 200px, `min-h-20` for 80px) and convert inline styles for disabled state opacity to Tailwind modifiers (`disabled:opacity-50`).
