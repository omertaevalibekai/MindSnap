# Changelog

## 1.0.3 — 2026-10-28

- Fix phantom `theses` nodes when normalizing nested mind-map responses.
- Add regression tests for structured response parsing and invalid flashcards.
- Refresh compatible dependencies to resolve reported npm audit advisories.
- Add CI for type checking, tests and production builds, plus Dependabot updates.
- Document Node.js 22.16+ and reproducible installation with `npm ci`.

Limitations: automated checks cover parsing and compilation, not a complete interactive
Chrome test. Install the unpacked extension from the release ZIP through Developer mode.
This release is not a Chrome Web Store submission.
