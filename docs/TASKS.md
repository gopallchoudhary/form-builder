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

- [x] Untrack `creds.md`, add to `.gitignore`
- [x] Add root `.env.example` (`setup.sh` already expected it)
- [x] **Rotate the dev password** that was committed in `1bba5e4` — it is in history

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
- [ ] Confirm `users` rows survive on the existing dev database

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
- [ ] `utils/theme.ts` — the 4 curated presets, the single source both web and API read
- [ ] `utils/answer-validation.ts` — the `kind` → zod → normalised value mapper (one place)
- [ ] `question-settings.ts` — **discriminated union** of per-kind `settings`.
      The column exists and the builder does not write it yet, so validate it the moment
      something starts reading it back.

### Services

- [x] `question/` — basic CRUD, soft delete, write-once `labelKey`, ownership enforced
- [ ] `question/` — page assignment, `reorder` (renumber `position` in one transaction),
      `duplicate`, and per-kind `settings` validation
- [ ] `form/` — `updateSettings`, `delete`, `publish` (bumps `version`, stamps `published_at`),
      `unpublish`, slug editing
- [ ] `form/` — `getFullDefinition` (form + pages + questions)
- [ ] `form-page/` — CRUD + `reorder`
- [ ] `access/` (respondent side) — `getPublishedFormBySlug` (never leaks creator email or draft
      state), `unlock(password)`, `getOrResumeSession`, `saveDraft` (idempotent upsert),
      `submit` (re-validates every answer, enforces max-responses / closes-at / one-per-device
      in a single transaction)
- [ ] `response/` — paginated list with filters, `toCsv` (hand-rolled, no dependency)
- [ ] `analytics/` — `formSummary`, `overview`, `funnel`, `questionDropOff`,
      `answerDistribution`, `timeToComplete` — all scoped to the owner's forms

### Tests

- [x] `slug.test.ts` — charset, 64-char limit, random suffix, no-trailing-hyphen
- [ ] `question-settings` union — valid + invalid per kind
- [ ] `answer-validation` — every kind, including multi-select and address
- [ ] `access.submit` — enforces each limit, is idempotent
- [ ] Integration tests for ownership on every service method (needs `DATABASE_URL_TEST`)

### Gate

- [ ] `pnpm test` green with meaningful coverage of the new services
- [ ] `pnpm check-types` green

---

## Phase 3 — tRPC

Goal: expose the services as a typed, documented API.

- [ ] Context: add a rate-limit middleware keyed on `ctx.clientIp`
- [ ] `form` router — `createForm` `getForm` `updateFormSettings` `listForms` `deleteForm`
      `publishForm` `unpublishForm`
- [ ] `formPage` router — `createPage` `updatePage` `deletePage` `reorderPages`
- [ ] `question` router — `createQuestion` `updateQuestion` `deleteQuestion`
      `duplicateQuestion` `reorderQuestions`
- [ ] `public` router — `getFormBySlug` `unlockForm` `resumeSession` `saveDraft` `submitForm`
      (all `protect: false`, all rate limited, tighter limits on `unlockForm` and `submitForm`)
- [ ] `response` router — `listResponses` `exportCsv`
- [ ] `analytics` router — `getFormAnalytics` `getOverviewAnalytics`
- [ ] `auth` router — add the new procedures
- [ ] `.meta({ openapi })` on every procedure, with `summary` and correct `protect`
- [ ] Delete `packages/trpc/server/schema.ts` (`zodUndefinedModel` is unused now)
- [ ] Verify the OpenAPI document at `/docs`

### Tests

- [ ] Supertest against the Express app: auth, ownership, validation, rate limits, 404s

### Gate

- [ ] `pnpm lint` / `check-types` / `test` green
- [ ] OpenAPI document reviewed by hand

---

## Phase 4 — `apps/web` foundation

Goal: routes, auth gating, state management, and a single renderer reused in two places.

### Routes

- [ ] `/` → redirect by session
- [ ] `/dashboard` — overview analytics
- [ ] `/dashboard/forms` — list + create
- [ ] `/dashboard/forms/[formId]/build` — builder
- [ ] `/dashboard/forms/[formId]/settings`
- [ ] `/dashboard/forms/[formId]/share`
- [ ] `/dashboard/forms/[formId]/responses`
- [ ] `/dashboard/forms/[formId]/analytics`
- [ ] `/f/[slug]` — public form
- [ ] `/f/[slug]/thanks`

