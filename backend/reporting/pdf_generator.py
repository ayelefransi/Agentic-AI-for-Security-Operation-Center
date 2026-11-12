"""
አውራ AI SOC — Presentation-ready PDF report generator using ReportLab.

Generates a multi-page vector PDF dossier containing:
- Branded dark cover page with executive metadata and verdict summary
- Content pages with running headers, footers, and two-pass "Page X of Y" numbering
- Executive Summary, KPI strip, Triage Gauge & Score Breakdown vector chart
- Analyst Feedback / Human Override panel (when present)
- Raw Alert payload & Normalized Security Events table
- IOC Verdict Distribution chart & complete Threat Intelligence enrichment table
- MITRE ATT&CK Tactic Breakdown chart & Technique Mapping table
- Recommended Countermeasures & Containment Plan
- Multi-Agent Execution Latency chart, Telemetry chart, and full Agent Trace table
- Complete Markdown Investigation Narrative parsed cleanly into Platypus flowables
"""

from __future__ import annotations

import datetime as dt
import io
import json
import math
import os
import re
from typing import Any
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import (
    Drawing,
    Line,
    Polygon,
    Rect,
    String,
)
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.fonts import addMapping
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Font Registration (Ethiopic Unicode for አውራ AI)
# ---------------------------------------------------------------------------

ETHIOPIC_FONT_NAME = "Helvetica"
ETHIOPIC_FONT_BOLD = "Helvetica-Bold"

for _reg_path, _bold_path in [
    ("C:/Windows/Fonts/ebrima.ttf", "C:/Windows/Fonts/ebrimabd.ttf"),
    ("C:/Windows/Fonts/nyala.ttf", "C:/Windows/Fonts/nyala.ttf"),
    ("/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Bold.ttf"),
]:
    if os.path.exists(_reg_path):
        try:
            pdfmetrics.registerFont(TTFont("AwraUnicode", _reg_path))
            pdfmetrics.registerFont(TTFont("AwraUnicode-Bold", _bold_path if os.path.exists(_bold_path) else _reg_path))
            addMapping("AwraUnicode", 0, 0, "AwraUnicode")
            addMapping("AwraUnicode", 1, 0, "AwraUnicode-Bold")
            ETHIOPIC_FONT_NAME = "AwraUnicode"
            ETHIOPIC_FONT_BOLD = "AwraUnicode-Bold"
            break
        except Exception:
            pass

# ---------------------------------------------------------------------------
# Brand & Semantic Palette
# ---------------------------------------------------------------------------

INK_DARK = colors.HexColor("#0B1020")
INK_CARD = colors.HexColor("#141B33")
INK_CARD_BORDER = colors.HexColor("#263259")
ACCENT_INDIGO = colors.HexColor("#6C83FF")
ACCENT_INDIGO_DARK = colors.HexColor("#4F46E5")
ACCENT_CYAN = colors.HexColor("#38BDF8")
WHITE = colors.HexColor("#FFFFFF")
SURFACE_SUBTLE = colors.HexColor("#F4F6FB")
SURFACE_CODE = colors.HexColor("#F8FAFC")
BORDER_SUBTLE = colors.HexColor("#E2E8F0")
TEXT_PRIMARY = colors.HexColor("#1E293B")
TEXT_MUTED = colors.HexColor("#64748B")
TEXT_LIGHT_MUTED = colors.HexColor("#94A3B8")

SEVERITY_COLORS: dict[str, tuple[colors.Color, colors.Color]] = {
    "critical": (colors.HexColor("#DC2626"), colors.HexColor("#FEF2F2")),
    "high": (colors.HexColor("#EA580C"), colors.HexColor("#FFF7ED")),
    "medium": (colors.HexColor("#D97706"), colors.HexColor("#FFFBEB")),
    "low": (colors.HexColor("#16A34A"), colors.HexColor("#F0FDF4")),
    "info": (colors.HexColor("#4F46E5"), colors.HexColor("#EEF2FF")),
}

COVER_SEVERITY_COLORS: dict[str, colors.Color] = {
    "critical": colors.HexColor("#FF5C6C"),
    "high": colors.HexColor("#FF9F43"),
    "medium": colors.HexColor("#F5C451"),
    "low": colors.HexColor("#4ADE80"),
    "info": colors.HexColor("#6C83FF"),
}

VERDICT_COLORS: dict[str, colors.Color] = {
    "malicious": colors.HexColor("#DC2626"),
    "suspicious": colors.HexColor("#EA580C"),
    "benign": colors.HexColor("#16A34A"),
    "clean": colors.HexColor("#16A34A"),
    "unknown": colors.HexColor("#64748B"),
}

STATUS_LABELS: dict[str, str] = {
    "open": "Open",
    "acknowledged": "Acknowledged",
    "investigating": "Investigating",
    "escalated": "Escalated",
    "closed": "Closed",
    "closed_false_positive": "Closed (False Positive)",
    "closed_resolved": "Closed (Resolved)",
    "closed_tp": "Closed (True Positive)",
    "closed_fp": "Closed (False Positive)",
}

PAGE_W, PAGE_H = letter
MARGIN_X = 0.65 * inch
MARGIN_TOP = 0.85 * inch
MARGIN_BOTTOM = 0.72 * inch
CONTENT_W = PAGE_W - (2 * MARGIN_X)


# ---------------------------------------------------------------------------
# Text Sanitization & Formatting Helpers
# ---------------------------------------------------------------------------

_UNICODE_REPLACEMENTS: dict[str, str] = {
    "\u2014": "--",
    "\u2013": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2026": "...",
    "\u2192": "->",
    "\u2190": "<-",
    "\u2194": "<->",
    "\u2265": ">=",
    "\u2264": "<=",
    "\u2260": "!=",
    "\u2713": "[OK]",
    "\u2714": "[OK]",
    "\u2705": "[OK]",
    "\u274c": "[X]",
    "\u26a0": "[!]",
    "\u200d": "",
    "\ufe0f": "",
    "\u00a0": " ",
}


