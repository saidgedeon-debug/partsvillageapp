"""
Parse structured Kafu section paste → JSON + kafu-inventory.ts
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

# Suffix letter only when another uppercase word follows (A01-1ARevolution)
CODE_START = re.compile(r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]))?)(.*)$")
PIPE_ROW = re.compile(
    r"^\|\s*(A\d{2}-\d{1,3}[A-Z]?)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|?\s*$",
    re.I,
)
HEADER_RE = re.compile(r"^Part Code Key", re.I)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

TYPE_WORDS = (
    "Revolution Sensor|Camshaft Sensor|Fuel Pump Speed Sensor|Inductive Switch Sensor|"
    "Pressure Switch Core|Flywheel Speed Sensor|Flywheel Timing Sensor|"
    "Eccentric Shaft Speed Sensor|Crankshaft Sensor|Air Induction Sensor|"
    "Camshaft Timing Sensor|Speed Sensor Array|"
    "Air Pressure Switch|Intake Temperature Sensor|Manifold Air Pressure Sensor|"
    "Air Intake Sensor|Air Pressure Sensor|Vacuum Pressure Switch|"
    "Air Temp Sensor|AC Pressure Switch|Air Alarm Sensor|Differential Pressure Sensor|"
    "Barometric Pressure Sensor|Intake Pressure Sensor|Sensor Cable Assembly|"
    "Angular Position Sensor|Rotary Switch Sensor|Door Courtesy Lamp Switch|"
    "Oil Pressure Switch|Oil Pressure Sensor|Mechanical Pressure Switch|Fluid Pressure Sensor|"
    "Air System Pressure Switch"
)

BRANDS = (
    r"KOMATSU|HITACHI|CATERPILLAR|KOBELCO|SANY|LIUGONG|DOOSAN|DAEWOO|VOLVO|JCB|"
    r"CUMMINS|ISUZU|YANMAR|PERKINS|HYUNDAI|SUMITOMO|SUNWARD|FOTON|LOVOL|"
    r"YUCHAI|SHANDONG|JONYANG|ZOOMLION|XCMG|BOBCAT|JOHN\s*DEERE|HINO|"
    r"MITSUBISHI|DEUTZ|SCANIA|KATO|LIEBHERR|KUBOTA|REXROTH|HK\d|"
    r"Cross-Platform|Universal|Generic|Specialty|Proximity|Heavy Industrial|"
    r"Industrial Diesel|Fleet Operator|Cabin Interior|Cockpit Frame|"
    r"High Density|High Displacement|High Reliability|High Stress|"
    r"High-Speed|Multi-Function|Field Infrastructure|Ground Logistics|"
    r"Logistics and|Extreme Environment|Hydraulic Articulation|"
    r"Specialized Fleet|Precision Sensor|Production Machinery"
)


def split_glued(rest: str) -> tuple[str, str, str]:
    m = re.match(rf"^({TYPE_WORDS})(.+)$", rest)
    if not m:
        return rest.strip(), "", ""
    typ = m.group(1).strip()
    tail = m.group(2).strip()
    # Insert space before brand when glued to OEM (2055358HITACHI → 2055358 HITACHI)
    tail = re.sub(rf"(?<=[\w)])(?=(?:{BRANDS})\b)", " ", tail, flags=re.I)
    bm = re.search(rf"^(.*?)(?=\b(?:{BRANDS})\b)", tail, re.I)
    if bm is not None:
        oem = bm.group(1).strip(" /-|")
        machine = tail[bm.end(1) :].strip()
        return typ, oem, machine
    return typ, tail, ""


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    # strip marketing suffixes after a clean OEM token
    raw = re.sub(
        r"\s+(Unit|Line|Module|Block|Group|Core|Assembly Spec|Configuration|"
        r"Base Group|Base Unit|Base Line|Platform|Spec|Node|Array|Lead|"
        r"Extended Unit|Extended Lead|Target Block|Target Configuration|"
        r"Production Line|Generation \d+|Heavy Spec|Rugged Design|"
        r"Sealed (?:Unit|Interface|Assembly|Array|Node)|"
        r"High (?:Capacity|Output Group|Pressure Unit|Temp Spec)|"
        r"Standard (?:Module|Node)|Integration Node|Module Framework|"
        r"Field Group|Industrial Base|Ruggedized Framework|"
        r"Control Matrix|Engine Block Spec|Probe Unit|Precision Lead|"
        r"Core Integration|Sensor Matrix|System Group|Core Module|"
        r"Grid Unit|Core Unit|Dynamic Matrix|Multi-Axis|"
        r"Structural Harness|Armored Lead|Terminal Block|Interface Lead|"
        r"Shielded Lead|Core Lead|Dual Line Configuration|"
        r"Specialized Engine|Alternative Mount|Structural Thread|"
        r"Standard Thread|Threaded Two-Blade Terminal|"
        r"Five-Hole Four-Blade Interface|"
        r"\(.*?\)|New Gen|Legacy Hardware Design|3-Pin Configuration|"
        r"2-Pin Waterproof Interface|Rotary Layout|Production Spec|"
        r"Technical Spec|Engine Standard Block|Engine Layout|"
        r"Engine Synchronization Group|Engine Frame Variant|"
        r"Engine Allocation Unit|Platform Spec|Core Technical Spec|"
        r"Core Line Spec|HINO Standard|Single Terminal|"
        r"Heavy Architecture|Universal Block(?: Variant [A-C])?|"
        r"Architecture|YUCHAI Design)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*|\s*,\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip().strip("|"))
        if len(t) < 2:
            continue
        # keep tokens that look like part numbers
        if not re.search(r"\d|[A-Z]{2,}\d|\d[A-Z]", t, re.I):
            continue
        # drop leftover prose
        if len(t) > 40 and " " in t and not re.search(r"^\d", t):
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
    chunks = re.split(r"\s*,\s*", raw)
    out: list[str] = []
    for c in chunks:
        t = c.strip().strip("|")
        if len(t) < 2:
            continue
        if t not in out:
            out.append(t)
    return out[:8]


def parse_raw(text: str) -> list[dict]:
    text = text.replace("A10-11B", "A03-11B")
    products: list[dict] = []
    section = "Kafu Parts"

    for line in text.splitlines():
        line = line.strip()
        if not line or HEADER_RE.search(line) or line.startswith("This dataset"):
            continue
        if SECTION_RE.match(line):
            section = line.split(":", 1)[0].strip()
            continue

        pipe = PIPE_ROW.match(line)
        if pipe:
            code, typ, oem, machine = [g.strip() for g in pipe.groups()]
            products.append(
                {
                    "catalogCode": code.upper(),
                    "category": typ,
                    "description": typ,
                    "oemRaw": oem,
                    "machineRaw": machine,
                    "section": section,
                }
            )
            continue

        m = CODE_START.match(line)
        if not m:
            continue
        code, rest = m.group(1).upper(), m.group(2).strip()
        typ, oem, machine = split_glued(rest)
        products.append(
            {
                "catalogCode": code,
                "category": typ or "Kafu Parts",
                "description": typ or "Kafu Parts",
                "oemRaw": oem,
                "machineRaw": machine,
                "section": section,
            }
        )

    out: list[dict] = []
    seen: set[str] = set()
    for p in products:
        code = p["catalogCode"]
        if code in seen:
            continue
        seen.add(code)
        oems = parse_oems(p["oemRaw"])
        machines = parse_machines(p["machineRaw"])
        desc = p["description"]
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
                "catalogCode": code,
                "category": p["category"],
                "description": desc,
                "name": name,
                "oemNumbers": oems,
                "compatibility": machines,
                "section": p["section"],
                "confidence": "user-section",
            }
        )
    return out


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def write_ts(products: list[dict]) -> None:
    lines = [
        'import type { Part } from "@/lib/mock-data";',
        "",
        "/** Kafu sections — structured paste (part #, type, OEM, machine). */",
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
        notes_parts.append("Supplier: Kafu")
        notes = " · ".join(notes_parts)
        compat_js = ", ".join(f'"{esc(c)}"' for c in compat)
        nums_js = ", ".join(f'"{esc(n)}"' for n in part_numbers)
        lines += [
            "  {",
            f'    id: "{esc(pid)}",',
            f'    partNumber: "{esc(code)}",',
            f"    partNumbers: [{nums_js}],",
            f'    name: "{esc(p["name"])}",',
            f'    category: "{esc(p["category"])}",',
            "    quantity: 0,",
            "    reorderAt: 0,",
            "    cost: 0,",
            "    price: 0,",
            f"    compatibility: [{compat_js}],",
            f'    notes: "{esc(notes)}",',
            "  },",
        ]
    lines += ["];", ""]
    OUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    products = parse_raw(RAW.read_text(encoding="utf-8"))
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "section_import",
        "supplier": "Kafu",
        "count": len(products),
        "categories": cats,
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"products={len(products)} categories={len(cats)}")
    for c in cats:
        n = sum(1 for p in products if p["category"] == c)
        print(f"  {n:3d}  {c}")
    for p in products[:5]:
        print(
            p["catalogCode"],
            "|",
            p["description"],
            "|",
            p["oemNumbers"][:2],
            "|",
            p["compatibility"][:2],
        )


if __name__ == "__main__":
    main()
