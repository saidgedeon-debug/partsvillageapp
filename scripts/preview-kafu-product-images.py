"""
Crop product photos from Kafu catalog pages using RapidOCR code positions.
Saves example crops for review — does not update the app.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz
from rapidocr_onnxruntime import RapidOCR
from PIL import Image

ROOT = Path(r"C:\Users\saidg\parts village app")
PDF = Path(r"c:\Users\saidg\Downloads\Mobile Devices\catalog.pdf")
OUT_DIR = ROOT / "data" / "kafu-image-preview"
CODE_RE = re.compile(r"\b([A-Z]\d{2}-\d{1,3}[A-Z]?)\b")


def ocr_items(result):
    items = []
    for row in result or []:
        if len(row) < 2 or not row[1]:
            continue
        box, text = row[0], str(row[1]).strip()
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        items.append(
            {
                "text": text,
                "x0": min(xs),
                "x1": max(xs),
                "y0": min(ys),
                "y1": max(ys),
                "cx": (min(xs) + max(xs)) / 2,
                "cy": (min(ys) + max(ys)) / 2,
            }
        )
    return items


def find_codes(items):
    codes = []
    for it in items:
        m = CODE_RE.search(it["text"].replace(" ", "").upper()) or CODE_RE.search(
            it["text"].upper()
        )
        if not m:
            continue
        code = m.group(1)
        compact = re.sub(r"\s+", "", it["text"]).upper()
        if len(compact) > 12 and code not in compact[:8]:
            continue
        codes.append({**it, "code": code})
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


def cluster_rows(codes, y_tol=45):
    if not codes:
        return []
    rows = [[codes[0]]]
    for c in codes[1:]:
        if abs(c["y0"] - rows[-1][0]["y0"]) <= y_tol:
            rows[-1].append(c)
        else:
            rows.append([c])
    return [sorted(r, key=lambda x: x["x0"]) for r in rows]


def cell_bounds(code, row, row_idx, rows, page_w, page_h):
    col = row.index(code)
    x0 = max(0, code["x0"] - 10)
    if col + 1 < len(row):
        x1 = row[col + 1]["x0"] - 8
    else:
        widths = []
        for r in rows:
            for i in range(len(r) - 1):
                widths.append(r[i + 1]["x0"] - r[i]["x0"])
        med = sorted(widths)[len(widths) // 2] if widths else 220
        x1 = min(page_w - 2, code["x0"] + med - 8)
    y0 = code["y0"] - 4
    if row_idx + 1 < len(rows):
        y1 = rows[row_idx + 1][0]["y0"] - 10
    else:
        y1 = page_h - 50
    return int(x0), int(x1), int(y0), int(y1)


def photo_crop(bounds, page_w, page_h):
    """Trim code label strip + caption strip; keep product photo band."""
    x0, x1, y0, y1 = bounds
    h = max(1, y1 - y0)
    w = max(1, x1 - x0)
    # Skip top ~12% (code badge) and bottom ~28% (caption text)
    top = y0 + int(h * 0.12)
    bottom = y0 + int(h * 0.72)
    left = x0 + int(w * 0.04)
    right = x1 - int(w * 0.04)
    left = max(0, left)
    top = max(0, top)
    right = min(page_w, right)
    bottom = min(page_h, bottom)
    if right - left < 40 or bottom - top < 40:
        return x0, x1, y0, y1
    return left, right, top, bottom


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*"):
        if old.is_file():
            old.unlink()

    ocr = RapidOCR()
    doc = fitz.open(PDF)
    # First product spread pages (PDF index 4 = catalog page 5)
    pages = [4, 5]
    examples = []
    max_examples = 8

    for pi in pages:
        if len(examples) >= max_examples:
            break
        page = doc[pi]
        # High-res for sharp product photos
        pix = page.get_pixmap(matrix=fitz.Matrix(3.0, 3.0), alpha=False)
        tmp = ROOT / ".tmp-ocr-page.png"
        pix.save(str(tmp))
        img = Image.open(tmp).convert("RGB")
        result, _ = ocr(str(tmp))
        items = ocr_items(result)
        codes = find_codes(items)
        rows = cluster_rows(codes)
        print(f"page {pi+1}: codes={len(codes)} rows={len(rows)} size={img.size}")

        for r_idx, row in enumerate(rows):
            for code in row:
                if len(examples) >= max_examples:
                    break
                bounds = cell_bounds(code, row, r_idx, rows, img.width, img.height)
                crop_box = photo_crop(bounds, img.width, img.height)
                left, right, top, bottom = crop_box
                crop = img.crop((left, top, right, bottom))
                fname = f"{code['code']}_p{pi+1}.jpg"
                path = OUT_DIR / fname
                crop.save(path, "JPEG", quality=92)
                examples.append(
                    {
                        "code": code["code"],
                        "pdfPage": pi + 1,
                        "file": str(path),
                        "size": list(crop.size),
                        "cell": bounds,
                        "crop": crop_box,
                    }
                )
                print(f"  saved {fname} {crop.size}")

    meta = {
        "note": "Preview only — not imported into the app yet",
        "engine": "PyMuPDF render @3x + RapidOCR spatial cell crop",
        "examples": examples,
    }
    (OUT_DIR / "preview-meta.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(examples)} examples to {OUT_DIR}")


if __name__ == "__main__":
    main()