def sanitize_text(value: Any) -> str:
    """
    Normalize arbitrary input into WinAnsi/cp1252-safe text so ReportLab's
    built-in fonts never draw black replacement squares for emojis or exotic scripts.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)

    text = value
    for src, dst in _UNICODE_REPLACEMENTS.items():
        text = text.replace(src, dst)

    cleaned_chars: list[str] = []
    for ch in text:
        if ch in ("\n", "\r", "\t"):
            cleaned_chars.append(ch)
            continue
        code = ord(ch)
        if code < 32:
            continue
        if 0x1200 <= code <= 0x139F:
            # Preserve Ethiopic script (Amharic: አውራ)
            cleaned_chars.append(ch)
            continue
        try:
            ch.encode("cp1252")
            cleaned_chars.append(ch)
        except UnicodeEncodeError:
            # Drop unsupported emojis / non-WinAnsi glyphs cleanly.
            continue
    return "".join(cleaned_chars)


def _xml(value: Any) -> str:
    """Sanitize and XML-escape text before placing it inside a ReportLab Paragraph."""
    return escape(sanitize_text(value))


def _enum_str(value: Any, default: str = "N/A") -> str:
    if value is None:
        return default
    if hasattr(value, "value"):
        value = value.value
    text = sanitize_text(value).strip()
    return text if text else default


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _fmt_timestamp(value: Any) -> str:
    if value is None or value == "":
        return "N/A"
    if isinstance(value, dt.datetime):
        if value.tzinfo is None:
            return value.strftime("%Y-%m-%d %H:%M:%S UTC")
        return value.astimezone(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    raw = sanitize_text(value).strip()
    try:
        parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.strftime("%Y-%m-%d %H:%M:%S UTC")
        return parsed.astimezone(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except ValueError:
        return raw


def _wrap_monospace_lines(text: str, max_cols: int = 94) -> list[str]:
    """Soft-wrap long raw log/JSON lines cleanly so code blocks never clip."""
    safe = sanitize_text(text)
    if not safe:
        return ["(No payload recorded)"]
    wrapped: list[str] = []
    for raw_line in safe.splitlines():
        if len(raw_line) <= max_cols:
            wrapped.append(raw_line)
            continue
        idx = 0
        while idx < len(raw_line):
            wrapped.append(raw_line[idx : idx + max_cols])
            idx += max_cols
    return wrapped or ["(No payload recorded)"]


def _severity_palette(severity: str) -> tuple[colors.Color, colors.Color]:
    return SEVERITY_COLORS.get(severity.lower().strip(), SEVERITY_COLORS["info"])


def _cover_severity_color(severity: str) -> colors.Color:
    return COVER_SEVERITY_COLORS.get(severity.lower().strip(), COVER_SEVERITY_COLORS["info"])


def _color_hex(color: colors.Color) -> str:
    hv = color.hexval()
    return f"#{hv[2:]}" if hv.startswith("0x") else hv


def _normalize_incident_dict(data: Any) -> dict[str, Any]:
    """Accept a Pydantic IncidentState or raw dict and return a normalized dict."""
    if hasattr(data, "model_dump"):
        return data.model_dump()
    if isinstance(data, dict):
        return dict(data)
    raise TypeError(f"Unsupported incident payload type: {type(data)!r}")


# ---------------------------------------------------------------------------
# Typography Style Sheet
# ---------------------------------------------------------------------------


def _build_styles() -> dict[str, ParagraphStyle]:
    return {
        "cover_eyebrow": ParagraphStyle(
            "CoverEyebrow",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=8.5,
            leading=12,
            textColor=ACCENT_CYAN,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=26,
            leading=31,
            textColor=WHITE,
            spaceAfter=8,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            fontName=ETHIOPIC_FONT_NAME,
            fontSize=11,
            leading=16,
            textColor=TEXT_LIGHT_MUTED,
            spaceAfter=14,
            splitLongWords=1,
        ),
        "cover_card_label": ParagraphStyle(
            "CoverCardLabel",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=7.5,
            leading=10,
            textColor=TEXT_LIGHT_MUTED,
        ),
        "cover_card_value": ParagraphStyle(
            "CoverCardValue",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=12,
            leading=15,
            textColor=WHITE,
            splitLongWords=1,
        ),
        "section_eyebrow": ParagraphStyle(
            "SectionEyebrow",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=7.5,
            leading=10,
            textColor=ACCENT_INDIGO_DARK,
        ),
        "section_title": ParagraphStyle(
            "SectionTitle",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=13.5,
            leading=17,
            textColor=INK_DARK,
            spaceAfter=4,
        ),
        "sub_heading": ParagraphStyle(
            "SubHeading",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=10.5,
            leading=14,
            textColor=INK_DARK,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName=ETHIOPIC_FONT_NAME,
            fontSize=9,
            leading=13.5,
            textColor=TEXT_PRIMARY,
            spaceAfter=5,
            splitLongWords=1,
        ),
        "body_bold": ParagraphStyle(
            "BodyBold",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=9,
            leading=13.5,
            textColor=INK_DARK,
            splitLongWords=1,
        ),
        "muted": ParagraphStyle(
            "Muted",
            fontName=ETHIOPIC_FONT_NAME,
            fontSize=8,
            leading=11,
            textColor=TEXT_MUTED,
            splitLongWords=1,
        ),
        "kpi_label": ParagraphStyle(
            "KpiLabel",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=7.2,
            leading=9.5,
            textColor=TEXT_MUTED,
        ),
        "kpi_value": ParagraphStyle(
            "KpiValue",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=13,
            leading=16,
            textColor=INK_DARK,
            splitLongWords=1,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=7.8,
            leading=10,
            textColor=WHITE,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            fontName=ETHIOPIC_FONT_NAME,
            fontSize=8,
            leading=11,
            textColor=TEXT_PRIMARY,
            splitLongWords=1,
        ),
        "table_cell_mono": ParagraphStyle(
            "TableCellMono",
            fontName="Courier",
            fontSize=7.6,
            leading=10.5,
            textColor=INK_DARK,
            splitLongWords=1,
        ),
        "code": ParagraphStyle(
            "Code",
            fontName="Courier",
            fontSize=7.6,
            leading=10.5,
            textColor=INK_DARK,
            splitLongWords=1,
        ),
        "callout_title": ParagraphStyle(
            "CalloutTitle",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=9,
            leading=12,
            textColor=INK_DARK,
            spaceAfter=3,
        ),
        "bullet": ParagraphStyle(
            "BulletItem",
            fontName=ETHIOPIC_FONT_NAME,
            fontSize=9,
            leading=13.2,
            textColor=TEXT_PRIMARY,
            leftIndent=12,
            firstLineIndent=-8,
            spaceAfter=3,
            splitLongWords=1,
        ),
        "md_h1": ParagraphStyle(
            "MdH1",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=12.5,
            leading=16,
            textColor=INK_DARK,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "md_h2": ParagraphStyle(
            "MdH2",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=11,
            leading=14.5,
            textColor=ACCENT_INDIGO_DARK,
            spaceBefore=8,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "md_h3": ParagraphStyle(
            "MdH3",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=9.5,
            leading=13,
            textColor=INK_DARK,
            spaceBefore=6,
            spaceAfter=2,
            keepWithNext=True,
        ),
        "badge": ParagraphStyle(
            "Badge",
            fontName=ETHIOPIC_FONT_BOLD,
            fontSize=7.8,
            leading=10,
            alignment=TA_CENTER,
            textColor=WHITE,
        ),
    }


# ---------------------------------------------------------------------------
# Two-Pass Canvas with Dynamic "Page X of Y" Footer
# ---------------------------------------------------------------------------


class NumberedCanvas(canvas.Canvas):
    """Canvas subclass capturing page snapshots to stamp accurate Page X of Y footers."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self._draw_page_number(total_pages)
            super().showPage()
        super().save()

    def _draw_page_number(self, total_pages: int) -> None:
        self.saveState()
        self.setFont(ETHIOPIC_FONT_BOLD, 7.8)
        self.setFillColor(TEXT_MUTED)
        self.drawRightString(
            PAGE_W - MARGIN_X,
            0.42 * inch,
            f"Page {self._pageNumber} of {total_pages}",
        )
        self.restoreState()


# ---------------------------------------------------------------------------
# Vector Graphics & Data Visualization Builders
# ---------------------------------------------------------------------------


