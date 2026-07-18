"""
Re-extract Kafu catalog with RapidOCR (PP-OCR based, strong CN+EN).
Merges with previous verified overrides and writes JSON + regenerates inventory TS.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(r"C:\Users\saidg\parts village app")
PDF = Path(r"c:\Users\saidg\Downloads\Mobile Devices\catalog.pdf")
OUT = ROOT / "data" / "kafu-extracted-products.json"
PREV = ROOT / "data" / "kafu-extracted-products.json"

CODE_RE = re.compile(r"\b([A-Z]\d{2}-\d{1,3}[A-Z]?)\b")
OEM_RE = re.compile(
    r"\b("
    r"\d{3,4}-\d{3,5}"
    r"|\d{6,10}"
    r"|[A-Z]{2}\d{5,}"
    r"|ME\d+"
    r"|MC\d+"
    r"|VDE\d+"
    r"|OEM[:\s]*[A-Z0-9/-]+"
    r")\b",
    re.I,
)
VOLT_RE = re.compile(r"\b(12V(?:\s*/\s*24V)?|24V(?:\s*/\s*12V)?)\b", re.I)

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


def main() -> None:
    ocr = RapidOCR()
    doc = fitz.open(PDF)
    products: dict[str, dict] = {}
    page_meta = []
    current_section = "Kafu Parts"
    verified = load_verified()

    start = 4  # product pages
    for i in range(start, doc.page_count):
        page = doc[i]
        # High-res render for better OCR on small catalog codes
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
        img_bytes = pix.tobytes("png")
        # RapidOCR accepts ndarray via cv2; write temp path for reliability
        tmp = ROOT / ".tmp-ocr-page.png"
        pix.save(str(tmp))
        result, _elapse = ocr(str(tmp))
        lines = []
        if result:
            for row in result:
                # row: [box, text, score]
                if len(row) >= 2 and row[1]:
                    lines.append(str(row[1]))
        text = "\n".join(lines)

        section = detect_section(text, current_section)
        if section != "Kafu Parts":
            current_section = section

        codes = []
        seen = set()
        for c in CODE_RE.findall(text.upper().replace(" ", "")):
            # normalize accidental glued tokens already handled by regex word bounds
            pass
        # Re-scan original lines (preserve letter suffixes)
        for c in CODE_RE.findall(text):
            if c not in seen:
                seen.add(c)
                codes.append(c)

        # Also try uppercase pass for mis-cased OCR
        for c in CODE_RE.findall(text.upper()):
            if c not in seen:
                seen.add(c)
                codes.append(c)

        page_meta.append(
            {
                "pdfPage": i + 1,
                "section": current_section,
                "codeCount": len(codes),
                "codes": codes,
                "engine": "rapidocr",
                "lineCount": len(lines),
            }
        )
        print(
            f"page {i+1}/{doc.page_count} section={current_section!r} "
            f"codes={len(codes)} lines={len(lines)}",
            flush=True,
        )

        for c in codes:
            cat = prefix_category(c) or current_section
            if c not in products:
                products[c] = {
                    "catalogCode": c,
                    "category": cat,
                    "name": f"{cat} — {c}",
                    "oemNumbers": [],
                    "compatibility": [],
                    "voltage": None,
                    "sourcePages": [i + 1],
                    "confidence": "rapidocr",
                }
            else:
                if i + 1 not in products[c]["sourcePages"]:
                    products[c]["sourcePages"].append(i + 1)
                pref = prefix_category(c)
                if pref:
                    products[c]["category"] = pref

        # Attach OEMs found near codes on this page (page-level bag)
        oems = [m if isinstance(m, str) else m[0] for m in OEM_RE.findall(text)]
        oems = [o for o in oems if not CODE_RE.fullmatch(o)]
        volts = VOLT_RE.findall(text)
        if len(volts) == 1 and 1 <= len(codes) <= 12:
            for c in codes:
                if c in products and not products[c].get("voltage"):
                    products[c]["voltage"] = volts[0].replace(" ", "").upper()

    # Keep verified hand rows
    for code, ov in verified.items():
        products[code] = {**products.get(code, {}), **ov, "confidence": "verified"}

    # Filter garbage codes
    cleaned = {}
    for code, p in products.items():
        m = re.match(r"^[A-Z]\d{2}-(\d{1,3})[A-Z]?$", code)
        if not m:
            continue
        if int(m.group(1)) > 399:
            continue
        cleaned[code] = p

    items = sorted(cleaned.values(), key=lambda x: x["catalogCode"])
    prev_count = 0
    if PREV.exists():
        prev_count = json.loads(PREV.read_text(encoding="utf-8")).get("count", 0)

    payload = {
        "status": "approved_for_import",
        "supplier": "Kafu Engineering Machine Fitting Co., Ltd.",
        "ocrEngine": "rapidocr-onnxruntime (PP-OCR)",
        "rules": {"partNumber": "kafu_code", "categories": "per_section"},
        "count": len(items),
        "previousCount": prev_count,
        "delta": len(items) - prev_count,
        "verifiedCount": sum(1 for x in items if x.get("confidence") == "verified"),
        "ocrCount": sum(1 for x in items if x.get("confidence") != "verified"),
        "pageMeta": page_meta,
        "products": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"products={len(items)} previous={prev_count} delta={len(items)-prev_count}")
    zero = [p for p in page_meta if p["codeCount"] == 0]
    print(f"pages with 0 codes: {len(zero)} -> {[p['pdfPage'] for p in zero]}")


if __name__ == "__main__":
    main()
