from pathlib import Path

p = Path("src/lib/kafu-inventory.ts")
t = p.read_text(encoding="utf-8")
t = t.replace('import type { Part } from "@/lib/mock-data";\n\n', "")
t = t.replace("export const kafuParts: Part[] = [", "export const kafuParts = [")
p.write_text(t, encoding="utf-8")
print("fixed")