def _arc_polygon(
    cx: float,
    cy: float,
    r_inner: float,
    r_outer: float,
    start_deg: float,
    end_deg: float,
    steps: int = 48,
) -> list[float]:
    """Compute a flat coordinate list for a circular ring sector from start_deg clockwise."""
    outer_pts: list[tuple[float, float]] = []
    inner_pts: list[tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        ang = math.radians(start_deg + (end_deg - start_deg) * t)
        outer_pts.append((cx + r_outer * math.cos(ang), cy + r_outer * math.sin(ang)))
        inner_pts.append((cx + r_inner * math.cos(ang), cy + r_inner * math.sin(ang)))
    pts = outer_pts + list(reversed(inner_pts))
    flat: list[float] = []
    for x, y in pts:
        flat.extend([x, y])
    return flat


def _build_risk_and_breakdown_drawing(
    score: int,
    severity: str,
    confidence: float,
    breakdown: dict[str, Any],
) -> Drawing:
    """
    Build a dual vector visual (518 x 155 pt):
    Left: Circular Risk Score Gauge (0-100).
    Right: Horizontal Breakdown Bar Chart of triage scoring factors.
    """
    width = CONTENT_W
    height = 156.0
    d = Drawing(width, height)

    # Outer panel cards
    gauge_w = 164.0
    gap = 12.0
    chart_x = gauge_w + gap
    chart_w = width - chart_x

    d.add(
        Rect(
            0,
            0,
            gauge_w,
            height,
            fillColor=SURFACE_SUBTLE,
            strokeColor=BORDER_SUBTLE,
            strokeWidth=0.75,
            rx=6,
            ry=6,
        )
    )
    d.add(
        Rect(
            chart_x,
            0,
            chart_w,
            height,
            fillColor=SURFACE_SUBTLE,
            strokeColor=BORDER_SUBTLE,
            strokeWidth=0.75,
            rx=6,
            ry=6,
        )
    )

    sev_fg, _ = _severity_palette(severity)
    clamped_score = max(0, min(100, score))

    # Gauge title
    d.add(
        String(
            gauge_w / 2,
            height - 18,
            "RISK SCORE GAUGE",
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=TEXT_MUTED,
            textAnchor="middle",
        )
    )

    # Ring track (90 deg -> -270 deg clockwise = full circle)
    cx, cy = gauge_w / 2, 78.0
    track_pts = _arc_polygon(cx, cy, 35.0, 47.0, 90.0, -270.0, steps=64)
    d.add(Polygon(track_pts, fillColor=BORDER_SUBTLE, strokeColor=None))

    if clamped_score > 0:
        sweep = -360.0 * (clamped_score / 100.0)
        arc_pts = _arc_polygon(cx, cy, 35.0, 47.0, 90.0, 90.0 + sweep, steps=max(8, int(clamped_score * 0.6)))
        d.add(Polygon(arc_pts, fillColor=sev_fg, strokeColor=None))

    # Center text inside ring
    d.add(
        String(
            cx,
            cy - 4,
            str(clamped_score),
            fontName="Helvetica-Bold",
            fontSize=20,
            fillColor=INK_DARK,
            textAnchor="middle",
        )
    )
    d.add(
        String(
            cx,
            cy - 17,
            "/ 100",
            fontName="Helvetica",
            fontSize=7.5,
            fillColor=TEXT_MUTED,
            textAnchor="middle",
        )
    )

    # Bottom severity + confidence line inside gauge card
    d.add(
        String(
            cx,
            14,
            f"{severity.upper()}  |  {confidence:.0%} CONF.",
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=sev_fg,
            textAnchor="middle",
        )
    )

    # Right side: Risk Factor Breakdown Bars
    d.add(
        String(
            chart_x + 14,
            height - 18,
            "TRIAGE SCORE FACTOR BREAKDOWN",
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=TEXT_MUTED,
        )
    )

    items: list[tuple[str, float]] = []
    if isinstance(breakdown, dict) and breakdown:
        for k, v in breakdown.items():
            label = sanitize_text(str(k).replace("_", " ").title())
            items.append((label[:28], max(0.0, _to_float(v, 0.0))))
        items.sort(key=lambda pair: pair[1], reverse=True)
        items = items[:6]
    else:
        items = [
            ("Overall Risk Score", float(clamped_score)),
            ("Model Confidence (%)", round(confidence * 100.0, 1)),
        ]

    max_val = max((v for _, v in items), default=100.0)
    scale_max = max(max_val, 25.0)
    bar_label_x = chart_x + 14
    bar_track_x = chart_x + 140
    bar_track_w = chart_w - 196
    top_y = height - 42
    row_step = 19.0 if len(items) <= 5 else 16.5

    for idx, (label, val) in enumerate(items):
        y = top_y - idx * row_step
        d.add(
            String(
                bar_label_x,
                y + 1,
                label,
                fontName="Helvetica",
                fontSize=7.8,
                fillColor=TEXT_PRIMARY,
            )
        )
        d.add(
            Rect(
                bar_track_x,
                y,
                bar_track_w,
                8.5,
                fillColor=BORDER_SUBTLE,
                strokeColor=None,
                rx=3,
                ry=3,
            )
        )
        fill_w = max(3.0, bar_track_w * min(1.0, val / scale_max)) if val > 0 else 0.0
        if fill_w > 0:
            bar_color = sev_fg if idx == 0 and val >= 50 else ACCENT_INDIGO
            d.add(
                Rect(
                    bar_track_x,
                    y,
                    fill_w,
                    8.5,
                    fillColor=bar_color,
                    strokeColor=None,
                    rx=3,
                    ry=3,
                )
            )
        d.add(
            String(
                bar_track_x + bar_track_w + 8,
                y + 1,
                f"{val:.1f} pts",
                fontName="Helvetica-Bold",
                fontSize=7.5,
                fillColor=INK_DARK,
            )
        )

    return d


def _build_horizontal_bar_chart(
    title: str,
    rows: list[tuple[str, float, colors.Color, str]],
    width: float = CONTENT_W,
) -> Drawing:
    """
    Build a crisp horizontal bar chart card with labeled bars.
    Each row tuple is: (label, numeric_value, bar_color, formatted_value_text).
    """
    display_rows = rows[:10]
    row_h = 18.0
    pad_top = 30.0
    pad_bottom = 14.0
    height = pad_top + pad_bottom + max(1, len(display_rows)) * row_h

    d = Drawing(width, height)
    d.add(
        Rect(
            0,
            0,
            width,
            height,
            fillColor=SURFACE_SUBTLE,
            strokeColor=BORDER_SUBTLE,
            strokeWidth=0.75,
            rx=6,
            ry=6,
        )
    )
    d.add(
        String(
            14,
            height - 17,
            sanitize_text(title).upper(),
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=TEXT_MUTED,
        )
    )

    if not display_rows:
        d.add(
            String(
                14,
                height / 2 - 4,
                "No data points available for this metric.",
                fontName="Helvetica",
                fontSize=8.2,
                fillColor=TEXT_MUTED,
            )
        )
        return d

    max_val = max((r[1] for r in display_rows), default=1.0)
    if max_val <= 0:
        max_val = 1.0

    label_x = 14.0
    track_x = 170.0
    value_col_w = 72.0
    track_w = width - track_x - value_col_w - 14.0

    for idx, (label, val, color, val_label) in enumerate(display_rows):
        y = height - pad_top - (idx + 1) * row_h + 4
        safe_label = sanitize_text(label)[:30]
        d.add(
            String(
                label_x,
                y + 1.5,
                safe_label,
                fontName="Helvetica",
                fontSize=7.8,
                fillColor=TEXT_PRIMARY,
            )
        )
        d.add(
            Rect(
                track_x,
                y,
                track_w,
                9.5,
                fillColor=BORDER_SUBTLE,
                strokeColor=None,
                rx=3,
                ry=3,
            )
        )
        if val > 0:
            fill_w = max(4.0, track_w * min(1.0, val / max_val))
            d.add(
                Rect(
                    track_x,
                    y,
                    fill_w,
                    9.5,
                    fillColor=color,
                    strokeColor=None,
                    rx=3,
                    ry=3,
                )
            )
        d.add(
            String(
                width - 14.0,
                y + 1.5,
                sanitize_text(val_label),
                fontName="Helvetica-Bold",
                fontSize=7.6,
                fillColor=INK_DARK,
                textAnchor="end",
            )
        )

    return d


def _extract_telemetry_series(telemetry_data: Any) -> list[tuple[str, float]]:
    """Extract numeric bar series from arbitrary telemetry_data shapes if available."""
    if not telemetry_data:
        return []

    if isinstance(telemetry_data, list):
        series: list[tuple[str, float]] = []
        for idx, item in enumerate(telemetry_data[:12], 1):
            if isinstance(item, dict):
                label = (
                    item.get("label")
                    or item.get("date")
                    or item.get("day")
                    or item.get("time")
                    or item.get("timestamp")
                    or item.get("name")
                    or f"T{idx}"
                )
                val = None
                for key in ("count", "volume", "alerts", "value", "score", "total", "events", "severity"):
                    if key in item and isinstance(item[key], (int, float)):
                        val = float(item[key])
                        break
                if val is not None:
                    series.append((sanitize_text(str(label))[:12], val))
        return series

    if isinstance(telemetry_data, dict):
        # Check common nested list/dict containers first
        for container_key in (
            "timeline",
            "daily_volume",
            "alert_volume",
            "series",
            "counts",
            "metrics",
            "by_severity",
            "categories",
        ):
            nested = telemetry_data.get(container_key)
            if isinstance(nested, (list, dict)):
                sub = _extract_telemetry_series(nested)
                if sub:
                    return sub

        # Fallback: direct top-level scalar numeric keys
        scalar_series: list[tuple[str, float]] = []
        for k, v in telemetry_data.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                scalar_series.append((sanitize_text(str(k).replace("_", " ").title())[:14], float(v)))
        return scalar_series[:12]

    return []


def _build_vertical_telemetry_chart(
    title: str,
    series: list[tuple[str, float]],
    width: float = CONTENT_W,
) -> Drawing:
    """Build a crisp vertical column chart for time-series / metric telemetry."""
    height = 148.0
    d = Drawing(width, height)
    d.add(
        Rect(
            0,
            0,
            width,
            height,
            fillColor=SURFACE_SUBTLE,
            strokeColor=BORDER_SUBTLE,
            strokeWidth=0.75,
            rx=6,
            ry=6,
        )
    )
    d.add(
        String(
            14,
            height - 17,
            sanitize_text(title).upper(),
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=TEXT_MUTED,
        )
    )

    if not series:
        return d

    plot_left = 34.0
    plot_right = width - 18.0
    plot_bottom = 26.0
    plot_top = height - 30.0
    plot_w = plot_right - plot_left
    plot_h = plot_top - plot_bottom

    max_val = max((v for _, v in series), default=1.0)
    if max_val <= 0:
        max_val = 1.0

    # Gridlines (3 levels)
    for frac in (0.0, 0.5, 1.0):
        gy = plot_bottom + plot_h * frac
        d.add(Line(plot_left, gy, plot_right, gy, strokeColor=BORDER_SUBTLE, strokeWidth=0.6))
        tick_val = max_val * frac
        tick_str = f"{tick_val:.0f}" if tick_val >= 10 or tick_val == int(tick_val) else f"{tick_val:.1f}"
        d.add(
            String(
                plot_left - 5,
                gy - 2.5,
                tick_str,
                fontName="Helvetica",
                fontSize=6.8,
                fillColor=TEXT_MUTED,
                textAnchor="end",
            )
        )

    n = len(series)
    slot_w = plot_w / max(1, n)
    bar_w = min(28.0, max(10.0, slot_w * 0.56))

    for idx, (label, val) in enumerate(series):
        cx = plot_left + slot_w * (idx + 0.5)
        bx = cx - bar_w / 2.0
        bh = max(2.0, plot_h * min(1.0, max(0.0, val) / max_val)) if val > 0 else 0.0
        if bh > 0:
            d.add(
                Rect(
                    bx,
                    plot_bottom,
                    bar_w,
                    bh,
                    fillColor=ACCENT_INDIGO if idx % 2 == 0 else ACCENT_CYAN,
                    strokeColor=None,
                    rx=2,
                    ry=2,
                )
            )
        val_txt = f"{val:.0f}" if val == int(val) else f"{val:.1f}"
        d.add(
            String(
                cx,
                plot_bottom + bh + 4,
                val_txt,
                fontName="Helvetica-Bold",
                fontSize=6.8,
                fillColor=INK_DARK,
                textAnchor="middle",
            )
        )
        d.add(
            String(
                cx,
                plot_bottom - 11,
                sanitize_text(label)[:10],
                fontName="Helvetica",
                fontSize=6.8,
                fillColor=TEXT_MUTED,
                textAnchor="middle",
            )
        )

    return d


# ---------------------------------------------------------------------------
# Styled Layout Component Helpers
# ---------------------------------------------------------------------------


def _section_header(number: str, eyebrow: str, title: str, styles: dict[str, ParagraphStyle]) -> list[Any]:
    return [
        Spacer(1, 10),
        Paragraph(f"{_xml(number)}  /  {_xml(eyebrow).upper()}", styles["section_eyebrow"]),
        Paragraph(_xml(title), styles["section_title"]),
        HRFlowable(width="100%", thickness=1.0, color=ACCENT_INDIGO, spaceBefore=1, spaceAfter=8),
    ]


def _styled_table(
    headers: list[str],
    rows: list[list[Any]],
    col_widths: list[float],
    styles: dict[str, ParagraphStyle],
) -> Table:
    header_cells = [Paragraph(_xml(h), styles["table_header"]) for h in headers]
    data = [header_cells] + rows
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SURFACE_SUBTLE]),
                ("GRID", (0, 0), (-1, -1), 0.45, BORDER_SUBTLE),
                ("LINEBELOW", (0, 0), (-1, 0), 1.2, ACCENT_INDIGO),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _callout_box(
    title: str,
    body_flowables: list[Any],
    accent_color: colors.Color,
    bg_color: colors.Color,
    styles: dict[str, ParagraphStyle],
) -> Table:
    rows: list[list[Any]] = [[Paragraph(_xml(title), styles["callout_title"])]] + [[f] for f in body_flowables]
    box = Table(rows, colWidths=[CONTENT_W])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg_color),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER_SUBTLE),
                ("LINEBEFORE", (0, 0), (0, -1), 3.0, accent_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
            ]
        )
    )
    return box


