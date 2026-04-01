with open("src/app/cases/new/page.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "<label>Branch / Region</label>" in line:
        new_lines.append('              <div className={styles.inputGroup}>\n')
    new_lines.append(line)

with open("src/app/cases/new/page.tsx", "w") as f:
    f.writelines(new_lines)
