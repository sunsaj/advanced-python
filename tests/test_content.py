from __future__ import annotations

import json
from pathlib import Path

from website.scripts.build_content import build_book_data

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def write_project(root: Path, chapters: list[tuple[int, str, str]]) -> None:
    manuscript = root / "book" / "manuscript"
    editorial = root / "book" / "editorial"
    illustrations = root / "book" / "illustrations"
    manuscript.mkdir(parents=True)
    editorial.mkdir(parents=True)
    illustrations.mkdir(parents=True)
    contract = {
        "chapters": [
            {"number": number, "slug": slug, "title": title, "part": "Part Test"}
            for number, slug, title in chapters
        ],
        "required_sections": ["Opening Story", "Summary"],
    }
    (editorial / "chapter-contract.json").write_text(json.dumps(contract), encoding="utf-8")
    (illustrations / "manifest.json").write_text("[]", encoding="utf-8")
    (manuscript / "00-front-matter.md").write_text("# Orientation\n\nWelcome reader.", encoding="utf-8")
    for number, slug, title in chapters:
        (manuscript / f"{number:02d}-{slug}.md").write_text(
            f"# Chapter {number} {title}\n\n## Opening Story\n\nStory {number}.\n\n## Summary\n\nSummary {number}.",
            encoding="utf-8",
        )
    for filename, title in [
        ("34-capstone.md", "Capstone"),
        ("35-roadmap-and-interviews.md", "Roadmap"),
        ("36-glossary.md", "Glossary"),
        ("37-bibliography.md", "Bibliography"),
    ]:
        (manuscript / filename).write_text(f"# {title}\n\nClosing content.", encoding="utf-8")


def test_build_book_data_orders_and_links_documents(tmp_path: Path) -> None:
    write_project(tmp_path, [(1, "one", "One"), (2, "two", "Two")])
    output = tmp_path / "website" / "content" / "book-data.js"
    data = build_book_data(tmp_path, output)
    ids = [document["id"] for document in data["documents"]]
    assert ids == ["orientation", "chapter-01", "chapter-02", "capstone", "roadmap", "glossary", "bibliography"]
    first = data["documents"][0]
    second = data["documents"][1]
    assert first["next_id"] == "chapter-01"
    assert second["previous_id"] == "orientation"
    assert second["part"] == "Part Test"
    assert second["sections"][0]["title"] == "Opening Story"
    assert "<h1" in second["html"]
    assert "Story 1" in second["plain_text"]
    assert output.exists()


def test_production_data_contains_every_book_document(tmp_path: Path) -> None:
    data = build_book_data(PROJECT_ROOT, tmp_path / "book-data.js")
    chapters = [document for document in data["documents"] if document["kind"] == "chapter"]
    assert len(chapters) == 33
    assert {document["id"] for document in chapters} == {f"chapter-{number:02d}" for number in range(1, 34)}
    assert {"orientation", "capstone", "roadmap", "glossary", "bibliography"} <= {document["id"] for document in data["documents"]}
    assert len({document["id"] for document in data["documents"]}) == len(data["documents"])


def test_conversion_escapes_html_preserves_code_and_resolves_images(tmp_path: Path) -> None:
    write_project(tmp_path, [(1, "safe", "Safe")])
    manuscript = tmp_path / "book" / "manuscript" / "01-safe.md"
    manuscript.write_text(
        "# Chapter 1 Safe\n\n## Opening Story\n\n<script>alert('x')</script> and **strong** plus \x60inline\x60.\n\n"
        "~~~python\ndef example() -> int:\n    return 1\n~~~\n\n"
        "![A useful diagram](../illustrations/png/figure.png)\n\n- one\n- two\n\n## Summary\n\nDone.",
        encoding="utf-8",
    )
    png = tmp_path / "book" / "illustrations" / "png" / "figure.png"
    png.parent.mkdir(parents=True)
    png.write_bytes(b"PNG")
    manifest = [{
        "id": "fig-01", "chapter": 1, "caption": "Useful figure", "alt": "Diagram showing a safe flow",
        "svg": "svg/figure.svg", "png": "png/figure.png", "grayscale_safe": True,
    }]
    (tmp_path / "book" / "illustrations" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    output = tmp_path / "website" / "content" / "book-data.js"
    data = build_book_data(tmp_path, output)
    chapter = next(document for document in data["documents"] if document["id"] == "chapter-01")
    assert "<script>" not in chapter["html"]
    assert "&lt;script&gt;" in chapter["html"]
    assert "<strong>strong</strong>" in chapter["html"]
    assert "<code>inline</code>" in chapter["html"]
    assert "    return 1" in chapter["html"]
    assert 'alt="Diagram showing a safe flow"' in chapter["html"]
    assert (tmp_path / "website" / "assets" / "illustrations" / "figure.png").exists()