def _code_box_table(
    wrapped_lines: list[str],
    accent_color: colors.Color,
    styles: dict[str, ParagraphStyle],
    chunk_size: int = 20,
) -> Table:
    """Render wrapped monospace text in a shaded left-accented table that splits cleanly across pages."""
    lines = wrapped_lines or ["(No payload recorded)"]
    rows: list[list[Any]] = []
    for start in range(0, len(lines), chunk_size):
        chunk = lines[start : start + chunk_size]
        html = "<br/>".join(_xml(cl) if cl else "&nbsp;" for cl in chunk) or "&nbsp;"
        rows.append([Paragraph(html, styles["code"])])
    box = Table(rows, colWidths=[CONTENT_W])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE_CODE),
                ("BOX", (0, 0), (-1, -1), 0.55, BORDER_SUBTLE),
                ("LINEBEFORE", (0, 0), (0, -1), 2.8, accent_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("TOPPADDING", (0, 0), (-1, 0), 7),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
            ]
        )
    )
    return box


def _badge_cell(text: str, fg: colors.Color, bg: colors.Color) -> Table:
    style = ParagraphStyle(
        f"Badge_{sanitize_text(text)}",
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=9,
        alignment=TA_CENTER,
        textColor=fg,
    )
    pill = Table([[Paragraph(_xml(text.upper()), style)]])
    pill.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.6, fg),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    return pill


# ---------------------------------------------------------------------------
# Markdown-to-Platypus Converter
# ---------------------------------------------------------------------------


def _md_inline_to_rml(text: str) -> str:
    """Convert inline markdown (**bold**, *italic*, _italic_, `code`) safely into ReportLab XML."""
    safe = _xml(text)

    # Extract inline code spans first using placeholders so bold/italic regexes don't alter them
    code_spans: list[str] = []

    def _store_code(match: re.Match[str]) -> str:
        idx = len(code_spans)
        code_spans.append(f'<font name="Courier" size="8.2" color="#0B1020">{match.group(1)}</font>')
        return f"\x00CODE{idx}\x00"

    safe = re.sub(r"`([^`]+)`", _store_code, safe)
    safe = re.sub(r"\*\*([^\*]+)\*\*", r"<b>\1</b>", safe)
    safe = re.sub(r"(?<!\*)\*([^\*]+)\*(?!\*)", r"<i>\1</i>", safe)
    safe = re.sub(r"(?<!\w)_([^_]+)_(?!\w)", r"<i>\1</i>", safe)

    for idx, replacement in enumerate(code_spans):
        safe = safe.replace(f"\x00CODE{idx}\x00", replacement)
    return safe


def _markdown_to_flowables(md_text: str, styles: dict[str, ParagraphStyle]) -> list[Any]:
    """Parse investigation markdown report (headings, lists, tables, code blocks) into Flowables."""
    safe_md = sanitize_text(md_text).strip()
    if not safe_md:
        return [Paragraph("No narrative markdown report was generated for this incident.", styles["muted"])]

    lines = safe_md.splitlines()
    flowables: list[Any] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Fenced code block ```...```
        if stripped.startswith("```"):
            i += 1
            code_lines: list[str] = []
            while i < n and not lines[i].strip().startswith("```"):
                code_lines.extend(_wrap_monospace_lines(lines[i], max_cols=90))
                i += 1
            if i < n and lines[i].strip().startswith("```"):
                i += 1
            flowables.append(_code_box_table(code_lines, ACCENT_INDIGO, styles))
            flowables.append(Spacer(1, 6))
            continue

        # Horizontal rule --- or ***
        if re.match(r"^([-*_])\1{2,}$", stripped):
            flowables.append(HRFlowable(width="100%", thickness=0.6, color=BORDER_SUBTLE, spaceBefore=4, spaceAfter=4))
            i += 1
            continue

        # Headings #, ##, ###, ####
        heading_match = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            text = _md_inline_to_rml(heading_match.group(2).strip())
            style_key = "md_h1" if level == 1 else ("md_h2" if level == 2 else "md_h3")
            flowables.append(Paragraph(text, styles[style_key]))
            i += 1
            continue

        # Markdown pipe table | ... |
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_lines: list[str] = []
            while i < n and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            parsed_rows: list[list[str]] = []
            for idx, tl in enumerate(table_lines):
                cells = [c.strip() for c in tl.strip("|").split("|")]
                # Skip separator row like |---|---|
                if idx == 1 and all(re.match(r"^:?-{2,}:?$", c.replace(" ", "")) for c in cells if c or len(cells) > 0):
                    continue
                parsed_rows.append(cells)

            if len(parsed_rows) >= 2:
                num_cols = max(len(r) for r in parsed_rows)
                headers = [(parsed_rows[0][c] if c < len(parsed_rows[0]) else "") for c in range(num_cols)]
                body_rows = []
                for row in parsed_rows[1:]:
                    body_rows.append(
                        [
                            Paragraph(_md_inline_to_rml(row[c] if c < len(row) else ""), styles["table_cell"])
                            for c in range(num_cols)
                        ]
                    )
                col_w = [CONTENT_W / num_cols] * num_cols
                flowables.append(_styled_table(headers, body_rows, col_w, styles))
                flowables.append(Spacer(1, 6))
            else:
                for tl in table_lines:
                    flowables.append(Paragraph(_md_inline_to_rml(tl), styles["body"]))
            continue

        # Unordered list - item / * item (including indented sub-bullets)
        bullet_match = re.match(r"^(\s*)[-*+]\s+(.+)$", line)
        if bullet_match:
            indent_spaces = len(bullet_match.group(1))
            item_text = _md_inline_to_rml(bullet_match.group(2).strip())
            style = styles["bullet"]
            if indent_spaces >= 2:
                style = ParagraphStyle(
                    "SubBullet",
                    parent=styles["bullet"],
                    leftIndent=24,
                    firstLineIndent=-8,
                )
            flowables.append(Paragraph(f"&bull;&nbsp;&nbsp;{item_text}", style))
            i += 1
            continue

        # Ordered list 1. item
        ordered_match = re.match(r"^\s*(\d+)\.\s+(.+)$", line)
        if ordered_match:
            num = ordered_match.group(1)
            item_text = _md_inline_to_rml(ordered_match.group(2).strip())
            flowables.append(Paragraph(f"<b>{num}.</b>&nbsp;&nbsp;{item_text}", styles["bullet"]))
            i += 1
            continue

        # Blockquote > text
        if stripped.startswith(">"):
            quote_text = _md_inline_to_rml(stripped.lstrip(">").strip())
            flowables.append(
                _callout_box(
                    "Note",
                    [Paragraph(quote_text, styles["body"])],
                    ACCENT_CYAN,
                    SURFACE_SUBTLE,
                    styles,
                )
            )
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # Normal paragraph (coalesce consecutive non-special lines)
        para_lines = [stripped]
        i += 1
        while i < n:
            nxt = lines[i]
            nxt_s = nxt.strip()
            if (
                not nxt_s
                or nxt_s.startswith("#")
                or nxt_s.startswith("```")
                or nxt_s.startswith("|")
                or nxt_s.startswith(">")
                or re.match(r"^(\s*)[-*+]\s+", nxt)
                or re.match(r"^\s*\d+\.\s+", nxt)
                or re.match(r"^([-*_])\1{2,}$", nxt_s)
            ):
                break
            para_lines.append(nxt_s)
            i += 1

        joined = " ".join(para_lines)
        flowables.append(Paragraph(_md_inline_to_rml(joined), styles["body"]))

    return flowables


# ---------------------------------------------------------------------------
# Page Canvas Decorations (Cover Page & Running Header/Footer)
# ---------------------------------------------------------------------------


def _make_cover_on_page(
    incident_id: str,
    created_str: str,
    generated_str: str,
    severity: str,
) -> Any:
    """Return an onPage callback rendering the full-bleed dark executive cover background."""
    sev_fg, _ = _severity_palette(severity)

    def _draw_cover(canv: canvas.Canvas, doc: Any) -> None:
        canv.saveState()
        # Full dark navy-ink canvas
        canv.setFillColor(INK_DARK)
        canv.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

        # Subtle top header bar
        canv.setFillColor(INK_CARD)
        canv.rect(0, PAGE_H - 64, PAGE_W, 64, stroke=0, fill=1)
        canv.setStrokeColor(INK_CARD_BORDER)
        canv.setLineWidth(1)
        canv.line(0, PAGE_H - 64, PAGE_W, PAGE_H - 64)

        # Left vertical indigo brand spine
        canv.setFillColor(ACCENT_INDIGO)
        canv.rect(0, 0, 10, PAGE_H, stroke=0, fill=1)

        # Geometric አውራ AI shield emblem top-left
        sx, sy = MARGIN_X, PAGE_H - 42
        shield_pts = [
            sx + 10, sy + 20,
            sx + 20, sy + 16,
            sx + 20, sy + 6,
            sx + 10, sy,
            sx, sy + 6,
            sx, sy + 16,
        ]
        canv.setFillColor(ACCENT_INDIGO)
        canv.setStrokeColor(ACCENT_CYAN)
        canv.setLineWidth(1.2)
        p = canv.beginPath()
        p.moveTo(shield_pts[0], shield_pts[1])
        for k in range(2, len(shield_pts), 2):
            p.lineTo(shield_pts[k], shield_pts[k + 1])
        p.close()
        canv.drawPath(p, stroke=1, fill=1)

        canv.setFillColor(WHITE)
        canv.setFont(ETHIOPIC_FONT_BOLD, 12)
        canv.drawString(sx + 28, PAGE_H - 36, "አውራ AI")
        canv.setFillColor(TEXT_LIGHT_MUTED)
        canv.setFont(ETHIOPIC_FONT_NAME, 8)
        canv.drawString(sx + 28, PAGE_H - 48, "Autonomous Security Operations Center")

        # Classification & Severity indicator top-right
        canv.setFillColor(sev_fg)
        canv.roundRect(PAGE_W - MARGIN_X - 115, PAGE_H - 44, 115, 20, 4, stroke=0, fill=1)
        canv.setFillColor(WHITE)
        canv.setFont("Helvetica-Bold", 8)
        canv.drawCentredString(PAGE_W - MARGIN_X - 57.5, PAGE_H - 37, f"SEVERITY: {severity.upper()}")

        # Bottom confidential cover footer
        canv.setStrokeColor(INK_CARD_BORDER)
        canv.setLineWidth(0.75)
        canv.line(MARGIN_X, 58, PAGE_W - MARGIN_X, 58)
        canv.setFillColor(TEXT_LIGHT_MUTED)
        canv.setFont("Helvetica", 7.8)
        canv.drawString(MARGIN_X, 42, f"Incident ID: {incident_id}   |   Alert Timestamp: {created_str}")
        canv.drawRightString(PAGE_W - MARGIN_X, 42, f"Generated: {generated_str}")
        canv.setFont("Helvetica-Bold", 7.5)
        canv.setFillColor(ACCENT_CYAN)
        canv.drawString(MARGIN_X, 28, "CONFIDENTIAL // INTERNAL SOC INVESTIGATION DOSSIER")
        canv.restoreState()

    return _draw_cover


