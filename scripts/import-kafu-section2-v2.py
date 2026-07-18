"""
Import cleaned Kafu Section 2 (unique codes, machine column).
Replaces A01/A02 products; keeps existing A03/A04 from prior Section 3 import.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section2-v2-raw.txt"
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

DESCRIPTIONS = sorted(
    [
        "Pressure Switch / Rev Sensor",
        "Pressure Switch / Revolution Sensor",
        "Fuel Pump Revolution Sensor",
        "Eccentric Shaft Sensor (3-Pin)",
        "Eccentric Shaft Rev Sensor",
        "Eccentric Shaft Speed Sensor",
        "Flywheel Camshaft Sensor",
        "Flywheel Rev Sensor",
        "Flywheel Revolution Sensor",
        "Crankshaft Sensor (Long Line)",
        "Crankshaft Rev Sensor",
        "Crankshaft Sensor",
        "Revolution Sensor (Dual Line)",
        "Revolution Sensor (New)",
        "Revolution Sensor (Dual-Line)",
        "Revolution Sensor (New Model)",
        "Revolution Sensor",
        "Camshaft Sensor",
        "Air Intake Sensor",
        "Switch Sensor",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
    r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
    r"Deutz|Scania|Liebherr|Rexroth|JCB|Daewoo|Foton|Yuchai|Zoomlion|"
    r"XCMG|Jonyang|Shandong|Shanshan|Sumitomo|Kato|Universal"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Engine Core)$",
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
            r"\s*\((2-Pin Variant|2-Pin|Long Line|Dual Line|New)\)\s*$",
            "",
            t,
            flags=re.I,
        )
        if len(t) < 2:
            continue
        if not re.search(r"\d", t) and not re.fullmatch(
            r"[A-Z0-9][A-Z0-9 ._/-]{2,24}", t, re.I
        ):
            # keep prose OEMs that look like model names with digits elsewhere handled
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
    # Drop parenthetical engine notes into separate soft tags kept on first chunk
    chunks = re.split(r"\s*,\s*", raw)
    out: list[str] = []
    for c in chunks:
        t = c.strip()
        if len(t) < 2:
            continue
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if d == "Switch Sensor":
        return "Inductive Switch Sensor"
    if d.startswith("Pressure Switch"):
        return "Pressure Switch Core"
    if d.startswith("Fuel Pump"):
        return "Fuel Pump Speed Sensor"
    if d.startswith("Flywheel Camshaft"):
        return "Camshaft Timing Sensor"
    if d.startswith("Flywheel Rev") or d.startswith("Flywheel Revolution"):
        return "Flywheel Speed Sensor"
    if d.startswith("Eccentric"):
        return "Eccentric Shaft Speed Sensor"
    if d.startswith("Crankshaft Rev") or d.startswith("Crankshaft"):
        return "Crankshaft Sensor"
    if d.startswith("Revolution"):
        return "Revolution Sensor"
    if d.startswith("Camshaft"):
        return "Camshaft Sensor"
    if d.startswith("Air Intake"):
        return "Air Intake Sensor"
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
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /()&Φφ.-]{2,50}?)(?=\d|[A-Z]{2,}\d)", rest)
        if m:
            desc = m.group(1).strip()
            rest = rest[m.end() :].strip()
        else:
            desc = "Kafu Part"

    rest = re.sub(rf"(?<=[\w)])(?=(?:{BRANDS})\b)", " ", rest, flags=re.I)
    rest = re.sub(rf"\b((?:{BRANDS}))(?=\d)", r"\1 ", rest, flags=re.I)
    # 449298HK450 → 449298 HK450 (not 6HK1 engine codes)
    rest = re.sub(r"(?<=\d{3})(?=HK\d)", " ", rest, flags=re.I)

    bm = None
    for m in re.finditer(rf"\b(?:{BRANDS})\b", rest, re.I):
        before = rest[: m.start()].strip(" /-|")
        if not before:
            continue
        if re.search(r"\d", before) or re.search(
            r"\b(?:VOE|ME|EX|PC|SK|WA|EC|DX|DH|JO|VH|RE|MC)\b", before, re.I
        ):
            bm = m
            break
    if bm is not None:
        oem = rest[: bm.start()].strip(" /-|")
        machine = rest[bm.start() :].strip()
    else:
        bm2 = re.search(rf"\b(?:{BRANDS})\b", rest, re.I)
        if bm2 and bm2.start() > 0:
            oem = rest[: bm2.start()].strip(" /-|")
            machine = rest[bm2.start() :].strip()
        elif bm2 and bm2.start() == 0:
            after = rest[bm2.end() :].strip()
            # "JCB Heavy Line JCB (4HK1...)" — OEM is text before second brand
            bm3 = re.search(rf"\b(?:{BRANDS})\b", after, re.I)
            if bm3 and bm3.start() > 0:
                oem = after[: bm3.start()].strip(" /-|")
                # Include leading brand in machine for clarity
                machine = (bm2.group(0) + " " + after[bm3.start() :]).strip()
                # Prefer: OEM = leading brand + middle, machine = second brand onward
                oem = (bm2.group(0) + " " + oem).strip()
                machine = after[bm3.start() :].strip()
            elif after and re.match(r"^[\dA-Z][\w./-]{2,}$", after.split()[0], re.I) and not re.search(
                rf"\b(?:{BRANDS})\b", after, re.I
            ):
                oem, machine = after, bm2.group(0)
            else:
                # Whole field is machine (e.g. "Volvo D3.8 Engine")
                oem, machine = "", rest
        else:
            hm = re.match(r"^([\w./-]+)\s+(HK\d+\b.*)$", rest, re.I)
            if hm:
                oem, machine = hm.group(1), hm.group(2)
            else:
                oem, machine = rest, ""
    return desc, oem, machine, page


def parse_raw(text: str) -> list[dict]:
    rows: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("Section ") or line.startswith("Part Code"):
            continue
        if line.startswith("This segment") or line.startswith("This dataset"):
            continue

        pipe = PIPE_RE.match(line)
        if pipe:
            code = pipe.group(1).upper()
            desc = pipe.group(2).strip()
            oem_raw = pipe.group(3).strip()
            machine_raw = pipe.group(4).strip()
            page = pipe.group(5)
        else:
            m = CODE_RE.match(line)
            if not m:
                continue
            code, rest = m.group(1).upper(), m.group(2).strip()
            # Avoid swallowing next field when code letter is part of description
            # CODE_RE already takes optional trailing letter only as whole suffix
            desc, oem_raw, machine_raw, page = split_glued(rest)

        # Normalize description aliases
        if desc == "Pressure Switch / Rev Sensor":
            desc = "Pressure Switch / Revolution Sensor"
        if desc == "Revolution Sensor (New)":
            desc = "Revolution Sensor (New Model)"
        if desc == "Revolution Sensor (Dual Line)":
            desc = "Revolution Sensor (Dual-Line)"
        if desc == "Flywheel Rev Sensor":
            desc = "Flywheel Revolution Sensor"
        if desc == "Eccentric Shaft Rev Sensor":
            desc = "Eccentric Shaft Speed Sensor"
        if desc == "Crankshaft Rev Sensor":
            desc = "Crankshaft Sensor"
        if desc.startswith("Eccentric Shaft Sensor"):
            desc = "Eccentric Shaft Speed Sensor"

        oems = parse_oems(oem_raw)
        machines = parse_machines(machine_raw)
        rows.append(
            {
                "catalogCode": code,
                "category": normalize_category(desc),
                "description": desc,
                "oemNumbers": oems,
                "compatibility": machines,
                "page": page,
                "brandGroup": "",
                "section": "Section 2",
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
                "brandGroups": [],
                "section": "Section 2",
                "confidence": "user-section2-v2",
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
    section2 = to_products(rows)

    # Keep Section 3 from previous import
    section3: list[dict] = []
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            if code.startswith("A03") or code.startswith("A04"):
                section3.append(p)

    by_code: dict[str, dict] = {}
    for p in section3 + section2:
        by_code[p["catalogCode"]] = p
    # Section 2 wins for A01/A02
    for p in section2:
        by_code[p["catalogCode"]] = p

    products = [by_code[k] for k in sorted(by_code.keys())]
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "section_2_v2_plus_section_3",
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
        f"section2_raw={len(rows)} section2={len(section2)} "
        f"section3_kept={len(section3)} total={len(products)}"
    )
    for c in cats:
        n = sum(1 for p in products if p["category"] == c)
        print(f"  {n:3d}  {c}")
    for code in ["A01-1", "A01-7A", "A01-17", "A02-4", "A02-23", "A02-47", "A03-12", "A04-67"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
