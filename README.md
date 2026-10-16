# Senior Python Engineering Web Reader

This folder is a framework-free static website generated from the canonical manuscript in ../book/manuscript.

## Preview on Windows Command Prompt

From the project root:

    C:\Users\MSRahulSaj\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe website\scripts\build_content.py
    C:\Users\MSRahulSaj\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pytest website\tests -v
    cd website
    C:\Users\MSRahulSaj\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m http.server 8765

Then open http://127.0.0.1:8765/.

A static server is recommended. Browser security rules can block JavaScript modules when index.html is opened directly through a file URL.

## Regenerate Content

Run website/scripts/build_content.py after editing the manuscript or illustration manifest. The generator rebuilds content/book-data.js and copies referenced PNG illustrations into assets/illustrations.

Do not edit content/book-data.js manually. It is generated.

## Features

- All 33 requested chapters plus orientation, capstone, roadmap, glossary, and bibliography
- Grouped chapter navigation and URL hash routing
- Local full-text search
- Previous and next navigation
- Reading progress and completion tracking
- Light and dark themes
- Code-copy controls
- Responsive mobile drawer
- Keyboard shortcuts and accessible dialogs
- Print styling for the active reading section
- No backend, account, framework, remote font, or remote script dependency

## Hosting

The complete website directory can be deployed as a static site. GitHub Pages, Netlify, Vercel, object storage static hosting, or an ordinary web server can serve it. No provider-specific configuration is included or required by the application.
