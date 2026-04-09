# Design System: Aura
A premium, highly refined standard dedicated to elevating the application's aesthetic.

## Aesthetic Goals
- Clean, uniform, and high-end design languages
- Consistent use of continuous curve radii ('squircles')
- Purposeful whitespace and semantic color muting
- High-contrast intentional colors for dark and light modes
- Structural whitespace and crisp typography
- Standardized, high-quality, multi-stop shadows

## Exact Token Scales
### Typography
- Font Family: Inter, sans-serif

### Radii
- lg: `0.75rem`
- md: `calc(0.75rem - 2px)`
- sm: `calc(0.75rem - 4px)`

### Colors
Semantic HSL format mapped with alpha-value placeholder to support tailwind opacity.
Example: `hsl(var(--color) / <alpha-value>)`

**Base**
- Background
- Foreground
- Primary / Primary Foreground
- Secondary / Secondary Foreground

**States & Feedback**
- Success
- Warning
- Destructive
- Info
- Attention
- Brand
