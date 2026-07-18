"""
Import cleaned Kafu Section 2–3 paste (brand-grouped rows).
Upserts into kafu inventory: merge OEM + machine by catalog code.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kafu-section2-3-raw.txt"
OUT_JSON = ROOT / "data" / "kafu-section-import.json"
OUT_TS = ROOT / "src" / "lib" / "kafu-inventory.ts"

CODE_RE = re.compile(r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z(\/]|[A-Z][a-z]))?)(.*)$")
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
HEADER_RE = re.compile(r"^Part CodePart Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Miscellaneous)",
    re.I,
)
SECTION_RE = re.compile(r"^Section\s+\d+", re.I)

# Descriptions seen in this clean paste (longest first)
DESCRIPTIONS = sorted(
    [
        "Pressure Switch / Revolution Sensor",
        "Fuel Pump Revolution Sensor",
        "Fuel/Oil Pressure Sensor",
        "Eccentric Shaft Speed Sensor",
        "Flywheel Revolution Sensor",
        "Flywheel Camshaft Sensor",
        "Barometric Pressure Sensor",
        "Intake Temperature Sensor (Old)",
        "Intake Temperature Sensor",
        "Intake Pressure Sensor",
        "Air Intake Sensor (5-Wire Line)",
        "Air Intake Sensor (6-Wire Line)",
        "Air Intake Sensor",
        "Air Pressure Sensor",
        "Air Pressure Switch",
        "AC Pressure Switch",
        "Vacuum Switch",
        "Oil Pressure Switch (Dual-Pin)",
        "Oil Pressure Switch (Single-Pin)",
        "Oil Pressure Switch",
        "Oil Pressure Sensor",
        "Low Pressure Switch (New Model)",
        "Low Pressure Switch",
        "Pressure Switch (40Bar)",
        "Pressure Switch (Small Plug)",
        "Pressure Sensor",
        "Camshaft Sensor (Flywheel 3-Pin)",
        "Camshaft Sensor (D4921684)",
        "Camshaft Sensor (D4921686)",
        "Revolution Sensor (Φ16 Thick)",
        "Revolution Sensor (Φ19 Thick)",
        "Revolution Sensor (Custom Edition)",
        "Revolution Sensor (Dual-Line)",
        "Revolution Sensor (6D102 Engine)",
        "Revolution Sensor (New Model)",
        "Revolution Sensor / Pressure Switch",
        "Revolution Sensor",
        "Camshaft Sensor",
        "Crankshaft Sensor",
        "Switch Sensor",
    ],
    key=len,
    reverse=True,
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_oems(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(
        r"\s+(Variant|Line Spec|Series Core|Spec|Node Spec|Engine Spec|"
        r"Engine Block Spec|Systems Base|Standard Line|Standard Node|"
        r"Core Line|Core Node|Fleet|Block Spec|Block Variant|"
        r"Longline Spec|Standard Layout|Systems Base|"
        r"OEM Standard Node)$",
        "",
        raw,
        flags=re.I,
    )
    parts = re.split(r"\s*/\s*", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        t = re.sub(r"\s+", " ", p.strip())
        # strip trailing marketing in parentheses kept if useful
        t = re.sub(r"\s*\((2-Pin|Dual-Pin|Single-Pin|Old|New Model)\)\s*$", "", t, flags=re.I)
        if len(t) < 2:
            continue
        # skip pure prose OEMs without digits (unless short code)
        if not re.search(r"\d", t) and not re.fullmatch(r"[A-Z0-9-]{3,16}", t.replace(" ", ""), re.I):
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
        if t not in out:
            out.append(t)
    return out[:10]


def split_row(rest: str) -> tuple[str, str, str, str | None]:
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
        # fallback: letters until digit
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /()&Φφ.-]{2,60}?)(?=\d|[A-Z]{2}\d)", rest)
        if m:
            desc = m.group(1).strip()
            rest = rest[m.end() :].strip()
        else:
            desc = "Kafu Part"

    # Split OEM vs machine: machine often starts with brand name
    brands = (
        r"Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Sany|Liugong|"
        r"Cummins|Isuzu|Yanmar|Perkins|John Deere|Bobcat|Kubota|Hino|Mitsubishi|"
        r"Deutz|Scania|Liebherr|Bosch|Rexroth|JCB|Daewoo|Foton|Yuchai|Zoomlion|"
        r"XCMG|Jonyang|Shandong|Shanshan|Global|Sumitomo|Kato"
    )
    # insert space before brand if glued to prior token
    rest = re.sub(rf"(?<=[\w)])(?=(?:{brands})\b)", " ", rest, flags=re.I)
    # insert space after brand glued to model digits (Caterpillar312D)
    rest = re.sub(rf"\b((?:{brands}))(?=\d)", r"\1 ", rest, flags=re.I)

    # Prefer machine brand that is NOT the first token when first token is OEM brand prefix
    # e.g. "VOLVO D3.8 Volvo, Deutz Engines" or "DEUTZ 0118-2850 Volvo, Deutz Engines"
    bm = None
    for m in re.finditer(rf"\b(?:{brands})\b", rest, re.I):
        before = rest[: m.start()].strip(" /-|")
        # Skip leading brand-only OEM prefixes (VOLVO / DEUTZ / HITACHI + number)
        if not before:
            continue
        # If before looks like an OEM (has digit or OEM-like token), this brand starts machine
        if re.search(r"\d", before) or re.search(
            r"\b(?:VOE|ME|EX|PC|SK|WA|EC|DX|DH|JO|VH|RE)\b", before, re.I
        ):
            bm = m
            break
        # Otherwise keep scanning for a later brand occurrence
    if bm is not None:
        oem = rest[: bm.start()].strip(" /-|")
        machine = rest[bm.start() :].strip()
    else:
        # Fallback: first brand occurrence, or whole string as OEM
        bm2 = re.search(rf"\b(?:{brands})\b", rest, re.I)
        if bm2 and bm2.start() > 0:
            oem = rest[: bm2.start()].strip(" /-|")
            machine = rest[bm2.start() :].strip()
        elif bm2 and bm2.start() == 0:
            # Entire field starts with brand — treat as machine (OEM empty)
            # unless brand + code pattern like "HITACHI 2055358" alone with no second brand
            after = rest[bm2.end() :].strip()
            if re.match(r"^[\dA-Z][\w./-]{2,}$", after.split()[0] if after else "", re.I) and not re.search(
                rf"\b(?:{brands})\b", after, re.I
            ):
                # "HITACHI 2055358" alone → OEM is the number, machine is brand general
                oem = after
                machine = bm2.group(0)
            else:
                oem, machine = "", rest
        else:
            # e.g. "449298 HK450 SLX300 Marine / Crane"
            hm = re.match(r"^([\w./-]+)\s+(HK\d+\b.*)$", rest, re.I)
            if hm:
                oem, machine = hm.group(1), hm.group(2)
            else:
                oem, machine = rest, ""
    return desc, oem, machine, page


def parse_raw(text: str) -> list[dict]:
    rows: list[dict] = []
    brand_group = ""
    section = "Section 2"

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if SECTION_RE.match(line):
            section = line.split(":", 1)[0].strip()
            continue
        if HEADER_RE.search(line):
            continue
        if line.startswith("This segment") or line.startswith("This dataset"):
            continue
        bh = BRAND_HEADER_RE.match(line)
        if bh:
            brand_group = bh.group(1)
            continue

        m = CODE_RE.match(line)
        if not m:
            continue
        code, rest = m.group(1).upper(), m.group(2).strip()
        desc, oem_raw, machine_raw, page = split_row(rest)
        # normalize Switch Sensor → Inductive Switch Sensor for consistency
        category = desc
        if category == "Switch Sensor":
            category = "Inductive Switch Sensor"
        if category.startswith("Revolution Sensor"):
            category = "Revolution Sensor"
        if category.startswith("Camshaft Sensor"):
            category = "Camshaft Sensor"
        if category.startswith("Fuel Pump"):
            category = "Fuel Pump Speed Sensor"
        if category.startswith("Pressure Switch /"):
            category = "Pressure Switch Core"
        if category.startswith("Oil Pressure Switch"):
            category = "Oil Pressure Switch"
        if category.startswith("Oil Pressure Sensor") or category == "Fuel/Oil Pressure Sensor":
            category = "Oil Pressure Sensor"
        if category.startswith("Low Pressure Switch") or category.startswith("Pressure Switch"):
            category = "Pressure Switch"
        if category.startswith("Pressure Sensor"):
            category = "Pressure Sensor"
        if category.startswith("Air Intake"):
            category = "Air Intake Sensor"
        if category.startswith("Intake Temperature"):
            category = "Intake Temperature Sensor"
        if category.startswith("Intake Pressure"):
            category = "Intake Pressure Sensor"
        if category.startswith("Air Pressure Sensor"):
            category = "Air Pressure Sensor"
        if category.startswith("Air Pressure Switch") or category == "AC Pressure Switch":
            category = "Air Pressure Switch"
        if category.startswith("Vacuum"):
            category = "Vacuum Pressure Switch"
        if category.startswith("Barometric"):
            category = "Barometric Pressure Sensor"
        if "Flywheel" in category and "Camshaft" in category:
            category = "Camshaft Timing Sensor"
        if category.startswith("Flywheel Revolution") or category.startswith("Flywheel Speed"):
            category = "Flywheel Speed Sensor"
        if category.startswith("Crankshaft"):
            category = "Crankshaft Sensor"
        if category.startswith("Eccentric"):
            category = "Eccentric Shaft Speed Sensor"

        oems = parse_oems(oem_raw)
        machines = parse_machines(machine_raw)
        rows.append(
            {
                "catalogCode": code,
                "category": category,
                "description": desc,
                "oemNumbers": oems,
                "compatibility": machines,
                "page": page,
                "brandGroup": brand_group,
                "section": section,
            }
        )
    return rows


def merge_rows(rows: list[dict]) -> list[dict]:
    by_code: dict[str, dict] = {}
    for r in rows:
        code = r["catalogCode"]
        if code not in by_code:
            by_code[code] = {
                "catalogCode": code,
                "category": r["category"],
                "description": r["description"],
                "oemNumbers": list(r["oemNumbers"]),
                "compatibility": list(r["compatibility"]),
                "pages": [r["page"]] if r.get("page") else [],
                "brandGroups": [r["brandGroup"]] if r.get("brandGroup") else [],
                "section": r["section"],
                "confidence": "user-section-clean",
            }
            continue
        cur = by_code[code]
        # Prefer longer/more specific description
        if len(r["description"]) > len(cur["description"]):
            cur["description"] = r["description"]
            cur["category"] = r["category"]
        for o in r["oemNumbers"]:
            if o.upper() not in {x.upper() for x in cur["oemNumbers"]}:
                cur["oemNumbers"].append(o)
        for m in r["compatibility"]:
            if m not in cur["compatibility"]:
                cur["compatibility"].append(m)
        if r.get("page") and r["page"] not in cur["pages"]:
            cur["pages"].append(r["page"])
        if r.get("brandGroup") and r["brandGroup"] not in cur["brandGroups"]:
            cur["brandGroups"].append(r["brandGroup"])

    out = []
    for code, p in sorted(by_code.items(), key=lambda x: x[0]):
        machines = p["compatibility"][:10]
        oems = p["oemNumbers"][:8]
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
                "pages": p["pages"],
                "brandGroups": p["brandGroups"],
                "section": p["section"],
                "confidence": "user-section-clean",
            }
        )
    return out


def write_ts(products: list[dict]) -> None:
    lines = [
        'import type { Part } from "@/lib/mock-data";',
        "",
        "/** Kafu Sections 2–3 — cleaned brand-grouped paste (part, OEM, machine). */",
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
    products = merge_rows(rows)
    cats = sorted({p["category"] for p in products})
    payload = {
        "status": "section_2_3_clean",
        "supplier": "Kafu",
        "rawRows": len(rows),
        "count": len(products),
        "categories": cats,
        "products": products,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_ts(products)
    print(f"rawRows={len(rows)} unique={len(products)} categories={len(cats)}")
    for c in cats:
        n = sum(1 for p in products if p["category"] == c)
        print(f"  {n:3d}  {c}")
    for code in ["A01-1", "A01-5", "A01-7A", "A02-14A", "A03-12", "A04-20", "A04-67"]:
        p = next((x for x in products if x["catalogCode"] == code), None)
        if not p:
            print(code, "MISSING")
        else:
            print(code, "|", p["description"], "|", p["oemNumbers"][:2], "|", p["compatibility"][:2])


if __name__ == "__main__":
    main()
