# High-End Design Style Document (Aura)

## Philosophy

True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user. Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## Aesthetic Principles

- **Continuous Curve Radii ("Squircles"):** Standardized, smooth, consistent border-radii across interactive elements and containers.
- **Multi-stop Elevations:** Shadows and overlays use multi-layer properties for deep, physically-driven realism, instead of flat harsh drops.
- **Chromatic Darkness:** Dark modes utilize deep, slightly saturated cool tones instead of raw `#000000` or `#111111`.
- **Physics-driven Transitions:** Easing functions follow physical velocity curves (`cubic-bezier` for snappy-yet-smooth interactions).
- **Semantic Color Muting:** Surfaces gracefully lower contrast to recess content, rather than arbitrarily fading opacities.
- **Structural Whitespace:** Strict adherence to a Base-4 / Base-8 spacing scale.

## Tokens Architecture

### 1. Color System (Semantic HSL Tokens)
All colors must be defined as HSL values (e.g. `222 47% 11%`) so they can utilize `<alpha-value>` modifiers in Tailwind via `hsl(var(--token) / <alpha-value>)`.

- **Background & Surfaces**
  - `--background`: Base background (app canvas).
  - `--surface-primary`: Primary containers (cards, modal bodies).
  - `--surface-secondary`: Secondary, slightly recessed containers (sidebars, secondary panels).
  - `--surface-tertiary`: Deeply recessed containers (input fields, dropdown menus).

- **Text**
  - `--text-primary`: High-contrast main text (headings, active states).
  - `--text-secondary`: Mid-contrast text (body text, subtitles).
  - `--text-muted`: Low-contrast text (placeholders, disabled text, deep meta-text).
  - `--text-inverse`: Used on primary solid backgrounds.

- **Action & Brand**
  - `--brand`: The core brand identity color.
  - `--brand-hover`: Hover state for brand color.
  - `--action-primary`: Primary call to action buttons.
  - `--action-secondary`: Secondary interaction surfaces.

- **Borders & Dividers**
  - `--border-primary`: Standard borders (cards, tables).
  - `--border-focus`: High visibility focus ring indicator.

- **Status (Feedback)**
  - `--success` / `--success-foreground`
  - `--warning` / `--warning-foreground`
  - `--destructive` / `--destructive-foreground`
  - `--info` / `--info-foreground`

### 2. Typography Scale
Consistent, structured text styles using variable font rendering (`Inter`).

- **Display**: Used for marketing or large hero elements.
- **Heading 1-3**: Semantic structural page headings.
- **Body**: Standard text for reading.
- **Small / Tiny**: Metatext, labels, badges.

### 3. Spacing Rhythm
Strict spacing scale mapped directly to Tailwind spacing variables (Base-4 scale).

- `spacing-1` (4px)
- `spacing-2` (8px)
- `spacing-3` (12px)
- `spacing-4` (16px) - *Default Padding/Margin*
- `spacing-6` (24px) - *Section gaps*
- `spacing-8` (32px) - *Page-level structural padding*
- `spacing-12` (48px)

### 4. Elevations (Shadows & Blurs)
Multi-layered shadows and backdrop blurs mapping structural hierarchy.

- **Level 1 (Subtle):** Low resting state (Cards, inputs).
- **Level 2 (Hover/Focus):** Elevated interactive state.
- **Level 3 (Floating):** Dropdowns, tooltips, sticky navigation.
- **Level 4 (Modal):** High z-index overlays with accompanying background blur (`backdrop-blur-md`).

### 5. Radii Scale
- `radius-sm`: Small inputs, badges, inner elements (`4px - 6px`).
- `radius-md`: Standard buttons, inputs, minor containers (`8px`).
- `radius-lg`: Primary structural cards, modals, image containers (`12px - 16px`).
- `radius-full`: Circular elements, pills, avatars (`9999px`).

## Usage Boundaries

- **Never** use hardcoded Hex values (e.g., `#FF0000`).
- **Never** use magic number spacing (e.g., `p-[17px]`).
- **Never** manually set opacities using `rgba()` when an alpha-channel token can be used `bg-brand/10`.
- **Always** apply hover/focus states consistently using the defined action tokens.
