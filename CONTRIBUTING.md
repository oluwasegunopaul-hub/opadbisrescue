# Contributing to opadbisrescue

Thank you for helping improve healthcare accessibility intelligence for Nigeria. Contributions of code, documentation, OSM data and domain review are all welcome.

## Table of Contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Branching strategy](#branching-strategy)
- [Commit conventions](#commit-conventions)
- [Pull requests](#pull-requests)
- [Coding standards](#coding-standards)
- [Documentation duties](#documentation-duties)
- [Reporting bugs](#reporting-bugs)
- [Proposing features](#proposing-features)
- [Contributing OSM data](#contributing-osm-data)

## Ways to contribute

| Contribution | Where to start |
| --- | --- |
| Bug fix | [Reporting bugs](#reporting-bugs), then a `fix/` branch |
| New feature | Open a discussion issue first, then a `feat/` branch |
| Documentation | Edit `docs/`; see [documentation duties](#documentation-duties) |
| Data quality rules | `src/lib/quality.ts` + [docs/data-quality-module.md](./docs/data-quality-module.md) |
| OSM edits | [Contributing OSM data](#contributing-osm-data) |
| Translation / accessibility | Issues labelled `a11y` or `i18n` |

## Development setup

```sh
git clone <repository-url>
cd opadbisrescue
bun install
bun run dev        # http://localhost:8080
```

Full instructions: [docs/installation.md](./docs/installation.md).

## Branching strategy

```text
main            production-ready, always deployable
  └── develop   integration branch for the next release
        ├── feat/<slug>     new capability
        ├── fix/<slug>      bug fix
        ├── docs/<slug>     documentation only
        ├── chore/<slug>    tooling, deps, config
        └── refactor/<slug> behaviour-preserving change
hotfix/<slug>   branched from main, merged to main and develop
```

Rules:
- Never commit directly to `main`.
- Rebase your branch on `develop` before opening a pull request.
- One logical change per branch.

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(quality): add opening_hours syntax validation
fix(map): prevent Leaflet init on SSR render
docs(api): document getAdminBoundary error codes
chore(deps): bump leaflet to 1.9.4
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull requests

Checklist before requesting review:

- [ ] `bun run lint` passes.
- [ ] `bun run build` succeeds.
- [ ] Manual verification on both `/` and `/quality`.
- [ ] Docs updated for any behaviour, API or configuration change.
- [ ] `CHANGELOG.md` entry added under `## [Unreleased]`.
- [ ] Screenshots or a short clip attached for UI changes.
- [ ] No hardcoded colour utilities — use design tokens in `src/styles.css`.

## Coding standards

- **TypeScript strict.** No `any` in new code; model OSM tags as `Record<string, string>`.
- **Server functions are thin.** Files declaring `createServerFn` contain only imports, types and the exported declaration; real logic lives in a `*.server.ts` module.
- **SSR safety.** Any module touching `window`, `document` or Leaflet must be lazily imported behind `useHydrated()`.
- **Pure domain logic.** Scoring, geometry and export helpers in `src/lib/` stay free of React imports so they remain unit-testable.
- **Design tokens only.** Never write `text-white`, `bg-black` or `bg-[#hex]` in components.
- **Query keys are explicit.** Include the study-area or quantised bbox key so caches never bleed across areas.
- **Respect OSM API etiquette.** Keep the descriptive `User-Agent`, keep endpoint failover, and never remove the request timeout.

## Documentation duties

Documentation is part of the definition of done. Map your change to its document:

| Change | Update |
| --- | --- |
| New/changed server function | [docs/api-reference.md](./docs/api-reference.md), [docs/backend.md](./docs/backend.md) |
| New route or page | [docs/frontend.md](./docs/frontend.md), [docs/folder-structure.md](./docs/folder-structure.md) |
| Scoring rule change | [docs/data-quality-module.md](./docs/data-quality-module.md) |
| Accessibility/routing change | [docs/healthcare-module.md](./docs/healthcare-module.md) |
| New env var | `.env.example` + [docs/configuration.md](./docs/configuration.md) |
| New external service | [docs/osm-integration.md](./docs/osm-integration.md), [docs/security.md](./docs/security.md) |
| Architecture change | [docs/system-architecture.md](./docs/system-architecture.md), [docs/architecture-diagrams.md](./docs/architecture-diagrams.md) |
| Any user-visible change | `CHANGELOG.md` |

## Reporting bugs

Include:

1. Environment (browser, OS, deployment URL or local).
2. Selected state/LGA and active layers.
3. Steps to reproduce.
4. Expected vs actual behaviour.
5. Console errors and failing network requests (Overpass/OSRM status codes).
6. Screenshot or screen recording.

Label the issue `bug`, and add `data-quality`, `map`, `routing` or `performance` as applicable.

## Proposing features

Open an issue with: problem statement, affected users (see [docs/user-roles.md](./docs/user-roles.md)), proposed behaviour, data requirements, and any OSM tagging implications. Maintainers triage against [docs/future-roadmap.md](./docs/future-roadmap.md).

## Contributing OSM data

The quality dashboard is designed to produce editing tasks. When you fix a flagged facility:

1. Use the **iD** or **JOSM** deep link from the issue row.
2. Only add tags you can verify — never invent phone numbers or opening hours.
3. Use a descriptive changeset comment, e.g. `Add contact and address tags to health facilities in Ibadan North (opadbisrescue audit)`.
4. Follow the [OSM healthcare tagging guidance](https://wiki.openstreetmap.org/wiki/Healthcare) and Nigerian community conventions.
5. Allow up to a few minutes for Overpass mirrors to reflect the edit, then refresh the dashboard.

Never bulk-import or machine-edit data without prior community discussion and an approved import plan.
