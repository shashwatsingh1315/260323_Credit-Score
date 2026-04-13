# UI Polish with React Bits Design Spec

## Overview
This specification details the plan to polish the Credit Issuance System UI using [React Bits](https://reactbits.dev/), adding subtle, professional animations and interactions that enhance the user experience without distracting from the complex data views.

## 1. Typography & Text Animations
- **Target Areas:** Main page headers (`<h1>` tags) and subtitles (e.g., "Credit Issuance System Overview").
- **Components to Use:**
  - `BlurText`: Used on main dashboard titles ("Dashboard", "Cases", "Policy"). Ensures they fade and blur-in smoothly upon navigation.
  - `ShinyText`: Applied to the secondary subtitle "Credit Issuance System Overview" to draw soft attention.

## 2. Layout & Backgrounds
- **Target Areas:** Authentication flow (Login, Reset Password) and the top navigation banner.
- **Components to Use:**
  - `Squares`: An animated background component placed behind the Auth screens to create depth.
  - `Iridescence` or `Aurora`: A very faint, stylized background placed behind the top search/logout navigation banner to distinguish the header area from the main content.

## 3. Interactive Elements (Cards & Buttons)
- **Target Areas:** Dashboard summary widgets ("My Tasks", "Recent Case Activity") and primary action links ("New Case", "Policy").
- **Components to Use:**
  - `TiltedCard`: Applied to the summary widget containers to provide a subtle 3D hover effect.
  - `SpotlightCard` or `StarBorder`: Wrapped around the primary action buttons ("New Case" and "Policy") to visually pop them out naturally.

## 4. Navigation & Sidebar
- **Target Areas:** Sidebar navigation links and icons.
- **Components to Use:**
  - `Magnet`: Applied to sidebar link icons, creating a slight magnetic snap effect when the cursor hovers near them.

## Technical Considerations
- **Tailwind Compatibility:** Components must be integrated using the Tailwind CSS variants provided by React Bits.
- **Framer Motion:** Since Framer Motion is already in the project (`framer-motion` in package.json), these components should drop in naturally without major bundle bloat.
- **Fallback:** Ensure accessibility (e.g., respect `prefers-reduced-motion`) if React Bits components support it, or gracefully degrade.
- **Directory Structure:** New components will be placed in `src/components/animations/` or `src/components/ui/` depending on their reusability.

## Spec Self-Review
- [x] No placeholders (e.g., "TBD").
- [x] Consistent and unambiguous approach.
- [x] Scope is well-defined and focused on UI enhancement.
