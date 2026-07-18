"""
Import cleaned Kafu Section 5 (separators, pressure switches, generic sensors).
Adds/replaces A07–A10. Keeps A01–A06 from prior sections.

Note: Page 21 lists A05-1..A05-8 as Core Terminal Post; those collide with
Section 4 water-temp A05 codes. Remap them to A07-1..A07-8 to match the
A07-9+ sequence on the same page.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section5-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[(]))?)(.*)$"
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
        "Oil-Water Separation Sensor (3-Blade)",
        "Oil-Water Separation Sensor (4-Blade)",
        "Oil-Water Separation Sensor",
        "Oil-Water Separator Sensor",
        "Separator Control Core (3-in-1)",
        "Separator Sensor Base",
        "Glass Bowl Core Sensor",
        "Fuel Bowl Core Sensor",
        "Fuel Sensor Cable",
        "Pressure Switch (Large Round Variant)",
        "Pressure Switch (Large Round Plug)",
        "Pressure Switch (Small Square Plug)",
        "Pressure Switch (Small Harness)",
        "Pressure Switch (Low Pressure)",
        "Travel Pressure Switch",
        "High Pressure Switch",
        "Interface Switch",
        "Pressure Switch",
        "High-Pressure Sensor",
        "High Pressure Sensor",
        "Main Pressure Sensor",
        "Vacuum Pressure Sensor",
        "New Style Pressure Sensor",
        "New Style Low Pressure Sensor",
        "Low Pressure Sensor",
        "Oil Pressure Sensor",
        "Pressure Sensor",
        "Intake Air Sensor",
        "Hydraulic Fluid Sensor",
        "Oil Temperature Sensor",
        "Water Temperature Sensor",
        "Core Terminal Post",
        "Core Sensor Node",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
    r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
    r"Deutz|Scania|JCB|Daewoo|Foton|Yuchai|Zoomlion|XCMG|Shanshan|Sumitomo|"
    r"Kato|Universal|General|Heavy|Filtration|Generic|CAT\b"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Engine Core|Base Line|Core Line|"
        r"Core Series|Master Line|Component Line|System Line|Engine Line|"
        r"Engine Variant|Component|Alternative|Standard|Spec|Cross-Ref|"
        r"Glass Variant|Block|Core Unit|Main Unit|Core Component|"
        r"Separation Module|Harness)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
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
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if d.startswith("Core Terminal"):
        return "Core Terminal Post"
    if d.startswith("Core Sensor"):
        return "Core Sensor Node"
    if "Oil-Water" in d or d.startswith("Separator") or d.startswith("Glass Bowl") or d.startswith("Fuel Bowl"):
        return "Oil-Water Separation Sensor"
    if d.startswith("Fuel Sensor"):
        return "Fuel Sensor Cable"
    if d.startswith("Travel Pressure") or d.startswith("High Pressure Switch") or d.startswith("Interface"):
        return "Pressure Switch"
    if d.startswith("Pressure Switch"):
        return "Pressure Switch"
    if d.startswith("High-Pressure") or d.startswith("High Pressure Sensor") or d.startswith("Main Pressure"):
        return "High Pressure Sensor"
    if d.startswith("Vacuum Pressure"):
        return "Vacuum Pressure Sensor"
    if d.startswith("Low Pressure") or d.startswith("New Style Low"):
        return "Low Pressure Sensor"
    if d.startswith("New Style Pressure"):
        return "Pressure Sensor"
    if d.startswith("Oil Pressure"):
        return "Oil Pressure Sensor"
    if d.startswith("Intake Air"):
        return "Intake Air Sensor"
    if d.startswith("Hydraulic Fluid"):
        return "Hydraulic Fluid Sensor"
    if d.startswith("Oil Temperature"):
        return "Oil Temperature Sensor"
    if d.startswith("Water Temperature"):
        return "Water Temperature Sensor"
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
            r"\b(?:VOE|ME|EX|PC|SK|WA|EC|DX|DH|YN|LC|LS|KM|FS|YSC|PT|RE)\b",
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


def remap_code(code: str, desc: str, page: str | None) -> str:
    """Page 21 A05 Core Terminal Posts → A07-1..A07-8 (avoid clobbering Section 4)."""
    m = re.match(r"^A05-([1-8])$", code)
    if m and desc == "Core Terminal Post" and page == "21":
        return f"A07-{m.group(1)}"
    return code


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
        if line.startswith("(") and ("JCB" in line or "Cummins" in line):
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
        code = remap_code(code, desc, page)

        rows.append(
            {
                "catalogCode": code,
                "category": normalize_category(desc),
                "description": desc,
                "oemNumbers": parse_oems(oem_raw),
                "compatibility": parse_machines(machine_raw),
                "page": page,
                "brandGroup": brand_group,
                "section": "Section 5",
            }
        )
    return rows


def merge_into(by_code: dict[str, dict], rows: list[dict]) -> list[dict]:
    """Upsert Section 5; merge OEM/machine when code already exists from S5 duplicates."""
    products = []
    for r in rows:
        code = r["catalogCode"]
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
        prod = {
            "catalogCode": code,
            "category": r["category"],
            "description": desc,
            "name": name,
            "oemNumbers": oems,
            "compatibility": machines,
            "pages": [r["page"]] if r.get("page") else [],
            "brandGroups": [r["brandGroup"]] if r.get("brandGroup") else [],
            "section": "Section 5",
            "confidence": "user-section5-v2",
        }
        if code in by_code and by_code[code].get("section") != "Section 5":
            # Don't overwrite Sections 2–4 unless this is a remapped A07
            if not code.startswith(("A07", "A08", "A09", "A10")):
                continue
        if code in by_code and by_code[code].get("confidence") == "user-section5-v2":
            cur = by_code[code]
            if len(desc) > len(cur["description"]):
                cur["description"] = desc
                cur["category"] = r["category"]
                cur["name"] = name
            for o in oems:
                if o.upper() not in {x.upper() for x in cur["oemNumbers"]}:
                    cur["oemNumbers"].append(o)
            for m in machines:
                if m not in cur["compatibility"]:
                    cur["compatibility"].append(m)
            if r.get("page") and r["page"] not in cur["pages"]:
                cur["pages"].append(r["page"])
            continue
        by_code[code] = prod
        products.append(prod)
    return products


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
        if not pages and p.get("catalogPage"):
            pages = [p["catalogPage"]]
        # Backfill page from notes if needed
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

    by_code: dict[str, dict] = {}
    if OUT_JSON.exists():
        prev = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        for p in prev.get("products", []):
            code = p.get("catalogCode", "")
            # Drop prior A07–A10 so Section 5 fully replaces them; keep A01–A06
            if code.startswith(("A07", "A08", "A09", "A10")):
                continue
            # Normalize to schema fields
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
        code = r["catalogCode"]
        # Only write A07–A10 (and remapped posts)
        if not code.startswith(("A07", "A08", "A09", "A10")):
            continue
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
        if code in by_code and by_code[code].get("section") == "Section 5":
            cur = by_code[code]
            for o in oems:
                if o.upper() not in {x.upper() for x in cur["oemNumbers"]}:
                    cur["oemNumbers"].append(o)
            for m in machines:
                if m not in cur["compatibility"]:
                    cur["compatibility"].append(m)
            if len(desc) > len(cur["description"]):
                cur["description"] = desc
                cur["category"] = r["category"]
                cur["name"] = name
            continue
        by_code[code] = {
            "catalogCode": code,
            "category": r["category"],
            "description": desc,
            "name": name,
            "oemNumbers": oems,
            "compatibility": machines,
            "pages": [r["page"]] if r.get("page") else [],
            "brandGroups": [r["brandGroup"]] if r.get("brandGroup") else [],
            "section": "Section 5",
            "confidence": "user-section5-v2",
        }

    products = [by_code[k] for k in sorted(by_code.keys())]
    s5 = sum(1 for p in products if p.get("section") == "Section 5")
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "sections_2_3_4_5_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section5": s5,
        "kept_prior": kept,
        "count": len(products),
        "categories": cats,
        "products": products,
        "note": "Page21 A05 Core Terminal Posts remapped to A07-1..A07-8",
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"section5_raw={len(rows)} section5={s5} kept={kept} total={len(products)}")
    for code in ["A05-1", "A07-1", "A07-9", "A08-1", "A09-7", "A10-1", "A10-41", "A09-26"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
