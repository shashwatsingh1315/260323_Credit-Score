# Design System & UX Architecture (Aura ✨)

## Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## Aesthetic
Premium, clean, high-contrast, and scalable. Influences include Uber, Linear, and Apple.
- **Continuous Curve Radii:** ('squircles')
- **Multi-stop Elevations:** Smooth and layered drop shadows.
- **Chromatic Darkness:** Dark modes feature rich deep colors.
- **Physics-driven Transition:** Transitions should feel snappy yet natural.
- **Semantic Color Muting:** Intelligent use of muted states.
- **Structural Whitespace:** Spacing that leads the eye intuitively.

## Token Scales

### 1. Colors (Semantic HSL Tokens)
All colors use HSL and `<alpha-value>` to easily hook into opacity scaling.
- **Background:** `hsl(var(--background))`
- **Surface (Cards):** `hsl(var(--card))`
- **Popover:** `hsl(var(--popover))`
- **Text (Primary):** `hsl(var(--foreground))`
- **Text (Muted):** `hsl(var(--muted-foreground))`
- **Action (Primary):** `hsl(var(--primary))`
- **Action (Secondary):** `hsl(var(--secondary))`
- **Border:** `hsl(var(--border))`
- **Input:** `hsl(var(--input))`
- **Ring:** `hsl(var(--ring))`

*Legacy hex colors (`--bg-primary`, `--text-primary`, etc.) are actively deprecated.*

### 2. Typography
A unified typographic hierarchy emphasizing readability and premium presentation.
- **Display:** Used for large headings. High contrast, tight tracking.
- **Body:** Clean sans-serif, standard line-heights for readability. (e.g., `font-sans` with `var(--font-inter)`)
- **Monospace:** For technical data.

### 3. Spacing (Base-4/8 System)
Consistent application of padding and margin using Tailwind's 4px base (e.g., `p-4` = 16px, `p-6` = 24px, `gap-2` = 8px). Avoid magic numbers like 13px or 17px.

### 4. Elevation / Shadows
Multi-layered, high-quality shadows rather than stark, flat borders for floating elements. Use shadows sparingly to indicate z-axis depth.

### 5. Radii
Standardized rounded corners for consistency across the application.
- **Large (`rounded-lg`):** `var(--radius)` (e.g., 0.75rem / 12px)
- **Medium (`rounded-md`):** `calc(var(--radius) - 2px)` (e.g., 10px)
- **Small (`rounded-sm`):** `calc(var(--radius) - 4px)` (e.g., 8px)