def _make_content_on_page(incident_id: str, severity: str, generated_str: str) -> Any:
    """Return an onPage callback drawing the crisp white content running header & footer."""
    sev_fg, _ = _severity_palette(severity)

    def _draw_content(canv: canvas.Canvas, doc: Any) -> None:
        canv.saveState()
        # Running header
        header_y = PAGE_H - 0.50 * inch
        canv.setFillColor(ACCENT_INDIGO)
        canv.rect(MARGIN_X, header_y + 10, 18, 2.5, stroke=0, fill=1)

        canv.setFillColor(INK_DARK)
        canv.setFont(ETHIOPIC_FONT_BOLD, 8.2)
        canv.drawString(MARGIN_X, header_y - 2, "አውራ AI  |  SOC INVESTIGATION REPORT")

        canv.setFont(ETHIOPIC_FONT_NAME, 7.8)
        canv.setFillColor(TEXT_MUTED)
        canv.drawRightString(
            PAGE_W - MARGIN_X - 68,
            header_y - 2,
            f"Incident: {incident_id}",
        )
        canv.setFillColor(sev_fg)
        canv.setFont(ETHIOPIC_FONT_BOLD, 7.8)
        canv.drawRightString(PAGE_W - MARGIN_X, header_y - 2, f"[{severity.upper()}]")

        canv.setStrokeColor(BORDER_SUBTLE)
        canv.setLineWidth(0.75)
        canv.line(MARGIN_X, header_y - 9, PAGE_W - MARGIN_X, header_y - 9)

        # Running footer (Page X of Y is drawn by NumberedCanvas at right)
        footer_line_y = 0.58 * inch
        canv.setStrokeColor(BORDER_SUBTLE)
        canv.setLineWidth(0.75)
        canv.line(MARGIN_X, footer_line_y, PAGE_W - MARGIN_X, footer_line_y)

        canv.setFillColor(TEXT_MUTED)
        canv.setFont(ETHIOPIC_FONT_NAME, 7.6)
        canv.drawString(
            MARGIN_X,
            0.42 * inch,
            f"Generated {generated_str}  |  አውራ AI Autonomous Security Operations",
        )
        canv.restoreState()

    return _draw_content


# ---------------------------------------------------------------------------
# Main Public PDF Generator
# ---------------------------------------------------------------------------


