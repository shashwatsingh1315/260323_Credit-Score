# Design Style Document (Aura)

## Core Philosophy
The design system emphasizes rigorous consistency, purposeful whitespace, crisp typography, and high-contrast intentional colors.
Hardcoded styles are avoided; design tokens are treated as scalable assets.

## Token Scales

### 1. Colors (Semantic HSL Tokens)
All colors are defined using HSL values mapped to variables (e.g., `hsl(var(--background))`).

- **Backgrounds**
  - `--background`: Primary page background.
  - `--card`: Surface for elevated containers.
  - `--popover`: Surface for floating elements.
  - `--muted`: Secondary/tertiary surface backgrounds.
- **Text**
  - `--foreground`: Primary text color.
  - `--muted-foreground`: Secondary text or labels.
- **Actions & States**
  - `--primary`: Main action color.
  - `--secondary`: Secondary action color.
  - `--accent`: Accent highlights.
  - `--destructive`: Error or destructive actions.
  - `--border`: Standard borders.
  - `--input`: Form input borders/backgrounds.
  - `--ring`: Focus rings.
- **Semantic Feedback**
  - `--color-success`: Positive state.
  - `--color-warning`: Cautionary state.
  - `--color-info`: Informational state.
  - `--color-attention`: High priority state.
  - `--color-brand`: Brand specific highlights.

*(All tokens must support opacity via Tailwind's `<alpha-value>` placeholder: `hsl(var(--token) / <alpha-value>)` or raw CSS: `hsla(var(--token) / 0.5)`).*

### 2. Typography
- **Font Stack**: Inter, system-ui, sans-serif.
- **Scales** (Tailwind standard mappings):
  - `text-tiny`: 10px / 14px (Special case)
  - `text-xs`: 12px
  - `text-sm`: 14px
  - `text-base`: 16px
  - `text-lg`: 18px
  - `text-xl`: 20px
  - `text-2xl`: 24px
  - `text-3xl`: 30px

### 3. Spacing Rhythm (Base-4/8)
Padding, margin, and gaps strictly follow a 4px/8px rhythm via standard Tailwind sizing (e.g., `p-2` = 8px, `gap-4` = 16px, `mt-6` = 24px).
*No magic numbers (e.g., 13px, 17px).*

### 4. Elevation & Shadows
- Shadows must utilize standard semantic tokens (e.g., `shadow-sm`, `shadow-md`, `shadow-lg`) avoiding arbitrary RGBA boxing when possible.
- Multi-stop elevations are preferred for floating components.

### 5. Radii ("Squircles" approximation)
- `--radius`: Base rounded corner radius (typically 0.75rem / 12px for modern cards).
- Scales adjust down for nested elements:
  - `.rounded-lg`: `var(--radius)`
  - `.rounded-md`: `calc(var(--radius) - 2px)`
  - `.rounded-sm`: `calc(var(--radius) - 4px)`

## CSS Modules Refactoring Guide
When migrating `*.module.css` files:
1. Replace legacy hex var `--bg-primary` with `hsl(var(--background))`.
2. Replace `--bg-secondary` with `hsl(var(--card))`.
3. Replace `--bg-tertiary` with `hsl(var(--muted))`.
4. Replace `--text-primary` with `hsl(var(--foreground))`.
5. Replace `--text-secondary` and `--text-muted` with `hsl(var(--muted-foreground))`.
6. Replace `--border-primary` and `--border-color` with `hsl(var(--border))`.
7. Replace `--accent-primary` with `hsl(var(--accent))`.
8. Avoid `rgba(255, 255, 255, 0.04)`, use `hsla(var(--foreground) / 0.04)` for theme-adaptive semi-transparency.
