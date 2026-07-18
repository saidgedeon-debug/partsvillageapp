"""
Import cleaned Kafu Section 4 (water temp / fluid level).
Replaces A05/A06 products; keeps Sections 2–3 (A01–A04).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section4-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[(]))?)(.*)$"
)
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
PIPE_RE = re.compile(
    r"^\|\s*(A\d{2}-\d{1,3}[A-Z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]+?)\s*\|\s*Page\s*(\d+)\s*\|?\s*$",
    re.I,
)
HEADER_RE = re.compile(r"^Part CodePart Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Miscellaneous)",
    re.I,
)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

DESCRIPTIONS = sorted(
    [
        "Water Temperature Sensor (Small)",
        "Water Temperature Sensor (Large)",
        "Water Temperature Sensor (200mm)",
        "Water Temperature Sensor (180mm)",
        "Water Temperature Sensor (140mm)",
        "Water Temperature Sensor (220mm)",
        "Water Temp Sensor (200mm)",
        "Water Temp Sensor (180mm)",
        "Water Temp Sensor (140mm)",
        "Water Temp Sensor (220mm)",
        "Water Temperature Sensor",
        "Water Temp Sensor",
        "Water Temp Switch Component",
        "Water Alarm Sensor (Twin)",
        "Water Alarm Sensor (Single)",
        "Water Alarm Sensor",
        "Water Alarm Switch",
        "Fuel/Oil Temperature Sensor",
        "Oil/Water Temperature Sensor",
        "Oil/Water Temp Sensor",
        "Oil/Water Pressure Switch",
        "Oil/Water Sensor",
        "Oil Temperature Switch",
        "Oil Temp Sensor",
        "Hydraulic Oil Temp Sensor",
        "Fluid Level / Water Sensor",
        "Fluid Level/Water Sensor",
        "Fluid Level Sensor",
        "Fluid Sensor Core",
        "Fluid Temp Sensor",
        "Coolant Temp Sensor",
        "Modulated Temp Sensor",
        "Common Rail Fuel Temp Sensor",
        "Engine Temp Sensor",
        "Carbon Fiber Temp Sensor",
        "Temperature Control Switch",
        "Temperature Probe Rod",
        "Temperature Sensor",
        "Intake Pressure/Air Sensor",
        "Camshaft Speed Sensor",
        "Proximity Switch / Cable",
        "Speed Sensor",
        "Oxygen Sensor",
        "Ignition/Glow Plug",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
    r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
    r"Deutz|DEUTZ|Scania|Liebherr|Rexroth|JCB|Daewoo|Foton|Yuchai|Zoomlion|Lonking|"
    r"Longking|Lishide|Ishikawa|Kawasaki|XCMG|Jonyang|Shandong|Shanshan|Sumitomo|"
        r"Kato|Murphy|International|Toyota|Universal|General|Excavator|Heavy|"
        r"Coolant|Custom|Domestic|ZAX\b|J05E|CAT\b"
    )


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Engine Core|Base Line|Core Line|"
        r"Core Series|Master Line|Component Line|System Line|Engine Line|"
        r"Engine Variant|Component|Dual-Pin|Rail|Rail Line|Core Unit|"
        r"Core Component|Alternative|Spec|Twin|Single|New Style Line|"
        r"Large Unit|Plug Node|Interface Spec|Order Spec|Cable Core)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        t = re.sub(
            r"\s*\((2-Pin|Dual-Pin|Single-Pin|Old|New Model|Twin|Single)\)\s*$",
            "",
            t,
            flags=re.I,
        )
        if re.fullmatch(r"\d+(\.\d+)?\s*Bar", t, re.I):
            continue
        if len(t) < 2:
            continue
        if not re.search(r"\d", t) and not re.fullmatch(
            r"[A-Z0-9][A-Z0-9 ._/-]{2,40}", t, re.I
        ):
            if not re.search(r"[A-Z]{2,}", t, re.I):
                continue
        key = t.upper()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out[:8]


def parse_machines(raw: str) -> list[str]:
    if not raw:
        return []
    chunks = re.split(r"\s*,\s*|\s*/\s*(?=[A-Za-z])", raw)
    out: list[str] = []
    for c in chunks:
        t = c.strip()
        if len(t) < 2:
            continue
        t = re.sub(r"^CAT\b", "Caterpillar", t)
        t = re.sub(r"^VOLVO\b", "Volvo", t, flags=re.I)
        t = re.sub(r"^DEUTZ\b", "Deutz", t, flags=re.I)
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if "Glow Plug" in d or d.startswith("Ignition"):
        return "Glow Plug"
    if d.startswith("Oxygen"):
        return "Oxygen Sensor"
    if d.startswith("Speed Sensor") or d.startswith("Camshaft Speed"):
        return "Speed Sensor"
    if d.startswith("Proximity"):
        return "Proximity Switch"
    if d.startswith("Temperature Probe"):
        return "Temperature Probe"
    if d.startswith("Intake Pressure"):
        return "Intake Pressure Sensor"
    if "Hydraulic Oil" in d:
        return "Hydraulic Oil Temperature Sensor"
    if d.startswith("Fuel/Oil Temperature"):
        return "Fuel/Oil Temperature Sensor"
    if d.startswith("Oil Temperature") or d.startswith("Oil Temp"):
        return "Oil Temperature Sensor"
    if d.startswith("Oil/Water Pressure"):
        return "Oil/Water Pressure Switch"
    if d.startswith("Oil/Water"):
        return "Oil/Water Temperature Sensor"
    if d.startswith("Water Alarm"):
        return "Water Alarm Sensor"
    if d.startswith("Water Temp Switch") or d.startswith("Temperature Control"):
        return "Temperature Switch"
    if d.startswith("Coolant Temp") or d.startswith("Modulated Temp"):
        return "Coolant Temperature Sensor"
    if d.startswith("Common Rail Fuel"):
        return "Fuel Temperature Sensor"
    if d.startswith("Fluid Level") or d.startswith("Fluid Sensor"):
        return "Fluid Level Sensor"
    if d.startswith("Fluid Temp"):
        return "Fluid Temperature Sensor"
    if d.startswith("Engine Temp") or d.startswith("Carbon Fiber"):
        return "Temperature Sensor"
    if d.startswith("Water Temperature") or d.startswith("Water Temp"):
        return "Water Temperature Sensor"
    if d.startswith("Temperature Sensor"):
        return "Temperature Sensor"
    return d


def split_glued(rest: str) -> tuple[str, str, str, str | None]:
    page = None
    pm = PAGE_RE.search(rest)
    if pm:
        page = pm.group(1)
        rest = rest[: pm.start()].strip()

    desc = ""
    for d in DESCRIPTIONS:
        if rest.startswith(d):
            desc = d
            rest = rest[len(d) :].strip()
            break
    if not desc:
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /()&Φφ.-]{2,55}?)(?=\d|[A-Z]{2,}\d)", rest)
        if m:
            desc = m.group(1).strip()
            rest = rest[m.end() :].strip()
        else:
            desc = "Kafu Part"

    # Normalize short aliases after match
    if desc.startswith("Water Temp Sensor"):
        desc = desc.replace("Water Temp Sensor", "Water Temperature Sensor", 1)
    if desc == "Oil/Water Temp Sensor":
        desc = "Oil/Water Temperature Sensor"

    rest = re.sub(rf"(?<=[\w)])(?=(?:{BRANDS}))", " ", rest, flags=re.I)
    rest = re.sub(rf"\b((?:{BRANDS}))(?=\d)", r"\1 ", rest, flags=re.I)

    bm = None
    for m in re.finditer(rf"\b(?:{BRANDS})", rest, re.I):
        before = rest[: m.start()].strip(" /-|")
        if not before:
            continue
        if re.search(r"\d", before) or re.search(
            r"\b(?:VOE|ME|EX|PC|SK|WA|EC|DX|DH|JO|VH|RE|MD|KHR|HM|AP|AI|AT|MBT|WG|WGP|JET|SWZ)\b",
            before,
            re.I,
        ):
            bm = m
            break
    if bm is not None:
        oem = rest[: bm.start()].strip(" /-|")
        machine = rest[bm.start() :].strip()
    else:
        bm2 = re.search(rf"\b(?:{BRANDS})", rest, re.I)
        if bm2 and bm2.start() > 0:
            oem = rest[: bm2.start()].strip(" /-|")
            machine = rest[bm2.start() :].strip()
        elif bm2 and bm2.start() == 0:
            after = rest[bm2.end() :].strip()
            bm3 = re.search(rf"\b(?:{BRANDS})", after, re.I)
            if bm3 and bm3.start() > 0:
                oem = (bm2.group(0) + " " + after[: bm3.start()]).strip()
                machine = after[bm3.start() :].strip()
            elif after and re.match(r"^[\dA-Z][\w./-]{2,}$", after.split()[0], re.I) and not re.search(
                rf"\b(?:{BRANDS})", after, re.I
            ):
                oem, machine = after, bm2.group(0)
            else:
                oem, machine = "", rest
        else:
            oem, machine = rest, ""
    return desc, oem, machine, page


def parse_raw(text: str) -> list[dict]:
    rows: list[dict] = []
    brand_group = ""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if SECTION_RE.match(line) or line.startswith("This section"):
            continue
        if HEADER_RE.search(line):
            continue
        if line.startswith("(") and ("Cummins" in line or "John Deere" in line):
            continue
        bh = BRAND_HEADER_RE.match(line)
        if bh:
            brand_group = bh.group(1)
            continue

        pipe = PIPE_RE.match(line)
        if pipe:
            code = pipe.group(1).upper()
            desc = pipe.group(2).strip()
            oem_raw = pipe.group(3).strip()
            machine_raw = pipe.group(4).strip()
            page = pipe.group(5)
            if desc == "Water Temp Sensor":
                desc = "Water Temperature Sensor"
            if desc == "Oil/Water Temp Sensor":
                desc = "Oil/Water Temperature Sensor"
        else:
            m = CODE_RE.match(line)
            if not m:
                continue
            code, rest = m.group(1).upper(), m.group(2).strip()
            desc, oem_raw, machine_raw, page = split_glued(rest)

        rows.append(
            {
                "catalogCode": code,
                "category": normalize_category(desc),
                "description": desc,
                "oemNumbers": parse_oems(oem_raw),
                "compatibility": parse_machines(machine_raw),
                "page": page,
                "brandGroup": brand_group,
                "section": "Section 4",
            }
        )
    return rows


def to_products(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        machines = r["compatibility"][:10]
        oems = r["oemNumbers"][:8]
        desc = r["description"]
        if machines:
            name = f"{desc} — {', '.join(machines[:3])}"
        elif oems:
            name = f"{desc} — {oems[0]}"
        else:
            name = desc
        if len(name) > 140:
            name = name[:137] + "..."
        out.append(
            {
                "catalogCode": r["catalogCode"],
                "category": r["category"],
                "description": desc,
                "name": name,
                "oemNumbers": oems,
                "compatibility": machines,
                "pages": [r["page"]] if r.get("page") else [],
                "brandGroups": [r["brandGroup"]] if r.get("brandGroup") else [],
                "section": "Section 4",
                "confidence": "user-section4-v2",
            }
        )
    return out


def write_ts(products: list[dict]) -> None:
    lines = [
        'import type { Part } from "@/lib/mock-data";',
        "",
        "/** Kafu catalog — Sections 2–4 (sensors, pressure, temp/level). */",
        "export const kafuParts: Part[] = [",
    ]
    for p in products:
        code = p["catalogCode"]
        pid = "kafu-" + code.lower()
        oems = p["oemNumbers"]
        compat = p["compatibility"]
        part_numbers = [code] + [o for o in oems if o.upper() != code.upper()]
        notes_parts = []
        if oems:
            notes_parts.append("OEM: " + ", ".join(oems))
        if p.get("pages"):
            notes_parts.append("Catalog p." + ", ".join(p["pages"]))
        notes_parts.append("Supplier: Kafu")
        notes = " · ".join(notes_parts)
        lines += [
            "  {",
            f'    id: "{esc(pid)}",',
            f'    partNumber: "{esc(code)}",',
            f"    partNumbers: [{', '.join(f'\"{esc(n)}\"' for n in part_numbers)}],",
            f'    name: "{esc(p["name"])}",',
            f'    category: "{esc(p["category"])}",',
            "    quantity: 0,",
            "    reorderAt: 0,",
            "    cost: 0,",
            "    price: 0,",
            f"    compatibility: [{', '.join(f'\"{esc(c)}\"' for c in compat)}],",
            f'    notes: "{esc(notes)}",',
            "  },",
        ]
    lines += ["];", ""]
    OUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = parse_raw(RAW.read_text(encoding="utf-8"))
    section4 = to_products(rows)

    kept: list[dict] = []
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            if code.startswith(("A01", "A02", "A03", "A04")):
                kept.append(p)

    by_code: dict[str, dict] = {p["catalogCode"]: p for p in kept}
    for p in section4:
        by_code[p["catalogCode"]] = p

    products = [by_code[k] for k in sorted(by_code.keys())]
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "sections_2_3_4_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section4": len(section4),
        "kept_2_3": len(kept),
        "count": len(products),
        "categories": cats,
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(
        f"section4_raw={len(rows)} section4={len(section4)} "
        f"kept_2_3={len(kept)} total={len(products)}"
    )
    for c in cats:
        n = sum(1 for p in products if p["category"] == c)
        if c.startswith(("Water", "Fluid", "Coolant", "Fuel", "Oil", "Temp", "Hyd", "Prox", "Glow", "Oxy", "Speed", "Angle")) or "Temperature" in c or "Level" in c:
            print(f"  {n:3d}  {c}")
    for code in ["A01-1", "A03-12", "A05-1", "A05-18", "A06-1", "A06-122", "A06-132", "A06-145"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
