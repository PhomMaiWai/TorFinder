# TorFinder documentation

Documentation for the Collaborative Software Process and Project
Management (01219346) course project, Kasetsart University. Setup and
running instructions are in the [root README](../README.md).

```
docs/
├── architecture.md start here: the code map and the rules
├── project/        what we are building and how the work went
├── requirements/   what the system must do
├── design/         how it is built: diagrams and API
├── process/        how we work: SDLC, team workflow, code, tests
├── operations/     running the import pipeline and deploying
└── security/       security self-audit
```

Start with [architecture.md](./architecture.md): what the system is made of,
where each kind of code lives, how a TOR moves through it, and the rules a
change must keep.

## Project

| Document | Covers |
| --- | --- |
| [project-plan.md](./project/project-plan.md) | Vision, scope, stakeholders, tech stack, iteration overview |
| [roles-and-features.md](./project/roles-and-features.md) | What each role can do, and which features are done |
| [iterations/](./project/iterations/) | Each iteration's backlog and delivery status, from the GitHub Projects board |

## Requirements

| Document | Covers |
| --- | --- |
| [srs.md](./requirements/srs.md) | The team's Software Requirements Specification (SRS v1.0, Aug 21 2026) |
| [summary.md](./requirements/summary.md) | The SRS condensed: FR-01 to FR-26, NFRs, stakeholders, screens |
| [kpi.md](./requirements/kpi.md) | Success measures with targets, how to measure them, and today's values |

## Design

| Document | Covers |
| --- | --- |
| [use-case.md](./design/use-case.md) | Use case model |
| [domain-model.md](./design/domain-model.md) | Domain model, TOR stage and account status state diagrams |
| [system-architecture.md](./design/system-architecture.md) | Containers, external systems, backend modules |
| [er-diagram.md](./design/er-diagram.md) | MongoDB collections, references, indexes |
| [class-diagram.md](./design/class-diagram.md) | Backend classes |
| [sequence-diagrams.md](./design/sequence-diagrams.md) | Six main flows |
| [api.md](./design/api.md) | Every backend route: guard, body, response, errors, rate limits |

## Process

| Document | Covers |
| --- | --- |
| [sdlc.md](./process/sdlc.md) | The six SDLC stages and what we did in each, with evidence |
| [team-workflow.md](./process/team-workflow.md) | How the team ran Scrum: cycle diagram, roles, cadence, Definition of Done |
| [developer-guide.md](./process/developer-guide.md) | Branches, commits, pull requests, code style |
| [testing.md](./process/testing.md) | How to run the tests, what they cover, what CI runs |

## Operations

| Document | Covers |
| --- | --- |
| [pipeline.md](./operations/pipeline.md) | The import and AI pipeline, precisely: jobs, config, dedup order, AI queue |
| [pipeline-guide.md](./operations/pipeline-guide.md) | The same pipeline in plain words, and how to run it locally |
| [sync-and-poll.md](./operations/sync-and-poll.md) | Older Thai notes on e-GP sync (pipeline.md says where they drifted) |
| [deployment-checklist.md](./operations/deployment-checklist.md) | What to check before, during and after a deploy |
| [maintenance.md](./operations/maintenance.md) | Keeping it running after release: monitoring, backups, updates, bug reports |

## Security

| Document | Covers |
| --- | --- |
| [asvs-l1.md](./security/asvs-l1.md) | Self-audit against OWASP ASVS 5.0 Level 1 |

## Iterations

Sourced from the team's GitHub Projects "Iteration" view (weekly cycles,
Must/Should/Could items tagged with their SRS functional requirement).

| Iteration | Dates | Status |
| --- | --- | --- |
| [1](./project/iterations/iteration-1.md) | Aug 27 – Sep 02 | All 6 epics Done |
| [2](./project/iterations/iteration-2.md) | Sep 03 – Sep 09 | All 5 epics Done |
| [3](./project/iterations/iteration-3.md) | Sep 10 – Sep 16 | All 6 epics Done (team's own `test/iteration-3` QA branch) |
| [4](./project/iterations/iteration-4.md) | Sep 17 – Sep 23 | 6/9 epics Done |
| [5](./project/iterations/iteration-5.md) | Sep 24 – Sep 30 | 6/10 epics Done |
| [6](./project/iterations/iteration-6.md) | Oct 01 – Oct 07 | 1/4 epics Done |
| [7](./project/iterations/iteration-7.md) | Oct 08 – Oct 14 | 1/13 sub-issues Done |
| [8](./project/iterations/iteration-8.md) | Oct 15 – Oct 21 | Not yet captured in full — see note in the file |

The board continues beyond iteration 8. Pull a fresh backlog export from
the GitHub Project to extend this past iteration 8.
