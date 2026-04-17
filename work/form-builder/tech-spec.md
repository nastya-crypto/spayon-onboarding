---
created: 2026-04-17
status: draft
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
**Decision:** Public submit endpoint lives under template namespace, not a separate /api/forms route.
**Rationale:** [TECHNICAL] Keeps template-related operations colocated. Rate limit key: `submit:${templateId}:${ip}` — 5 submissions per IP per template per hour, reuses existing `rateLimit()` utility from `src/lib/rate-limit.ts`.
**Alternatives considered:** `/api/onboarding/submit` (keep existing path) — contradicts removal of OnboardingToken system; separate `/api/forms/submit` — unnecessary indirection.

### Decision 6: File uploads to Supabase Storage bucket `form-uploads`
**Decision:** File field responses uploaded to Supabase Storage bucket `form-uploads`, path: `{submissionId}/{fieldId}-{timestamp}-{filename}`. Public URL stored as JSON `{url, mimeType, size}` in `FieldResponse.value`.
**Rationale:** Supports US file field type. Separates from existing `logos` bucket. Same upload pattern as current `src/lib/supabase.ts`.
**Alternatives considered:** Inline base64 — impractical for files. Reusing logos bucket — mixes concerns.

### Decision 7: Middleware updated to allow new public routes
**Decision:** Add `/onboarding` (already allowed by prefix match) and `/api/templates` public GET + submit patterns to NextAuth middleware allowlist.
**Rationale:** [TECHNICAL] `/onboarding/[templateId]` is public (no login required). `/api/templates/[id]/submit` is public. All `/api/templates` management routes remain admin-only.

### Decision 8: Legacy onboarding system deleted in Wave 4
**Decision:** Old token-based routes and pages deleted after all new functionality is live (Wave 4 cleanup task).
**Rationale:** Supports US migration decision. No deprecation period needed — project is not in production.

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
  email        String
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
- `FormField` type validation: each `FieldType` produces correct Zod schema (TEXT → z.string(), EMAIL → z.string().email(), NUMBER → z.number(), etc.)
- `isProtected` field: Company Name field cannot be deleted via API (returns 403)
- Rate limiting: 6th request within window returns 429
- `companyName` extraction: submit endpoint correctly extracts Company Name from FormData
- localStorage autosave: `DynamicForm` reads/writes `form-draft-[templateId]` on field change and clears on successful submit

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

## User-Spec Deviations

- **Added: `form-uploads` Supabase Storage bucket** (not mentioned in user-spec). Reason: FILE-type fields need a storage location; separating from `logos` bucket is standard practice. → [PENDING USER APPROVAL]
- **Added: `fieldKey` on FormField** (not in user-spec). Reason: stable machine-readable key for localStorage draft mapping and future document generation placeholders (`{{fieldKey}}`). Auto-generated from label (kebab-case). → [TECHNICAL]
- **Added: `isProtected` flag on FormField** (not in user-spec, implied by "Company Name cannot be deleted"). Reason: enforces the user-spec invariant at data layer and API layer, not just UI layer. → [TECHNICAL]

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
- **Description:** Add `FormTemplate`, `FormStep`, `FormField`, `FormSubmission`, `FieldResponse` models and `FieldType`, `SubmissionStatus` enums to `prisma/schema.prisma`. Remove `OnboardingToken` model. Update `prisma/seed.ts` to create default "Standard Onboarding" template with 4 steps mirroring the current form, with Company Name as protected field.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor
- **Files to modify:** `prisma/schema.prisma`, `prisma/seed.ts`
- **Files to read:** `work/form-builder/tech-spec.md` (Data Models section), `work/form-builder/code-research.md`

### Wave 2: Backend APIs (parallel, all depend on Task 1)

#### Task 2: Template management API
- **Description:** Implement admin CRUD for form templates: `GET /api/templates` (list all), `POST /api/templates` (create with steps + fields), `GET /api/templates/[id]` (with steps/fields), `PATCH /api/templates/[id]` (update), `DELETE /api/templates/[id]` (cascade-deletes steps/fields, submissions remain). All routes require admin auth. Protected fields (isProtected=true) cannot be deleted via PATCH.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/templates/route.ts` (new), `src/app/api/templates/[id]/route.ts` (new)
- **Files to read:** `src/app/api/merchants/route.ts`, `src/lib/db.ts`, `src/lib/auth/auth-options.ts`, `work/form-builder/tech-spec.md`

#### Task 3: Public form API
- **Description:** Implement `GET /api/templates/[id]/public` (returns template with steps/fields, no auth required, 404 if not found) and `POST /api/templates/[id]/submit` (public, rate-limited 5/IP/hour, validates required fields, extracts companyName, stores FormSubmission + FieldResponse, handles FILE uploads to Supabase `form-uploads` bucket). Update `src/middleware.ts` to allow these public routes.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/templates/[id]/public/route.ts` (new), `src/app/api/templates/[id]/submit/route.ts` (new), `src/middleware.ts`
- **Files to read:** `src/app/api/onboarding/submit/route.ts`, `src/lib/rate-limit.ts`, `src/lib/supabase.ts`, `src/lib/db.ts`

