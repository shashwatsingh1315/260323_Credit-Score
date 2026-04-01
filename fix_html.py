with open("src/app/cases/new/page.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "<div className={styles.inputGroup}>" in line and i < len(lines) - 1 and "<div className={styles.inputGroup}>" in lines[i+1]:
        continue
    new_lines.append(line)

with open("src/app/cases/new/page.tsx", "w") as f:
    f.writelines(new_lines)
