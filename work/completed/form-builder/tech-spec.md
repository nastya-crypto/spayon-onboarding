---
created: 2026-04-17
status: approved
branch: main
size: L
---

# Tech Spec: form-builder

## Solution

Replace the hardcoded 4-step onboarding form with a dynamic template system. Admin creates `FormTemplate` records via a new admin UI at `/dashboard/templates`. Each template holds ordered `FormStep` and `FormField` records. The template gets a permanent public URL `/onboarding/[templateId]`. Clients fill a dynamically-rendered form; each submission creates a `FormSubmission` with per-field `FieldResponse` records. The admin dashboard switches from showing `Merchant` records to showing `FormSubmission` records. The existing `OnboardingToken` single-use flow is removed.

## Architecture

### What we're building/modifying

**New — Admin UI:**
- `src/app/(dashboard)/templates/page.tsx` — template list with Edit / Copy Link / Delete actions
- `src/app/(dashboard)/templates/new/page.tsx` — template editor (create)
- `src/app/(dashboard)/templates/[id]/edit/page.tsx` — template editor (edit)
- `src/components/dashboard/TemplateEditor.tsx` — shared editor: name + steps + fields builder

**New — Public Form:**
- `src/app/(onboarding)/onboarding/[templateId]/page.tsx` — replaces `[token]/page.tsx`
- `src/app/(onboarding)/onboarding/[templateId]/DynamicForm.tsx` — renders form from template structure, localStorage autosave

**New — API Routes:**
- `src/app/api/templates/route.ts` — GET list, POST create (admin)
- `src/app/api/templates/[id]/route.ts` — GET, PATCH, DELETE (admin)
- `src/app/api/templates/[id]/public/route.ts` — GET template structure (no auth, public)
- `src/app/api/templates/[id]/submit/route.ts` — POST submit form (public, rate-limited)
- `src/app/api/submissions/route.ts` — GET list (admin)
- `src/app/api/submissions/[id]/route.ts` — GET detail (admin)
- `src/app/api/submissions/[id]/status/route.ts` — PATCH status (admin)

**Modified — Dashboard:**
- `src/app/(dashboard)/dashboard/page.tsx` — swap `MerchantsTable` for `SubmissionsTable`, replace `CreateLinkButton` with `Templates` nav button
- `src/app/(dashboard)/merchants/[id]/page.tsx` → rename/repurpose to `submissions/[id]/page.tsx` — dynamic FieldResponse rendering
- `src/components/dashboard/CreateLinkButton.tsx` → replaced by simple link to `/dashboard/templates`
- `src/components/dashboard/MerchantsTable.tsx` → replaced by `SubmissionsTable.tsx`

**Modified — Schema & Seed:**
- `prisma/schema.prisma` — add 5 new models, 2 new enums; remove `OnboardingToken`
- `prisma/seed.ts` — add default template creation
- `src/middleware.ts` — add new public routes to allowlist

**Deleted:**
- `src/app/(onboarding)/onboarding/[token]/page.tsx`
- `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx`
- `src/app/api/onboarding/create-link/route.ts`
- `src/app/api/onboarding/submit/route.ts`
- `src/app/api/merchants/route.ts` (replaced by submissions)
- `src/app/api/merchants/[id]/status/route.ts` (replaced by submissions status)

### How it works

**Template creation flow:**
Admin navigates to `/dashboard/templates` → clicks "New Template" → editor pre-populates with a "Company Name" field (protected, cannot delete) → admin adds steps and fields → POST `/api/templates` → template created → list page shows new entry with "Copy Link" button.

**Client form flow:**
Client opens `/onboarding/[templateId]` → server fetches template (404 page if not found) → `DynamicForm` renders steps from `template.steps[].fields[]` → client fills form step by step → `DynamicForm` syncs to localStorage on every field change (key: `form-draft-[templateId]`) → on submit: POST `/api/templates/[id]/submit` with FormData → server validates, stores `FormSubmission` + `FieldResponse` records, uploads files to Supabase Storage → success page shown → localStorage draft cleared.

