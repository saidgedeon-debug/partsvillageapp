"""
Extract every Kafu catalog product photo into public/kafu-parts/{code}.jpg
using high-res PDF render + RapidOCR spatial cell crops.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(r"C:\Users\saidg\parts village app")
PDF = Path(r"c:\Users\saidg\Downloads\Mobile Devices\catalog.pdf")
OUT_DIR = ROOT / "public" / "kafu-parts"
META = ROOT / "data" / "kafu-image-extract.json"
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
    x0, x1, y0, y1 = bounds
    h = max(1, y1 - y0)
    w = max(1, x1 - x0)
    # Skip code badge (top) and caption (bottom)
    top = y0 + int(h * 0.10)
    bottom = y0 + int(h * 0.74)
    left = x0 + int(w * 0.05)
    right = x1 - int(w * 0.05)
    left = max(0, left)
    top = max(0, top)
    right = min(page_w, right)
    bottom = min(page_h, bottom)
    if right - left < 40 or bottom - top < 40:
        return x0, x1, y0, y1
    return left, right, top, bottom


def safe_name(code: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", code)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.jpg"):
        old.unlink()

    ocr = RapidOCR()
    doc = fitz.open(PDF)
    best: dict[str, dict] = {}
    start = 4

    for i in range(start, doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.8, 2.8), alpha=False)
        tmp = ROOT / ".tmp-ocr-page.png"
        pix.save(str(tmp))
        img = Image.open(tmp).convert("RGB")
        result, _ = ocr(str(tmp))
        items = ocr_items(result)
        codes = find_codes(items)
        rows = cluster_rows(codes)
        page_saved = 0

        for r_idx, row in enumerate(rows):
            for code_item in row:
                code = code_item["code"]
                m = re.match(r"^[A-Z]\d{2}-(\d{1,3})[A-Z]?$", code)
                if not m or int(m.group(1)) > 399:
                    continue
                bounds = cell_bounds(code_item, row, r_idx, rows, img.width, img.height)
                left, right, top, bottom = photo_crop(bounds, img.width, img.height)
                crop = img.crop((left, top, right, bottom))
                area = crop.size[0] * crop.size[1]
                prev = best.get(code)
                if prev and prev["area"] >= area:
                    continue
                fname = f"{safe_name(code)}.jpg"
                path = OUT_DIR / fname
                crop.save(path, "JPEG", quality=88, optimize=True)
                best[code] = {
                    "code": code,
                    "file": fname,
                    "url": f"/kafu-parts/{fname}",
                    "pdfPage": i + 1,
                    "size": list(crop.size),
                    "area": area,
                    "bytes": path.stat().st_size,
                }
                page_saved += 1

        print(
            f"page {i+1}/{doc.page_count} codes={len(codes)} "
            f"saved/updated={page_saved} unique={len(best)}",
            flush=True,
        )

    items = sorted(best.values(), key=lambda x: x["code"])
    total_bytes = sum(x["bytes"] for x in items)
    payload = {
        "count": len(items),
        "totalBytes": total_bytes,
        "outDir": str(OUT_DIR),
        "images": [{k: v for k, v in x.items() if k != "area"} for x in items],
    }
    META.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} images ({total_bytes/1e6:.1f} MB) to {OUT_DIR}")
    print(f"Meta {META}")


if __name__ == "__main__":
    main()