### Auth gating

- [ ] `trpc/server-caller.ts` — server-side caller that **forwards cookies** from `next/headers`
      (the current `create-client` sets `credentials: "include"`, which Node ignores)
- [ ] Guard the dashboard in a server component and redirect to `/login`
- [ ] **Fix the `/dashboard` infinite redirect** (`app/dashboard/page.tsx` replaces
      `/dashboard` with `/dashboard`)
- [ ] `useUser` should distinguish "not signed in" from "still loading", otherwise every
      protected page bounces to `/login` on first paint

### Zustand stores

- [ ] `stores/builder-store.ts` — form definition, `selectedQuestionId`, `activeTab`,
      `saving` state, undo/redo history
- [ ] `stores/builder-store` — debounced autosave middleware serialising the definition into the
      granular tRPC mutations
- [ ] `stores/runner-store.ts` — respondent runtime: `sessionId`, layout-aware cursor, answers
      draft, `touched`/`errors`, progress, submit state
- [ ] `stores/runner-store` — `persist` to `localStorage` so a refresh mid-form loses nothing,
      reconciled with the server draft on resume
- [ ] `stores/analytics-store.ts` — date range + granularity
- [ ] Use `useShallow` for selectors to avoid re-render storms

### Hooks

- [ ] `hooks/api/{form,form-page,question,public,response,analytics}/` mirroring the routers
- [ ] Fix the invalidation bugs in `hooks/api/form`: `createField` and `deleteField`
      invalidate `getField` with no input, and delete does not clear `getField`

### Renderer

- [ ] Extract the respondent form into one component tree taking a `FormDefinition`
- [ ] Mount it from `/f/[slug]` with server data **and** from a live Preview tab with draft
      store data — WYSIWYG by construction

### Gate

- [ ] Signed-out visitors are redirected server-side, not by a client flash
- [ ] `pnpm lint` / `check-types` / `test` green

---

## Phase 5 — Builder UI

- [ ] Build tab — left canvas: pages as sections in `PAGED`, flat list in `STEP`;
      questions as cards; **dnd-kit drag reorder** (deps and the grip icon are present, never wired)
- [ ] Question inspector — label, helper text, placeholder, required toggle, kind picker
- [ ] Kind-specific config controls driven by the `settings` union — options editor for choices,
      scale + style + labels for rating, field toggles for address, min/max for number/date/length
- [ ] Add / duplicate / delete question, with a real empty state
- [ ] Settings tab — theme preset picker with live thumbnails, password on/off, max responses,
      close date, one-per-device, show progress, back button, thank-you copy + redirect
- [ ] Share tab — slug editor, copyable link, QR (client-side `qrcode`: inline SVG + PNG download),
      publish state, live/published indicator
- [ ] Preview tab — device-width toggle, theme-aware
- [ ] Status chips for `DRAFT` / `PUBLISHED` / `CLOSED`, a password badge
- [ ] Publish is gated on a valid form; the audience can never see a half-finished form

### Gate

- [ ] Create → build → autosave → publish → share all work
- [ ] Keyboard reachable, visible focus, respects `prefers-reduced-motion`
- [ ] Responsive to 375px

---

## Phase 6 — Respondent renderer

- [ ] Password gate → `unlockForm` → signed form-scoped cookie
- [ ] Session bootstrap: emit `VIEW`, resume an `IN_PROGRESS` session if the device cookie has
      one, else `START`
- [ ] `STEP` — one question, keyboard-first (`Enter` next, `Shift+Enter` back), auto-advance on
      `YES_NO` / single choice, per-question validation before advancing, no page reload
- [ ] `PAGED` — page title + grouped questions, `PAGE_VIEW` event, validate the page before Next
- [ ] Autosave the draft on every step / page change so Resume works after a closed tab
- [ ] `SUBMIT` → full server-side revalidation → thank-you
- [ ] Dedicated designed states for: closed, past the deadline, limit reached, already submitted
- [ ] **Time to complete** depends on the first `VIEW` firing before anything else

