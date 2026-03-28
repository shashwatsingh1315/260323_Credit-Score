import re

with open("src/app/cases/new/page.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r"<<<<<<< feature/routing-and-grading-mapping.*?\n(.*?)\n=======\n.*?\n>>>>>>> main",
    r"\1",
    content,
    flags=re.DOTALL
)

with open("src/app/cases/new/page.tsx", "w") as f:
    f.write(content)

with open("src/app/cases/new/actions.ts", "r") as f:
    content = f.read()

content = re.sub(
    r"<<<<<<< feature/routing-and-grading-mapping.*?\n(.*?)\n=======\n.*?\n>>>>>>> main",
    r"\1",
    content,
    flags=re.DOTALL
)

with open("src/app/cases/new/actions.ts", "w") as f:
    f.write(content)
