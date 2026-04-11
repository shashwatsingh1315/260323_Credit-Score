# Aura Design System (CreditFlow)

## Aesthetic Principles

- **Premium Continuous Curves**: Utilizing squircle-like logic for modern interface roundedness (`var(--radius)`).
- **Multi-stop Elevations**: Standardizing depth semantics instead of hardcoded hex shadows.
- **Chromatic Darkness**: Semantic HSL tokens that seamlessly transition to high-end dark modes.
- **Physics-driven Transitions**: Responsive and fast interaction patterns.
- **Semantic Color Muting**: Actionable foreground elements balanced by intentionally muted background/borders.
- **Structural Whitespace**: Strict, consistent 4px/8px rhythm to space out content securely.

## Tokens & Variables

All variables should be accessed via global CSS tokens that map directly to Tailwind class counterparts using `hsl()`.

### Colors

Defined using `hsl(var(--token) / <alpha-value>)` in Tailwind configuration to support opacity modifiers seamlessly.

* **Backgrounds**:
  * `--background`: Application backdrop.
  * `--card`: Surface backdrop.
  * `--popover`: Elevated container backdrop.
* **Text & Typography**:
  * `--foreground`: Primary reading text.
  * `--muted-foreground`: Secondary text, placeholders.
* **Actions & Borders**:
  * `--primary`: Primary call to action backdrop.
  * `--primary-foreground`: Primary call to action text.
  * `--secondary`: Alternative action backdrop.
  * `--muted`: Subtle backgrounds.
  * `--border`: Universal border line color.
  * `--input`: Form control border.
* **Semantic Feedback**:
  * `--destructive`: Errors, rejections, deletes.
  * `--success`: Positive states.
  * `--warning`: Action required, cautious states.
  * `--info`: Neutral data highlights.
  * `--attention`: User alerts.

### Typography

* **Font Family**: Inter, Sans-serif fallback (`var(--font-inter)`).
* **Base Scaling**: Base-14px (`text-sm`) standard for most data-dense elements.

### Spacing & Layout

Strict use of Tailwind sizing variants (e.g. `p-4` = `16px`, `p-6` = `24px`).
Avoid magic pixel sizes entirely.

### Radii

Variables used to establish curve hierarchy:
* `var(--radius)`: Large containers, modals (`0.75rem / 12px` default).
* `calc(var(--radius) - 2px)`: Medium components (`10px`).
* `calc(var(--radius) - 4px)`: Small items, form controls (`8px`).

## Anti-Patterns

- **No Magic Hex Colors**: `bg-[#1a1a1a]` or `color: #333` inside inline styles or global CSS.
- **No Inline Opacity/Colors for disabled states**: Avoid `style={{ opacity: 0.5 }}`. Instead, leverage `disabled:opacity-50`.
- **No Hardcoded Pixel Spacing in UI Modules**: E.g. `padding: 22px`. Use semantic layouts mapped via standard scale.
