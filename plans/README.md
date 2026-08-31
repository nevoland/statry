# Plans

Feature-based design notes for the `statry` project. Each Markdown file in this folder describes one substantial feature — its rationale, architecture, key data types, and the interactions between the pieces — at a level of detail that lets a contributor rebuild or extend that feature without re-deriving every decision.

Not a changelog and not user documentation:

- **Not a changelog.** Plans describe the intended shape of a feature, not the history of how it was implemented. Stale sections should be removed as the design evolves rather than annotated with amendments.
- **Not user documentation.** Plans are for people modifying or extending the code; the README, JSDoc, and examples handle the public API.

## Conventions

- One file per feature, named after the feature (`vizualizer.md`, not `2024-01-15-visualizer.md`).
- Structure by component/concern, not by chronology. Sections should read like a table of contents of the feature's parts.
- Reference source paths (`src/client/tools/inspector/analyze.ts`) so a reader can jump straight from a section to the code it describes.
- Keep a short "Deferred / future work" list at the end for known gaps and follow-ups.

## Current plans

- [`vizualizer.md`](./vizualizer.md) — the state-machine visualizer (`<Inspector>` component + supporting analysis / layout / rendering pipeline).
