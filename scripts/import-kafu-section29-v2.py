"""
Import Kafu Section 29 (radiators, hydraulic oil coolers, intercoolers).
Upserts A38; keeps prior sections.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section29-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(r"^(A\d{2}-\d{1,3})([A-Z])?(.*)$")
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
HEADER_RE = re.compile(r"^Part CodePart Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Miscellaneous)",
    re.I,
)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

DESCRIPTIONS = sorted(
    [
        "Heavy-Duty Engine Radiator (Copper Core)",
        "High-Pressure Hydraulic Oil Cooler",
        "Turbocharged Air Intercooler / Aftercooler",
        "Radiator Cooling Fan Blade (6-Blade Nylon)",
        "Anti-Vibration Radiator Rubber Mount",
        "Hydraulic Oil Cooler Guard / Shroud",
        "Combined Radiator & Oil Cooler Core Unit",
        "High-Efficiency Aluminum Intercooler Core",
        "Viscous Cooling Fan Shroud Assembly",
        "Heavy Aluminum Fin Engine Radiator",
        "Heavy-Duty Hydraulic Oil Cooler Core",
        "Air-to-Air Charge Air Cooler / Intercooler",
        "Radiator Expansion Water Tank Assembly",
        "Multi-Wing Heavy Radiator Fan Blade",
        "Copper Core Engine Radiator Assembly",
        "Parallel-Flow Hydraulic Oil Cooler",
        "High-Capacity Turbo Intercooler Unit",
        "Durable Polyurethane Radiator Fan Blade",
        "Aluminum Fin Solder Radiator Assembly",
        "Dual-Circuit Hydraulic Oil Cooler Core",
        "High-Pressure Turbo Intercooler Assembly",
        "Heavy Duty Radiator Fan Shroud & Blade",
        "Dual-Row Aluminum Engine Radiator",
        "Copper Fin Tube Hydraulic Oil Cooler",
        "Integrated Radiator, Cooler, & Intercooler",
        "Heavy Duty Multi-Blade Radiator Fan",
        "Engine Core Radiator & Fan Assembly Unit",
        "Heavy Plate-Fin Hydraulic Oil Cooler",
        "Core Air Aftercooler / Intercooler Module",
        "Complete Interlocking Radiator & Fan Set",
        "Heavy Equipment Oil Cooler Mount Gasket Set",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
    r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
    r"Deutz|JCB|Daewoo|XCMG|Sumitomo|Universal|CAT\b"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Node|Block Spec|Unit Spec|Line Spec|Box Spec|Board Spec|"
        r"Module Spec|Component Spec|Core Spec|Component Kit|Terminal Unit|"
        r"Component Unit|Component|Core|Board|Module|Panel|Unit)$",
        "",
        raw,
        flags=re.I,
    )
    raw = re.sub(r"\s*/\s*\d[A-Z0-9]*\s+Engine\b", "", raw, flags=re.I)
    parts = re.split(r"\s+/\s+", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        if len(t) < 2:
            continue
        if re.search(r"\bEngine\b", t, re.I):
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
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if "Fan" in d or "Shroud" in d or "Mount" in d or "Gasket" in d or "Tank" in d:
        return "Cooling Fan / Mount / Hardware"
    if "Intercooler" in d or "Aftercooler" in d or "Charge Air" in d:
        return "Intercooler / Aftercooler"
    if "Oil Cooler" in d:
        return "Hydraulic Oil Cooler"
    if "Radiator" in d or "Cooler" in d:
        return "Engine Radiator"
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
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /()&Φφ.°,-]{2,80}?)(?=\d|[A-Z]{2,}\d)", rest)
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
            r"\b(?:VOE|YN|YT|LC|KHR|AT|RE|ME|S\d)\b", before, re.I
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
        if line.startswith("(") and ("Sany" in line or "JCB" in line):
            continue
        bh = BRAND_HEADER_RE.match(line)
        if bh:
            brand_group = bh.group(1)
            continue
        m = CODE_RE.match(line)
        if not m:
            continue
        base, suffix, rest = m.group(1), m.group(2) or "", m.group(3).strip()
        if suffix:
            keep = (
                any(rest.startswith(d) for d in DESCRIPTIONS)
                or rest.startswith("AC ")
                or bool(re.match(r"^[A-Z][a-z]", rest))
            )
            if not keep:
                rest = suffix + rest
                suffix = ""
        code = (base + suffix).upper()
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
                "section": "Section 29",
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
        "section": "Section 29",
        "confidence": "user-section29-v2",
    }


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
    section_codes = {r["catalogCode"] for r in rows}

    by_code: dict[str, dict] = {}
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            if code.startswith("A38") or code in section_codes:
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
        by_code[r["catalogCode"]] = to_product(r)

    products = [by_code[k] for k in sorted(by_code.keys())]
    s29 = sum(1 for p in products if p.get("section") == "Section 29")
    payload = {
        "status": "sections_2_to_29_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section29": s29,
        "kept_prior": kept,
        "count": len(products),
        "categories": sorted({p["category"] for p in products}),
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"section29_raw={len(rows)} section29={s29} kept={kept} total={len(products)}")
    for code in ["A01-1", "A37-1", "A38-1", "A38-3A", "A38-9", "A38-14A", "A38-10C", "A38-23", "A38-24"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
