## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Gates

The four gates are not one thing, and they are not equally worth running on every change.
Costs measured in this repo: `check-types` ~16–56s, `lint` ~30–70s, `test` ~9–45s, and
`build` varies by whether the output changed — a cache hit is ~1s, a cold build ~60s.

| When | Gates |
| --- | --- |
| Every change | `pnpm check-types` |
| Every change that touches logic | `+ pnpm test` |
| Checkpoint, before committing a batch, before push | `+ pnpm lint` + `pnpm build` |
| CI | all four, on every push — already the case |

Rationale, so this is not just a preference:

- `check-types` runs always. Highest value per second of the four.
- `test` runs whenever behaviour could have changed. Deferring it does not save compute, it
  moves the cost: at a checkpoint a red suite means bisecting every change since the last
  green one. Worse, this suite has a mode where it is green and proves nothing — the service
  integration tests **skip themselves** when `DATABASE_URL_TEST` is absent, so read the
  `Tests N passed | M skipped` line rather than just the exit code. A gate that quietly tests
  nothing is worse than no gate, because it is a green light over a hole.
- `build` is deferred. `check-types` already proves the types; what `build` adds is
  "compiles in a production bundle" — server/client boundary mistakes, bad imports, bundler
  config. Those cluster around specific edits (adding `"use client"`, restructuring imports)
  rather than showing up on every change, and it is the expensive gate.
- `lint` is checkpointed. It catches mechanical mistakes — unused imports, hook-rule
  violations — which is exactly the class you do not want to discover three commits later.

Deferring gates locally costs no safety, because CI runs all four on every push anyway. The
point is to find mechanical breakage at the moment it is written, and to keep the expensive
gate off the inner loop.

## Tests

- **Vitest** is the default. Write unit and integration tests alongside the logic they cover.
- **Playwright is manual, not part of the inner loop and not run in CI.** Run
  `pnpm --filter web e2e` only when asked, or when something is failing and types plus unit
  tests genuinely cannot say why. Do not add it to a gate or reach for it reflexively.
- The two are not interchangeable. Vitest cannot see the bugs Playwright finds, because those
  bugs are in the browser as a *runtime*: an event dispatched before hydration, a CSS-collapsed
  element, an in-flight request, a route change. Conversely Playwright is a poor way to check
  pure logic — extract it and unit-test it.
- When a bug turns out to need a browser to diagnose, say so in one line when reaching for
  Playwright, so it can be corrected if the wrong tool was picked.
- What the browser journeys currently guard, and what silently rots without them: the public
  form's inputs (a respondent typing before hydration loses the answer), `auth.signOutUser`
  over tRPC, the builder's autosave and publish flush ordering, the sidebar's active-route
  rule, and the `?form=` selection round trip.

## Build caches

`.turbo/cache` and `apps/web/.next` are disposable — delete them freely, nothing is lost but
build time. `turbo` does not evict by default, so a long session accumulates entries without
bound. If `.turbo/cache` passes a few GB, that is a bug in `turbo.json`'s `outputs`, not normal
growth: an entry should be a few MB, not hundreds.

