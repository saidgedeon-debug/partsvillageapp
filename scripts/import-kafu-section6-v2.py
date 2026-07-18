"""
Import Kafu Section 6 (high-pressure, common rail, SCU valves).
Upserts A10-42+ / A11 / A12; keeps prior A01–A10 (earlier pages) and A01–A09.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section6-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(
    # Trailing letter only before Title-case or ALLCAPS acronym descriptions (not A12-27SCU).
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[A-Z]{2}[A-Za-z]|\())?)(.*)$"
)
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
HEADER_RE = re.compile(r"^Part CodePart Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Miscellaneous)",
    re.I,
)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

DESCRIPTIONS = sorted(
    [
        "Solenoid Control Valve (12V/24V)",
        "Solenoid Control Valve",
        "Solenoid Control Block",
        "Solenoid Valve Unit",
        "SCU Control Valve (12V/24V)",
        "SCU Control Valve Unit",
        "SCU Control Valve",
        "SCU Repair Seal Kit",
        "High-Pressure SCU Control Valve",
        "High-Pressure SCU Valve (Long)",
        "High-Pressure SCU Valve (Short)",
        "High-Pressure SCU Valve",
        "High-Pressure Switch",
        "High-Pressure Sensor",
        "High/Low Combined Unit",
        "Low-Pressure Sensor",
        "3-Wire Pressure Sensor",
        "Valve Body Dual Sensor Unit",
        "Pressure Sensor (Rexroth Series)",
        "Small Thread High-Pressure Sensor",
        "Large Thread High-Pressure Sensor",
        "Large Thread Low-Pressure Sensor",
        "Pressure Reducing Valve",
        "Pressure Switch",
        "Pressure Sensor",
        "Common Rail Sensor",
        "Common Rail Control Valve",
        "Common Rail Valve Component",
        "Common Rail Pressure Limiter",
        "Fuel Pressure Limiter Valve",
        "Fuel Limiter Valve",
        "Overflow Valve",
        "High-Pressure Valve",
        "Pump Head Unit",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|HYUNDAI|Doosan|Kobelco|Sany|"
    r"Liugong|Cummins|Isuzu|Yanmar|Perkins|John Deere|Hino|Mitsubishi|Deutz|"
    r"Scania|JCB|Daewoo|Yuchai|Zoomlion|Lonking|XCMG|Shanhe|Lovol|Rexroth|"
    r"Denso|Shanshan|Sumitomo|Kato|Universal|Chai-Diesel|EC250D|CAT\b|"
    r"WG200|4D56|B3\.3|320D|C9\.3|6D140|E320D"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Engine Series|Base Line|Core Line|"
        r"Cross-Ref|Cross-Ref Line|Block|Heavy Line|Base Series|Spec|"
        r"Alternative Variant|Terminal Alt|Distribution Node|"
        r"Distribution Block|Heavy-Duty Variant)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        # drop pure pressure ratings
        if re.fullmatch(r"\d+(\.\d+)?\s*(Bar|MPa|bar)", t, re.I):
            continue
        if re.fullmatch(r"0-\d+(\.\d+)?\s*(bar|Bar|MPa)", t, re.I):
            continue
        if len(t) < 2:
            continue
        if not re.search(r"\d", t) and not re.fullmatch(
            r"[A-Z0-9][A-Z0-9 ._/-]{2,50}", t, re.I
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
        t = re.sub(r"^HYUNDAI\b", "Hyundai", t, flags=re.I)
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if "Seal Kit" in d:
        return "SCU Repair Seal Kit"
    if "Overflow" in d:
        return "Overflow Valve"
    if "Fuel Pressure Limiter" in d or "Fuel Limiter" in d or "Pressure Limiter" in d:
        return "Fuel Pressure Limiter Valve"
    if "Common Rail Control" in d or "Common Rail Valve" in d:
        return "Common Rail Valve"
    if "Common Rail" in d:
        return "Common Rail Sensor"
    if "Pressure Reducing" in d:
        return "Pressure Reducing Valve"
    if "Pump Head" in d:
        return "Pump Head Unit"
    if "High-Pressure Valve" in d and "SCU" not in d:
        return "High-Pressure Valve"
    if "SCU" in d or "High-Pressure SCU" in d:
        return "SCU Control Valve"
    if "Solenoid" in d:
        return "Solenoid Control Valve"
    if "High-Pressure Switch" in d:
        return "High-Pressure Switch"
    if "High-Pressure Sensor" in d or "High/Low" in d or "3-Wire" in d or "Valve Body" in d:
        return "High-Pressure Sensor"
    if "Low-Pressure Sensor" in d:
        return "Low-Pressure Sensor"
    if "Rexroth" in d:
        return "Pressure Sensor"
    if d.startswith("Pressure Switch"):
        return "Pressure Switch"
    if d.startswith("Pressure Sensor"):
        return "Pressure Sensor"
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
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /()&Φφ.-]{2,60}?)(?=\d|[A-Z]{2,}\d)", rest)
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
            r"\b(?:VOE|RE|MD|LC|PX|MBS|JO8|J05|J08|PC|SK|EC|DX|DH)\b",
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
        if line.startswith("(") and ("Sany" in line or "Cummins" in line or "Denso" in line):
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
                "section": "Section 6",
            }
        )
    return rows


def to_product(r: dict) -> dict:
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
    return {
        "catalogCode": r["catalogCode"],
        "category": r["category"],
        "description": desc,
        "name": name,
        "oemNumbers": oems,
        "compatibility": machines,
        "pages": [r["page"]] if r.get("page") else [],
        "brandGroups": [r["brandGroup"]] if r.get("brandGroup") else [],
        "section": "Section 6",
        "confidence": "user-section6-v2",
    }


def merge_product(cur: dict, new: dict) -> dict:
    if len(new["description"]) > len(cur["description"]):
        cur["description"] = new["description"]
        cur["category"] = new["category"]
        cur["name"] = new["name"]
    for o in new["oemNumbers"]:
        if o.upper() not in {x.upper() for x in cur["oemNumbers"]}:
            cur["oemNumbers"].append(o)
    for m in new["compatibility"]:
        if m not in cur["compatibility"]:
            cur["compatibility"].append(m)
    for pg in new.get("pages", []):
        if pg and pg not in cur["pages"]:
            cur["pages"].append(pg)
    for bg in new.get("brandGroups", []):
        if bg and bg not in cur.get("brandGroups", []):
            cur.setdefault("brandGroups", []).append(bg)
    cur["section"] = "Section 6"
    cur["confidence"] = "user-section6-v2"
    return cur


def write_ts(products: list[dict]) -> None:
    lines = [
        'import type { Part } from "@/lib/mock-data";',
        "",
        "/**",
        " * Kafu catalog — columns match extraction schema:",
        " * Part Code | Description | OEM / Serial | Machine Compatibility | Page",
        " */",
        "export const kafuParts: Part[] = [",
    ]
    for p in products:
        code = p["catalogCode"]
        pid = "kafu-" + code.lower()
        oems = p.get("oemNumbers") or []
        compat = p.get("compatibility") or []
        desc = p.get("description") or (
            p["name"].split(" — ")[0] if " — " in p.get("name", "") else p.get("name", code)
        )
        pages = p.get("pages") or []
        if not pages and p.get("notes"):
            m = re.search(r"Catalog p\.?\s*([\d,\s]+)", p["notes"], re.I)
            if m:
                pages = [x.strip() for x in m.group(1).split(",") if x.strip()]
        catalog_page = pages[0] if pages else ""
        part_numbers = [code] + [o for o in oems if o.upper() != code.upper()]
        notes_parts = []
        if oems:
            notes_parts.append("OEM: " + ", ".join(oems))
        if pages:
            notes_parts.append("Catalog p." + ", ".join(pages))
        notes_parts.append("Supplier: Kafu")
        notes = " · ".join(notes_parts)
        name = p.get("name") or desc
        lines += [
            "  {",
            f'    id: "{esc(pid)}",',
            f'    partNumber: "{esc(code)}",',
            f"    partNumbers: [{', '.join(f'\"{esc(n)}\"' for n in part_numbers)}],",
            f'    name: "{esc(name)}",',
            f'    description: "{esc(desc)}",',
            f'    category: "{esc(p["category"])}",',
            "    quantity: 0,",
            "    reorderAt: 0,",
            "    cost: 0,",
            "    price: 0,",
            f"    compatibility: [{', '.join(f'\"{esc(c)}\"' for c in compat)}],",
        ]
        if catalog_page:
            lines.append(f'    catalogPage: "{esc(catalog_page)}",')
        lines += [
            f'    notes: "{esc(notes)}",',
            "  },",
        ]
    lines += ["];", ""]
    OUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = parse_raw(RAW.read_text(encoding="utf-8"))
    section6_codes = {r["catalogCode"] for r in rows}

    by_code: dict[str, dict] = {}
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            # Drop prior A11/A12 and any A10 codes that Section 6 redefines
            if code.startswith(("A11", "A12")):
                continue
            if code in section6_codes:
                continue
            if not p.get("description"):
                name = p.get("name", "")
                p["description"] = name.split(" — ")[0] if " — " in name else name
            if not p.get("pages") and p.get("notes"):
                m = re.search(r"Catalog p\.?\s*([\d,\s]+)", p["notes"], re.I)
                if m:
                    p["pages"] = [x.strip() for x in m.group(1).split(",") if x.strip()]
            by_code[code] = p

    kept = len(by_code)
    for r in rows:
        prod = to_product(r)
        code = prod["catalogCode"]
        if code in by_code and by_code[code].get("confidence") == "user-section6-v2":
            merge_product(by_code[code], prod)
        else:
            by_code[code] = prod

    products = [by_code[k] for k in sorted(by_code.keys())]
    s6 = sum(1 for p in products if p.get("section") == "Section 6")
    payload = {
        "status": "sections_2_to_6_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section6": s6,
        "kept_prior": kept,
        "count": len(products),
        "categories": sorted({p["category"] for p in products}),
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"section6_raw={len(rows)} section6={s6} kept={kept} total={len(products)}")
    for code in ["A01-1", "A10-41", "A10-42", "A10-44A", "A11-1", "A12-1", "A12-27", "A12-7A"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
