# Streamyst — Implementation Tasks

Phase-wise task list for turning the POC into a production form builder.

**How to use:** work one phase at a time. Stop when a phase is done, get it reviewed, commit it.
Tick boxes as you go. Every phase ends with a verification gate that must be green before moving on.

**Legend:** `[x]` done · `[ ]` todo · `(file)` hints at where the work belongs

---

## Locked decisions

Settled before implementation. Changing one invalidates the phases that depend on it.

| Area | Decision |
|---|---|
| Layouts | `STEP` (one question per screen) and `PAGED` (N pages of grouped questions). A one-page form is `PAGED` with one page. |
| Question kinds | Text/choice core, plus `RATING`, `DATE`, `ADDRESS` |
| Access | Open share link, optional shared password gate |
| Response | Resumable draft, one completion per device, close date + max responses, custom thank-you |
| Analytics | Views/starts/completions + trend, funnel, per-question drop-off, answer distribution, time-to-complete, CSV export |
| Themes | 4 curated presets built from `DESIGN.md` tokens, respondent surface only |
| Data | Wipe `forms`/`form_fields`, keep `users` (hashing already upgraded in Phase 0) |
| Conditional logic | Deferred to v2. v1 renders every question in order. |
| Public URL | Same app, `/f/[slug]` |
| Builder saves | Debounced autosave to draft + explicit Publish |
| New-response alerts | In-app only, no email provider |

---

## Phase 0 — Foundation & hygiene ✅

Goal: make the codebase safe and verifiable before adding features. Everything here changes
signatures later phases depend on, so it had to go first.

### Secrets

- [x] Untrack `creds.md`, add to `.gitignore` — the values are dummy dev credentials
- [x] Add root `.env.example` (`setup.sh` already expected it)

### Auth

- [x] Replace HMAC-SHA256 + `salt` column with scrypt, params encoded in the hash
      (`packages/services/utils/password.ts`)
- [x] Rename `users.password` → `users.password_hash`, drop `users.salt`
- [x] One generic message for every failed sign-in (no account enumeration)
- [x] JWT expiry (`7d`) — the old tokens never expired
- [x] Add `auth.signOutUser` procedure + `clearAuthenticationCookie` actually clears
- [x] Normalise email (trim + lowercase) *before* validating the format

### Errors

- [x] `AppError` hierarchy in `packages/services/utils/errors.ts` (services never import `@trpc/server`)
- [x] `toTRPCError` + `appErrorToHttpStatus` in `packages/trpc/server/utils/errors.ts`
- [x] `baseProcedure` middleware maps `AppError` → tRPC code, once
- [x] `errorFormatter` scrubs `INTERNAL_SERVER_ERROR` messages
- [x] Express error handler maps `AppError` → HTTP status, logs the real cause
- [x] Remove dead imports: `TRPCError`, `string` from zod, `zodUndefinedModel`, `createNextApiHandler`

### Authorisation

- [x] `packages/services/utils/ownership.ts` — `assertFormOwnership`, `assertFieldOwnership`
- [x] Every form/field service method takes a **required** `userId`

### Env & config

