import re

with open('src/app/cases/new/page.tsx', 'r') as f:
    content = f.read()

replacements = {
    'text-gray-500': 'text-muted-foreground',
    'text-gray-200': 'text-muted',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('src/app/cases/new/page.tsx', 'w') as f:
    f.write(content)
