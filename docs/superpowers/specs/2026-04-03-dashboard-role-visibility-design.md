# Dashboard Role-Based Visibility Design

## 1. Goal
Ensure that the `DashboardPage` (`src/app/page.tsx`) displays relevant information based on the user's role. Specifically, the "Portfolio Overview", "PDCR", and "Efficiency Funnel" widgets should only be visible to the RM (Relationship Manager) role. 

## 2. Approach
The current dashboard displays all widgets to all users. We will conditionally render the widgets based on the user's role, fetched via `getImpersonationRole()`.

### RM (Relationship Manager) View
The RM will see the full dashboard as it currently exists:
- Portfolio Overview (Total Outstanding Exposure, PDCR, Avg Margin)
- Urgent Collections (Delayed Payments)
- Quick Shortcuts (New Case, Policy)
- Recent Case Activity
- Efficiency Funnel (Approval Success Rate, PDCR Amount)
- Quick Actions (System Audit, Admin Panel)

### Non-RM View (KAM, BDO, Admin, Approvers, etc.)
Non-RM users will see a simplified, focused dashboard:
- Recent Case Activity (spanning the full width)
- Quick Actions (System Audit, Admin Panel)
- Quick Shortcuts (New Case, Policy)

## 3. Implementation Details
In `src/app/page.tsx`:
- Use the existing `role` variable (from `getImpersonationRole()`) to conditionally wrap the RM-specific sections.
- The `rmMetrics` calculation and tranche fetching are already conditionally executed (`if (role === 'rm' && user)`), which is correct and efficient. We just need to apply the same condition to the TSX rendering.
- For Non-RM users, adjust the CSS grid spanning (e.g., `col-span-1 md:col-span-4`) for the rendered widgets so they fill the available space nicely instead of leaving blank areas where the RM widgets used to be.

## 4. Security & Performance
- The `computeRmPortfolioMetrics` and active cases fetch already have a check for `role === 'rm'`, preventing unnecessary database queries for non-RM users.
- Role is determined server-side, preventing unauthorized users from simply modifying DOM/React state to see RM metrics.