- [x] `NODE_ENV` → `development | test | production` (was rejecting `production` and `test`)
- [x] `apps/api/src/env.ts`: `CORS_ORIGINS`, `TRUST_PROXY`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`,
      `COOKIE_DOMAIN`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- [x] `JWT_SECRET` minimum length
- [x] Fail fast on invalid cookie/production combinations
- [x] `NEXT_PUBLIC_APP_URL` for share links and QR codes

### HTTP layer

- [x] `helmet` (CSP off for `/docs`), `express-rate-limit` on `/api` + `/trpc`
- [x] CORS allowlist from env, credentials on
- [x] Request id middleware — generated, echoed, returned, logged
- [x] Access log with duration; `error` / `warn` / `debug` by status
- [x] `trust proxy` for correct client IPs
- [x] `1mb` JSON body limit
- [x] Cookie factories take `secure`/`sameSite`/`domain` from a config passed in by `apps/api`
      (keeps `@repo/trpc` env-free)
- [x] `clearCookie` uses matching `path`/`domain`
- [x] OpenAPI: `protect: false` on public routes (trpc-to-openapi defaults to `true`),
      `apiKey`/`cookie` security scheme

### Gates & tooling

- [x] `check-types` in all 6 packages
- [x] `lint` in all 6 packages — **migrated the 5 backend packages to ESLint 9 flat config**
      (they had never linted; the old configs also pointed at a non-existent export)
- [x] `packages/eslint-config/node.js` flat config
- [x] `react/prop-types` off for the Next config (redundant in TypeScript)
- [x] `^_` prefix ignored by `no-unused-vars` (Express error handlers need the 4th param)
- [x] `turbo.json`: `dist/**` in build outputs, `db:migrate` uncached, `db:studio` persistent,
      `globalEnv: SKIP_ENV_VALIDATION`
- [x] `packages/database` `dev` → `db:studio` (was hijacking the root `dev` task)
- [x] Fix `resizable.tsx` — `react-resizable-panels` v4 renamed `PanelGroup`→`Group`
- [x] Remove ~20 pre-existing lint warnings across `apps/web`

### Tests

- [x] Vitest at the root (`vitest.config.mts`), `pnpm test` / `pnpm test:watch`
- [x] `password.test.ts` — round trip, tampering, malformed + hostile stored hashes
- [x] `label-key.test.ts` — slug determinism (what makes `labelKey` write-once safe)
- [x] `user-model.test.ts` — email normalisation, password rules
- [x] `errors.test.ts` — `AppError` → tRPC code + HTTP status mapping
- [x] `path-generator.test.ts`

### Migrations

- [x] `0001_drop_legacy_password_columns.sql`
- [x] `0002_add_user_password_hash.sql`
- [ ] **Apply them** — Docker's daemon was down, so `pnpm db:migrate` has not run yet

### Docs & dead code

- [x] Rewrite `README.md` (was Turborepo boilerplate)
- [x] Delete `test.ts`, `test-pg.js`, `packages/database/test-pg.js`
- [x] Delete `packages/services/clients/google-oauth.ts` + `google-auth-library` dep
- [x] Fix stale `tsup.config.ts` (`noExternal: ["@synapse"]`), source maps on

### Gate

- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 41/41 · `pnpm build` 2/2
- [x] Live server smoke test: 401 unauth, 400 with field issues, CORS allow + deny,
      scrubbed 500 with the cause in the log, no stack in production, OpenAPI generates 11 paths

---

## Phase 1 — Database schema

Goal: the full data model for forms, questions, responses and analytics.

### Schema

- [x] `models/form.ts` — `slug` (unique), `layout_mode`, `theme_key`, `status`, `password_hash`,
      `show_progress`, `allow_back`, `one_response_per_device`, `max_responses`, `closes_at`,
      `thank_you_{title,message,redirect_url}`, `version`, `published_at`
- [x] `models/form-page.ts` — `form_id`, `title`, `description`, `position numeric(8,2)`
- [x] `models/question.ts` — 13 `kind`s, `page_id`, `position`, `label_key`, `description`,
      `placeholder`, `is_required`, `settings jsonb`, `deleted_at`
- [x] `models/form-session.ts` — `device_id`, `form_version`, `status`, `started_at`,
      `last_seen_at`, `completed_at`, `current_{page,question}_id`, `user_agent`, `ip_hash`
- [x] `models/form-answer.ts` — `value_{text,number,date,json}`, denormalised
      `question_{label,label_key,kind}`, `is_draft`
- [x] `models/form-event.ts` — `bigserial`, 7 `type`s, `question_id`, `page_id`, `form_version`
- [x] Deleted `models/form-field.ts`
- [x] `theme_key` is a varchar, not a pgEnum, so adding a preset needs no migration

### Indexes & constraints

- [x] `forms`: unique `slug`, index on `created_by` and `status`
- [x] `form_pages`: unique `(form_id, position)`
- [x] `questions`: partial unique `(form_id, label_key)` where `deleted_at is null`
- [x] `questions`: **two** partial position indexes — `(form_id, page_id, position)` where
      `page_id is not null`, and `(form_id, position)` where `page_id is null`. Postgres treats
      NULLs as distinct, so a single index would enforce nothing for `STEP` layouts
- [x] `form_sessions`: partial unique `(form_id, device_id)` where `status = 'COMPLETED'`, so an
      abandoned draft never blocks a retry
- [x] `form_sessions`: indexes on `completed_at`, `started_at`, `status`
- [x] `form_events`: indexes on `(form_id, created_at)`, `(form_id, type, created_at)`,
      `(session_id, created_at)`
- [x] `form_answers`: unique `(session_id, question_id)` — the upsert target
- [x] `form_answers.question_id` is `ON DELETE restrict` so history survives a deleted question

### Migration

- [x] `0003_drop_legacy_form_schema.sql` + `0004_create_form_schema.sql`, both tool-generated
- [x] Verified: a third `generate` reports **no schema changes**, so the snapshots and the models agree
- [ ] **Apply them** to a real database — `pnpm db:migrate` still has not run against Postgres,
      because Docker's daemon is down. PGlite verified the SQL, but not against your dev data.
- [x] Confirmed `users` keeps `password_hash` and no `salt` (it held 0 rows, so no data was lost)

### Service integration tests

- [x] `tests/db.ts` — PGlite harness (real PostgreSQL in WebAssembly, so no Docker needed),
      applies every migration in order
- [x] `tests/schema.test.ts` — 15 tests asserting the *constraints*, not just the columns:
      duplicate slug, enum rejection, unique positions in both layouts, soft-delete freeing a
      `labelKey`, one-completion-per-device, answer upsert, `ON DELETE restrict`, denormalised
      labels surviving a rename, and cascade behaviour
- [ ] `DATABASE_URL_TEST` for tests against a real server (only needed once services take part)

### Forced ripple from the schema change

Renaming `form_fields` → `questions` and `type` → `kind` touched everything above the database.
Done here rather than in Phase 2 so every commit stays green.

- [x] `services/form-field/` → `services/question/`, soft delete instead of hard delete
- [x] `services/utils/slug.ts` — `generateSlug` with a collision retry in `FormService.createForm`
- [x] `services/utils/ownership.ts` — asserts against `questions`
- [x] tRPC procedures renamed to `createQuestion` / `updateQuestion` / `deleteQuestion` /
      `getQuestion` / `listQuestions` (still on the `form` router; the split is Phase 3)
- [x] `apps/web/hooks/api/form` rewritten, and the invalidation bugs fixed — they were
      invalidating `getField` with no input, and delete did not clear it
- [x] Builder page updated for `kind` / `position`; offers the 6 kinds that need no per-kind
      settings, so no question can be created in a state the renderer cannot display
- [x] Fixed `server.listen` failing asynchronously and killing the process with an unhandled
      `error` event (surfaced while smoke-testing the new schema)

### Gate

- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 65/65 · `pnpm build` 2/2
- [x] Live server: 11 OpenAPI paths, correct `protect` flags, 13-value `kind` enum in the document
- [ ] `pnpm db:migrate` against a real database

---

## Phase 2 — Services

Goal: all business logic, each service owning its zod input models and enforcing ownership.

### Shared utils

- [x] `utils/slug.ts` — `generateSlug` (collisions retried in `FormService.createForm`)
- [x] `utils/theme.ts` — the 4 curated presets, the single source both web and API read
- [x] `utils/answer-validation.ts` — `kind` → zod → typed value columns, plus the inverse
      for resuming a draft, and `formatNumericAnswer`
- [x] `utils/ordering.ts` — fractional positions, and a two-phase `renumberInOrder`
- [x] `utils/signed-token.ts` — HMAC unlock tokens for password-protected forms
- [x] `utils/db-errors.ts` — unwraps Drizzle's wrapper to find the Postgres error
- [x] `question-settings.ts` — **discriminated union** of per-kind `settings`

### Services

- [x] `question/` — CRUD, settings validation, page assignment, two-phase reorder, duplicate,
      soft delete, ownership enforced
- [x] `form/` — `getFullDefinition`, `updateSettings`, `setPassword`, `updateSlug`, `deleteForm`,
      `setStatus` (publish gate), `getClosedReason`
- [x] `form-page/` — CRUD + two-phase reorder, inserting after a page
- [x] `access/` — `getPublicFormBySlug`, `unlock`, `startSession` (resume), `getSession`,
      `saveDraft`, `submit`, all ownership- and password-checked
- [x] `response/` — paginated list with filters, `deleteResponse`, `exportCsv`
- [x] `analytics/` — `getFormAnalytics`, `getOverview`, `getFunnel`, `getQuestionDropOff`,
      `getAnswerDistribution`, `getTimeToComplete`
- [x] `createDatabase(url)` exported from `@repo/database` so tests can point services at a
      test database without depending on `drizzle-orm`
- [x] Every service takes an optional `Database` so it is testable against a real server

### Tests

- [x] `settings` union — valid + invalid per kind
- [x] `answer-validation` — every kind, multi-select, address, round-tripping
- [x] `theme` — token completeness, single-accent rule, contrast, green-on-green ban
- [x] `integration.test.ts` — 29 tests: ownership isolation, publish gating, password gating,
      resume, one-response-per-device, response limits, denormalised labels
- [x] `analytics.test.ts` — 15 tests: responses, CSV escaping, funnel, time series,
      distributions, owner scoping
- [x] Per-file test database (`streamyst_test_<scope>`) so parallel test files cannot drop
      each other's schema

### Bugs these tests caught

- [x] `z.infer` returns the **output** type, so `.default()` fields became required for
      service callers. All payload types are `z.input` now.
- [x] Renumbering in one pass violates the unique index transiently — swapping the first and
      third of three questions failed. Now two-phase.
- [x] `completionRate` and the other rates were **inverted** — reporting views ÷ completions.
- [x] `date_trunc($1, …)` cannot resolve overloads from a bound parameter.
- [x] `= ANY($1)` does not survive binding a JS array as a Postgres array.
- [x] `ilike` has no `jsonb` operator; the value needed a `::text` cast.
- [x] Drizzle wraps driver errors, so the unique-violation check never matched and every
      constraint violation became an opaque 500.
- [x] `numeric(20,6)` returns `"5.000000"`; answers now render as `5`.
- [x] Response pagination had no tiebreaker, so a row could repeat or vanish between pages.

### Gate

- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 202/202 · `pnpm build` 2/2
- [x] Suite also passes with `DATABASE_URL_TEST` unset (integration tests skip cleanly)

---

## Phase 3 — tRPC

Goal: expose the services as a typed, documented API.

- [x] Context: rate limiting keyed on `ctx.clientIp`, with `RATE_LIMITS` in
      `utils/rate-limit.ts` and `resetRateLimits` for tests
- [x] `form` router — `createForm` `listForms` `getForm` `getFormSettings` `updateFormSettings`
      `setFormPassword` `updateFormSlug` `setFormStatus` `deleteForm`
- [x] `formPage` router — `listPages` `createPage` `updatePage` `deletePage` `reorderPages`
- [x] `question` router — `listQuestions` `getQuestion` `createQuestion` `updateQuestion`
      `deleteQuestion` `duplicateQuestion` `reorderQuestions`
- [x] `public` router — `getFormBySlug` `unlockForm` `startSession` `getSession` `saveDraft`
      `submitForm` (all `protect: false`, all rate limited, tighter limits on `unlockForm` and
      `submitForm`)
- [x] `response` router — `listResponses` `exportCsv` `deleteResponse`
- [x] `analytics` router — `getFormAnalytics` `getFunnel` `getQuestionDropOff`
      `getAnswerDistribution` `getTimeToComplete` `getOverview`
- [x] `auth` router — the new procedures
- [x] `.meta({ openapi })` on every procedure, with `summary` and correct `protect`
- [x] Delete `packages/trpc/server/schema.ts` (`zodUndefinedModel` is unused now)
- [x] Verify the OpenAPI document — `apps/api/tests/openapi.test.ts` generates it and asserts
      the new paths, so schema/meta drift fails the suite rather than shipping silently

### Design notes

- **Errors are converted in the services layer, not in a middleware.** tRPC v11's
  `callRecursive` catches an error and returns it as a *value* (`{ ok: false, error }`),
  re-throwing only after the chain unwinds, so a middleware's `await next()` never rejects and
  a `try`/`catch` around it cannot see a resolver error. Every service error was reaching the
  client as a 500. `utils/handler.ts` was the first attempt at a per-resolver wrapper and was
  deleted in favour of `typedService()` in `server/services/index.ts`, which decorates the
  service instances with a `Proxy`. One place, and a procedure cannot forget it.
- **CSV columns come from the form's questions, not from its answers.** Sourcing them from
  `form_answers` meant an export of a form with no responses had no question columns at all,
  and partial responses produced a different column set depending on who had answered.
- `listForms` takes no client input; the `userId` comes from the session.
- `setFormStatus` is one procedure for publish/unpublish/close, because publishing is the gate
  between the builder and the audience and is where fillability is validated.
- `getForm` returns the whole definition for the builder store; `getFormSettings` is the
  lighter read for panels that only need settings.
- No zod `.refine()` on a top-level input: `trpc-to-openapi` crashes while building the
  document for them. The closed-form check for `thankYouRedirectUrl` lives in the service.

### Tests

- [x] Supertest against the Express app: auth, ownership, validation, 404s, CSV export,
      analytics — `apps/api/tests/api.test.ts`
- [x] OpenAPI document generation — `apps/api/tests/openapi.test.ts`

### Gate

- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 239/239 · `pnpm build` 2/2
- [x] OpenAPI document asserted in a test rather than reviewed by hand

---

## Phase 4 — `apps/web` foundation

Goal: routes, auth gating, state management, and a single renderer reused in two places.

### Routes

- [x] `/` → redirect by session
- [x] `/dashboard` — overview analytics, on the real `getOverview` query (the POC rendered
      a hard-coded `data.json` chart)
- [x] `/forms` — list + create
- [x] `/forms/[formId]/build` — builder
- [x] `/forms/[formId]/settings`
- [x] `/forms/[formId]/share`
- [x] `/responses?form=<id>` — responses table, filters, pagination, CSV, delete
- [x] `/analytics?form=<id>` — per-form KPIs, trend, funnel, drop-off, distributions, timing
- [x] The console layout lives in `app/(console)/layout.tsx`, so `/dashboard` and `/forms` are
      siblings in the URL and share one auth guard. They used to be nested, which meant
      `/dashboard` was a prefix of every other console route and the sidebar lit up every
      item on every page
- [x] The dashboard lists no forms. It showed a second copy of the `/forms` list as a table,
      and two pages listing the same things in different shapes is one more than a person can
      be reminded of
- [x] **Responses and analytics left the form tabs and became sections.** Reading what came in
      is not an operation *on* a form — it is something you do across all of them — so the form
      became a filter rather than the address, and the sections sit beside Dashboard and Forms
      in the sidebar. Two consequences worth keeping:
  - The form travels in `?form=`, so `/responses` is a real page with nothing chosen, the
      sidebar link never points at nothing, and a link to one form's responses is shareable
  - **The builder store is now read only by the builder.** Responses took its question columns
      from the store and `AnswerDistributions` took its chartable questions, which meant a
        read-only table and a read-only chart were hydrating a store whose entire purpose is
        holding edits the server has not seen. Both now take a `useGetForm` query instead, and
        the invariant is worth defending: the store is for unsaved work, so a page that cannot
        save anything has no business reading it
- [x] The builder keeps a `Responses` / `Analytics` link pair carrying the form in the query,
      so "I have just published — has anyone filled it in?" stays one click
- [x] Analytics is per-form and the dashboard is across all of them, deliberately. They answer
      different questions, and the summed totals only exist in one place
- [x] No form in the URL resolves to the most recently updated form, and the choice is written
      back so the view is shareable. An empty page behind a sidebar link is a worse answer than
      a plausible one
- [x] Drafts appear in the picker. A draft cannot collect responses, so "zero responses" is the
      honest answer; hiding them leaves a new creator with a single draft and an empty picker
- [x] `/f/[slug]` — public form, definition fetched on the server
- [x] `/f/[slug]/thanks`
- [x] `components/form-tabs.tsx` — the four things you do *to* a form, mounted by each of those
      pages so a new tab is one entry plus one page
- [x] `components/console/form-picker.tsx` — one picker, two sections, so both pages behave
      identically for free
- [x] **Which form a section shows, in three tiers** — `?form=` in the URL (a link somebody
      was sent, so it wins) → the last form this creator looked at → the most recently
      updated one, and that last fallback only for a first visit. The middle tier did not
      exist: the choice lived only in the URL, the sidebar links to a bare `/responses`, and
      so every return visit fell through to the newest form
- [x] Arriving with no `?form=` **no longer rewrites the URL**. It used to `router.replace` the
      guessed form in, so the address a creator copied from a bare `/responses` was a guess
      about them rather than something they had chosen — a "shareable link" that was only ever
      the newest form's. The URL is now written only when the picker is used, so a link means
      what it says
- [x] `stores/console-store.ts` — `lastFormId`, the response filters and their page, persisted
      for the same reason `analytics-store` keeps its range: these are view preferences, not
      form data, and re-typing a search you set up thirty seconds ago is pure friction.
      Switching form clears the row-based state, because page 4 of one form's rows is not
      page 4 of another's
- [x] The analytics range buttons read the store's preset on mount. `rangeKey` used to
      initialise to `"30d"`, so `rangeKey || preset` never fell through and the persisted
      range was silently overridden on every visit — the buttons could claim 30 days while the
      query asked for 7
- [x] A remembered or linked form that has since been deleted falls through to the newest one
      and says so. Fetching it would render a table and charts that are permanently empty,
      indistinguishable from a form nobody has answered yet

### Auth gating

- [x] `trpc/server-caller.ts` — server-side caller that **forwards cookies** from `next/headers`
      (the browser client sets `credentials: "include"`, which Node ignores, so every
      server-side "who is this?" was a 401)
- [x] `lib/auth.ts` — `getCurrentUser` / `requireUser`. Only `UNAUTHORIZED` becomes
      `null`; a 500 is rethrown, or a broken API would look like a working sign-out
- [x] Guard the dashboard in a server component — `dashboard/layout.tsx`, so a new page
      cannot ship unguarded
- [x] **Fix the `/dashboard` infinite redirect** — `/` and the dashboard are both server
      components now, so no effect ever decides where to go
- [x] `useUser` distinguishes `loading` / `authenticated` / `anonymous`; `isFetched` alone
      made "loading" and "signed out" identical
- [x] `API_URL` server env var, falling back to `NEXT_PUBLIC_API_URL`, so a deployment can
      point the server at an internal address

### Zustand stores

- [x] `stores/builder-store/` — definition, `selectedQuestionId`, `activeTab`, `saveState`,
      50-step undo/redo, all mutations funnelled through one `commit`
- [x] `plan-sync.ts` — the diff from the last persisted definition to the current one,
      expressed as tRPC calls. Pure, and the part most worth testing
- [x] `run-sync.ts` — runs a plan and swaps `local:` ids for the server's, rewriting a
      reorder that names a question created moments earlier
- [x] `use-autosave.ts` — 800ms debounce, flushed on `pagehide`, using the **uncached** `api`
      client: the store is the source of truth, so a cache refetch would overwrite unsaved
      edits
- [x] `stores/runner-store.ts` — session, layout-aware cursor, answers, `touched`/`errors`,
      submit state; `persist` to `localStorage`, keeping only answers/cursor/touched
- [x] `stores/analytics-store.ts` — range, preset and granularity, persisted
- [x] `useShallow` for multi-field selectors

### Hooks

- [x] `hooks/api/{form,form-page,question,public,response,analytics}/` mirroring the routers
- [x] Invalidation targets are chosen per procedure: `createPage`/`reorderPages` name the
      exact entry, while `updatePage`/`deletePage`/`updateQuestion`/`deleteQuestion` take no
      `formId` and so invalidate the whole key. The old hooks invalidated `getField` with no
      input at all, which matched nothing and left a deleted question on screen
- [x] `trpc/api.ts` — a plain, uncached proxy client. `trpc/server.ts` was renamed: it was
      never server-only, and the name invited exactly the wrong import in a client component

### Renderer

- [x] `components/form/form-renderer.tsx` — one component tree, driven only by props
- [x] `components/form/question-input.tsx` — all 13 kinds on native elements, so keyboard
      and screen-reader behaviour is the platform's rather than re-derived
- [x] `RenderableDefinition` is the *smaller* structural type, not `FormDefinition`: the
      public API withholds `position` and `labelKey`, and a `FormDefinition` parameter would
      have forced the public route to invent fields the server does not send
- [x] Mounted from `/f/[slug]` with server data and from `components/form/form-preview.tsx`
      with store data — WYSIWYG by construction
- [x] The form paints from the server definition; the session starts in parallel and only
      gates submitting

### Bugs this phase found

- [x] **`publicQuestionSchema` had no `pageId`**, though the service selected it, so a
      `PAGED` form reached the public route as a flat list and every respondent saw all its
      questions on one page — or, with no matching page, none at all. zod strips what the
      output schema does not declare, so the field was silently dropped.
- [x] **The publish gate let a `PAGED` form with no pages through.** Its questions belong
      to no page, so the audience got a published form that renders nothing. The gate now
      requires a page when the layout is `PAGED`.
- [x] **`layout_mode` defaulted to `PAGED`**, so every new form was born in exactly that
      broken state. Now `STEP`, which needs no pages and is coherent the moment it is
      created — migration `0005_conscious_ben_grimm.sql`.

### Gate

- [x] Signed-out visitors are redirected server-side, not by a client flash — verified live:
      all eight dashboard routes and `/` return `307 → /login`, and with a session cookie
      `/` returns `307 → /dashboard` and the dashboard renders
- [x] `/f/[slug]` verified live in both layouts: `PAGED` shows page 1 with its two
      questions and hides page 2; `STEP` shows the first question only
- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 262/262 · `pnpm build` 2/2
- [ ] The builder UI is still the Phase 1 POC; the store it will use is built and tested,
      and Phase 5 rewires it

---

## Phase 5 — Builder UI

- [x] Build section — canvas: pages as sections in `PAGED`, flat list in `STEP`;
      **dnd-kit drag reorder**, pointer and keyboard sensors on the same handlers
- [x] Question inspector — label, helper text, placeholder, required toggle, kind picker
      grouped by category, so thirteen options are not one flat list
- [x] Kind-specific config controls driven by the `settings` union — options editor for
      choices, scale + style + labels for rating, field toggles for address, min/max for
      number/date/length, allowed domains for email
- [x] Add / duplicate / delete question, with a real empty state
- [x] Settings section — theme preset picker with thumbnails drawn from the real tokens,
      password on/off, max responses, close date, one-per-device, show progress, back button,
      thank-you copy + redirect
- [x] Share section — slug editor, copyable link, QR (client-side `qrcode`: inline SVG + PNG
      download), publish state
- [x] Preview section — device-width toggle, theme-aware, reading the store
- [x] Status chips for `DRAFT` / `PUBLISHED` / `CLOSED`, a password badge, a live save
      indicator
- [x] Publish is gated on a valid form; the audience can never see a half-finished form
- [x] `app/globals.css` re-themed from DESIGN.md. The app's chrome was stock shadcn
      (near-black primary on white) while the *form* was already on-brand, so the product had
      two visual languages. Two deliberate departures, both noted in the file: mute darkened
      for legibility on sage, and an ink focus ring because a lime one is invisible on white

### The canvas is the form

Each card renders the **actual** `QuestionInput` the respondent gets, in the form's own
theme — not a description of it. Two consequences: a question cannot be dragged into a
state the renderer would not know how to display, and "what I see" cannot drift from "what
they get". The controls are disabled and non-interactive on purpose; they share a surface
with a drag handle, and a live field there is a click target that sometimes drags and
sometimes focuses.

### Bugs this phase found

- [x] **`planSync` grouped questions by layout instead of by page.** The service's
      `reorderQuestions` scopes to a page, and an omitted `pageId` there means "the
      questions with no page". A stepper form whose questions sat on a page therefore sent a
      page-scoped list to a form-scoped endpoint, which rejected it with *"must list every
      question in scope exactly once"*. Found by replaying a real plan against a running API;
      grouping is now by `pageId` in every layout, which is also simpler.
- [x] **Switching to `PAGED` stranded the questions.** A stepper form's questions have no
      page, so they would render on no page at all and publishing would refuse.
      `setLayoutMode` now adopts them onto the first page. Switching to `STEP` deliberately
      *keeps* the page structure, so switching back does not flatten the grouping.
- [x] **The store claimed `Date` fields the API sends as strings.** The API has no date
      serialiser. `BuilderDefinition` is now taken from the router's own output rather than
      the service's `FormDefinition`, so the lie cannot be reintroduced.

### Gate

- [x] Create → build → autosave → publish → share — verified against a running API by
      replaying the real `planSync` + `runSync` with an HTTP executor
      (`apps/web/scripts/autosave-smoke.ts`): 5 calls, every `local:` id replaced by the
      server's, per-kind settings persisted, and a second plan came back empty so autosave
      does not loop
- [x] All six sections render, `/f/[slug]` serves the published form, no hydration or React
      errors in the dev log
- [x] Keyboard reachable — the drag grip is a real button with an `aria-label`, and dnd-kit's
      `KeyboardSensor` drives the same handlers; every toggle is a real `Switch`/`Button`
- [x] Visible focus — `--ring` is ink and the canvas grid collapses to one column below
      `lg`, so the inspector stacks under the canvas
- [ ] `prefers-reduced-motion` — the renderer's progress bar honours it; the builder's
      remaining transitions are short and non-essential, and a full pass is the polish phase
- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 269/269 · `pnpm build` 2/2

---

## Phase 6 — Respondent renderer

- [x] Password gate → `unlockForm` → signed form-scoped cookie, so a refresh finds the form
      already open instead of asking again
- [x] Session bootstrap: `VIEW` then `START` server-side, resuming an `IN_PROGRESS` session
      for this device instead of starting a new one
- [x] `STEP` — one question, keyboard-first (`Enter` next, `Shift+Enter` back, and `Enter`
      stays a newline inside a textarea), auto-advance on `YES_NO` / `SINGLE_CHOICE` /
      `DROPDOWN`, per-question validation before advancing, no page reload
- [x] `PAGED` — page title + grouped questions, `PAGE_VIEW` event, the page validated before Next
- [x] Autosave the draft on every step / page change, and on `pagehide`, so Resume works after
      a closed tab or a refresh
- [x] `SUBMIT` → full server-side revalidation → thank-you in the creator's own words
- [x] Designed states for: closed, past the deadline, limit reached, already submitted, not
      found, and a server that could not answer — each in the form's own theme
- [x] **Time to complete** depends on the first `VIEW` firing before anything else — it is
      emitted inside `startSession`, before `START`

### The rules live outside the component

`components/form/runtime-logic.ts` holds what is visible, where the cursor lands on resume,
which answers are valid and which questions advance by themselves. The component drives them
and contains none of them, which is what makes them testable: 20 cases covering both
layouts, resume, clamping a cursor past a deleted question, and per-kind validation.

Client-side validation calls the *same* `validateAnswer` the service does, so the two cannot
disagree about what a valid email is. It only decides *when* to complain.

### Bugs this phase found

- [x] **Nothing was ever writing `QUESTION_VIEW`.** `getQuestionDropOff` reads those rows and
      has been shipping a chart of zeroes. View events are now recorded in `saveDraft` on a
      genuine change of position — the one place a move is observable, and gating on a real
      change means hammering "back" cannot inflate the funnel. No new endpoint, so no new
      rate-limit surface for client telemetry.
- [x] **`getTimeToComplete` 500'd on any form with a response.** The histogram's open-ended
      top bucket had `max: Number.POSITIVE_INFINITY`, and zod v4's `z.number()` rejects a
      non-finite value, so the router's output validation failed. The empty case skips the
      histogram entirely and looked healthy, and a *service* test passed — output validation
      only happens in the tRPC layer. The bound is now `null`, and there is an API-level test
      that completes a response and asks for the timing.

### Gate

- [x] Both layouts complete end to end, with and without a password — 35 assertions against
      a running API (`apps/web/scripts/respondent-smoke.ts`), covering the stepper, the
      paged form, the password gate and its cookie, cross-form unlock isolation, and each
      designed state
- [x] Refresh mid-form keeps the answers — verified as: start a session, answer, start again
      from the same device, and get the same session, the same answers and the same position
- [x] Pages render: `/f/[slug]` paints the real form, `/f/[slug]/thanks` shows the creator's
      own copy, an unknown slug shows the not-found screen
- [ ] Keyboard and auto-advance are covered by unit tests of the rules and by the markup
      (real inputs, real buttons), not observed in a browser — worth a manual pass
- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 292/292 · `pnpm build` 2/2

---

## Phase 7 — Responses + export

- [x] Response table — one column per question, `ex-data-table-cell` chrome: `canvas-soft`
      header, mono-caps eyebrow columns, `body-sm` cells, `canvas-soft` row borders
- [x] Per-question answer rendering, including address objects (stacked, with readable field
      labels) and multi-select arrays (as pills)
- [x] Filters — completeness, a from/until date range, and a search over answers — plus
      pagination that reports the total across all pages, not the size of the current one
- [x] CSV export straight from `form_sessions` + `form_answers`
- [x] Delete a single response, behind a confirm dialog that only closes once the delete has
      actually succeeded

### The export is the record, not a screenshot of the form

Two requirements pull in opposite directions, and the export has to satisfy both:

- a question **nobody has answered** still belongs in the file, or its shape would depend on
  who has replied and a form with no responses would export no question columns at all;
- a question the creator has since **deleted** must keep its column and every value in it,
  because the answers are the record and the question is only the question.

So the columns are the union of the live questions and every question that still has a
recorded answer. A deleted question is headed by the label **denormalised onto its answers**,
which is the only label those responses were ever collected under. Renaming a live question
moves its header, because the creator asked for that and the values are unchanged.

Choice ids are also resolved to the labels respondents saw, so a multi-select exports
`The API; The UI` rather than `api; ui`; an id with no matching option is left as itself,
which is the honest rendering for a question edited since. The same lookup happens in the
table's cells, so the two agree.

### Gate

- [x] An exported CSV survives a question being renamed and deleted — asserted directly in
      `packages/services/tests/analytics.test.ts`, and again end to end against a running API
      (`apps/web/scripts/responses-smoke.ts`, 19 assertions covering every answer kind, the
      filters, the pagination totals, the delete and the export)
- [x] A response of every one of the eight kinds round-trips through the table's query and
      the export
- [x] Deleting a response is reflected in the list *and* in the analytics totals
- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 294/294 · `pnpm build` 2/2
- [ ] The page is client-rendered, so its DOM is not verified by an HTTP fetch — the data
      contract behind it is, and the styling is worth a look in a browser

## Phase 8 — Analytics

Dashboard (all forms) and per form.

- [x] KPI row — responses, opened, completion rate, average time
- [x] Trend — views / starts / submissions, with a range picker
- [x] Funnel — views → starts → completes, with the drop-off between steps in people
- [x] Question drop-off — reached vs answered per question, with the worst step called out
- [x] Answer distribution — a donut for a two-way question, bars for choices and ratings
- [x] Time to complete — histogram with the average, the median, and a median marker
- [x] Reuses the existing shadcn `chart.tsx` + Recharts 3.8; client components fed by the
      `analytics` procedures
- [x] Chart palette read from the `--chart-*` tokens, which Phase 5 mapped to the DESIGN.md
      family; Phase 9 finishes the rest of the mapping
- [x] The **granularity control is gone**. The service chooses the bucket from the range and
      returns it, so a client-side knob could only ever disagree with the server; the UI shows
      what it was sent instead

### The funnel is drawn, not charted

The thing worth seeing in a funnel is the *width* at each step and the size of the fall
between them, and three narrowing bars say that more directly than a bar chart of three
numbers. Each gap states how many people it cost — "24% completion rate" does not tell a
creator which step to fix. The same reasoning decides the marks elsewhere: a two-way question
gets a donut because yes and no are parts of a whole, while a five-option question gets bars
because its options are not parts of anything, and a donut over a rating scale would imply
five shares of one thing.

### Gate

- [x] **Numbers in the UI match a direct SQL query** — `apps/web/scripts/analytics-gate.ts`
      seeds a real form, then recomputes every figure the UI shows with raw SQL against the
      same database and compares: `VIEW` and `START` events, completed sessions, the
      completion rate, all three funnel rates, the trend total, per-question answered counts,
      every distribution bucket, the timing count and the overview totals. 31 assertions,
      all green.
- [x] **Every form only ever sees its owner's data** — all five analytics procedures refuse
      a second creator with a 403, and neither creator's overview mentions the other's forms
- [x] The gate caught itself lying once: seeding by submitting directly produced no
      `QUESTION_VIEW` rows, so drop-off read zero reached for every question — correct for
      that data, and a gate that would have passed on a flow nothing actually uses. The seed
      now saves drafts the way the runtime does
- [x] `pnpm lint` 6/6 · `pnpm check-types` 6/6 · `pnpm test` 294/294 · `pnpm build` 2/2
- [ ] The charts are verified by their data and their compile, not by eye — worth a look in a
      browser, where a wrong `layout` or an unreadable axis is obvious in a second and
      invisible to every check above

---

## Phase 9 — Design system & hardening

`DESIGN.md` is the source of truth. `/frontend-design` supplies the aesthetic direction.

### Two token layers over one Tailwind build

- [x] **Creator console** — `globals.css` remapped from the shadcn neutral defaults to
      `DESIGN.md`: `canvas-soft` background, `canvas` cards, `ink` foreground, `primary` lime,
      `positive` / `negative` / `warning`, `mute` body
- [x] Radius rescaled so `{rounded.md}` = 12 on inputs and `{rounded.xl}` = 24 on cards and
      buttons. The scale is written out in full rather than derived from one multiplier,
      because the components use four different steps and a single `--radius` cannot express
      that
- [x] `{typography.*}` mapped to `--text-*`; display at weight 900, body Inter
- [x] Fonts are local woff2 through `next/font/local` — Geist 800 as the display substitute
      `DESIGN.md:373` allows, with no network dependency at build time
- [x] Chart palette: lime is too light to carry a data series, so `--chart-1..5` map to
      `ink-deep`, `accent-cyan`, `accent-orange`, `positive`, `warning`. This also honours
      `DESIGN.md:537` — success uses `positive`, never the brand lime
- [x] **Form theme presets** — `data-theme="sage|ink|pale|peach"` remapping the same variables.
      `pale` switches the CTA to `ink` because `DESIGN.md:543` bans a green CTA on green
- [x] Signature element: the **progress rail** — a pill-shaped lime track that fills as the
      respondent advances, segmenting per page in `PAGED`. One memorable thing; everything else
      stays flat
- [x] Template branding removed: `Acme Inc.`, the shadcn GitHub link, the hardcoded shadcn user
      and `navClouds` pointing at `#` are gone. The wordmark is one component, because it had
      been written into three places
- [x] UI copy audited — plain verbs, sentence case, one name per action. Creating a form now
      takes you to that form, and signing in takes you to the dashboard, because both used to
      leave you where you were

### Hardening

- [x] Playwright: signup → create → build → publish → fresh context → complete → submit →
      thank-you → the response is in the creator's table and the analytics count has moved
- [x] Playwright: resume-after-refresh, the signed-out redirect, and the publish gate refusing
      a form with no questions
- [x] Vitest integration tests for services against a real database
- [x] CI running `lint` + `check-types` + `test` + `build`
- [x] `DESIGN.md` updated to match what ships
- [x] **The browser journeys run locally, not in CI.** `pnpm --filter web e2e` is a manual
      check, run on request or when something is failing and the unit tests cannot say why —
      not part of the pre-push loop, and CI does not run it. So nothing is guarding these
      regressions automatically, and the ones it found are worth re-running by hand after
      touching any of the areas below:
  - the public form's inputs (`readOnly` until the session exists) — a respondent typing
    before hydration loses the answer, and no unit test can see it
  - `auth.signOutUser` over tRPC — it once declared `z.undefined()` and was uncallable, while
    the REST route the API tests use kept working and hid it
  - the builder's autosave ordering, the tab-change flush, and publish's flush
  - the sidebar's active-route rule, and the `?form=` selection round trip

### What the browser found that no test had

Six real bugs, all of them invisible to unit tests because each one needed a real browser, a
real debounce and a real request to line up. They are recorded here because the pattern
matters more than the individual fixes:

- [x] **The public form was being served from a disk cache.** `/f/[slug]` reads the definition
      through a server caller, which Next.js knows nothing about, so the route was static: the
      first request for a slug rendered it and every later request replayed that render. A
      creator who added a question and republished was still handing respondents the old form.
      Fixed with `dynamic = "force-dynamic"`
- [x] **A late draft save could un-submit a response.** The respondent's last draft and their
      submit are two unordered requests; when the draft landed second it rewrote the same rows
      as drafts, so a response that had been accepted stopped being one. A completed session is
      now immutable
- [x] **The autosave lost its id map when an edit landed mid-save.** The baseline was only
      advanced when nothing had changed during the request, which threw away the server's ids
      for anything created in that window. The next plan then saw a local id, created the same
      question again, and the server refused it as a duplicate — permanently, because a
      rejected plan was never retried
- [x] **Publish could race the autosave it depended on.** The flush returned early when a save
      was already running, so a form could be published without the question added a moment
      earlier. Flushes are serialised now, and Publish awaits one
- [x] **Changing builder tab could lose the last edit.** The only safety net was a fetch
      started during `pagehide`, which browsers abort. Tabs now flush before navigating
- [x] **Analytics excluded today.** The range ended at midnight, so a response received an hour
      ago was not in the total. A relative preset is also recomputed on load, instead of
      replaying a window that has since gone stale

The failures were also honest about the tests themselves: a `waitForTimeout` was replaced by
waiting for the response it was waiting for, and a suite that exhausted the API's own rate
limit was fixed in the harness rather than by loosening the limiter. A failing suite that
looks like a product bug is worth more than a green one that hides it.

### Deployment checklist

- [ ] Decide the public form and API domains — cross-site cookies need
      `COOKIE_SAME_SITE=None` + `COOKIE_DOMAIN`, and a dev/prod mismatch here is a silent failure
- [ ] `COOKIE_SECURE=true`, real `JWT_SECRET`, `CORS_ORIGINS` narrowed to the web app
- [ ] Event-table retention job if `form_events` grows past a few million rows
- [x] `pnpm db:create` before `pnpm db:migrate` — migrations create tables, not databases, so a
      fresh machine and every CI run need the database to exist first
- [ ] The charts still want a human eye: screenshots at 375 / 768 / 1440, and a look with
      reduced motion on. The data behind them is verified; their legibility is not

---

## Deferred to v2

- [ ] Conditional logic (show/hide by answer) — needs a rule engine in the schema, in validation,
      in the renderer and in the builder
- [ ] `session_version` on `users` so JWTs can be revoked ("log out everywhere")
- [ ] OAuth / social sign-in — the dead `google-oauth.ts` was removed
- [ ] File upload, matrix/grid questions, respondent email gating, unique invite tokens
- [ ] `form_daily_stats` rollup table — only once a real dataset shows live aggregation is too slow
- [ ] `.gitattributes` — git currently warns about LF→CRLF on every commit
- [ ] Convert the naive `created_at` / `updated_at` columns to `timestamptz`. Every timestamp in
      the new tables is timezone-naive to match the existing convention; instants like
      `closes_at` and `completed_at` would be more correct as `timestamptz`
- [ ] Add a transaction-per-test wrapper for tests that talk to a real server — PGlite gives each
      test its own database instead

---

## Conventions (from Phase 0)

- Services raise `AppError`; tRPC codes and HTTP statuses are mapped in one place each
- Ownership lives in the service layer; `userId` is a required parameter
- Service `model.ts` files own the zod input schemas; route files re-export them and add only
  output schemas
- `labelKey` is derived once at creation and never updated
- Any `AppError` message is safe to show a user; anything else is a bug, logged in full and
  reported as a generic 500 with no stack outside development
