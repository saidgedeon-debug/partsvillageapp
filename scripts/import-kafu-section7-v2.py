"""
Import Kafu Section 7 (common rail fuel logs, relays, starters).
Upserts A13/A14/A15; keeps prior sections including Section 8.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section7-v2-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[A-Z]{2}[A-Za-z]|\())?)(.*)$"
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
        "Common Rail Pipe Log",
        "Fuel Common Rail Log",
        "Heavy-Duty Starter Relay",
        "Heavy-Duty Relay Block",
        "Heavy-Duty Relay Core",
        "Heavy-Duty Relay",
        "Heavy-Duty Fuse System",
        "Heavy-Duty Resistor Block",
        "Heavy-Duty Power Switch",
        "Heavy-Duty Audio Horn",
        "Universal Starter Relay",
        "Ground Starter Relay",
        "Isolated Starter Relay",
        "Starter Relay Component",
        "Time Delay Relay",
        "Windshield Wiper Relay",
        "Wiper Control Relay",
        "Electrical Relay Unit",
        "Electrical Relay",
        "Electrical Solenoid Valve",
        "Control Module Relay",
        "Power Relay Interface",
        "Universal Relay",
        "Power Isolator Relay",
        "Multi-Terminal Relay Set",
        "Relay Base Assembly",
        "Relay Base Solenoid",
        "Circuit Breaker",
        "Throttle Drive Board",
        "Engine Voltage Regulator",
        "Battery Disconnect Switch",
        "Master Battery Disconnect",
        "Chassis Electric Horn",
        "Reverse Backup Alarm",
        "Ignition Preheater Plug",
    ],
    key=len,
    reverse=True,
)

BRANDS = (
    r"Caterpillar|Komatsu|Volvo|VOLVO|Hitachi|Hyundai|HYUNDAI|Doosan|Kobelco|Sany|"
    r"Liugong|Cummins|Isuzu|Yanmar|Perkins|John Deere|Hino|Mitsubishi|Mitsu|"
    r"Deutz|JCB|Daewoo|XCMG|Yuchai|Zoomlion|Sumitomo|Kubota|Universal|"
    r"Industrial|Heavy-Duty|CAT\b|PC200|PC300|EX200|E320|E312|E307|E330|"
    r"E336|R60|C9\b"
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Core|Series Core|Line|Assembly|Configuration|"
        r"Base Block|Base Board Unit|Drive Line Core|Component|"
        r"Power Switch|New|Spec)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        if re.fullmatch(r"\d+\s*[AVΩ]", t, re.I):
            continue
        if re.fullmatch(r"12V|24V|12/24V|48V", t, re.I):
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
        t = re.sub(r"^HYUNDAI\b", "Hyundai", t, flags=re.I)
        if t not in out:
            out.append(t)
    return out[:10]


def normalize_category(desc: str) -> str:
    d = desc
    if "Common Rail" in d or "Pipe Log" in d or "Rail Log" in d:
        return "Fuel Common Rail"
    if "Circuit Breaker" in d or "Fuse" in d:
        return "Circuit Protection"
    if "Throttle" in d:
        return "Throttle Drive Board"
    if "Voltage Regulator" in d:
        return "Voltage Regulator"
    if "Battery Disconnect" in d or "Master Battery" in d or "Power Isolator" in d:
        return "Battery Disconnect Switch"
    if "Horn" in d or "Backup Alarm" in d or "Audio" in d:
        return "Horn / Alarm"
    if "Preheater" in d:
        return "Glow / Preheater Plug"
    if "Solenoid" in d:
        return "Electrical Solenoid"
    if "Relay Base" in d:
        return "Relay Base"
    if "Starter" in d or "Relay" in d:
        return "Starter / Control Relay"
    if "Power Switch" in d:
        return "Power Switch"
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
            r"\b(?:VOE|ME|VH|YH|BR|ACB|HC|ACA|JQX|MK|DKB|YC|PC|SK|DX|EX|WA)\b",
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
        if line.startswith("(") and ("Sany" in line or "Cummins" in line):
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
                "section": "Section 7",
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
        "section": "Section 7",
        "confidence": "user-section7-v2",
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
            if code.startswith(("A13", "A14", "A15")) or code in section_codes:
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
    s7 = sum(1 for p in products if p.get("section") == "Section 7")
    payload = {
        "status": "sections_2_to_8_v2",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "section7": s7,
        "kept_prior": kept,
        "count": len(products),
        "categories": sorted({p["category"] for p in products}),
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"section7_raw={len(rows)} section7={s7} kept={kept} total={len(products)}")
    for code in ["A01-1", "A13-1", "A14-1", "A14-33A", "A15-1", "A15-39", "A16-1", "A17-1"]:
        p = by_code.get(code)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
