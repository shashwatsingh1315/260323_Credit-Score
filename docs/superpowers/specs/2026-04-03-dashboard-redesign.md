# Dashboard UI Redesign (Next-Gen Bento)

## Objective
Modernize the Credit Issuance System dashboard to create a "next-generation" B2B financial interface. The redesign transitions from a standard linear card stack to a dynamic **Bento Grid** layout with a **Soft Glass** aesthetic, leveraging **React Bits** for high-end micro-interactions.

## 1. Layout & Architecture
The dashboard will use a CSS Grid-based "Bento" structure.

### 1.1 Grid Arrangement (4-Column Layout)
- **Header:** Full-width container using `BlurText` for the "Dashboard" title and system status subtitle.
- **Hero Stats (Col 1-2, Row 1):** Large Portfolio Overview card. Shows "Total Exposure" and "Average Margin".
- **Urgent Counter (Col 3, Row 1):** Square card for "Delayed Collections". Uses a high-visibility `warning` or `destructive` token.
- **Shortcuts (Col 4, Row 1):** Quick links to "New Case" and "Policy Engine".
- **Recent Activity (Col 1-2, Row 2-3):** Tall card showing the last 5 cases with status badges. Uses `StaggeredFade` for row entrance.
- **Performance Funnel (Col 3-4, Row 2):** Analytics card showing approval rates or PDCR metrics.
- **Quick Actions (Col 3-4, Row 3):** Icon-based grid of common system actions.

## 2. Visual Specification (Soft Glass)
The UI will adhere to the "Subtle Polish" direction using the project's semantic tokens.

### 2.1 Component Surfaces
- **Background:** `bg-background` (standard token).
- **Cards:** 
  - Class: `bg-card/70 backdrop-blur-md border border-white/20 shadow-sm transition-all`.
  - Hover: `hover:scale-[1.01] hover:border-white/40 hover:bg-card/80`.
  - Feature: Wrapped in `SpotlightCard` for cursor-following glow effects.

### 2.2 Tokens Usage
- **Numbers:** Large, bold primary text (`text-foreground`).
- **Labels:** `text-tiny uppercase tracking-wider text-muted-foreground`.
- **Accents:** Usage of `text-brand` for primary metrics and `text-success` / `text-warning` for status-specific indicators.

## 3. Animation Strategy
Animations are powered by `framer-motion` via the React Bits library.

- **Initial Load:** Staggered entrance where cards slide up (`y: 20 -> 0`) and fade in sequentially.
- **Metrics:** `CountUp` component applied to all currency values and percentage rates.
- **Transitions:** Standardized `cubic-bezier(0.4, 0, 0.2, 1)` easing for all hover states.

## 4. Implementation Details
- **File:** `src/app/page.tsx` will be completely refactored.
- **Dependencies:** React Bits components (`SpotlightCard`, `CountUp`, `BlurText`, `StaggeredFade`) must be verified in `src/components/animations/`.
- **Data:** Existing server-side queries for metrics and recent cases remain unchanged; only the rendering layer is replaced.

## 5. Success Criteria
- Dashboard feels significantly more modern and premium.
- Zero hardcoded colors; 100% adherence to the updated Design Token System.
- Responsive behavior: Bento grid collapses to a single column on mobile.
