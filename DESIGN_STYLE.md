# Aura Design System (High-End Aesthetic)

## 📐 Philosophy
True elegance comes from rigorous consistency. A unified design system is invisible but deeply felt by the user.
Premium design relies on purposeful whitespace, crisp typography, and high-contrast intentional colors. Hardcoded styles are technical debt; design tokens are scalable assets.

## 🎨 Color Tokens (Semantic & HSL-Based)
Colors are strictly defined as HSL variables to support Tailwind's opacity modifiers. The theme uses **Luminance-Based Contrast** and **Chromatic Darkness** for a velvety dark mode.

### Light Mode (`:root`)
- **Backgrounds**:
  - `background`: 0 0% 100% (Pure White)
  - `card`, `popover`: 0 0% 100%
  - `secondary`, `muted`: 210 40% 96%
- **Text (Foregrounds)**:
  - `foreground`: 222 47% 11% (Deep Slate)
  - `muted-foreground`: 215 16% 47%
- **Actions (Primary)**:
  - `primary`: 222 47% 11%
  - `primary-foreground`: 0 0% 100%
- **Borders & Interactive**:
  - `border`, `input`: 214 32% 91%
  - `ring`: 222 84% 5%

### Dark Mode (`.dark`)
- **Backgrounds**:
  - `background`: 240 10% 4% (Almost Black)
  - `card`, `popover`: 240 10% 6%
  - `secondary`, `muted`: 240 4% 16%
- **Text (Foregrounds)**:
  - `foreground`: 0 0% 98% (Crisp White)
  - `muted-foreground`: 240 5% 65%
- **Actions (Primary)**:
  - `primary`: 0 0% 98%
  - `primary-foreground`: 240 6% 10%
- **Borders & Interactive**:
  - `border`, `input`: 240 4% 16%
  - `ring`: 0 0% 98%

## 📏 Typography
- **Family**: Inter, system-ui, sans-serif.
- **Scale**:
  - Semantic classes from Tailwind typography.
  - Tightly tracked display headers, relaxed body copy.

## 🔲 Radii (Continuous Curve)
- `radius`: 0.5rem (8px standard)
- Follows "squircle" proportions.

## 🕰️ Animation & Motion
- Physics-driven damping over linear easing.
- Fast duration (`duration-200` to `duration-150`).
