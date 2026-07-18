"""Regenerate src/lib/kafu-inventory.ts from extracted JSON (with partNumbers + images)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "data" / "kafu-extracted-products.json").read_text(encoding="utf-8"))
products = data["products"]

image_map: dict[str, str] = {}
meta_path = ROOT / "data" / "kafu-image-extract.json"
if meta_path.exists():
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    for img in meta.get("images", []):
        image_map[img["code"]] = img["url"]
else:
    # Fallback: scan public folder
    for path in (ROOT / "public" / "kafu-parts").glob("*.jpg"):
        code = path.stem
        image_map[code] = f"/kafu-parts/{path.name}"


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def safe_name(code: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", code)


lines: list[str] = []
lines.append('import type { Part } from "@/lib/mock-data";')
lines.append("")
lines.append(
    "/** Kafu 2025 catalog — part #, description, machine, product photo. */"
)
lines.append("export const kafuParts: Part[] = [")

with_image = 0
for p in products:
    code = p["catalogCode"]
    pid = "kafu-" + code.lower().replace(" ", "")
    name = p.get("name") or p.get("description") or f"{p['category']} — {code}"
    cat = p["category"]
    oems = p.get("oemNumbers") or []
    compat = p.get("compatibility") or []
    volt = p.get("voltage")
    part_numbers = [code] + [o for o in oems if o != code]
    image_url = image_map.get(code) or image_map.get(safe_name(code))
    if image_url:
        with_image += 1

    notes_parts: list[str] = []
    if oems:
        notes_parts.append("OEM: " + ", ".join(oems))
    if volt:
        notes_parts.append("Voltage: " + volt)
    notes_parts.append("Supplier: Kafu")
    notes = " · ".join(notes_parts)

    compat_js = ", ".join(f'"{esc(c)}"' for c in compat)
    nums_js = ", ".join(f'"{esc(n)}"' for n in part_numbers)

    lines.append("  {")
    lines.append(f'    id: "{esc(pid)}",')
    lines.append(f'    partNumber: "{esc(code)}",')
    lines.append(f"    partNumbers: [{nums_js}],")
    lines.append(f'    name: "{esc(name)}",')
    lines.append(f'    category: "{esc(cat)}",')
    lines.append("    quantity: 0,")
    lines.append("    reorderAt: 0,")
    lines.append("    cost: 0,")
    lines.append("    price: 0,")
    lines.append(f"    compatibility: [{compat_js}],")
    lines.append(f'    notes: "{esc(notes)}",')
    if image_url:
        lines.append(f'    imageUrl: "{esc(image_url)}",')
    lines.append("  },")

lines.append("];")
lines.append("")

out = ROOT / "src" / "lib" / "kafu-inventory.ts"
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {out} ({len(products)} parts, {with_image} with images)")
