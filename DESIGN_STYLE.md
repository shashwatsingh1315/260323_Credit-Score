# 📐 Aura: Design System & Styling Doctrine

## The Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## The Standard

### 1. 🎨 Colors & Theming
- **Strict Prohibition of Hardcoded Hex/RGB:** Never use arbitrary colors (e.g., `#141414`, `rgba(0,0,0,0.5)`) in component files.
- **Semantic Token Reliance:** Strictly use standard Tailwind semantic color variables (e.g., `bg-background`, `text-muted-foreground`, `border-border`).
- **Standard HSL Scale:** All custom colors added to the system must use the HSL variable format to ensure Dark Mode compatibility (e.g., `hsl(var(--primary))`).

### 2. 📏 Spacing & Sizing
- **The Base-4/Base-8 Grid:** Rely strictly on Tailwind’s default integer spacing scale (e.g., `p-4`, `m-2`, `gap-3`).
- **No Magic Numbers:** Never use arbitrary bracket notation for sizing or spacing unless absolutely required by a third-party library calculation or complex CSS-Grid masonry (e.g., avoid `w-[200px]`, `mt-[13px]`, `min-h-[80px]`).

### 3. ✍️ Typography
- **Semantic Font Tokens:** Utilize standardized text scaling (e.g., `text-sm`, `text-lg`).
- **Micro Typography:** For subtext, labels, and badges, use the newly introduced configuration tokens `text-tiny` and `text-micro` instead of bracket notation (e.g., `text-[10px]`, `text-[11px]`).

### 4. 🔲 Borders & Radii
- **Standardized Curves:** Use explicit border-radius tokens (e.g., `rounded-md`, `rounded-xl`).
- **Consistent Borders:** Almost all bordered elements should use `border-border` to ensure low-contrast structure that supports high-contrast text.

### 5. ⚡ Animations
- **Snappy Transitions:** Animations must be fast and purposeful. Use predefined timing functions (e.g., `duration-200`, `ease-out`). Avoid long, overly complex animations that reduce perceived performance.

## The Process
When modifying styles, follow the workflow: Envision & Document -> Tokenize -> Refactor -> Verify -> Present.

*Document maintained by Aura ✨*
