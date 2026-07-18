"""
Extract Kafu catalog fields with RapidOCR (PP-OCR) + spatial cell clustering.

Per item:
  - catalogCode (Kafu A##-#)
  - description (product text under photo)
  - machines / compatibility
  - oemNumbers (OEM part numbers)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(r"C:\Users\saidg\parts village app")
PDF = Path(r"c:\Users\saidg\Downloads\Mobile Devices\catalog.pdf")
OUT = ROOT / "data" / "kafu-extracted-products.json"
PREV = OUT

CODE_RE = re.compile(r"\b([A-Z]\d{2}-\d{1,3}[A-Z]?)\b")
OEM_RE = re.compile(
    r"(?:"
    r"\b\d{3,4}-\d{2,5}(?:-\d{2,5})?\b"
    r"|\b\d{6,10}\b"
    r"|\bME\d{5,}\b"
    r"|\bMC\d{5,}\b"
    r"|\bVDE\d+\b"
    r"|\b[A-Z]{1,3}\d{5,}(?:-\d+)?\b"
    r"|\b\d{2,3}/\d{5,}\b"
    r")",
    re.I,
)
VOLT_RE = re.compile(r"\b(12V(?:\s*/\s*24V)?|24V(?:\s*/\s*12V)?)\b", re.I)

# Machine / model tokens commonly printed under product photos
MACHINE_RE = re.compile(
    r"(?:"
    r"\b(?:KOMATSU|HITACHI|CAT(?:ERPILLAR)?|KOBELCO|SANY|LIUGONG|DOOSAN|VOLVO|"
    r"JCB|CUMMINS|ISUZU|YANMAR|PERKINS|HYUNDAI|CASE|NEW\s*HOLLAND|SUMITOMO|"
    r"KATO|TAKEUCHI|KUBOTA|JOHN\s*DEERE)\b"
    r"|\bPC\s?\d{2,4}(?:-\d+[A-Z]?)?(?:/\d+[A-Z]?)?\b"
    r"|\bSK\s?\d{2,4}(?:-\d+[A-Z]?)?(?:/\d+[A-Z]*)?\b"
    r"|\bEX\s?\d{2,4}(?:-\d+[A-Z]?)?(?:/\d+)*\b"
    r"|\bZAX\s?\d{2,4}(?:-\d+[A-Z]?)?\b"
    r"|\bWA\s?\d{2,4}(?:-\d+[A-Z]?)?\b"
    r"|\bDH\s?\d{2,4}(?:-\d+[A-Z]?)?\b"
    r"|\bSH\s?\d{2,4}[A-Z]?\d*\b"
    r"|\bR\d{3,4}(?:-\d+)?\b"
    r"|\bE\d{2,4}[A-Z]?(?:-\d+[A-Z]?)?(?:/\d+[A-Z]*)?\b"
    r"|\b6D\d{2}\b"
    r"|\b6WG\d\b"
    r"|\b4P\d+\b"
    r")",
    re.I,
)

CN_BRAND = {
    "三一": "SANY",
    "康明斯": "Cummins",
    "小松": "Komatsu",
    "日立": "Hitachi",
    "卡特": "Caterpillar",
    "神钢": "Kobelco",
    "斗山": "Doosan",
    "沃尔沃": "Volvo",
    "柳工": "Liugong",
}

NOISE_RE = re.compile(
    r"(GENUINE\s*PARTS|MACHINERY\s*PARTS|KAFU\s*PARTS|www\.kafu|"
    r"need more information|需要更多|All Original|For Reference|"
    r"RevolutionSensor|转速传感器RevolutionSensor)",
    re.I,
)

SECTIONS = [
    "Revolution Sensor",
    "Camshaft Sensor",
    "Air Pressure Sensor",
    "Oil Pressure Switch",
    "Water Temp Sensor",
    "Oil-Water Separation Sensor",
    "Pressure Switch",
    "Common Rail Sensor",
    "SCU Valve",
    "High-pressure Oil Pump",
    "Starter Relay",
    "Spare Switch",
    "Controller",
    "Switch Ass'y",
    "Switch Assy",
    "Hydraulic Lock Switch",
    "Throttle Motor Parts",
    "Accelerator Motor",
    "Motor Assy Parts",
    "Time Meter",
    "Solenoid Valve",
    "Solenoid Valve Center",
    "Solenoid Valve Coil",
    "Ignition Switch",
    "Flameout Solenoid",
    "Plug",
    "Fusebox",
    "Wiring Harness",
    "Diode",
    "Fan Clutch",
    "Monitor",
    "Control Parts",
    "Survey Meter",
    "Detector",
    "F&R SWITCH",
    "Fuel Tank Sensor",
    "Wiper Motor",
    "Lamp",
    "Starting Motor",
    "Magnetic Switch",
    "Alternator",
    "Breather",
    "Door Hinge",
    "Grease Gun",
    "Universal Joint",
    "Air Filter",
    "Heating Radiator",
    "Cabin Filter",
    "Oil Injector",
    "Thermostat",
    "Engine Parts",
    "Oil Pump",
    "Oil Pipe",
    "Rubber Track",
    "Crankshaft",
    "Cylinder Block",
    "Engine Bearing",
    "Undercarriage",
]

PREFIX_CAT = {
    "A01": "Revolution Sensor",
    "A02": "Camshaft Sensor",
    "A03": "Air Pressure Sensor",
    "A04": "Oil Pressure Switch",
    "A05": "Water Temp Sensor",
    "A06": "Pressure Switch",
    "A07": "Common Rail Sensor",
    "A08": "High-pressure Oil Pump",
    "A09": "Starter Relay",
    "A10": "Controller",
    "A11": "Throttle Motor Parts",
    "A12": "Accelerator Motor",
    "A13": "Time Meter",
    "A14": "Solenoid Valve",
    "A15": "Ignition Switch",
    "A16": "Wiring Harness",
    "A17": "Fan Clutch",
    "A18": "Monitor",
    "A19": "Fuel Tank Sensor",
    "A20": "Wiper Motor",
    "A21": "Starting Motor",
    "A22": "Alternator",
    "A23": "Air Filter",
    "A24": "Thermostat",
    "A25": "Oil Pump",
    "A26": "Solenoid Valve",
}


def detect_section(text: str, fallback: str) -> str:
    found = [s for s in SECTIONS if s.lower() in text.lower()]
    if not found:
        return fallback
    return max(found, key=len)


def prefix_category(code: str) -> str | None:
    m = re.match(r"^([A-Z]\d{2})", code)
    if not m:
        return None
    return PREFIX_CAT.get(m.group(1))


def load_verified() -> dict:
    if not PREV.exists():
        return {}
    prev = json.loads(PREV.read_text(encoding="utf-8"))
    out = {}
    for p in prev.get("products", []):
        if p.get("confidence") == "verified":
            out[p["catalogCode"]] = p
    return out


def ocr_items(result) -> list[dict]:
    items = []
    for row in result or []:
        if len(row) < 2 or not row[1]:
            continue
        box, text, score = row[0], str(row[1]).strip(), float(row[2]) if len(row) > 2 else 0.0
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        items.append(
            {
                "text": text,
                "score": score,
                "x0": min(xs),
                "x1": max(xs),
                "y0": min(ys),
                "y1": max(ys),
                "cx": (min(xs) + max(xs)) / 2,
                "cy": (min(ys) + max(ys)) / 2,
            }
        )
    return items


def find_codes(items: list[dict]) -> list[dict]:
    codes = []
    for it in items:
        m = CODE_RE.search(it["text"].replace(" ", "").upper())
        if not m:
            # also try original
            m = CODE_RE.search(it["text"].upper())
        if not m:
            continue
        code = m.group(1)
        # prefer short labels that are mostly the code
        compact = re.sub(r"\s+", "", it["text"]).upper()
        if len(compact) > 12 and code not in compact[:8]:
            continue
        codes.append({**it, "code": code})
    # de-dupe same code at nearly same position
    codes.sort(key=lambda c: (c["y0"], c["x0"]))
    kept = []
    for c in codes:
        if any(
            k["code"] == c["code"]
            and abs(k["x0"] - c["x0"]) < 40
            and abs(k["y0"] - c["y0"]) < 40
            for k in kept
        ):
            continue
        kept.append(c)
    return kept


def cluster_rows(codes: list[dict], y_tol: float = 45) -> list[list[dict]]:
    if not codes:
        return []
    rows: list[list[dict]] = []
    cur = [codes[0]]
    for c in codes[1:]:
        if abs(c["y0"] - cur[0]["y0"]) <= y_tol:
            cur.append(c)
        else:
            rows.append(sorted(cur, key=lambda x: x["x0"]))
            cur = [c]
    rows.append(sorted(cur, key=lambda x: x["x0"]))
    return rows


def cell_bounds(
    code: dict,
    row: list[dict],
    row_idx: int,
    rows: list[list[dict]],
    page_w: float,
    page_h: float,
) -> tuple[float, float, float, float]:
    col = row.index(code)
    x0 = code["x0"] - 8
    if col + 1 < len(row):
        x1 = row[col + 1]["x0"] - 6
    else:
        # estimate from median cell width
        widths = []
        for r in rows:
            for i in range(len(r) - 1):
                widths.append(r[i + 1]["x0"] - r[i]["x0"])
        med = sorted(widths)[len(widths) // 2] if widths else 220
        x1 = min(page_w - 4, code["x0"] + med - 6)

    y0 = code["y0"] - 4
    if row_idx + 1 < len(rows):
        y1 = rows[row_idx + 1][0]["y0"] - 8
    else:
        y1 = page_h - 40
    # captions sit under the photo — keep lower portion of cell mainly,
    # but include whole cell so we don't miss short captions
    return x0, x1, y0, y1


def texts_in_cell(
    items: list[dict],
    code: dict,
    bounds: tuple[float, float, float, float],
) -> list[str]:
    x0, x1, y0, y1 = bounds
    out = []
    for it in items:
        if it is code or it.get("code"):
            # skip code labels themselves
            if CODE_RE.fullmatch(re.sub(r"\s+", "", it["text"]).upper()):
                continue
        # center must be in cell, and below the code label a bit
        if not (x0 <= it["cx"] <= x1 and y0 <= it["cy"] <= y1):
            continue
        if it["cy"] < code["y1"] - 5:
            continue
        t = it["text"].strip()
        if not t or NOISE_RE.search(t):
            continue
        if CODE_RE.fullmatch(re.sub(r"\s+", "", t).upper()):
            continue
        out.append(t)
    return out


def normalize_machine(raw: str) -> str:
    s = re.sub(r"\s+", "", raw.upper())
    s = s.replace("CATERPILLAR", "CAT")
    # SK1308 -> SK130-8 (common missing-dash OCR)
    s = re.sub(r"^(SK|PC|EX|ZAX|WA|DH|SH|E)(\d{2,3})(\d)$", r"\1\2-\3", s)
    return s


def pre_split_caption(text: str) -> str:
    """Insert spaces so machine / OEM / description don't stay glued."""
    t = text
    for cn, en in CN_BRAND.items():
        t = t.replace(cn, f" {en} ")
    t = re.sub(r"(转速传感器|Revolution\s*Sensor)", r"\1 ", t, flags=re.I)
    t = re.sub(
        r"\b(KOMATSU|HITACHI|CAT|KOBELCO|SANY|LIUGONG|DOOSAN|VOLVO|JCB|CUMMINS)\s*",
        r"\1 ",
        t,
        flags=re.I,
    )
    t = re.sub(r"([A-Z0-9/])(ME\d+|MC\d+|VDE\d+)", r"\1 \2", t, flags=re.I)
    t = re.sub(r"([\u4e00-\u9fff])([A-Z]{1,3}\d)", r"\1 \2", t)
    t = re.sub(r"([A-Z]{1,3}\d{2,4}(?:-\d+[A-Z]?)?)(\d{4,})", r"\1 \2", t, flags=re.I)
    t = re.sub(
        r"(SK|PC|EX|ZAX|WA|DH|E)(\d{2,4}(?:-\d+[A-Z]?)?)(?=(?:SK|PC|EX|ZAX|WA|DH|E)\d)",
        r"\1\2 ",
        t,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", t).strip()


def parse_cell(texts: list[str], category: str) -> dict:
    split_texts = [pre_split_caption(t) for t in texts]
    blob = " ".join(split_texts)

    oems: list[str] = []
    for m in OEM_RE.findall(blob):
        tok = m.upper().replace(" ", "")
        if CODE_RE.fullmatch(tok):
            continue
        if re.fullmatch(r"(PC|SK|EX|WA|DH|E)\d{2,4}", tok):
            continue
        if tok not in oems:
            oems.append(tok)

    machines: list[str] = []
    for m in MACHINE_RE.findall(blob):
        tok = normalize_machine(m)
        if len(tok) < 2:
            continue
        if any(tok == o or tok in o for o in oems) and not re.match(
            r"^(KOMATSU|HITACHI|CAT|KOBELCO|SANY|LIUGONG|DOOSAN|VOLVO|JCB|CUMMINS)",
            tok,
        ):
            continue
        if tok not in machines:
            machines.append(tok)

    desc_parts: list[str] = []
    for t in split_texts:
        clean = NOISE_RE.sub("", t).strip()
        clean = CODE_RE.sub("", clean)
        for oem in oems:
            clean = re.sub(re.escape(oem), "", clean, flags=re.I)
        for mac in machines:
            clean = re.sub(re.escape(mac), "", clean, flags=re.I)
        clean = re.sub(r"[·•|/]+", " ", clean)
        clean = re.sub(r"\s+", " ", clean).strip(" -–,.")
        if not clean or len(clean) < 2:
            continue
        if re.fullmatch(r"[\d\s\-./]+", clean):
            continue
        if clean.upper() in {m.upper() for m in machines}:
            continue
        if clean not in desc_parts:
            desc_parts.append(clean)

    description = " ".join(desc_parts[:3]).strip()
    if not description or re.fullmatch(r"[\w\-]{1,6}", description):
        cn = re.findall(r"[\u4e00-\u9fff]{2,20}", blob)
        description = cn[0] if cn else category
    if category == "Revolution Sensor":
        if "柴油泵" in blob:
            description = "Diesel pump revolution sensor"
        elif description in (category, "转速传感器") or "转速" in description:
            description = "Revolution Sensor"

    if machines:
        name = f"{description} — {', '.join(machines[:4])}"
    elif oems:
        name = f"{description} — {oems[0]}"
    else:
        name = description

    if len(name) > 120:
        name = name[:117] + "..."

    volt = None
    vm = VOLT_RE.search(blob)
    if vm:
        volt = vm.group(1).replace(" ", "").upper()

    return {
        "description": description,
        "name": name,
        "oemNumbers": oems[:8],
        "compatibility": machines[:8],
        "voltage": volt,
        "rawCaptions": texts[:8],
    }


def merge_product(existing: dict | None, new: dict) -> dict:
    if not existing:
        return new
    out = {**existing}
    # Prefer richer fields
    if len(new.get("oemNumbers") or []) > len(out.get("oemNumbers") or []):
        out["oemNumbers"] = new["oemNumbers"]
    else:
        for o in new.get("oemNumbers") or []:
            if o not in out.get("oemNumbers", []):
                out.setdefault("oemNumbers", []).append(o)

    if len(new.get("compatibility") or []) > len(out.get("compatibility") or []):
        out["compatibility"] = new["compatibility"]
    else:
        for m in new.get("compatibility") or []:
            if m not in out.get("compatibility", []):
                out.setdefault("compatibility", []).append(m)

    if new.get("description") and (
        not out.get("description")
        or out.get("description") == out.get("category")
        or out.get("catalogCode", "") in (out.get("name") or "")
    ):
        out["description"] = new["description"]
        out["name"] = new["name"]

    if new.get("voltage") and not out.get("voltage"):
        out["voltage"] = new["voltage"]

    for pg in new.get("sourcePages") or []:
        if pg not in out.setdefault("sourcePages", []):
            out["sourcePages"].append(pg)

    caps = out.get("rawCaptions") or []
    for c in new.get("rawCaptions") or []:
        if c not in caps:
            caps.append(c)
    out["rawCaptions"] = caps[:12]
    return out


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ocr = RapidOCR()
    doc = fitz.open(PDF)
    products: dict[str, dict] = {}
    page_meta = []
    current_section = "Kafu Parts"
    verified = load_verified()

    start = 4
    for i in range(start, doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
        tmp = ROOT / ".tmp-ocr-page.png"
        pix.save(str(tmp))
        result, _ = ocr(str(tmp))
        items = ocr_items(result)
        page_text = "\n".join(it["text"] for it in items)

        section = detect_section(page_text, current_section)
        if section != "Kafu Parts":
            current_section = section

        codes = find_codes(items)
        rows = cluster_rows(codes)
        parsed_n = 0

        for r_idx, row in enumerate(rows):
            for code_item in row:
                code = code_item["code"]
                bounds = cell_bounds(
                    code_item, row, r_idx, rows, pix.width, pix.height
                )
                captions = texts_in_cell(items, code_item, bounds)
                cat = prefix_category(code) or current_section
                parsed = parse_cell(captions, cat)
                parsed_n += 1 if captions else 0

                prod = {
                    "catalogCode": code,
                    "category": cat,
                    "description": parsed["description"],
                    "name": parsed["name"],
                    "oemNumbers": parsed["oemNumbers"],
                    "compatibility": parsed["compatibility"],
                    "voltage": parsed["voltage"],
                    "rawCaptions": parsed["rawCaptions"],
                    "sourcePages": [i + 1],
                    "confidence": "rapidocr-spatial",
                }
                products[code] = merge_product(products.get(code), prod)

        page_meta.append(
            {
                "pdfPage": i + 1,
                "section": current_section,
                "codeCount": len(codes),
                "codes": [c["code"] for c in codes],
                "cellsWithCaption": parsed_n,
                "engine": "rapidocr-spatial",
                "lineCount": len(items),
            }
        )
        print(
            f"page {i+1}/{doc.page_count} section={current_section!r} "
            f"codes={len(codes)} captions={parsed_n} lines={len(items)}",
            flush=True,
        )

    for code, ov in verified.items():
        base = products.get(code, {})
        products[code] = {
            **base,
            **ov,
            "confidence": "verified",
            "description": ov.get("description")
            or ov.get("name")
            or base.get("description"),
        }

    cleaned = {}
    for code, p in products.items():
        m = re.match(r"^[A-Z]\d{2}-(\d{1,3})[A-Z]?$", code)
        if not m or int(m.group(1)) > 399:
            continue
        # Ensure name always has something useful
        if not p.get("name") or p["name"].endswith(f"— {code}"):
            desc = p.get("description") or p.get("category") or "Kafu Part"
            machines = p.get("compatibility") or []
            p["name"] = f"{desc} — {', '.join(machines[:3])}" if machines else f"{desc} — {code}"
        cleaned[code] = p

    items = sorted(cleaned.values(), key=lambda x: x["catalogCode"])
    with_desc = sum(
        1
        for x in items
        if x.get("description")
        and x["description"] != x.get("category")
        and x["catalogCode"] not in (x.get("description") or "")
    )
    with_machine = sum(1 for x in items if x.get("compatibility"))
    with_oem = sum(1 for x in items if x.get("oemNumbers"))

    prev_count = 0
    if PREV.exists():
        prev_count = json.loads(PREV.read_text(encoding="utf-8")).get("count", 0)

    payload = {
        "status": "approved_for_import",
        "supplier": "Kafu Engineering Machine Fitting Co., Ltd.",
        "ocrEngine": "rapidocr-onnxruntime (PP-OCR) + spatial cell parse",
        "rules": {
            "partNumber": "kafu_code + oemNumbers",
            "description": "caption under product photo",
            "machine": "compatibility models/brands from caption",
            "categories": "per_section",
        },
        "count": len(items),
        "previousCount": prev_count,
        "delta": len(items) - prev_count,
        "withDescription": with_desc,
        "withMachine": with_machine,
        "withOem": with_oem,
        "verifiedCount": sum(1 for x in items if x.get("confidence") == "verified"),
        "ocrCount": sum(1 for x in items if x.get("confidence") != "verified"),
        "pageMeta": page_meta,
        "products": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(
        f"products={len(items)} desc={with_desc} machine={with_machine} oem={with_oem}"
    )


if __name__ == "__main__":
    main()
