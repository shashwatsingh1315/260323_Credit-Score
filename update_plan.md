1. **Design System Baseline**: Create `DESIGN_STYLE.md` with guidelines for tokens instead of magic numbers.
2. **Typography Fixes**: Replace `text-[10px]` with `text-tiny` (defined in `tailwind.config.js`).
   - Files to update:
     - `src/components/admin/PartyDialog.tsx`
     - `src/app/collections/CollectionsClient.tsx`
     - `src/app/cases/new/NewCaseForm.tsx`
     - `src/app/cases/[id]/StagesTab.tsx`
     - `src/app/cases/[id]/TaskCompleteForm.tsx`
     - `src/app/admin/imports/ImportsClient.tsx`
3. **Width Fixes**: Replace arbitrary widths like `w-[200px]`, `w-[150px]`, `w-[120px]`, `w-[100px]`, `w-[50px]`, `min-w-[120px]` with standard Tailwind tokens (e.g., `w-48`, `w-40`, `w-28`, `w-24`, `w-12`, `min-w-32`).
   - Files to update:
     - `src/app/settings/PrefixManager.tsx`
     - `src/app/settings/CityCodeManager.tsx`
     - `src/app/collections/CollectionsClient.tsx`
     - `src/app/cases/[id]/OverviewTab.tsx`
     - `src/app/admin/aliases/AliasesClient.tsx`
     - `src/app/admin/imports/ImportsClient.tsx`
4. **Height Fixes**: Replace arbitrary heights like `max-h-[400px]`, `min-h-[80px]` with standard tokens (`max-h-96`, `min-h-20`).
   - Files to update:
     - `src/components/ui/textarea.tsx`
     - `src/app/admin/AdminClient.tsx`
5. **View Height Fixes**: Replace `h-[50vh]` with `h-[50vh]` is fine or convert to flex-1/min-h-screen logic if possible. I'll check `src/app/loading.tsx` and `src/app/cases/[id]/error.tsx`. It's okay to keep vh, but maybe standard token `min-h-[50vh]` -> `min-h-96`.
6. **Other Magic Numbers**: Replace `p-[2px]`, `rounded-[10px]`, `translate-y-[2px]` etc. with `p-0.5`, `rounded-xl` or similar tokens.
7. **Verify**: Build, format, lint, tests.
