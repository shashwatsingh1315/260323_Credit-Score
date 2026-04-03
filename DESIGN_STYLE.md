# Aura Design System — Premium & Unified Aesthetic

True elegance comes from rigorous consistency. This design system establishes a unified visual language using strictly scalable, semantic HSL tokens to ensure harmony across both light and dark themes.

## 1. Color Primitives & Semantic Tokens
We use HSL-based variables mapped to functional concepts to guarantee uniform contrast and accessibility. No hardcoded hex values should be present in our UI.

### Backgrounds & Surfaces
- **Background (`hsl(var(--background))`)**: Base page background.
- **Card/Surface (`hsl(var(--card))`)**: Elevated containers and widgets.
- **Popover (`hsl(var(--popover))`)**: Dropdowns, dialogs, and floating elements.
- **Muted/Tertiary (`hsl(var(--muted))`)**: Subtle backgrounds for input groups or inactive areas.

### Text Hierarchy
- **Foreground/Primary Text (`hsl(var(--foreground))`)**: Default body text and headings.
- **Muted Text (`hsl(var(--muted-foreground))`)**: Secondary labels, timestamps, and helper copy.

### Interactive & Action Tokens
- **Primary Action (`hsl(var(--primary))`)**: Key buttons and active states.
- **Primary Action Text (`hsl(var(--primary-foreground))`)**: Text on primary buttons.
- **Secondary Action (`hsl(var(--secondary))`)**: Alternate actions, tabs.
- **Accent/Hover (`hsl(var(--accent))`)**: Hover states for standard interactives.
- **Focus Ring (`hsl(var(--ring))`)**: Uniform focus indicator for keyboard navigation.

### Structural & Borders
- **Border (`hsl(var(--border))`)**: Standard dividing lines and container borders.
- **Input Border (`hsl(var(--input))`)**: Form input borders.

### Status & Feedback Colors
- **Success (`hsl(var(--color-success))`)**: Positive outcomes.
- **Destructive/Error (`hsl(var(--destructive))`)**: Critical errors, destructive actions.
- **Warning (`hsl(var(--color-warning))`)**: Cautions.
- **Info (`hsl(var(--color-info))`)**: Neutral systemic feedback.
- **Attention (`hsl(var(--color-attention))`)**: Required user focus areas.
- **Brand (`hsl(var(--color-brand))`)**: Special branding accents.

## 2. Typography
A premium interface demands crisp, legible, and hierarchical typography.
- **Font Family**: Primary font stack is `var(--font-inter), system-ui, sans-serif`.
- Use consistent sizing classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`) avoiding arbitrary font-size injections.

## 3. Spacing & Rhythm
We employ a rigid, consistent spacing scale (typically base-4 or base-8) leveraging Tailwind's spacing classes (`p-2`, `p-4`, `gap-3`, `m-6`). Avoid magic numbers like `mt-[13px]`.
- **Micro Spacing**: `gap-1`, `gap-2` for internal element layout.
- **Component Spacing**: `p-4`, `gap-4` for standard blocks.
- **Section Spacing**: `py-8`, `gap-6` to separate structural areas.

## 4. Radii & Structural Whitespace
- Standardized border radius defined by `--radius`.
- Variations scaled via Tailwind (`rounded-sm`, `rounded-md`, `rounded-lg`).
- "Squircles" and continuous curve radii to ensure premium feel without jagged clipping.

## 5. Shadows & Elevations
Use multi-stop shadows to establish depth logically without overwhelming the interface. Avoid arbitrary shadow definitions.
- `shadow-sm` for cards.
- `shadow-md` for dropdowns.
- `shadow-lg` for modals.

## Core Rules for the Codebase:
1. **Never use hex codes or hardcoded colors in CSS modules or inline styles.** Always refer to `hsl(var(--token-name))`.
2. **Never use arbitrary Tailwind values (`px-[17px]`)**. Stick to the standard scale.
3. **Respect Dark Mode**. All text and background tokens must seamlessly flip when `.dark` is applied to the root document. Explicitly background and color styles in global forms (`select`, `textarea`, `input`) must use semantic vars.
