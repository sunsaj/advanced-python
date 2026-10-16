from __future__ import annotations

import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SITE = PROJECT_ROOT / "website"


def test_index_contains_reader_landmarks() -> None:
    text = (SITE / "index.html").read_text(encoding="utf-8")
    for fragment in [
        'class="skip-link"', '<header', '<nav', '<main', '<article',
        'id="search-dialog"', 'id="mobile-backdrop"', 'id="live-region"',
        'id="previous-document"', 'id="next-document"', 'id="theme-toggle"',
        '<noscript>', 'type="module"',
    ]:
        assert fragment in text
    assert len(re.findall(r"<main\b", text)) == 1


def test_no_remote_script_or_font_dependencies() -> None:
    text = (SITE / "index.html").read_text(encoding="utf-8")
    assert not re.search(r'<script[^>]+src="https?://', text)
    css = (SITE / "styles.css").read_text(encoding="utf-8")
    assert "@import url(http" not in css


def load_generated_data() -> dict:
    text = (SITE / "content" / "book-data.js").read_text(encoding="utf-8")
    prefix = "window.SENIOR_PYTHON_BOOK = "
    assert text.startswith(prefix) and text.rstrip().endswith(";")
    return __import__("json").loads(text[len(prefix):].strip()[:-1])


def test_generated_data_and_assets_are_complete() -> None:
    data = load_generated_data()
    documents = data["documents"]
    chapter_ids = {document["id"] for document in documents if document["kind"] == "chapter"}
    assert chapter_ids == {f"chapter-{number:02d}" for number in range(1, 34)}
    assert {"orientation", "capstone", "roadmap", "glossary", "bibliography"} <= {document["id"] for document in documents}
    for document in documents:
        for source in re.findall(r'src="(assets/illustrations/[^"]+)"', document["html"]):
            assert (SITE / source).exists(), source
        section_ids = [section["id"] for section in document["sections"]]
        assert len(section_ids) == len(set(section_ids))
        if document["previous_id"]:
            previous = next(item for item in documents if item["id"] == document["previous_id"])
            assert previous["next_id"] == document["id"]
    raw = (SITE / "content" / "book-data.js").read_text(encoding="utf-8").lower()
    assert "</script" not in raw


def test_module_imports_resolve_and_no_placeholders_remain() -> None:
    app = (SITE / "app.js").read_text(encoding="utf-8")
    for module in re.findall(r'from\s+"(\./[^"]+)"', app):
        assert (SITE / module).resolve().exists(), module
    for path in [SITE / "index.html", SITE / "styles.css", SITE / "app.js", *sorted((SITE / "modules").glob("*.js"))]:
        text = path.read_text(encoding="utf-8")
        assert not re.search(r"\b(?:TODO|TBD)\b", text)


def test_compact_sidebar_keeps_expand_control_visible() -> None:
    css = (SITE / "styles.css").read_text(encoding="utf-8")
    assert "body.sidebar-compact .sidebar-actions { display: flex;" in css
    assert "body.sidebar-compact #home-link { display: none;" in css
