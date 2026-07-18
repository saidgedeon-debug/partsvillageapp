"""
Import cleaned Kafu Section 3 (air/oil pressure, brand-grouped).
Replaces A03/A04 products; keeps existing Section 2 (A01/A02).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section3-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[(]))?)(.*)$"
)
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
HEADER_RE = re.compile(r"^Part CodePart Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Miscellaneous)",
    re.I,
)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

DESCRIPTIONS = sorted(
    [
        "Intake Temperature Sensor (Old)",
        "Intake Temperature Sensor",
        "Intake Pressure Sensor",
        "Air Intake Sensor (5-Wire Line)",
        "Air Intake Sensor (6-Wire Line)",
        "Air Intake Sensor",
        "Air Pressure Sensor",
        "Air Pressure Switch",
        "Air Temp Sensor",
        "Air Alarm Sensor",
        "AC Pressure Switch",
        "Differential Pressure Sensor",
        "Barometric Pressure Sensor",
        "Vacuum Switch",
        "Sensor Cable Assembly",
        "Angle Sensor",
        "Rotary Switch Sensor",
        "Door Lamp Switch",
        "Fuel/Oil Pressure Sensor",
        "Oil Pressure Switch (Dual-Pin)",
        "Oil Pressure Switch (Single-Pin)",
        "Oil Pressure Switch",
        "Oil Pressure Sensor",
        "Low Pressure Switch (New Model)",
        "Low Pressure Switch",
        "Pressure Switch (Small Plug)",
        "Pressure Switch",
        "Pressure Sensor",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
    r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
    r"Deutz|Scania|Liebherr|Rexroth|JCB|Daewoo|Foton|Yuchai|Zoomlion|Lonking|"
    r"XCMG|Jonyang|Shandong|Shanshan|Sumitomo|Kato|Murphy|International|"
    r"Universal|General|Excavator|Heavy Machinery|CAT\b"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Engine Core|Base Line|Core Line|"
        r"Core Series|Master Line|Component Line|System Line|Engine Line|"
        r"Engine Variant|Component|Dual-Pin|Rail)$",
        "",
        raw,
        flags=re.I,
    )
    # Drop trailing bar ratings from OEM list items later; keep joined for now then split
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        t = re.sub(
            r"\s*\((2-Pin|Dual-Pin|Single-Pin|Old|New Model)\)\s*$",
            "",
            t,
            flags=re.I,
        )
        # skip pure pressure ratings like 34Bar, 0.7Bar
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
        # Expand CAT shorthand for display consistency
        t = re.sub(r"^CAT\b", "Caterpillar", t)
        t = re.sub(r"^VOLVO\b", "Volvo", t, flags=re.I)
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if d.startswith("Fuel/Oil"):
        return "Oil Pressure Sensor"
    if d.startswith("Oil Pressure Switch"):
        return "Oil Pressure Switch"
    if d.startswith("Oil Pressure Sensor"):
        return "Oil Pressure Sensor"
    if d.startswith("Low Pressure Switch") or d.startswith("Pressure Switch"):
        return "Pressure Switch"
    if d == "Pressure Sensor":
        return "Pressure Sensor"
    if d.startswith("Air Intake"):
        return "Air Intake Sensor"
    if d.startswith("Intake Temperature"):
        return "Intake Temperature Sensor"
    if d.startswith("Intake Pressure"):
        return "Intake Pressure Sensor"
    if d.startswith("Air Pressure Sensor"):
        return "Air Pressure Sensor"
    if d.startswith("Air Pressure Switch") or d == "AC Pressure Switch":
        return "Air Pressure Switch"
    if d.startswith("Air Temp"):
        return "Air Temperature Sensor"
    if d.startswith("Air Alarm"):
        return "Air Alarm Sensor"
    if d.startswith("Vacuum"):
        return "Vacuum Pressure Switch"
    if d.startswith("Barometric"):
        return "Barometric Pressure Sensor"
    if d.startswith("Differential"):
        return "Differential Pressure Sensor"
    if d.startswith("Sensor Cable"):
        return "Sensor Cable Assembly"
    if d.startswith("Angle"):
        return "Angle Sensor"
    if d.startswith("Rotary"):
        return "Rotary Switch Sensor"
    if d.startswith("Door Lamp"):
        return "Door Lamp Switch"
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

    rest = re.sub(rf"(?<=[\w)])(?=(?:{BRANDS}))", " ", rest, flags=re.I)
    rest = re.sub(rf"\b((?:{BRANDS}))(?=\d)", r"\1 ", rest, flags=re.I)

    bm = None
    for m in re.finditer(rf"\b(?:{BRANDS})", rest, re.I):
        before = rest[: m.start()].strip(" /-|")
        if not before:
            continue
        if re.search(r"\d", before) or re.search(
            r"\b(?:VOE|ME|EX|PC|SK|WA|EC|DX|DH|JO|VH|RE|MD|Zmpar)\b", before, re.I
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
        if SECTION_RE.match(line) or line.startswith("This dataset"):
            continue
        if HEADER_RE.search(line):
            continue
        if line.startswith("(") and "Cummins" in line:
            continue
        bh = BRAND_HEADER_RE.match(line)
        if bh:
            brand_group = bh.group(1)
            continue

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
                "section": "Section 3",
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
                "section": "Section 3",
                "confidence": "user-section3-v2",
            }
        )
    return out


def write_ts(products: list[dict]) -> None:
    lines = [
        'import type { Part } from "@/lib/mock-data";',
        "",
        "/** Kafu catalog — Section 2 (sensors) + Section 3 (pressure). */",
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
    section3 = to_products(rows)

    section2: list[dict] = []
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            if code.startswith("A01") or code.startswith("A02"):
                section2.append(p)

    by_code: dict[str, dict] = {}
    for p in section2:
        by_code[p["catalogCode"]] = p
    for p in section3:
        by_code[p["catalogCode"]] = p

    products = [by_code[k] for k in sorted(by_code.keys())]
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "section_2_v2_plus_section_3_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section2": len(section2),
        "section3": len(section3),
        "count": len(products),
        "categories": cats,
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(
        f"section3_raw={len(rows)} section3={len(section3)} "
        f"section2_kept={len(section2)} total={len(products)}"
    )
    for c in cats:
        n = sum(1 for p in products if p["category"] == c)
        if n:
            print(f"  {n:3d}  {c}")
    for code in [
        "A01-1",
        "A03-12",
        "A03-7",
        "A03-37",
        "A04-20",
        "A04-56C",
        "A04-84",
        "A04-67",
    ]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
