# DESIGN_STYLE.md

## The Target Aesthetic
Premium, clean, high-contrast, scalable design language inspired by Uber, Linear, and Apple.

## Token Scales
- Colors: Semantic HSL variables mapping to background, foreground, primary, secondary, muted, border, input, ring, destructive, success, warning, info, attention, brand.
- Spacing: Standard tailwind base-4 spacing scale.
- Typography: Inter font-family with defined variants.
- Shadow/Elevation: Use predefined drop-shadows.

## The Cleanup
- Removed direct React `setState` calls inside `useEffect` hooks across components to comply with Next.js state update limitations.
