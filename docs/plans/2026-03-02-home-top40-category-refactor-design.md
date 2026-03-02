# CoreNews Category and Homepage Refactor Design (2026-03-02)

## Confirmed Decisions

- Homepage is a unified hot feed, not category sections.
- Homepage displays top 40 events by heat score.
- Light diversification is required: max 8 events per single category on homepage.
- Primary category taxonomy is expanded to 12 categories.
- Category pages use unified route prefix: `/category/[slug]`.
- Old short routes (such as `/ai`, `/tech`) are removed.

## Category Taxonomy (L1)

- `ai`
- `tech`
- `business`
- `markets`
- `policy`
- `china`
- `us`
- `japan`
- `europe`
- `world`
- `energy`
- `health`

## Snapshot Contract Update

- `snapshots.key = "home"` payload becomes `SnapshotEvent[]`.
- `snapshots.key = "category:<slug>"` payload remains per-category `SnapshotEvent[]`.
- Home snapshot selection rule:
  1. Sort all events by `hotScore desc`.
  2. Select up to 40 items.
  3. Limit each category to at most 8 items.

## Read Model and UI

- `readHomeSnapshot()` returns `{ generatedAt, events }`.
- Homepage renders a single ranked feed from `events`.
- Category page path is `/category/[slug]` and supports pagination.
- Navigation points to unified category routes only.

## Compatibility Strategy

- `readHomeSnapshot()` keeps legacy tolerance:
  - If old object payload is encountered, flatten to an event list.
- This allows smooth transition while new pipeline runs generate new home snapshots.