**Dashboard flow:**
Dashboard fetches `FormSubmission` list ordered by `createdAt DESC`. Table shows: `companyName`, `templateName`, date, status badge, "Open" link. Admin opens submission → detail page fetches submission with `template.steps[].fields[]` + all `responses` → renders field label/value pairs grouped by step → status changer allows NEW → IN_REVIEW → APPROVED | REJECTED.

### Shared resources

| Resource | Owner (creates) | Consumers | Instance count |
|----------|----------------|-----------|----------------|
| Prisma client singleton | `src/lib/db.ts` | All API routes | 1 (singleton) |
| Supabase client | `src/lib/supabase.ts` | `api/templates/[id]/submit` | 1 (lazy singleton) |
| Rate limiter in-memory store | `src/lib/rate-limit.ts` | Public submit route | 1 (module-level Map) |

## Decisions

### Decision 1: FormSubmission stores templateName and fieldLabel as snapshots
**Decision:** `FormSubmission.templateName` and `FieldResponse.fieldLabel` capture values at submit time, not via join.
**Rationale:** Supports US-4 (template deletion doesn't affect existing submissions). When a template or field is deleted, submission data remains fully renderable from snapshots alone. Avoids orphan-detection logic in detail page. Supports US-13 (dashboard shows company name and template name without joins on optional FK).
**Alternatives considered:** Version-pinning templates (copy full template on each submission) — adds complexity for no benefit given single-admin usage.

### Decision 2: companyName denormalized onto FormSubmission
**Decision:** `FormSubmission.companyName` is a top-level column populated from the Company Name field at submit time.
**Rationale:** Supports US-12 (dashboard shows company name). Avoids scanning all FieldResponse rows for every dashboard list query. Company Name is guaranteed present in every template (protected field), so extraction is always possible.
**Alternatives considered:** Query FieldResponse by fieldKey at list time — adds a join or N+1 queries for each row.

### Decision 3: Company Name field is protected via isProtected flag
**Decision:** `FormField.isProtected = true` for Company Name. API DELETE `/api/templates/[id]` cascade-deletes steps/fields, but the submit endpoint enforces that `companyName` is present. Editor hides Delete button for protected fields.
**Rationale:** Supports US-8 (Company Name auto-created and undeletable). Ensures `companyName` can always be extracted at submit time.
**Alternatives considered:** Separate `companyNameFieldId` FK on FormTemplate — more coupling, same result.

### Decision 4: templateId is nullable on FormSubmission (SetNull on template delete)
**Decision:** `FormSubmission.templateId String?` with `onDelete: SetNull`. `FieldResponse.fieldId String?` with `onDelete: SetNull`.
**Rationale:** Supports US-10 (deleting template doesn't cascade-delete submissions). Submissions remain in dashboard after template deletion. Snapshots (templateName, fieldLabel) ensure full display without the FK.
**Alternatives considered:** Hard delete prevention (block DELETE if submissions exist) — contradicts user-spec decision that deletion is unrestricted.

### Decision 5: Public submit at /api/templates/[id]/submit
**Decision:** Public submit endpoint lives under template namespace, not a separate /api/forms route. Rate limit key: `submit:${templateId}:${ip}` — 5 submissions per IP per template per hour, reuses `rateLimit()` from `src/lib/rate-limit.ts`. IP extracted via `req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.ip` (Railway proxies requests, so `x-forwarded-for` carries real client IP).
**Rationale:** [TECHNICAL] Keeps template-related operations colocated. Handles Railway reverse proxy correctly.
**Alternatives considered:** `/api/onboarding/submit` (keep existing path) — contradicts removal of OnboardingToken system; separate `/api/forms/submit` — unnecessary indirection.

### Decision 6: File uploads to Supabase Storage bucket `form-uploads`
**Decision:** File field responses uploaded to Supabase Storage bucket `form-uploads`, path: `{submissionId}/{fieldId}-{timestamp}-{sanitizedFilename}`. URL stored as JSON `{url, mimeType, size}` in `FieldResponse.value`. Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf` (SVG excluded — can carry inline JS, unsafe when served directly). Max file size: 10 MB enforced server-side before upload. Filename sanitized: `name.replace(/[^a-zA-Z0-9._-]/g, '_')` (same pattern as existing logo upload in `src/app/api/onboarding/submit/route.ts`). These are **formal requirements** — Task 3 must enforce all three at the submit endpoint. **Bucket visibility: public** — `form-uploads` bucket is public; signed URLs can be added later if needed. → [USER APPROVED]
**Rationale:** Supports US file field type. Separates from existing `logos` bucket. Upload pattern reused from `src/app/api/onboarding/submit/route.ts`.
**Alternatives considered:** Inline base64 — impractical for files up to 10 MB. Reusing `logos` bucket — mixes concerns, complicates access control.

### Decision 7: Middleware updated to allow new public routes
**Decision:** Exact public paths added to NextAuth middleware allowlist: `GET /api/templates/:id/public` and `POST /api/templates/:id/submit`. The broader `/api/templates` prefix must NOT be allowlisted — that would bypass auth for all admin management routes. `/onboarding/:templateId` page is already covered by the existing `/onboarding` prefix.
**Rationale:** [TECHNICAL] Minimal allowlist reduces accidental auth bypass. Admin template management routes (`GET /api/templates`, `POST /api/templates`, `GET/PATCH/DELETE /api/templates/:id`) stay behind NextAuth.
**Alternatives considered:** Allowlisting `/api/templates` broadly — too permissive, exposes admin CRUD routes. Allowlisting by HTTP method in middleware — Next.js middleware doesn't natively filter by method without custom logic.

### Decision 8: Legacy onboarding system deleted in Wave 4
**Decision:** Old token-based routes and pages deleted after all new functionality is live (Wave 4 cleanup task).
**Rationale:** Supports US migration decision. No deprecation period needed — project is not in production.
**Alternatives considered:** Keeping old routes as redirects — unnecessary complexity for a pre-production project. Deprecation period — no external users exist who depend on old URLs.

### Decision 9: Admin routes require `role === 'ADMIN'` session check
**Decision:** All admin API routes check `session.user.role === 'ADMIN'` in addition to session existence. Return 403 if role is absent or mismatched. The `role` field is available on the JWT session via `src/lib/auth/auth-options.ts`.
**Rationale:** [TECHNICAL] Checking session existence alone (`getServerSession`) does not prevent a future non-admin user type from accessing template management. Defense in depth.
**Alternatives considered:** Route-group middleware — not currently used in this project; auth check inline in each route handler is the existing pattern.

### Decision 10: Zod input validation with explicit size limits
**Decision:** All text inputs in admin API routes validated with explicit Zod constraints: `name: z.string().min(1).max(255)`, `label: z.string().min(1).max(255)`, `placeholder: z.string().max(500).optional()`, `value: z.string().max(10000)` for text/textarea responses. Number fields: `z.number().finite()`. These limits prevent unbounded writes on all new routes.
**Rationale:** [TECHNICAL] Without `.max()` limits, any text field accepts arbitrary-length input, enabling write amplification DoS against the database.
**Alternatives considered:** Database-level constraints only — fails after the write attempt, wastes a round trip. No limits — unacceptable for public-facing endpoints.

### Decision 11: `email` field is nullable on FormSubmission
**Decision:** `FormSubmission.email` is `String?` (nullable). Email is extracted from the first `EMAIL`-type field response at submit time if present; otherwise stored as null. There is no protected email field analogous to Company Name.
**Rationale:** [TECHNICAL] User-spec says email is stored "for identification" but does not mandate it in every template. Making it required would break templates that don't include an email field. Nullable preserves flexibility.
**Alternatives considered:** Protected email field (like Company Name) — over-constrains templates that don't need email. Required with default empty string — misleading data.

## Data Models

```prisma
model FormTemplate {
  id          String           @id @default(cuid())
  name        String
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  steps       FormStep[]
  submissions FormSubmission[]

  @@map("form_templates")
}

model FormStep {
  id         String       @id @default(cuid())
  templateId String
  title      String
  order      Int
  template   FormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  fields     FormField[]

  @@unique([templateId, order])
  @@map("form_steps")
}

model FormField {
  id          String      @id @default(cuid())
  stepId      String
  label       String
  fieldKey    String      // URL-safe key, used in localStorage and value mapping
  type        FieldType
  placeholder String?
  required    Boolean     @default(true)
  isProtected Boolean     @default(false) // true = cannot be deleted (Company Name)
  order       Int
  step        FormStep    @relation(fields: [stepId], references: [id], onDelete: Cascade)
  responses   FieldResponse[]

  @@unique([stepId, order])
  @@map("form_fields")
}

model FormSubmission {
  id           String           @id @default(cuid())
  templateId   String?          // nullable: set to null when template deleted (SetNull)
  templateName String           // snapshot of template.name at submit time
  companyName  String           // extracted from Company Name field at submit time
  email        String?          // nullable: extracted from first EMAIL field if present
  status       SubmissionStatus @default(NEW)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  template     FormTemplate?    @relation(fields: [templateId], references: [id], onDelete: SetNull)
  responses    FieldResponse[]

  @@map("form_submissions")
}

model FieldResponse {
  id           String         @id @default(cuid())
  submissionId String
  fieldId      String?        // nullable: set to null when field deleted (SetNull)
  fieldLabel   String         // snapshot of field.label at submit time
  value        String         @db.Text // plain string; JSON for file: {"url","mimeType","size"}
  submission   FormSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  field        FormField?     @relation(fields: [fieldId], references: [id], onDelete: SetNull)

  @@map("field_responses")
}

enum FieldType {
  TEXT
  EMAIL
  URL
  NUMBER
  TEXTAREA
  FILE
  CHECKBOX
}

enum SubmissionStatus {
  NEW
  IN_REVIEW
  APPROVED
  REJECTED
}
```

**Remove:** `OnboardingToken` model and all dependent code.

**Retain:** `Merchant` model remains in `prisma/schema.prisma` unchanged — not modified or deleted. Preserved for future document generation (per user-spec technical decision). Task 9 does not touch this model.

**Seed — default template** (`prisma/seed.ts`): After creating admin user, create a `FormTemplate` named "Standard Onboarding" with 4 steps mirroring the current hardcoded form (About the Project / Contacts / Business Profile / Documents), including Company Name as a protected field.

## Dependencies

### New packages
None — all required functionality is available via existing stack.

### Using existing (from project)
- `src/lib/db.ts` — Prisma singleton, all new API routes
- `src/lib/rate-limit.ts` — rate limiting for public submit endpoint
- `src/lib/supabase.ts` — file upload for FILE-type field responses
- `zod` — request validation in all new API routes
- `src/lib/auth/auth-options.ts` — NextAuth session for admin route protection
- `src/components/onboarding/ProgressBar.tsx` — reused in DynamicForm
- Tailwind CSS — all new UI components follow existing patterns

## Testing Strategy

**Feature size:** L

### Unit tests

Utility `src/lib/form-validation.ts` exports `buildZodSchema(fields: FormField[])` — tested in isolation:
- **Field type schema — valid inputs:** TEXT → z.string(), EMAIL → z.string().email(), NUMBER → z.number(), URL → z.string().url(), CHECKBOX → z.boolean()
- **Field type schema — invalid inputs:** EMAIL field rejects non-email string; URL field rejects non-URL; required field rejects empty value
- **Field type schema — optional fields:** optional field passes with empty/undefined value

Route-level (API handlers):
- **Template create — happy path:** POST `/api/templates` with valid body returns 201; response includes auto-added Company Name field with `isProtected: true`
- **Template create — validation:** POST with no steps returns 400; POST with empty fields array in a step returns 400
- **Template PATCH — protected field removal:** PATCH body that omits the `isProtected` Company Name field returns 400 "Company Name field cannot be removed"
- **Submit — happy path:** POST `/api/templates/[id]/submit` with valid FormData returns 201; `FormSubmission` created with correct `companyName` and `templateName` snapshots; `FieldResponse` records created for every submitted field
- **Submit — template not found:** returns 404
- **Submit — required field missing:** returns 400
- **Submit — rate limit:** 6th request from same IP+templateId within window returns 429
- **Admin auth — role check:** request without ADMIN role session returns 403 on all admin routes
- **Status transitions — valid:** PATCH `/api/submissions/[id]/status` with NEW→IN_REVIEW returns 200
- **Status transitions — invalid:** unrecognised status value returns 400
- **localStorage autosave:** `DynamicForm` writes `form-draft-[templateId]` on field change; restores on mount; clears on successful submit; silently no-ops when localStorage throws

### Integration tests
None — agreed in user-spec (no test infrastructure, not worth bootstrapping for v1).

### E2E tests
None — agreed in user-spec.

## Agent Verification Plan

**Source:** user-spec "Как проверить" section.

### Verification approach
All verification is manual (user-driven). No MCP tools required — app runs locally via `npm run dev`. Agent can assist by opening `localhost:3000` for spot checks but primary verification is user-initiated.

### Tools required
None (no MCP tools). User verifies via browser at `localhost:3000`.

## Risks

| Risk | Mitigation |
|------|-----------|
| Dashboard breaks if Merchant queries not fully replaced | Wave 3 task explicitly replaces `MerchantsTable` + merchants API with `SubmissionsTable` + submissions API |
| File upload errors in production (Supabase bucket missing) | Seed or README documents that `form-uploads` bucket must be created in Supabase dashboard before deploy |
| `prisma migrate deploy` fails on Railway if DB has stale state | Run `prisma migrate reset --force` locally against prod DB before deploy (documented in seed.ts header) |
| companyName field not found at submit time (template misconfigured) | Submit endpoint returns 400 "Company Name field is required" if protected field response is missing |
| In-memory rate limiter ineffective across multiple Railway instances | Rate-limit `Map` is process-local — does not share state across replicas. Acceptable for single-instance MVP; if Railway scales to multiple instances, replace with Redis-based limiter |
| Duplicate submissions on double-click or network retry | No idempotency key. Frontend disables Submit button after first click. Acceptable for MVP; unique constraint not added to avoid overcomplicating schema |

## User-Spec Deviations

- **Added: `form-uploads` Supabase Storage bucket** (not mentioned in user-spec). Reason: FILE-type fields need a storage location; separating from `logos` bucket is standard practice. → [TECHNICAL]
- **Bucket visibility: public** — `form-uploads` bucket is public. Signed URLs deferred to future iteration. → [USER APPROVED]
- **Added: `fieldKey` on FormField** (not in user-spec). Reason: stable machine-readable key for localStorage draft mapping and future document generation placeholders (`{{fieldKey}}`). Auto-generated from label (kebab-case). → [TECHNICAL]
- **Added: `isProtected` flag on FormField** (not in user-spec, implied by "Company Name cannot be deleted"). Reason: enforces the invariant at data layer and API layer, not just UI layer. → [TECHNICAL]
- **Orphan FieldResponse rendering** — user-spec says "orphan responses are skipped". Tech-spec renders them using the `fieldLabel` snapshot (fieldId = null after field deletion). Reason: admin should see all data the client submitted, even for fields that were later removed. → [USER APPROVED]
- **PATCH template strategy** — user-spec describes editing fields/steps but doesn't specify the API contract. Tech-spec uses full-replacement PATCH: `PATCH /api/templates/[id]` accepts `{name, steps: [{title, fields: [...]}]}` and replaces all steps/fields atomically (delete old + insert new in a transaction). Existing FieldResponse records are unaffected (SetNull on fieldId). → [TECHNICAL]
- **FILE upload restrictions** — user-spec mentions file field type but doesn't specify limits. Tech-spec: allowed MIME types (JPEG, PNG, PDF — SVG excluded due to XSS risk), max 10 MB. → [TECHNICAL]
- **`email` nullable on FormSubmission** — user-spec says email is stored for identification but doesn't mandate it in every template. Tech-spec makes `email String?`. Extracted from first EMAIL-type field if present. → [TECHNICAL]
- **Copy Link URL construction** — user-spec says `[NEXTAUTH_URL]/onboarding/[templateId]`. Tech-spec uses `process.env.NEXTAUTH_URL` server-side for the Copy Link button value (not `window.location.origin`, which could be wrong behind a proxy). → [TECHNICAL]

## Acceptance Criteria

- [ ] `prisma migrate deploy` runs without errors on fresh DB
- [ ] All new API routes return correct HTTP status codes (200/201/400/401/403/404/429/500)
- [ ] POST `/api/templates/[id]/submit` returns 429 on 6th request from same IP within 1 hour
- [ ] DELETE `/api/templates/[id]` with protected Company Name field returns 200; field is cascade-deleted but `FormSubmission` records remain
- [ ] `FormSubmission.companyName` and `templateName` populated correctly at submit time
- [ ] `FieldResponse.fieldLabel` snapshot preserved after FormField deletion
- [ ] Unit tests pass: field type validation, rate limiting, companyName extraction, localStorage
- [ ] No TypeScript compilation errors (`next build` succeeds)
- [ ] Existing auth flow (login → dashboard) unchanged

## Implementation Tasks

### Wave 1: Database Schema

#### Task 1: Prisma schema migration
- **Description:** Establish the new data model foundation for the form-builder feature. All subsequent API and UI tasks depend on this schema being in place. Removes the legacy `OnboardingToken` table and seeds the default template so the system is usable immediately after deploy.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor
- **Files to modify:** `prisma/schema.prisma`, `prisma/seed.ts`
- **Files to read:** `work/form-builder/tech-spec.md`, `work/form-builder/code-research.md`

### Wave 2: Backend APIs (parallel, all depend on Task 1)

#### Task 2: Template management API
- **Description:** Implement admin CRUD for form templates. All routes must verify `session.user.role === 'ADMIN'` (Decision 9). PATCH uses full-replacement strategy (Decision — PATCH template strategy in User-Spec Deviations). All text inputs validated with Zod `.max()` limits per Decision 10. POST auto-inserts Company Name protected field.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/templates/route.ts` (new), `src/app/api/templates/[id]/route.ts` (new), `src/lib/form-validation.ts` (new — exports `buildZodSchema(fields)`)
- **Files to read:** `src/app/api/merchants/route.ts`, `src/lib/db.ts`, `src/lib/auth/auth-options.ts`, `work/form-builder/tech-spec.md`

#### Task 3: Public form API
- **Description:** Implement the public template fetch and form submission endpoints. Submit endpoint must enforce all formal file upload requirements from Decision 6: MIME allowlist (JPEG/PNG/PDF only), 10 MB max, filename sanitization. Rate limit key: `submit:${templateId}:${ip}` with IP from `x-forwarded-for` header first value. Middleware allowlist uses exact paths only (Decision 7). `public` endpoint must not expose `isProtected` or `fieldKey` in response.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/templates/[id]/public/route.ts` (new), `src/app/api/templates/[id]/submit/route.ts` (new), `src/middleware.ts`
- **Files to read:** `src/app/api/onboarding/submit/route.ts`, `src/lib/rate-limit.ts`, `src/lib/supabase.ts`, `src/lib/db.ts`, `src/lib/form-validation.ts` (new, created in T1 or T2)

#### Task 4: Submissions API
- **Description:** Implement admin endpoints for reviewing submissions. All routes verify `session.user.role === 'ADMIN'` (Decision 9). List endpoint (`GET /api/submissions`) returns companyName/templateName/status/createdAt — **email excluded from list response** (returned only in detail). Detail endpoint returns full FieldResponse list including orphans (fieldId = null). Status transitions: NEW→IN_REVIEW→APPROVED|REJECTED only.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/submissions/route.ts` (new), `src/app/api/submissions/[id]/route.ts` (new), `src/app/api/submissions/[id]/status/route.ts` (new)
- **Files to read:** `src/app/api/merchants/route.ts`, `src/app/api/merchants/[id]/status/route.ts`, `src/lib/db.ts`

### Wave 3: UI (parallel, T5/T6/T7 depend on T2+T4, T8 depends on T3)

#### Task 5: Templates admin pages
- **Description:** Build the template list and editor UI in English. List page includes a confirm dialog before deletion (AC10). Editor enforces AC7: save is blocked if there are no steps or any step has no fields. Copy Link button passes `process.env.NEXTAUTH_URL` as the base URL (not `window.location.origin`). Delete button hidden for `isProtected` fields. All UI text in English.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open `localhost:3000/dashboard/templates` → create template with 2 steps and 3 fields → template appears in list with Copy Link button.
- **Files to modify:** `src/app/(dashboard)/templates/page.tsx` (new), `src/app/(dashboard)/templates/new/page.tsx` (new), `src/app/(dashboard)/templates/[id]/edit/page.tsx` (new), `src/components/dashboard/TemplateEditor.tsx` (new)
- **Files to read:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/MerchantsTable.tsx`, `work/form-builder/tech-spec.md`

#### Task 6: Dashboard refactor
- **Description:** Switch the dashboard from showing `Merchant` records to showing `FormSubmission` records, and replace the single-use link button with a navigation entry to the templates section. `SubmissionsTable` shows: companyName, templateName, date, status badge. `StatsCard` counts are switched from Merchant status counts to SubmissionStatus counts (NEW/IN_REVIEW/APPROVED/REJECTED). All UI text in English.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open `localhost:3000/dashboard` → "Templates" button visible → after submitting a test form, submission row appears in table.
- **Files to modify:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/CreateLinkButton.tsx`, `src/components/dashboard/MerchantsTable.tsx`, `src/components/dashboard/StatsCard.tsx`
- **Files to read:** `src/app/api/submissions/route.ts`, `src/components/dashboard/MerchantsTable.tsx`, `src/components/dashboard/StatsCard.tsx`

#### Task 7: Submission detail page
- **Description:** Repurpose `/dashboard/merchants/[id]` as `/dashboard/submissions/[id]`. Renders all field responses grouped by step. When `submission.templateId` is null (deleted template), show a note "Template was deleted" but still render all FieldResponse data. FILE-type responses rendered as download/anchor links — href must be validated to `http://` or `https://` only before rendering to prevent `javascript:` URI XSS. All labels in English.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open a submission detail page → all submitted field values visible → status change works.
- **Files to modify:** `src/app/(dashboard)/submissions/[id]/page.tsx` (new), `src/components/dashboard/StatusChanger.tsx`
- **Files to read:** `src/app/(dashboard)/merchants/[id]/page.tsx`, `src/components/dashboard/StatusChanger.tsx`, `src/app/api/submissions/[id]/route.ts`

#### Task 8: Dynamic public form
- **Description:** Build `/onboarding/[templateId]/page.tsx` that fetches template via `GET /api/templates/[id]/public` and renders `DynamicForm`. `DynamicForm` renders steps from `template.steps[].fields[]` using the existing `ProgressBar`, step navigation (Back/Next/Submit), real-time per-field validation based on `FieldType` and `required`, EN/RU toggle (same pattern as existing `OnboardingForm`). localStorage autosave: on every field change write `form-draft-[templateId]` → JSON of all field values; on mount read and pre-fill; on successful submit clear draft. Show "This link is no longer available" page if template fetch returns 404.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open copied template link → form renders correctly → fill halfway → close tab → reopen → data restored → complete and submit → "Application submitted!" shown.
- **Files to modify:** `src/app/(onboarding)/onboarding/[templateId]/page.tsx` (new), `src/app/(onboarding)/onboarding/[templateId]/DynamicForm.tsx` (new)
- **Files to read:** `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx`, `src/components/onboarding/ProgressBar.tsx`, `src/app/api/templates/[id]/public/route.ts`

### Wave 4: Legacy Cleanup (depends on all Wave 3 tasks)

#### Task 9: Remove legacy onboarding system
- **Description:** Remove the legacy single-use token onboarding system now that all clients have been migrated to the new template-based flow. Eliminates dead code, prevents accidental use of deprecated endpoints, and reduces middleware complexity. Does NOT touch the `Merchant` model — it is retained per user-spec.
- **Skill:** code-writing
- **Reviewers:** code-reviewer
- **Files to modify:** `src/middleware.ts`
- **Files to read:** `src/app/api/onboarding/create-link/route.ts`, `src/app/api/onboarding/submit/route.ts`, `src/app/(onboarding)/onboarding/[token]/page.tsx`, `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx`, `src/app/api/merchants/route.ts`, `src/app/api/merchants/[id]/status/route.ts`
- **Files to delete:** `src/app/api/onboarding/create-link/route.ts`, `src/app/api/onboarding/submit/route.ts`, `src/app/(onboarding)/onboarding/[token]/page.tsx`, `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx`, `src/app/api/merchants/route.ts`, `src/app/api/merchants/[id]/status/route.ts`

### Audit Wave

#### Task 10: Code Audit
- **Description:** Full-feature code quality audit. Read all source files created/modified in this feature. Review holistically for cross-component issues: duplicate resource initialization, shared resources compliance with Architecture decisions, architectural consistency across API routes and UI components. Write audit report.
- **Skill:** code-reviewing
- **Reviewers:** none
- **Files to read:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`, `src/app/api/templates/[id]/public/route.ts`, `src/app/api/templates/[id]/submit/route.ts`, `src/app/api/submissions/route.ts`, `src/app/api/submissions/[id]/route.ts`, `src/app/api/submissions/[id]/status/route.ts`, `src/app/(dashboard)/templates/page.tsx`, `src/app/(dashboard)/templates/new/page.tsx`, `src/app/(dashboard)/templates/[id]/edit/page.tsx`, `src/components/dashboard/TemplateEditor.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/submissions/[id]/page.tsx`, `src/app/(onboarding)/onboarding/[templateId]/page.tsx`, `src/app/(onboarding)/onboarding/[templateId]/DynamicForm.tsx`, `src/middleware.ts`

#### Task 11: Security Audit
- **Description:** Full-feature security audit. Read all source files created/modified in this feature. Analyze for OWASP Top 10: public submit endpoint (injection, rate limiting, file upload validation), admin routes (auth bypass), FieldResponse value storage (XSS in rendering), Supabase Storage access. Write audit report.
- **Skill:** security-auditor
- **Reviewers:** none
- **Files to read:** `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`, `src/app/api/templates/[id]/public/route.ts`, `src/app/api/templates/[id]/submit/route.ts`, `src/app/api/submissions/route.ts`, `src/app/api/submissions/[id]/route.ts`, `src/app/api/submissions/[id]/status/route.ts`, `src/app/(onboarding)/onboarding/[templateId]/DynamicForm.tsx`, `src/app/(dashboard)/submissions/[id]/page.tsx`, `src/middleware.ts`

#### Task 12: Test Audit
- **Description:** Full-feature test quality audit. Read all test files created in this feature. Verify coverage of field type validation, rate limiting, companyName extraction, localStorage autosave. Check for meaningful assertions (not testing mocks). Write audit report.
- **Skill:** test-master
- **Reviewers:** none
- **Files to read:** All test files in `src/__tests__/` and `src/app/` matching `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` created for this feature

### Final Wave

#### Task 13: Pre-deploy QA
- **Description:** Acceptance testing: run all unit tests, manually verify all 16 acceptance criteria from user-spec and 9 from tech-spec. Follow the 6-step verification plan from user-spec "Как проверить" section. Document results.
- **Skill:** pre-deploy-qa
- **Reviewers:** none
- **Files to read:** N/A (runs tests and checks browser)

#### Task 14: Deploy
- **Description:** Push to `main` → Railway auto-deploys via Dockerfile. Verify `prisma migrate deploy` runs in build step. Confirm health check passes at `/api/health`. Manually create `form-uploads` bucket in Supabase dashboard if not already present.
- **Skill:** deploy-pipeline
- **Reviewers:** none
- **Files to read:** N/A
