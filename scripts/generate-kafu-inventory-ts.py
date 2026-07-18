import json
from pathlib import Path

data = json.loads(Path("data/kafu-extracted-products.json").read_text(encoding="utf-8"))
products = data["products"]


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


lines: list[str] = []
lines.append('import type { Part } from "@/lib/mock-data";')
lines.append("")
lines.append(
    "/** Kafu 2025 product catalog import (Part # = Kafu code, categories per section). */"
)
lines.append("export const kafuParts: Part[] = [")

for p in products:
    code = p["catalogCode"]
    pid = "kafu-" + code.lower().replace(" ", "")
    name = p.get("name") or f"{p['category']} — {code}"
    cat = p["category"]
    oems = p.get("oemNumbers") or []
    compat = p.get("compatibility") or []
    volt = p.get("voltage")
    notes_parts: list[str] = []
    if oems:
        notes_parts.append("OEM: " + ", ".join(oems))
    if volt:
        notes_parts.append("Voltage: " + volt)
    notes_parts.append("Supplier: Kafu")
    notes = " · ".join(notes_parts)
    compat_js = ", ".join(f'"{esc(c)}"' for c in compat)
    lines.append("  {")
    lines.append(f'    id: "{esc(pid)}",')
    lines.append(f'    partNumber: "{esc(code)}",')
    lines.append(f'    name: "{esc(name)}",')
    lines.append(f'    category: "{esc(cat)}",')
    lines.append("    quantity: 0,")
    lines.append("    reorderAt: 0,")
    lines.append("    cost: 0,")
    lines.append("    price: 0,")
    lines.append(f"    compatibility: [{compat_js}],")
    lines.append(f'    notes: "{esc(notes)}",')
    lines.append("  },")

lines.append("];")
lines.append("")
Path("src/lib/kafu-inventory.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"wrote {len(products)} parts")
