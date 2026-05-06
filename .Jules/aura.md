## 2025-05-06 - Initial Aesthetic Audit
**Learning:** Legacy UI elements have inline styles representing disabled states (`style={{ opacity: canGoNext(X) ? 1 : 0.5 }}`).
**Action:** Replace these with standard Tailwind `disabled:opacity-50 disabled:pointer-events-none` utility classes per strict design system guidelines.