def generate_incident_pdf(incident_data: Any) -> bytes:
    """
    Generate a complete, multi-page presentation-ready PDF report from an
    IncidentState model or serialized incident dictionary.

    Returns raw PDF bytes suitable for direct HTTP streaming or disk export.
    """
    inc = _normalize_incident_dict(incident_data)
    styles = _build_styles()

    incident_id = sanitize_text(inc.get("id") or "UNASSIGNED")
    raw_status = _enum_str(inc.get("status"), "open").lower()
    status_label = STATUS_LABELS.get(raw_status, raw_status.replace("_", " ").title())
    created_str = _fmt_timestamp(inc.get("created_at"))
    generated_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    triage = inc.get("triage") or {}
    if hasattr(triage, "model_dump"):
        triage = triage.model_dump()
    triage_score = _to_int(triage.get("score"), 0)
    severity = _enum_str(triage.get("severity"), "info").lower()
    triage_conf = _to_float(triage.get("confidence"), 0.0)
    triage_breakdown = triage.get("breakdown") if isinstance(triage.get("breakdown"), dict) else {}

    decision = sanitize_text(inc.get("decision") or "Pending Final Classification").strip()
    reasoning = sanitize_text(inc.get("decision_reasoning") or "").strip()
    plan_summary = sanitize_text(inc.get("investigation_plan_summary") or "").strip()
    raw_sup_decision = inc.get("supervisor_decision")
    if isinstance(raw_sup_decision, dict):
        sd_act = sanitize_text(
            raw_sup_decision.get("action") or raw_sup_decision.get("decision") or "Completed"
        ).replace("_", " ").title()
        sd_conf = raw_sup_decision.get("confidence")
        sd_reason = sanitize_text(raw_sup_decision.get("reasoning") or "").strip()
        conf_part = f" ({_to_float(sd_conf):.0%} confidence)" if sd_conf is not None else ""
        supervisor_decision = f"{sd_act}{conf_part}" + (f" -- {sd_reason}" if sd_reason else "")
    else:
        supervisor_decision = sanitize_text(raw_sup_decision or "").strip()
    supervisor_iteration = inc.get("supervisor_iteration")
    rewrite_iterations = inc.get("rewrite_iterations")
    is_sufficient = inc.get("is_sufficient")
    optimized_query = sanitize_text(inc.get("optimized_query") or "").strip()
    soc_analysis = inc.get("soc_analysis")
    retrieved_docs = inc.get("retrieved_docs") or []

    events = inc.get("events") or []
    enrichments = inc.get("enrichments") or []
    mitre_mappings = inc.get("mitre_mappings") or []
    recommended_actions = inc.get("recommended_actions") or []
    agent_trace = inc.get("agent_trace") or []
    telemetry_data = inc.get("telemetry_data")
    feedback = inc.get("feedback")
    supervisor_plan = inc.get("supervisor_plan")
    raw_alert = sanitize_text(inc.get("raw_alert") or "")
    markdown_report = sanitize_text(inc.get("report") or "")

    sev_fg, sev_bg = _severity_palette(severity)
    cover_sev = _cover_severity_color(severity)

    # Set up BaseDocTemplate with dedicated Cover and Content PageTemplates
    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title=f"አውራ AI SOC Investigation Report - {incident_id}",
        author="አውራ AI Autonomous SOC Platform",
        subject=f"Incident {incident_id} - {decision}",
    )

    cover_frame = Frame(
        MARGIN_X,
        1.05 * inch,
        CONTENT_W,
        PAGE_H - 2.15 * inch,
        id="cover_frame",
        leftPadding=0,
        rightPadding=0,
        topPadding=16,
        bottomPadding=0,
    )
    content_frame = Frame(
        MARGIN_X,
        MARGIN_BOTTOM,
        CONTENT_W,
        PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        id="content_frame",
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )

    doc.addPageTemplates(
        [
            PageTemplate(
                id="CoverPage",
                frames=[cover_frame],
                onPage=_make_cover_on_page(incident_id, created_str, generated_str, severity),
            ),
            PageTemplate(
                id="ContentPage",
                frames=[content_frame],
                onPage=_make_content_on_page(incident_id, severity, generated_str),
            ),
        ]
    )

    story: list[Any] = []

    # ======================================================================
    # COVER PAGE FLOWABLES
    # ======================================================================
    story.append(Spacer(1, 24))
    story.append(Paragraph("AUTONOMOUS MULTI-AGENT THREAT INVESTIGATION", styles["cover_eyebrow"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Security Incident &amp;<br/>Investigation Report", styles["cover_title"]))

    subtitle_text = (
        f"Comprehensive telemetry analysis, indicator enrichment, ATT&amp;CK correlation, "
        f"multi-agent audit trail, and actionable remediation dossier for incident {incident_id}."
    )
    story.append(Paragraph(subtitle_text, styles["cover_subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT_INDIGO, spaceBefore=6, spaceAfter=18))

    # Verdict Hero Card on Cover
    verdict_card = Table(
        [
            [
                Paragraph("PRIMARY VERDICT", styles["cover_card_label"]),
                Paragraph("RISK SCORE", styles["cover_card_label"]),
                Paragraph("TRIAGE SEVERITY", styles["cover_card_label"]),
            ],
            [
                Paragraph(_xml(decision), styles["cover_card_value"]),
                Paragraph(f"{triage_score} / 100", styles["cover_card_value"]),
                Paragraph(
                    f'<font color="{_color_hex(cover_sev)}">{severity.upper()}</font>',
                    styles["cover_card_value"],
                ),
            ],
        ],
        colWidths=[CONTENT_W * 0.50, CONTENT_W * 0.25, CONTENT_W * 0.25],
    )
    verdict_card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), INK_CARD),
                ("BOX", (0, 0), (-1, -1), 0.9, INK_CARD_BORDER),
                ("LINEBEFORE", (0, 0), (0, -1), 3.5, cover_sev),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 12),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 14),
            ]
        )
    )
    story.append(verdict_card)
    story.append(Spacer(1, 14))

    # Cover Metadata & Coverage Matrix (2 x 4 dark tiles)
    cover_meta_rows = [
        [
            Paragraph("INCIDENT IDENTIFIER", styles["cover_card_label"]),
            Paragraph("WORKFLOW STATUS", styles["cover_card_label"]),
            Paragraph("MODEL CONFIDENCE", styles["cover_card_label"]),
            Paragraph("REPORT DATE (UTC)", styles["cover_card_label"]),
        ],
        [
            Paragraph(_xml(incident_id), styles["cover_card_value"]),
            Paragraph(_xml(status_label), styles["cover_card_value"]),
            Paragraph(f"{triage_conf:.0%}", styles["cover_card_value"]),
            Paragraph(generated_str.split(" ")[0], styles["cover_card_value"]),
        ],
    ]
    cover_meta = Table(cover_meta_rows, colWidths=[CONTENT_W / 4.0] * 4)
    cover_meta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), INK_CARD),
                ("BOX", (0, 0), (-1, -1), 0.75, INK_CARD_BORDER),
                ("LINEBEFORE", (1, 0), (3, -1), 0.5, INK_CARD_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
            ]
        )
    )
    story.append(cover_meta)
    story.append(Spacer(1, 14))

    # Evidence Scope Counters on Cover
    total_event_iocs = sum(len(ev.get("extracted_iocs") or []) for ev in events if isinstance(ev, dict))
    ioc_total = max(len(enrichments), total_event_iocs)
    scope_rows = [
        [
            Paragraph("NORMALIZED EVENTS", styles["cover_card_label"]),
            Paragraph("OBSERVED IOCs", styles["cover_card_label"]),
            Paragraph("MITRE TECHNIQUES", styles["cover_card_label"]),
            Paragraph("AGENT STEPS / ACTIONS", styles["cover_card_label"]),
        ],
        [
            Paragraph(str(len(events)), styles["cover_card_value"]),
            Paragraph(str(ioc_total), styles["cover_card_value"]),
            Paragraph(str(len(mitre_mappings)), styles["cover_card_value"]),
            Paragraph(f"{len(agent_trace)} / {len(recommended_actions)}", styles["cover_card_value"]),
        ],
    ]
    scope_table = Table(scope_rows, colWidths=[CONTENT_W / 4.0] * 4)
    scope_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), INK_CARD),
                ("BOX", (0, 0), (-1, -1), 0.75, INK_CARD_BORDER),
                ("LINEBEFORE", (1, 0), (3, -1), 0.5, INK_CARD_BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
            ]
        )
    )
    story.append(scope_table)

    # Brief executive preview on cover if reasoning exists
    if reasoning:
        story.append(Spacer(1, 20))
        preview = reasoning[:420] + ("..." if len(reasoning) > 420 else "")
        preview_box = Table(
            [
                [Paragraph("EXECUTIVE BRIEF", styles["cover_eyebrow"])],
                [
                    Paragraph(
                        _xml(preview),
                        ParagraphStyle(
                            "CoverBrief",
                            fontName="Helvetica",
                            fontSize=9.2,
                            leading=13.8,
                            textColor=WHITE,
                            splitLongWords=1,
                        ),
                    )
                ],
            ],
            colWidths=[CONTENT_W],
        )
        preview_box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), INK_CARD),
                    ("BOX", (0, 0), (-1, -1), 0.75, INK_CARD_BORDER),
                    ("LINEBEFORE", (0, 0), (0, -1), 3.0, ACCENT_CYAN),
                    ("LEFTPADDING", (0, 0), (-1, -1), 14),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                    ("TOPPADDING", (0, 1), (-1, 1), 2),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 12),
                ]
            )
        )
        story.append(preview_box)

    # Transition from dark cover to clean white content pages
    story.append(NextPageTemplate("ContentPage"))
    story.append(PageBreak())

    # ======================================================================
    # SECTION 1: EXECUTIVE SUMMARY & TRIAGE ASSESSMENT
    # ======================================================================
    story.extend(_section_header("SECTION 01", "EXECUTIVE BRIEFING", "Executive Summary & Triage Assessment", styles))

    # 4-Column Light KPI Strip
    kpi_table = Table(
        [
            [
                Paragraph("VERDICT", styles["kpi_label"]),
                Paragraph("SEVERITY", styles["kpi_label"]),
                Paragraph("RISK SCORE", styles["kpi_label"]),
                Paragraph("CONFIDENCE & STATUS", styles["kpi_label"]),
            ],
            [
                Paragraph(_xml(decision), styles["kpi_value"]),
                _badge_cell(severity.upper(), sev_fg, sev_bg),
                Paragraph(f"{triage_score} / 100", styles["kpi_value"]),
                Paragraph(f"{triage_conf:.0%}  ({ _xml(status_label) })", styles["body_bold"]),
            ],
        ],
        colWidths=[CONTENT_W * 0.34, CONTENT_W * 0.16, CONTENT_W * 0.20, CONTENT_W * 0.30],
    )
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE_SUBTLE),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_SUBTLE),
                ("LINEBEFORE", (1, 0), (3, -1), 0.6, BORDER_SUBTLE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    # Decision Reasoning callout
    if reasoning:
        story.append(
            _callout_box(
                "Root Cause & Verdict Rationale",
                [Paragraph(_xml(reasoning), styles["body"])],
                ACCENT_INDIGO,
                SURFACE_SUBTLE,
                styles,
            )
        )
        story.append(Spacer(1, 10))

    # Triage Risk Gauge & Factor Breakdown Chart
    story.append(
        KeepTogether(
            [
                Paragraph("Triage Risk Visualization & Score Breakdown", styles["sub_heading"]),
                _build_risk_and_breakdown_drawing(triage_score, severity, triage_conf, triage_breakdown),
                Spacer(1, 8),
            ]
        )
    )

    if triage_breakdown:
        tb_rows = [
            [
                Paragraph(_xml(str(k).replace("_", " ").title()), styles["table_cell"]),
                Paragraph(f"{_to_float(v):.2f} pts", styles["table_cell_mono"]),
            ]
            for k, v in triage_breakdown.items()
        ]
        story.append(_styled_table(["Risk Factor", "Weighted Contribution"], tb_rows, [CONTENT_W * 0.70, CONTENT_W * 0.30], styles))
        story.append(Spacer(1, 8))

    # Investigation Metadata & Query Context
    meta_rows = [
        [Paragraph("Incident Created (UTC)", styles["table_cell"]), Paragraph(_xml(created_str), styles["table_cell_mono"])],
        [Paragraph("Investigation Plan", styles["table_cell"]), Paragraph(_xml(plan_summary or "Standard Multi-Agent Pipeline"), styles["table_cell"])],
        [Paragraph("Supervisor Decision", styles["table_cell"]), Paragraph(_xml(supervisor_decision or "Completed"), styles["table_cell"])],
        [
            Paragraph("Iterations / RAG Rewrites", styles["table_cell"]),
            Paragraph(
                f"Supervisor: {supervisor_iteration if supervisor_iteration is not None else 'N/A'}  |  "
                f"Rewrites: {rewrite_iterations if rewrite_iterations is not None else 0}  |  "
                f"Evidence Sufficient: {'Yes' if is_sufficient else ('No' if is_sufficient is False else 'N/A')}",
                styles["table_cell"],
            ),
        ],
    ]
    if optimized_query:
        meta_rows.append(
            [Paragraph("Optimized Threat Query", styles["table_cell"]), Paragraph(_xml(optimized_query), styles["table_cell_mono"])]
        )
    story.append(_styled_table(["Investigation Attribute", "Recorded Value"], meta_rows, [CONTENT_W * 0.30, CONTENT_W * 0.70], styles))
    story.append(Spacer(1, 8))

    # SOC Analysis & Retrieved Knowledge Docs (if non-empty)
    if soc_analysis:
        soc_str = json.dumps(soc_analysis, indent=2, default=str) if isinstance(soc_analysis, (dict, list)) else str(soc_analysis)
        story.append(
            _callout_box(
                "Additional SOC Analyst Telemetry Synthesis",
                [Paragraph(_xml(soc_str), styles["body"])],
                ACCENT_CYAN,
                SURFACE_SUBTLE,
                styles,
            )
        )
        story.append(Spacer(1, 8))

    if retrieved_docs:
        doc_items: list[Any] = []
        for idx, rdoc in enumerate(retrieved_docs, 1):
            if isinstance(rdoc, dict):
                t_part = sanitize_text(rdoc.get("title") or rdoc.get("source") or "").strip()
                c_part = sanitize_text(rdoc.get("content") or rdoc.get("snippet") or rdoc.get("text") or "").strip()
                txt = f"{t_part}: {c_part}" if (t_part and c_part) else (t_part or c_part or json.dumps(rdoc, default=str))
            else:
                txt = str(rdoc)
            doc_items.append(Paragraph(f"<b>[{idx}]</b> {_xml(txt)}", styles["bullet"]))
        story.append(
            _callout_box(
                f"Retrieved Threat Knowledge Base References ({len(retrieved_docs)})",
                doc_items,
                ACCENT_INDIGO_DARK,
                SURFACE_SUBTLE,
                styles,
            )
        )
        story.append(Spacer(1, 8))

    # Analyst Feedback / Override (when submitted)
    if feedback:
        fb_items = feedback if isinstance(feedback, list) else [feedback]
        fb_flowables: list[Any] = []
        for fb in fb_items:
            if not isinstance(fb, dict):
                fb_flowables.append(Paragraph(_xml(str(fb)), styles["body"]))
                continue
            analyst = sanitize_text(fb.get("analyst_id") or fb.get("analyst") or "SOC Analyst")
            verdict_override = sanitize_text(fb.get("override_verdict") or fb.get("verdict") or "Reviewed")
            comment = sanitize_text(fb.get("comment") or fb.get("notes") or "")
            ts = _fmt_timestamp(fb.get("timestamp") or fb.get("submitted_at"))
            fb_flowables.append(
                Paragraph(
                    f"<b>{_xml(analyst)}</b> &bull; Override Verdict: <b>{_xml(verdict_override)}</b> &bull; <i>{_xml(ts)}</i>",
                    styles["body"],
                )
            )
            if comment:
                fb_flowables.append(Paragraph(_xml(comment), styles["body"]))
        story.append(
            _callout_box(
                "Human-in-the-Loop Analyst Feedback",
                fb_flowables,
                colors.HexColor("#16A34A"),
                colors.HexColor("#F0FDF4"),
                styles,
            )
        )
        story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 2: RAW ALERT PAYLOAD & NORMALIZED EVENTS
    # ======================================================================
    story.extend(_section_header("SECTION 02", "INGESTION TELEMETRY", "Raw Alert Payload & Normalized Events", styles))

    wrapped_raw = _wrap_monospace_lines(raw_alert, max_cols=92)
    raw_box = _code_box_table(wrapped_raw, INK_DARK, styles)
    story.append(Paragraph("Ingested Raw Alert Payload", styles["sub_heading"]))
    story.append(raw_box)
    story.append(Spacer(1, 10))

    story.append(Paragraph(f"Normalized Security Events ({len(events)})", styles["sub_heading"]))
    if events:
        event_rows: list[list[Any]] = []
        for idx, ev in enumerate(events, 1):
            if not isinstance(ev, dict):
                continue
            ev_type = sanitize_text(ev.get("event_type") or "Unknown Event")
            ev_source = sanitize_text(ev.get("source") or "N/A")
            ev_ts = _fmt_timestamp(ev.get("timestamp"))
            net_parts: list[str] = []
            if ev.get("src_ip"):
                net_parts.append(f"Src IP: {ev['src_ip']}")
            if ev.get("dst_ip"):
                net_parts.append(f"Dst IP: {ev['dst_ip']}")
            if ev.get("user"):
                net_parts.append(f"User: {ev['user']}")
            if ev.get("hostname"):
                net_parts.append(f"Host: {ev['hostname']}")
            net_summary = "\n".join(net_parts) if net_parts else "No host/network attributes"

            ev_iocs = ev.get("extracted_iocs") or []
            ioc_lines = []
            for ioc in ev_iocs:
                if isinstance(ioc, dict):
                    t = _enum_str(ioc.get("type"), "ioc").upper()
                    v = sanitize_text(ioc.get("value") or "")
                    ioc_lines.append(f"{t}: {v}")
            ioc_text = "\n".join(ioc_lines) if ioc_lines else "None"

            event_rows.append(
                [
                    Paragraph(f"#{idx}", styles["table_cell_mono"]),
                    Paragraph(f"<b>{_xml(ev_type)}</b><br/>Source: {_xml(ev_source)}<br/>{_xml(ev_ts)}", styles["table_cell"]),
                    Paragraph("<br/>".join(_xml(l) for l in net_summary.splitlines()), styles["table_cell_mono"]),
                    Paragraph("<br/>".join(_xml(l) for l in ioc_text.splitlines()), styles["table_cell_mono"]),
                ]
            )
        story.append(
            _styled_table(
                ["#", "Event Type / Source / Time", "Network & Identity Context", "Extracted Indicators"],
                event_rows,
                [CONTENT_W * 0.06, CONTENT_W * 0.30, CONTENT_W * 0.30, CONTENT_W * 0.34],
                styles,
            )
        )
    else:
        story.append(Paragraph("No normalized security events were extracted for this incident.", styles["muted"]))
    story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 3: INDICATORS OF COMPROMISE (IOCs) & ENRICHMENT
    # ======================================================================
    story.extend(_section_header("SECTION 03", "THREAT INTELLIGENCE", "Indicators of Compromise (IOCs) & Enrichment", styles))

    verdict_counts: dict[str, int] = {"malicious": 0, "suspicious": 0, "benign": 0, "unknown": 0}
    enriched_values: set[str] = set()

    if enrichments:
        for enr in enrichments:
            if not isinstance(enr, dict):
                continue
            v_key = _enum_str(enr.get("final_verdict"), "unknown").lower()
            if v_key == "clean":
                v_key = "benign"
            verdict_counts[v_key] = verdict_counts.get(v_key, 0) + 1
            ioc_obj = enr.get("ioc") or {}
            if isinstance(ioc_obj, dict) and ioc_obj.get("value"):
                enriched_values.add(str(ioc_obj["value"]).strip().lower())

        chart_rows = [
            (
                v_label.title(),
                float(count),
                VERDICT_COLORS.get(v_label, TEXT_MUTED),
                f"{count} IOC{'s' if count != 1 else ''}",
            )
            for v_label, count in verdict_counts.items()
            if count > 0 or v_label in ("malicious", "suspicious", "benign", "unknown")
        ]
        story.append(
            KeepTogether(
                [
                    _build_horizontal_bar_chart("IOC Verdict Distribution Across Threat Feeds", chart_rows),
                    Spacer(1, 10),
                ]
            )
        )

        ioc_table_rows: list[list[Any]] = []
        for enr in enrichments:
            if not isinstance(enr, dict):
                continue
            ioc_obj = enr.get("ioc") or {}
            ioc_type = _enum_str(ioc_obj.get("type"), "IOC").upper()
            ioc_val = sanitize_text(ioc_obj.get("value") or "N/A")
            ioc_ctx = sanitize_text(ioc_obj.get("context") or "")
            verdict = _enum_str(enr.get("final_verdict"), "unknown").lower()
            conf = _to_float(enr.get("final_confidence"), 0.0)
            tags = [sanitize_text(t) for t in (enr.get("tags") or []) if t]

            v_color = VERDICT_COLORS.get(verdict, TEXT_MUTED)
            v_bg_map = {
                "malicious": colors.HexColor("#FEF2F2"),
                "suspicious": colors.HexColor("#FFF7ED"),
                "benign": colors.HexColor("#F0FDF4"),
                "clean": colors.HexColor("#F0FDF4"),
            }
            v_bg = v_bg_map.get(verdict, colors.HexColor("#F1F5F9"))

            src_lines: list[str] = []
            for res in enr.get("results") or []:
                if not isinstance(res, dict):
                    continue
                src_name = sanitize_text(res.get("source") or "Feed")
                if res.get("error"):
                    src_lines.append(f"{src_name}: Error ({sanitize_text(res['error'])})")
                else:
                    rv = _enum_str(res.get("verdict"), "unknown")
                    rc = _to_float(res.get("confidence"), 0.0)
                    cached_flag = " [cached]" if res.get("cached") else ""
                    src_lines.append(f"{src_name}: {rv} ({rc:.0%}){cached_flag}")
            src_html = "<br/>".join(_xml(line) for line in src_lines) if src_lines else "No external feed responses"

            val_html = _xml(ioc_val)
            if ioc_ctx:
                val_html += f'<br/><font color="#64748B" size="7.2">Context: {_xml(ioc_ctx)}</font>'

            ioc_table_rows.append(
                [
                    Paragraph(f"<b>{_xml(ioc_type)}</b>", styles["table_cell_mono"]),
                    Paragraph(val_html, styles["table_cell_mono"]),
                    _badge_cell(verdict.upper(), v_color, v_bg),
                    Paragraph(f"{conf:.0%}", styles["table_cell_mono"]),
                    Paragraph(src_html, styles["table_cell"]),
                    Paragraph(_xml(", ".join(tags)) if tags else "--", styles["table_cell"]),
                ]
            )

        story.append(
            _styled_table(
                ["Type", "Indicator Value", "Verdict", "Conf.", "Threat Intel Source Breakdown", "Tags"],
                ioc_table_rows,
                [
                    CONTENT_W * 0.09,
                    CONTENT_W * 0.25,
                    CONTENT_W * 0.14,
                    CONTENT_W * 0.08,
                    CONTENT_W * 0.29,
                    CONTENT_W * 0.15,
                ],
                styles,
            )
        )
    else:
        story.append(Paragraph("No enriched IOC records present in this investigation.", styles["muted"]))

    # Also capture any raw event IOCs not present in enrichments so zero IOCs are omitted
    unenriched: list[dict[str, Any]] = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        for ioc in ev.get("extracted_iocs") or []:
            if isinstance(ioc, dict):
                val = str(ioc.get("value") or "").strip()
                if val and val.lower() not in enriched_values:
                    unenriched.append(ioc)
    if unenriched:
        story.append(Spacer(1, 8))
        story.append(Paragraph(f"Additional Extracted Event Indicators ({len(unenriched)})", styles["sub_heading"]))
        un_rows = [
            [
                Paragraph(_xml(_enum_str(u.get("type"), "IOC").upper()), styles["table_cell_mono"]),
                Paragraph(_xml(u.get("value") or ""), styles["table_cell_mono"]),
                Paragraph(_xml(u.get("context") or "Extracted from raw event"), styles["table_cell"]),
            ]
            for u in unenriched
        ]
        story.append(
            _styled_table(
                ["Type", "Indicator Value", "Extraction Context"],
                un_rows,
                [CONTENT_W * 0.14, CONTENT_W * 0.44, CONTENT_W * 0.42],
                styles,
            )
        )
    story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 4: MITRE ATT&CK FRAMEWORK MAPPING
    # ======================================================================
    story.extend(_section_header("SECTION 04", "ADVERSARY TACTICS & TECHNIQUES", "MITRE ATT&CK Framework Mapping", styles))

    if mitre_mappings:
        tactic_counts: dict[str, int] = {}
        tactic_conf_sums: dict[str, float] = {}
        for mp in mitre_mappings:
            if not isinstance(mp, dict):
                continue
            tac = sanitize_text(mp.get("tactic") or "Unclassified Tactic")
            tactic_counts[tac] = tactic_counts.get(tac, 0) + 1
            tactic_conf_sums[tac] = tactic_conf_sums.get(tac, 0.0) + _to_float(mp.get("confidence"), 0.0)

        tactic_chart_rows = [
            (
                tac,
                float(cnt),
                ACCENT_INDIGO,
                f"{cnt} tech. ({tactic_conf_sums[tac] / cnt:.0%} avg)",
            )
            for tac, cnt in sorted(tactic_counts.items(), key=lambda item: item[1], reverse=True)
        ]
        story.append(
            KeepTogether(
                [
                    _build_horizontal_bar_chart("ATT&CK Technique Coverage by Tactic", tactic_chart_rows),
                    Spacer(1, 10),
                ]
            )
        )

        mitre_rows: list[list[Any]] = []
        for mp in mitre_mappings:
            if not isinstance(mp, dict):
                continue
            tid = sanitize_text(mp.get("technique_id") or "N/A")
            tname = sanitize_text(mp.get("technique_name") or "Unknown Technique")
            tac = sanitize_text(mp.get("tactic") or "Unknown")
            conf = _to_float(mp.get("confidence"), 0.0)
            ev_txt = sanitize_text(mp.get("evidence") or "Correlated from alert telemetry")
            mitre_rows.append(
                [
                    Paragraph(f"<b>{_xml(tid)}</b>", styles["table_cell_mono"]),
                    Paragraph(f"<b>{_xml(tname)}</b>", styles["table_cell"]),
                    Paragraph(_xml(tac), styles["table_cell"]),
                    Paragraph(f"{conf:.0%}", styles["table_cell_mono"]),
                    Paragraph(_xml(ev_txt), styles["table_cell"]),
                ]
            )
        story.append(
            _styled_table(
                ["ID", "Technique Name", "Tactic", "Conf.", "Correlated Evidence"],
                mitre_rows,
                [
                    CONTENT_W * 0.11,
                    CONTENT_W * 0.24,
                    CONTENT_W * 0.17,
                    CONTENT_W * 0.08,
                    CONTENT_W * 0.40,
                ],
                styles,
            )
        )
    else:
        story.append(Paragraph("No MITRE ATT&CK techniques were mapped to this incident.", styles["muted"]))
    story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 5: RECOMMENDED COUNTERMEASURES
    # ======================================================================
    story.extend(_section_header("SECTION 05", "CONTAINMENT & REMEDIATION", "Recommended Countermeasures", styles))

    if recommended_actions:
        action_rows: list[list[Any]] = []
        for idx, act in enumerate(recommended_actions, 1):
            action_rows.append(
                [
                    Paragraph(f"<b>{idx:02d}</b>", styles["table_cell_mono"]),
                    Paragraph(_xml(act), styles["table_cell"]),
                ]
            )
        story.append(
            _styled_table(
                ["Step", "Recommended Response / Containment Action"],
                action_rows,
                [CONTENT_W * 0.08, CONTENT_W * 0.92],
                styles,
            )
        )
    else:
        story.append(Paragraph("No automated remediation actions were recommended.", styles["muted"]))
    story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 6: MULTI-AGENT EXECUTION TIMELINE & TELEMETRY
    # ======================================================================
    story.extend(_section_header("SECTION 06", "ORCHESTRATION & METRICS", "Multi-Agent Execution Timeline & Telemetry", styles))

    if agent_trace:
        latency_rows: list[tuple[str, float, colors.Color, str]] = []
        trace_table_rows: list[list[Any]] = []
        for idx, step in enumerate(agent_trace, 1):
            if not isinstance(step, dict):
                continue
            agent_name = sanitize_text(step.get("agent_name") or f"Agent {idx}")
            st_raw = _enum_str(step.get("status"), "done").lower()
            dur = _to_float(step.get("duration_ms"), 0.0)
            dur_str = f"{dur:.0f} ms" if step.get("duration_ms") is not None else "N/A"
            in_sum = sanitize_text(step.get("input_summary") or "")
            out_sum = sanitize_text(step.get("output_summary") or "")
            err_sum = sanitize_text(step.get("error") or "")

            st_color = (
                colors.HexColor("#16A34A")
                if st_raw == "done"
                else (colors.HexColor("#DC2626") if st_raw == "error" else TEXT_MUTED)
            )
            st_bg = (
                colors.HexColor("#F0FDF4")
                if st_raw == "done"
                else (colors.HexColor("#FEF2F2") if st_raw == "error" else SURFACE_SUBTLE)
            )
            latency_rows.append(
                (
                    agent_name,
                    dur,
                    ACCENT_INDIGO if st_raw == "done" else st_color,
                    dur_str,
                )
            )

            detail_parts = []
            if in_sum:
                detail_parts.append(f"<b>Input:</b> {_xml(in_sum)}")
            if out_sum:
                detail_parts.append(f"<b>Output:</b> {_xml(out_sum)}")
            if err_sum:
                detail_parts.append(f'<font color="#DC2626"><b>Error:</b> {_xml(err_sum)}</font>')
            detail_html = "<br/>".join(detail_parts) if detail_parts else "--"

            trace_table_rows.append(
                [
                    Paragraph(f"{idx:02d}", styles["table_cell_mono"]),
                    Paragraph(f"<b>{_xml(agent_name)}</b>", styles["table_cell"]),
                    _badge_cell(st_raw.upper(), st_color, st_bg),
                    Paragraph(_xml(dur_str), styles["table_cell_mono"]),
                    Paragraph(detail_html, styles["table_cell"]),
                ]
            )

        story.append(
            KeepTogether(
                [
                    _build_horizontal_bar_chart("Agent Execution Latency Profile (ms)", latency_rows),
                    Spacer(1, 10),
                ]
            )
        )
        story.append(
            _styled_table(
                ["#", "Agent Name", "Status", "Duration", "Execution Input / Output Summary"],
                trace_table_rows,
                [
                    CONTENT_W * 0.06,
                    CONTENT_W * 0.21,
                    CONTENT_W * 0.12,
                    CONTENT_W * 0.11,
                    CONTENT_W * 0.50,
                ],
                styles,
            )
        )
        story.append(Spacer(1, 10))
    else:
        story.append(Paragraph("No agent execution trace entries recorded.", styles["muted"]))

    if telemetry_data:
        series = _extract_telemetry_series(telemetry_data)
        if series:
            story.append(
                KeepTogether(
                    [
                        Paragraph("Operational Telemetry Visualization", styles["sub_heading"]),
                        _build_vertical_telemetry_chart("SOC Telemetry Metrics Distribution", series),
                        Spacer(1, 8),
                    ]
                )
            )
        if isinstance(telemetry_data, dict):
            t_rows = [
                [
                    Paragraph(_xml(str(k).replace("_", " ").title()), styles["table_cell"]),
                    Paragraph(
                        _xml(json.dumps(v, default=str) if isinstance(v, (dict, list)) else str(v)),
                        styles["table_cell_mono"],
                    ),
                ]
                for k, v in telemetry_data.items()
            ]
            if t_rows:
                story.append(Paragraph("Recorded Telemetry Snapshot", styles["sub_heading"]))
                story.append(_styled_table(["Telemetry Field", "Value"], t_rows, [CONTENT_W * 0.30, CONTENT_W * 0.70], styles))
                story.append(Spacer(1, 8))
        elif isinstance(telemetry_data, list) and all(isinstance(row, dict) for row in telemetry_data):
            sample_keys: list[str] = []
            for row in telemetry_data:
                for k in row.keys():
                    if str(k) not in sample_keys:
                        sample_keys.append(str(k))
            cols = sample_keys[:6]
            if cols:
                t_headers = [c.replace("_", " ").title() for c in cols]
                t_list_rows = [
                    [Paragraph(_xml(row.get(c, "--")), styles["table_cell_mono"]) for c in cols]
                    for row in telemetry_data
                ]
                col_w = [CONTENT_W / len(cols)] * len(cols)
                story.append(Paragraph("Recorded Telemetry Series", styles["sub_heading"]))
                story.append(_styled_table(t_headers, t_list_rows, col_w, styles))
                story.append(Spacer(1, 8))

    if supervisor_plan:
        plan_str = (
            json.dumps(supervisor_plan, indent=2, default=str)
            if isinstance(supervisor_plan, (dict, list))
            else str(supervisor_plan)
        )
        story.append(Paragraph("Supervisor Orchestration Plan", styles["sub_heading"]))
        plan_lines = _wrap_monospace_lines(plan_str, max_cols=92)
        story.append(_code_box_table(plan_lines, ACCENT_CYAN, styles))
        story.append(Spacer(1, 8))

    # ======================================================================
    # SECTION 7: COMPLETE INVESTIGATION NARRATIVE (MARKDOWN REPORT)
    # ======================================================================
    story.extend(_section_header("SECTION 07", "ANALYST NARRATIVE", "Complete Investigation Final Report", styles))
    story.extend(_markdown_to_flowables(markdown_report, styles))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()