#### Task 4: Submissions API
- **Description:** Implement admin endpoints for reviewing submissions: `GET /api/submissions` (list, ordered by createdAt DESC, includes companyName/templateName/status), `GET /api/submissions/[id]` (detail with template steps/fields + all FieldResponse), `PATCH /api/submissions/[id]/status` (update status, valid transitions: NEW→IN_REVIEW→APPROVED|REJECTED). All require admin auth.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, security-auditor, test-reviewer
- **Files to modify:** `src/app/api/submissions/route.ts` (new), `src/app/api/submissions/[id]/route.ts` (new), `src/app/api/submissions/[id]/status/route.ts` (new)
- **Files to read:** `src/app/api/merchants/route.ts`, `src/app/api/merchants/[id]/status/route.ts`, `src/lib/db.ts`

### Wave 3: UI (parallel, T5/T6/T7 depend on T2+T4, T8 depends on T3)

#### Task 5: Templates admin pages
- **Description:** Build `/dashboard/templates` list page (table: name, createdAt, Edit/Copy Link/Delete buttons) and template editor (`/dashboard/templates/new` + `/dashboard/templates/[id]/edit`). Editor: template name input, step list with Add Step / ↑↓ / Delete, per-step field list with Add Field / ↑↓ / Delete (hidden for isProtected). Field form: type dropdown, label, placeholder, required toggle. On save: calls template API.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open `localhost:3000/dashboard/templates` → create template with 2 steps and 3 fields → template appears in list with Copy Link button.
- **Files to modify:** `src/app/(dashboard)/templates/page.tsx` (new), `src/app/(dashboard)/templates/new/page.tsx` (new), `src/app/(dashboard)/templates/[id]/edit/page.tsx` (new), `src/components/dashboard/TemplateEditor.tsx` (new)
- **Files to read:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/MerchantsTable.tsx`, `work/form-builder/tech-spec.md`

#### Task 6: Dashboard refactor
- **Description:** Replace `CreateLinkButton` with a `<Link href="/dashboard/templates">Templates</Link>` button. Replace `MerchantsTable` with new `SubmissionsTable` component that fetches from `GET /api/submissions` and shows: company name, template name, submission date, status badge, "Open" link. Update `StatsCard` counts to use `SubmissionStatus` values. Update dashboard page to English labels.
- **Skill:** code-writing
- **Reviewers:** code-reviewer, test-reviewer
- **Verify-user:** Open `localhost:3000/dashboard` → "Templates" button visible → after submitting a test form, submission row appears in table.
- **Files to modify:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/CreateLinkButton.tsx`, `src/components/dashboard/MerchantsTable.tsx`, `src/components/dashboard/StatsCard.tsx`
- **Files to read:** `src/app/api/submissions/route.ts`, `src/components/dashboard/MerchantsTable.tsx`

#### Task 7: Submission detail page
- **Description:** Repurpose `/dashboard/merchants/[id]` as `/dashboard/submissions/[id]`. Fetch submission with `GET /api/submissions/[id]` (includes template structure + FieldResponse). Render field responses grouped by step, using `fieldLabel` snapshot for display. FILE-type responses rendered as download links. Orphan responses (fieldId = null) rendered with `fieldLabel` only. Include `StatusChanger` component (existing pattern). All labels in English.
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
- **Description:** Delete all token-based onboarding code: `onboarding/[token]/` page + `OnboardingForm.tsx`, `api/onboarding/create-link/`, `api/onboarding/submit/`. Delete or repurpose `api/merchants/` and `api/merchants/[id]/status/` (now covered by submissions API). Update `src/middleware.ts` to remove old allowlist entries. Verify no remaining imports of deleted modules.
- **Skill:** code-writing
- **Reviewers:** code-reviewer
- **Files to modify:** `src/middleware.ts`
- **Files to read:** `src/app/api/onboarding/create-link/route.ts`, `src/app/api/onboarding/submit/route.ts`, `src/app/(onboarding)/onboarding/[token]/page.tsx`

### Audit Wave

#### Task 10: Code Audit
- **Description:** Full-feature code quality audit. Read all source files created/modified in this feature. Review holistically for cross-component issues: duplicate resource initialization, shared resources compliance with Architecture decisions, architectural consistency across API routes and UI components. Write audit report.
- **Skill:** code-reviewing
- **Reviewers:** none

#### Task 11: Security Audit
- **Description:** Full-feature security audit. Read all source files created/modified in this feature. Analyze for OWASP Top 10: public submit endpoint (injection, rate limiting, file upload validation), admin routes (auth bypass), FieldResponse value storage (XSS in rendering), Supabase Storage access. Write audit report.
- **Skill:** security-auditor
- **Reviewers:** none

#### Task 12: Test Audit
- **Description:** Full-feature test quality audit. Read all test files created in this feature. Verify coverage of field type validation, rate limiting, companyName extraction, localStorage autosave. Check for meaningful assertions (not testing mocks). Write audit report.
- **Skill:** test-master
- **Reviewers:** none

### Final Wave

#### Task 13: Pre-deploy QA
- **Description:** Acceptance testing: run all unit tests, manually verify all 16 acceptance criteria from user-spec and 9 from tech-spec. Follow the 6-step verification plan from user-spec "Как проверить" section. Document results.
- **Skill:** pre-deploy-qa
- **Reviewers:** none

#### Task 14: Deploy
- **Description:** Push to `main` → Railway auto-deploys via Dockerfile. Verify `prisma migrate deploy` runs in build step. Confirm health check passes at `/api/health`. Manually create `form-uploads` bucket in Supabase dashboard if not already present.
- **Skill:** deploy-pipeline
- **Reviewers:** none
