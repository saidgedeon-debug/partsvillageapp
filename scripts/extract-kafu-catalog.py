"""
Extract Kafu catalog.pdf products via Tesseract OCR → JSON staging.
Does not write into the app inventory by itself.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import fitz

PDF = Path(r"c:\Users\saidg\Downloads\Mobile Devices\catalog.pdf")
OUT = Path(r"C:\Users\saidg\parts village app\data\kafu-extracted-products.json")
TESSDATA = r"C:\Program Files\Tesseract-OCR\tessdata"

for p in [r"C:\Program Files\Tesseract-OCR", r"C:\Program Files (x86)\Tesseract-OCR"]:
    if os.path.isdir(p):
        os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")

# Known section titles from catalog TOC (English)
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

CODE_RE = re.compile(r"\b([A-Z]\d{2}-\d{1,3}[A-Z]?)\b")
# OEM-ish tokens
OEM_RE = re.compile(
    r"\b("
    r"\d{3,4}-\d{3,5}"  # 121-4036
    r"|\d{6,10}"  # 9218229
    r"|[A-Z]{1,3}\d{5,}"  # ME845235
    r"|OEM[:\s]*[A-Z0-9/-]+"
    r"|VDE\d+"
    r")\b",
    re.I,
)
VOLT_RE = re.compile(r"\b(12V(?:/24V)?|24V(?:/12V)?)\b", re.I)

# Hand-verified overrides (high quality)
OVERRIDES = {
    "A01-1": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — PC200-7",
        "oemNumbers": ["7861-93-2330"],
        "compatibility": ["Komatsu PC200-7"],
    },
    "A01-1A": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — Hitachi",
        "oemNumbers": ["2055358"],
        "compatibility": ["Hitachi"],
    },
    "A01-1B": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — WA500-1",
        "oemNumbers": ["7819-11-2315"],
        "compatibility": ["Komatsu WA500-1"],
    },
    "A01-2": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — PC200-5/6 PC220-6",
        "oemNumbers": ["7861-92-2330"],
        "compatibility": ["Komatsu PC200-5", "Komatsu PC200-6", "Komatsu PC220-6"],
    },
    "A01-2B": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — PC360-8",
        "oemNumbers": ["31121"],
        "compatibility": ["Komatsu PC360-8"],
    },
    "A01-5": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — E329",
        "oemNumbers": ["193-2550", "318-1178", "318-1181"],
        "compatibility": ["Caterpillar E329"],
    },
    "A01-9": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — SK200-3/5",
        "oemNumbers": ["ME845235"],
        "compatibility": ["Kobelco SK200-3", "Kobelco SK200-5"],
    },
    "A01-10": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — SK200-6/6E",
        "oemNumbers": ["ME844577"],
        "compatibility": ["Kobelco SK200-6"],
    },
    "A01-10A": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — SANY",
        "oemNumbers": ["MC867505"],
        "compatibility": ["SANY"],
    },
    "A01-14": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — EX200 / EX120",
        "oemNumbers": ["4265372"],
        "compatibility": ["Hitachi EX200", "Hitachi EX120"],
    },
    "A01-15": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — ZAX450",
        "oemNumbers": ["1-81510713-1"],
        "compatibility": ["Hitachi ZAX450"],
    },
    "A01-21": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — Liugong",
        "oemNumbers": ["30T815", "4884223"],
        "compatibility": ["Liugong"],
    },
    "A01-21C": {
        "category": "Revolution Sensor",
        "name": "Revolution Sensor — PC1250-7 / ZAX1200",
        "oemNumbers": ["4327239", "3408472"],
        "compatibility": ["Komatsu PC1250-7", "Hitachi ZAX1200"],
    },
    "A26-53": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — Hitachi EX200-5 / ZAX200-3",
        "oemNumbers": [],
        "compatibility": ["Hitachi EX200-5", "Hitachi ZAX200-3"],
    },
    "A26-54": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — Hitachi EX200-5",
        "oemNumbers": ["9218229"],
        "compatibility": ["Hitachi EX200-5"],
    },
    "A26-61": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — CAT",
        "oemNumbers": ["121-4036"],
        "compatibility": ["Caterpillar"],
    },
    "A26-67": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — E320C",
        "oemNumbers": [],
        "compatibility": ["Caterpillar E320C"],
    },
    "A26-67A": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — CAT",
        "oemNumbers": ["170-9419"],
        "compatibility": ["Caterpillar"],
    },
    "A26-71": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — JCB 24V",
        "oemNumbers": [],
        "compatibility": ["JCB"],
        "voltage": "24V",
    },
    "A26-71B": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — Volvo 24V",
        "oemNumbers": ["11418522"],
        "compatibility": ["Volvo"],
        "voltage": "24V",
    },
    "A26-73A": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — CAT",
        "oemNumbers": ["225-0303"],
        "compatibility": ["Caterpillar"],
    },
    "A26-73B": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — JCB",
        "oemNumbers": ["25/974628"],
        "compatibility": ["JCB"],
    },
    "A26-77A": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — Volvo",
        "oemNumbers": ["VDE15125649"],
        "compatibility": ["Volvo"],
    },
    "A26-83": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve 12V/24V",
        "oemNumbers": ["3017993"],
        "compatibility": [],
        "voltage": "12V/24V",
    },
    "A26-89": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — DH220-5",
        "oemNumbers": [],
        "compatibility": ["Doosan DH220-5"],
    },
    "A26-97": {
        "category": "Solenoid Valve",
        "name": "Solenoid Valve — Volvo",
        "oemNumbers": ["11709493"],
        "compatibility": ["Volvo"],
    },
}


def detect_section(text: str, fallback: str) -> str:
    upper = text
    # Prefer longer matches
    found = []
    for s in SECTIONS:
        if s.lower() in upper.lower():
            found.append(s)
    if not found:
        return fallback
    return max(found, key=len)


def prefix_category(code: str) -> str | None:
    """Fallback category by Kafu series prefix when page header OCR fails."""
    m = re.match(r"^([A-Z]\d{2})", code)
    if not m:
        return None
    series = m.group(1)
    mapping = {
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
    return mapping.get(series)


def main() -> None:
    doc = fitz.open(PDF)
    products: dict[str, dict] = {}
    page_meta = []
    current_section = "Kafu Parts"

    # Skip cover/about/TOC-ish early pages: start at PDF index 4 (page 5) through end
    # Also OCR page 3 (TOC) for nothing product-wise; products from index 4.
    start = 4
    for i in range(start, doc.page_count):
        page = doc[i]
        tp = page.get_textpage_ocr(language="eng", dpi=170, full=True, tessdata=TESSDATA)
        text = page.get_text("text", textpage=tp)
        section = detect_section(text, current_section)
        if section != "Kafu Parts":
            current_section = section

        codes = []
        seen = set()
        for c in CODE_RE.findall(text):
            # Filter OCR garbage like A01-276 when unrealistic? keep all
            if c not in seen:
                seen.add(c)
                codes.append(c)

        oems = OEM_RE.findall(text)
        volts = VOLT_RE.findall(text)

        page_meta.append(
            {
                "pdfPage": i + 1,
                "section": current_section,
                "codeCount": len(codes),
                "codes": codes,
            }
        )
        print(f"page {i+1}/{doc.page_count} section={current_section!r} codes={len(codes)}")

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
                    "confidence": "ocr",
                }
            else:
                if i + 1 not in products[c]["sourcePages"]:
                    products[c]["sourcePages"].append(i + 1)
                # Prefer more specific category from prefix
                pref = prefix_category(c)
                if pref:
                    products[c]["category"] = pref
                    if products[c]["name"].startswith("Kafu Parts") or products[c]["name"].endswith(c):
                        products[c]["name"] = f"{pref} — {c}"

        # Attach page-level OEMs lightly to codes on same page (best-effort)
        # Skip bulk attach — too noisy. Only voltage if single volt on page with few codes.
        if len(volts) == 1 and 1 <= len(codes) <= 8:
            for c in codes:
                if not products[c].get("voltage"):
                    products[c]["voltage"] = volts[0].upper()

    # Apply hand overrides
    for code, ov in OVERRIDES.items():
        base = products.get(
            code,
            {
                "catalogCode": code,
                "category": ov["category"],
                "name": ov["name"],
                "oemNumbers": [],
                "compatibility": [],
                "voltage": None,
                "sourcePages": [],
                "confidence": "verified",
            },
        )
        base.update(
            {
                "category": ov["category"],
                "name": ov["name"],
                "oemNumbers": ov.get("oemNumbers", []),
                "compatibility": ov.get("compatibility", []),
                "confidence": "verified",
            }
        )
        if ov.get("voltage"):
            base["voltage"] = ov["voltage"]
        products[code] = base

    # Drop obvious OCR garbage codes (too many digits in suffix, e.g. A01-276 from misread)
    cleaned = {}
    for code, p in products.items():
        m = re.match(r"^[A-Z]\d{2}-(\d{1,3})[A-Z]?$", code)
        if not m:
            continue
        num = int(m.group(1))
        # Allow up to 399 for series numbers seen in catalog
        if num > 399:
            continue
        cleaned[code] = p

    items = sorted(cleaned.values(), key=lambda x: x["catalogCode"])
    payload = {
        "status": "approved_for_import",
        "supplier": "Kafu Engineering Machine Fitting Co., Ltd.",
        "rules": {
            "partNumber": "kafu_code",
            "categories": "per_section",
        },
        "count": len(items),
        "verifiedCount": sum(1 for x in items if x.get("confidence") == "verified"),
        "ocrCount": sum(1 for x in items if x.get("confidence") == "ocr"),
        "pageMeta": page_meta,
        "products": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} with {len(items)} products")


if __name__ == "__main__":
    main()
