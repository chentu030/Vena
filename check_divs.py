
import re

file_path = "src/app/teams/[teamId]/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

div_open = len(re.findall(r"<div\b", content))
div_close = len(re.findall(r"</div>", content))

print(f"Open divs: {div_open}")
print(f"Close divs: {div_close}")

if div_open > div_close:
    print(f"Missing {div_open - div_close} closing divs.")
elif div_close > div_open:
    print(f"Excess {div_close - div_open} closing divs.")
else:
    print("Divs are balanced.")
