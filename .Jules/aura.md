## 2025-05-18 - CSS Modules use hardcoded CSS variables instead of HSL token variables
**Learning:** Legacy CSS files use CSS variables like `var(--bg-primary)` instead of the new standard `hsl(var(--background))` or Tailwind classes. This violates the color scalability and standard dark mode compatibility.
**Action:** Extract these hardcoded variables and map them to the corresponding Tailwind classes or HSL tokens (`hsl(var(--background))`, `hsl(var(--foreground))`, `hsl(var(--card))`, etc.) in all CSS Modules throughout the app.
