import re

with open('src/app/cases/[id]/CaseWorkspace.tsx', 'r') as f:
    content = f.read()

replacements = {
    'text-indigo-700': 'text-muted-foreground',
    'border-indigo-100': 'border-border',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('src/app/cases/[id]/CaseWorkspace.tsx', 'w') as f:
    f.write(content)
