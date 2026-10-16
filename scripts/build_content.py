from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

WORDS_PER_MINUTE = 220


@dataclass
class SectionRecord:
    id: str
    title: str
    level: int
    text_parts: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return " ".join(part for part in self.text_parts if part).strip()


class MarkdownConverter:
    def __init__(self, project_root: Path, manifest: list[dict[str, Any]], site_root: Path) -> None:
        self.project_root = project_root
        self.site_root = site_root
        self.manifest = manifest
        self.manifest_by_basename = {
            Path(entry["png"]).name: entry for entry in manifest if entry.get("png")
        }
        self.used_assets: set[str] = set()
        self.slug_counts: dict[str, int] = {}

    def slug(self, value: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "section"
        count = self.slug_counts.get(base, 0)
        self.slug_counts[base] = count + 1
        return base if count == 0 else f"{base}-{count + 1}"

    def inline(self, value: str) -> str:
        safe = html.escape(value, quote=True)
        safe = re.sub(r"\*\*([^*]+)\*\*", lambda match: f"<strong>{match.group(1)}</strong>", safe)
        safe = re.sub(r"\x60([^\x60]+)\x60", lambda match: f"<code>{match.group(1)}</code>", safe)
        safe = re.sub(
            r"(?<![\"'=])(https?://[^\s<]+)",
            lambda match: f'<a href="{match.group(1)}" target="_blank" rel="noopener noreferrer">{match.group(1)}</a>',
            safe,
        )
        return safe

    def copy_image(self, markdown_path: Path, source: str) -> tuple[str, str, str]:
        basename = Path(source).name
        entry = self.manifest_by_basename.get(basename)
        if entry is None:
            raise ValueError(f"No illustration manifest entry for {basename} referenced by {markdown_path.name}")
        source_path = self.project_root / "book" / "illustrations" / entry["png"]
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        asset_dir = self.site_root / "assets" / "illustrations"
        asset_dir.mkdir(parents=True, exist_ok=True)
        destination = asset_dir / basename
        if not destination.exists() or destination.read_bytes() != source_path.read_bytes():
            shutil.copy2(source_path, destination)
        self.used_assets.add(basename)
        return f"assets/illustrations/{basename}", str(entry["alt"]), str(entry.get("caption", ""))

    def convert(self, markdown_path: Path) -> dict[str, Any]:
        self.slug_counts = {}
        lines = markdown_path.read_text(encoding="utf-8").splitlines()
        html_parts: list[str] = []
        plain_parts: list[str] = []
        sections: list[SectionRecord] = []
        current_section: SectionRecord | None = None
        paragraph: list[str] = []
        list_items: list[tuple[str, str]] = []
        code_lines: list[str] = []
        code_language = "text"
        in_code = False
        in_yaml = False
        yaml_seen = False
        open_section = False
        document_title = markdown_path.stem

        def append_text(text: str) -> None:
            plain_parts.append(text)
            if current_section is not None:
                current_section.text_parts.append(text)

        def flush_paragraph() -> None:
            nonlocal paragraph
            if not paragraph:
                return
            value = " ".join(part.strip() for part in paragraph).strip()
            if value:
                html_parts.append(f"<p>{self.inline(value)}</p>")
                append_text(re.sub(r"\*\*|\x60", "", value))
            paragraph = []

        def flush_list() -> None:
            nonlocal list_items
            if not list_items:
                return
            ordered = list_items[0][0] == "ol"
            tag = "ol" if ordered else "ul"
            html_parts.append(f"<{tag}>")
            for _, value in list_items:
                html_parts.append(f"<li>{self.inline(value)}</li>")
                append_text(value)
            html_parts.append(f"</{tag}>")
            list_items = []

        for line in lines:
            stripped = line.strip()
            if stripped == "---" and not yaml_seen and not html_parts and not paragraph:
                in_yaml = not in_yaml
                yaml_seen = True
                continue
            if in_yaml:
                continue
            if stripped.startswith("~~~"):
                flush_paragraph()
                flush_list()
                if in_code:
                    code_text = "\n".join(code_lines)
                    escaped_code = html.escape(code_text, quote=False)
                    html_parts.append(
                        f'<div class="code-block" data-language="{html.escape(code_language)}">'
                        f'<div class="code-toolbar"><span>{html.escape(code_language)}</span></div>'
                        f'<pre tabindex="0"><code class="language-{html.escape(code_language)}">{escaped_code}</code></pre></div>'
                    )
                    append_text(code_text)
                    code_lines = []
                    code_language = "text"
                    in_code = False
                else:
                    code_language = stripped[3:].strip() or "text"
                    in_code = True
                continue
            if in_code:
                code_lines.append(line)
                continue
            if stripped.startswith("<div") and "page-break" in stripped:
                flush_paragraph()
                flush_list()
                continue
            image_match = re.fullmatch(r"!\[(.*?)\]\((.*?)\)", stripped)
            if image_match:
                flush_paragraph()
                flush_list()
                src, alt, _caption = self.copy_image(markdown_path, image_match.group(2))
                html_parts.append(
                    f'<figure class="book-figure"><img src="{html.escape(src)}" alt="{html.escape(alt, quote=True)}" loading="lazy"></figure>'
                )
                append_text(alt)
                continue
            heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
            if heading:
                flush_paragraph()
                flush_list()
                level = len(heading.group(1))
                title = re.sub(r"\*\*|\x60", "", heading.group(2)).strip()
                anchor = self.slug(title)
                if level == 1:
                    document_title = title
                    html_parts.append(f'<h1 id="{anchor}" tabindex="-1">{self.inline(title)}</h1>')
                else:
                    if level == 2:
                        if open_section:
                            html_parts.append("</section>")
                        section_class = "section-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
                        html_parts.append(f'<section class="book-section {section_class}" data-section-id="{anchor}">')
                        open_section = True
                    html_parts.append(f'<h{level} id="{anchor}" tabindex="-1">{self.inline(title)}</h{level}>')
                    current_section = SectionRecord(anchor, title, level)
                    sections.append(current_section)
                append_text(title)
                continue
            unordered = re.match(r"^-\s+(.+)$", stripped)
            ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
            if unordered or ordered:
                flush_paragraph()
                kind = "ul" if unordered else "ol"
                value = (unordered or ordered).group(1)
                if list_items and list_items[0][0] != kind:
                    flush_list()
                list_items.append((kind, value))
                continue
            if not stripped:
                flush_paragraph()
                flush_list()
            else:
                paragraph.append(line)

        flush_paragraph()
        flush_list()
        if in_code:
            raise ValueError(f"Unclosed code fence in {markdown_path}")
        if open_section:
            html_parts.append("</section>")
        plain_text = " ".join(plain_parts)
        return {
            "title": document_title,
            "html": "\n".join(html_parts),
            "plain_text": re.sub(r"\s+", " ", plain_text).strip(),
            "sections": [
                {"id": section.id, "title": section.title, "level": section.level, "text": section.text}
                for section in sections
            ],
        }


def document_specs(project_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    contract = json.loads((project_root / "book" / "editorial" / "chapter-contract.json").read_text(encoding="utf-8"))
    specs: list[dict[str, Any]] = [
        {"id": "orientation", "kind": "orientation", "file": "00-front-matter.md", "part": "Start Here", "number": None}
    ]
    for chapter in contract["chapters"]:
        specs.append({
            "id": f"chapter-{chapter['number']:02d}",
            "kind": "chapter",
            "file": f"{chapter['number']:02d}-{chapter['slug']}.md",
            "part": chapter["part"],
            "number": chapter["number"],
        })
    specs.extend([
        {"id": "capstone", "kind": "capstone", "file": "34-capstone.md", "part": "Practice and Reference", "number": None},
        {"id": "roadmap", "kind": "roadmap", "file": "35-roadmap-and-interviews.md", "part": "Practice and Reference", "number": None},
        {"id": "glossary", "kind": "glossary", "file": "36-glossary.md", "part": "Practice and Reference", "number": None},
        {"id": "bibliography", "kind": "bibliography", "file": "37-bibliography.md", "part": "Practice and Reference", "number": None},
    ])
    return specs, contract["chapters"]


def build_book_data(project_root: Path, destination: Path) -> dict[str, Any]:
    project_root = Path(project_root)
    destination = Path(destination)
    site_root = destination.parent.parent
    manuscript = project_root / "book" / "manuscript"
    manifest_path = project_root / "book" / "illustrations" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else []
    specs, chapter_contract = document_specs(project_root)
    converter = MarkdownConverter(project_root, manifest, site_root)
    documents: list[dict[str, Any]] = []
    for index, spec in enumerate(specs):
        source = manuscript / spec["file"]
        if not source.exists():
            raise FileNotFoundError(source)
        converted = converter.convert(source)
        word_count = len(re.findall(r"\b\w+\b", converted["plain_text"]))
        documents.append({
            **spec,
            **converted,
            "order": index,
            "word_count": word_count,
            "reading_minutes": max(1, round(word_count / WORDS_PER_MINUTE)),
            "previous_id": specs[index - 1]["id"] if index else None,
            "next_id": specs[index + 1]["id"] if index + 1 < len(specs) else None,
        })

    parts: list[dict[str, Any]] = []
    for document in documents:
        if not parts or parts[-1]["title"] != document["part"]:
            part_id = re.sub(r"[^a-z0-9]+", "-", document["part"].lower()).strip("-")
            parts.append({"id": part_id, "title": document["part"], "document_ids": []})
        parts[-1]["document_ids"].append(document["id"])

    search_records: list[dict[str, Any]] = []
    for document in documents:
        search_records.append({
            "id": document["id"], "document_id": document["id"], "section_id": None,
            "title": document["title"], "heading": document["title"], "kind": document["kind"],
            "text": document["plain_text"],
        })
        for section in document["sections"]:
            search_records.append({
                "id": f"{document['id']}::{section['id']}", "document_id": document["id"],
                "section_id": section["id"], "title": document["title"], "heading": section["title"],
                "kind": document["kind"], "text": section["text"],
            })

    data = {
        "metadata": {
            "title": "Senior Python Engineering",
            "subtitle": "From First Principles to Production Systems",
            "description": "An illustrated guide to Python internals, architecture, distributed systems, AI engineering, reliability, and security.",
            "chapter_count": len(chapter_contract),
            "illustration_count": len(manifest),
            "verified_on": "2026-10-16",
        },
        "parts": parts,
        "documents": documents,
        "search_records": search_records,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    encoded = encoded.replace("</script", "<\\/script").replace("<!--", "<\\!--")
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text("window.SENIOR_PYTHON_BOOK = " + encoded + ";\n", encoding="utf-8")
    temporary.replace(destination)
    return data


def main() -> int:
    project_root = Path(__file__).resolve().parents[2]
    destination = project_root / "website" / "content" / "book-data.js"
    data = build_book_data(project_root, destination)
    print(f"Generated {len(data['documents'])} documents and {len(data['search_records'])} search records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
