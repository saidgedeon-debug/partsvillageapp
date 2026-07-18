"""
Kafu catalog table schema (canonical import format).

Every section paste / AI extraction should follow this structure:

  Brand group header (optional), e.g. 🚜 Caterpillar (CAT) Series
  Then rows with exactly these columns:

  | Column                  | App field                          |
  |-------------------------|------------------------------------|
  | Part Code               | partNumber (+ id kafu-{code})       |
  | Part Description        | description (+ category derived)   |
  | OEM / Serial Number     | partNumbers[1..] (OEM list)        |
  | Machine Compatibility   | compatibility[]                    |
  | Page                    | catalogPage                        |

Glued OCR lines without separators are accepted:
  A03-12Air Pressure Sensor266-0136CAT E312DPage 9

Pipe / markdown table rows are also accepted:
  | A03-12 | Air Pressure Sensor | 266-0136 | CAT E312D | Page 9 |
"""

from __future__ import annotations

import re

# Shared code matcher: A01-1, A03-12A, A10-39C, …
CODE_RE = re.compile(
    r"^(A\d{2}-\d{1,3}(?:[A-Z](?=[A-Z][a-z]|[(]))?)(.*)$"
)
PAGE_RE = re.compile(r"Page\s*(\d+)\s*$", re.I)
PIPE_RE = re.compile(
    r"^\|\s*(A\d{2}-\d{1,3}[A-Z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]+?)\s*\|\s*Page\s*(\d+)\s*\|?\s*$",
    re.I,
)
HEADER_RE = re.compile(r"^Part Code\s*Part Description", re.I)
BRAND_HEADER_RE = re.compile(
    r"^(?:[^\w]*)(Caterpillar|Komatsu|Volvo|Hitachi|Hyundai|Doosan|Kobelco|Miscellaneous)",
    re.I,
)

COLUMN_KEYS = (
    "partCode",
    "description",
    "oemSerial",
    "machineCompatibility",
    "page",
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def expand_cat_volvo(machine: str) -> str:
    t = machine.strip()
    t = re.sub(r"^CAT\b", "Caterpillar", t)
    t = re.sub(r"^VOLVO\b", "Volvo", t, flags=re.I)
    return t
