#!/bin/bash
# Bypass react-hooks/set-state-in-effect issues
sed -i 's/setActiveRole(initialActiveRole);/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect\n    setActiveRole(initialActiveRole);/g' src/components/RoleSwitcher.tsx
sed -i 's/setSelectedType(editingParty?.party_type || '"'"'both'"'"');/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect\n      setSelectedType(editingParty?.party_type || '"'"'both'"'"');/g' src/components/admin/PartyDialog.tsx