### Gate

- [ ] Both layouts complete end to end, with and without a password
- [ ] Refresh mid-form keeps the answers

---

## Phase 7 — Responses + export

- [ ] Response table (`data-table`, `canvas-soft` header per `ex-data-table-cell`,
      mono-caps eyebrow headers)
- [ ] Per-question answer rendering including address objects and multi-select arrays
- [ ] Filters (date range, completeness) + pagination
- [ ] CSV export straight from `form_sessions` + `form_answers`
- [ ] Delete a single response

### Gate

- [ ] An exported CSV survives a question being renamed or deleted, because the label is
      denormalised onto each answer

---

## Phase 8 — Analytics

Dashboard (all forms) and per form.

- [ ] KPI row — responses, views, completion rate, average time
- [ ] Trend — daily views / starts / submissions with a range picker
- [ ] Funnel — views → starts → completes with drop-off percentages
- [ ] Question drop-off — reached vs answered per question, highlighting the worst step
- [ ] Answer distribution — bar / donut per choice, rating and yes-no question
- [ ] Time to complete — histogram with average and median
- [ ] Reuse the existing shadcn `chart.tsx` + Recharts 3.8; client components fed by the
      `analytics` procedures
- [ ] Chart palette mapped to `DESIGN.md` tokens (see Phase 9)

### Gate

- [ ] Numbers in the UI match a direct SQL query
- [ ] Every form only ever sees its owner's data

---

## Phase 9 — Design system & hardening

`DESIGN.md` is the source of truth. `/frontend-design` supplies the aesthetic direction.

### Two token layers over one Tailwind build

- [ ] **Creator console** — remap `globals.css` from the shadcn neutral defaults to `DESIGN.md`:
      `canvas-soft` background, `canvas` cards, `ink` foreground, `primary` lime,
      `positive` / `negative` / `warning`, `mute` body
- [ ] Rescale the radius variables so `{rounded.md}` = 12 on inputs and `{rounded.xl}` = 24 on
      cards and buttons (currently `--radius: 0.625rem`)
- [ ] Map the `{typography.*}` scale to `--text-*`; display at **weight 900**, body Inter
- [ ] Fonts: `DESIGN.md:373` allows Geist 800 as a display substitute and the woff2 files are
      already local, so this can ship with no network dependency at build
- [ ] Chart palette: lime is too light to carry a data series, so `--chart-1..5` map to
      `ink-deep`, `accent-cyan`, `accent-orange`, `positive`, `warning`. This also honours
      `DESIGN.md:537` — success uses `positive`, never the brand lime
- [ ] **Form theme presets** — `data-theme="sage|ink|pale|peach"` remapping the same variables.
      `pale` switches the CTA to `ink` because `DESIGN.md:543` bans a green CTA on green
- [ ] Signature element: the **progress rail** — a pill-shaped lime track that fills as the
      respondent advances, segmenting per page in `PAGED`. One memorable thing; everything else
      stays flat
- [ ] Remove the leftover template branding (`Acme Inc.`, the shadcn GitHub link, the hardcoded
      shadcn user, `navClouds` pointing at `#`)
- [ ] Audit the UI copy — plain verbs, sentence case, one name per action

### Hardening

- [ ] Playwright: signup → create → build → publish → fresh context → unlock → complete → submit →
      thank-you → response in the creator's table and the counts move
- [ ] Playwright: the `PAGED` variant, and a resume-after-refresh test
- [ ] Vitest integration tests for services against a real database
- [ ] CI running `lint` + `check-types` + `test` + `build`
- [ ] Self-review pass: screenshots at 375 / 768 / 1440, keyboard walkthrough, reduced motion
- [ ] `DESIGN.md` updated to match whatever ships

### Deployment checklist

- [ ] Decide the public form and API domains — cross-site cookies need
      `COOKIE_SAME_SITE=None` + `COOKIE_DOMAIN`, and a dev/prod mismatch here is a silent failure
- [ ] `COOKIE_SECURE=true`, real `JWT_SECRET`, `CORS_ORIGINS` narrowed to the web app
- [ ] Event-table retention job if `form_events` grows past a few million rows

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
