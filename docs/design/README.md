# Software design

Design diagrams for TorFinder, drawn from the code as of November 2026.
They are written in [Mermaid](https://mermaid.js.org/), which GitHub renders
in place, so they live next to the code and can be edited in a PR like any
other file.

| Diagram | What it shows |
| --- | --- |
| [Use case model](./use-case.md) | Actors (Public, Viewer, Organization, Project Owner, Auditor, Admin, Scheduler) and what each can do, mapped to routes and FRs |
| [Domain model](./domain-model.md) | Business concepts and how they relate, plus TOR stage and account status state diagrams |
| [System architecture](./system-architecture.md) | Containers, external systems, backend modules and frontend areas |
| [ER diagram](./er-diagram.md) | MongoDB collections, fields, references and indexes |
| [Class diagram](./class-diagram.md) | Backend guards, schedulers, importers and domain services |
| [Sequence diagrams](./sequence-diagrams.md) | Sign-in, sign-up and approval, import and AI, matching, feedback moderation, error reports |
| [API reference](./api.md) | Every backend route, its guard, body and response |

## Editing a diagram

1. Change the Mermaid block in the `.md` file.
2. Check it renders: open the file on GitHub, or paste the block into
   [mermaid.live](https://mermaid.live).
3. If the change follows a code change, put both in the same PR so the
   diagram doesn't drift.
