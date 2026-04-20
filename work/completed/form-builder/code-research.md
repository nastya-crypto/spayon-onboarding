# Form-Builder Feature: Code Research Report

**Date:** 2026-04-17  
**Codebase:** `/Users/anastasiabaranova/Developer/spayon-onboarding`  
**Researcher:** Code Analysis

---

## Executive Summary

This report documents the current onboarding system architecture and identifies what must change to implement the **dynamic form-builder feature**. The current system uses **single-use tokens** with a **hardcoded form** for all onboardings. The new system requires:

1. **FormTemplate** models to store reusable form configurations (admin-created)
2. **Public URLs per template** (permissionless, no token needed)
3. **FormSubmission** records (replace the token + merchant creation flow)
4. **Field responses** as dynamic key-value data (not hardcoded fields)
5. **Template management dashboard** replacing the "Create Link" button

---

## 1. Current OnboardingToken System

### Token Creation: `/api/onboarding/create-link`

**Location:** `src/app/api/onboarding/create-link/route.ts`  
**Auth:** Requires `NextAuth` JWT token (admin only)  
**Rate limiting:** 20 tokens per user per hour (in-memory store)

**Flow:**
```typescript
POST /api/onboarding/create-link
→ Validate user token
→ Rate limit check
→ Create OnboardingToken record (7-day expiry)
→ Return URL: {NEXTAUTH_URL}/onboarding/{token}
```

**Key Code:**
- Creates token with `token: cuid()`, `createdBy: user.id`, `expiresAt: now + 7 days`
- Returns `url` and `token` fields
- **Issue:** No way to reuse or share a template URL; each token is single-use

### Token Validation: `onboarding/[token]/page.tsx`

**Location:** `src/app/(onboarding)/onboarding/[token]/page.tsx`  
**No auth required** (publicly accessible)

**Validation Logic:**
```typescript
const record = await prisma.onboardingToken.findUnique({ where: { token } })
const isInvalid = !record || record.expiresAt < new Date()
const isUsed = !!record?.usedAt
```

**Flow:**
- If invalid or expired → 404 error page
- If already used → "Link already used" error page
- If valid → Render `<OnboardingForm token={token} />`

**Key Issue:** Form is hardcoded; no reference to template data

### Token Consumption: `/api/onboarding/submit`

**Location:** `src/app/api/onboarding/submit/route.ts`  
**No auth required** (public endpoint)  
**Rate limiting:** 5 submissions per IP per hour

**Flow:**
```typescript
POST /api/onboarding/submit
→ Rate limit check (by IP)
→ Validate token is valid and not used
→ Atomically mark token as usedAt = now (prevents double-submit)
→ Extract form data from FormData
→ Create/find User by email
→ Create Merchant record
→ Create Contact record (from contactName/email)
→ Upload logo to Supabase Storage
→ Create Document record for logo
→ Return { success: true, merchantId }
```

**Key Code Pattern:**
```typescript
// Atomically prevent double-submit
const updated = await prisma.onboardingToken.updateMany({
  where: { token, usedAt: null, expiresAt: { gt: new Date() } },
  data: { usedAt: new Date() },
});
if (updated.count === 0) {
  return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
}
```

**Form Data Extracted:**
- `token`, `companyName`, `websiteUrl`, `paymentUrls` (JSON), `servicesProvided`
- `contactName`, `email`, `telegram`
- `projectAge`, `chargebackRate`, `refundRate`
- `privacyPolicyUrl`, `termsUrl`, `refundPolicyUrl`, `noLegalDocs`
- `logo` (file upload)

### What Must Change

1. **Remove OnboardingToken dependency** — tokens are single-use, not reusable
2. **Replace with FormTemplate URLs** — admins create template once, share same URL many times
3. **Move form validation** from OnboardingForm to template-driven validation
4. **Store submissions as FormSubmission** — track responses separately from Merchant
5. **Decouple form structure** — allow multiple templates with different fields

---

## 2. Current Form Structure

### OnboardingForm.tsx

**Location:** `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx`  
**Type:** Client component with full form logic  
**Size:** 697 lines

### Form Steps (4 Total)

**Step 0: About the Project**
- Fields: `companyName`, `websiteUrl`, `paymentUrls` (array), `servicesProvided`
- Validation: required fields, URL format, at least one payment URL
- Internationalization: English/Russian

**Step 1: Contacts**
- Fields: `contactName`, `email`, `telegram`
- Validation: required name/email, email format
- Type mapping: splits `contactName` to `firstName`/`lastName` on submit

**Step 2: Business Profile**
- Fields: `projectAge`, `chargebackRate`, `refundRate`
- Validation: required, numeric 0-100 for rates
- Type mapping: stored as `Float` in Merchant model

**Step 3: Documents**
- Fields: `privacyPolicyUrl`, `termsUrl`, `refundPolicyUrl`, `noLegalDocs` (checkbox), `logo` (file)
- Validation: URL format (optional unless noLegalDocs is false), logo required
- Type mapping: URLs stored in Merchant; logo uploaded to Supabase, stored in Document

### Form Data Structure

```typescript
type FormData = {
  companyName: string;
  websiteUrl: string;
  paymentUrls: string[];
  servicesProvided: string;
  contactName: string;
  email: string;
  telegram: string;
  projectAge: string;
  chargebackRate: string;
  refundRate: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  refundPolicyUrl: string;
  noLegalDocs: boolean;
};
```

### Field Mapping to Merchant/Contact

| Form Field | DB Field | Model | Notes |
|-----------|----------|-------|-------|
| companyName | businessName | Merchant | Required |
| websiteUrl | website | Merchant | Optional |
| paymentUrls | paymentUrls | Merchant | Array, stored as string[] |
| servicesProvided | servicesProvided | Merchant | Text, optional |
| projectAge | projectAge | Merchant | String, optional |
| chargebackRate | chargebackRate | Merchant | Float, optional |
| refundRate | refundRate | Merchant | Float, optional |
| privacyPolicyUrl | privacyPolicyUrl | Merchant | Optional |
| termsUrl | termsUrl | Merchant | Optional |
| refundPolicyUrl | refundPolicyUrl | Merchant | Optional |
| noLegalDocs | noLegalDocs | Merchant | Boolean default false |
| logo | logoUrl | Merchant + Document | Uploaded to Supabase, stored as Document |
| contactName | firstName/lastName | Contact | Split on whitespace |
| email | (user creation) + email | User + Contact | Creates User if not exists |
| telegram | telegram | Contact | Contact field, optional |

### Validation Logic

- **Client-side** in `validate(step, data, logo, t)` function
- **Server-side** in `/api/onboarding/submit` (email, contactName, logo MIME/size)
- **Pattern:** Step-by-step validation; errors shown per field
- **Internationalization:** Full EN/RU translations in `T` object

### Current Issues for Template System

1. **Hardcoded steps** — form structure is in component code, not data
2. **Hardcoded validation** — validation rules are JS functions, not configurable
3. **Hardcoded field mapping** — each form field maps to specific Merchant/Contact fields
4. **No field types** — validation is ad-hoc per field (URL, email, numeric range)
5. **No conditional logic** — `noLegalDocs` checkbox manually hides fields

---

## 3. Current DB Schema

### OnboardingToken Model

```prisma
model OnboardingToken {
  id        String    @id @default(cuid())
  token     String    @unique @default(cuid())
  createdBy String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@map("onboarding_tokens")
}
```

**Issues for new system:**
- Single-use only (usedAt prevents reuse)
- No reference to form structure
- No way to store template configuration

### Merchant Model (Partial)

```prisma
model Merchant {
  id                 String           @id @default(cuid())
  userId             String           @unique
  businessName       String
  businessType       BusinessType?
  registrationNumber String?
  taxId              String?
  website            String?
  description        String?          @db.Text
  legalName          String?
  registrationCountry String?
  paymentUrls        String[]
  servicesProvided   String?          @db.Text
  projectAge         String?
  chargebackRate     Float?
  refundRate         Float?
  privacyPolicyUrl   String?
  termsUrl           String?
  refundPolicyUrl    String?
  logoUrl            String?
  noLegalDocs        Boolean          @default(false)
  status             MerchantStatus   @default(NEW)
  onboardingStep     Int              @default(0)
  onboardingStatus   OnboardingStatus @default(IN_PROGRESS)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  address     Address?
  bankAccount BankAccount?
  documents   Document[]
  contacts    Contact[]
}
```

**One-to-One relationship with User:** `userId @unique` means each merchant has exactly one user. Currently handled by "create User if not exists" logic in submit endpoint.

### User Model (Partial)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  role          Role      @default(MERCHANT)
  password      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  merchant Merchant?  // one-to-one
}
```

**Role enum:** ADMIN, MERCHANT, REVIEWER

### Contact Model

```prisma
model Contact {
  id         String      @id @default(cuid())
  merchantId String
  type       ContactType
  firstName  String
  lastName   String
  email      String
  phone      String?
  telegram   String?
  isPrimary  Boolean     @default(false)

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
}
```

**ContactType enum:** OWNER, MANAGER, FINANCE, TECHNICAL, OTHER

### Document Model

```prisma
model Document {
  id         String         @id @default(cuid())
  merchantId String
  type       DocumentType
  name       String
  url        String
  status     DocumentStatus @default(PENDING)
  createdAt  DateTime       @default(now())

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
}
```

**DocumentType enum:** BUSINESS_LICENSE, TAX_CERTIFICATE, IDENTITY_PROOF, ADDRESS_PROOF, BANK_STATEMENT, OTHER

### Proposed New Models for Form Builder

**Models to create (new):**

```prisma
model FormTemplate {
  id            String   @id @default(cuid())
  name          String   // e.g., "Standard Merchant Onboarding"
  slug          String   @unique // URL path, e.g., "standard-merchant"
  description   String?
  isActive      Boolean  @default(true)
  steps         FormStep[]
  submissions   FormSubmission[]
  createdBy     String   // admin user ID
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("form_templates")
}

model FormStep {
  id           String   @id @default(cuid())
  templateId   String
  order        Int
  title        String   // e.g., "About the Project"
  description  String?
  fields       FormField[]
  template     FormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, order])
  @@map("form_steps")
}

model FormField {
  id           String   @id @default(cuid())
  stepId       String
  order        Int
  name         String   // e.g., "companyName"
  label        String   // e.g., "Company Name"
  type         FieldType // "text", "email", "url", "number", "file", "checkbox", "textarea"
  required     Boolean  @default(true)
  validation   Json?    // e.g., { "pattern": "...", "min": 0, "max": 100 }
  metadata     Json?    // e.g., { "placeholder": "...", "hint": "..." }
  order        Int
  step         FormStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  responses    FieldResponse[]

  @@unique([stepId, order])
  @@map("form_fields")
}

model FormSubmission {
  id           String   @id @default(cuid())
  templateId   String
  email        String   // for duplicate check / contact
  status       SubmissionStatus @default(PENDING) // PENDING, COMPLETED, ABANDONED
  merchantId   String?  // link to created merchant (if approved)
  responses    FieldResponse[]
  template     FormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  merchant     Merchant? @relation(fields: [merchantId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("form_submissions")
}

model FieldResponse {
  id           String   @id @default(cuid())
  submissionId String
  fieldId      String
  value        Json     // stores any response: string, number, file URL, etc.
  submission   FormSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  field        FormField @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([submissionId, fieldId])
  @@map("field_responses")
}
```

**Enums to add:**

```prisma
enum FieldType {
  TEXT
  EMAIL
  URL
  NUMBER
  FILE
  CHECKBOX
  TEXTAREA
  SELECT
  RADIO
}

enum SubmissionStatus {
  PENDING
  COMPLETED
  ABANDONED
}
```

### Migration Strategy

**What to keep:**
- User, Merchant, Contact, Document, Address, BankAccount models (all unchanged)
- Existing foreign key relationships
- MerchantStatus and OnboardingStatus enums

**What to remove:**
- OnboardingToken model (no longer needed)

**What to add:**
- FormTemplate, FormStep, FormField, FormSubmission, FieldResponse models
- FieldType, SubmissionStatus enums

**Default Template Seed:**
- When database is initialized, create a FormTemplate that mirrors the current hardcoded form
- This becomes the "standard" template that admin can clone/modify

---

## 4. Dashboard UI Changes

### Current State: CreateLinkButton + MerchantsTable

**Location:** `src/app/(dashboard)/dashboard/page.tsx`

**Current Flow:**
```
Dashboard Header
  ├─ Title: "Заявки мерчантов"
  └─ CreateLinkButton (top-right)

Stats Cards (4 columns)
  ├─ Новые (NEW)
  ├─ На проверке (IN_REVIEW)
  ├─ Одобрены (APPROVED)
  └─ Отклонены (REJECTED)

MerchantsTable
  ├─ Search by business name / email
  └─ Columns: Company | Email | Status | Date | Actions (Open)
```

### CreateLinkButton Component

**Location:** `src/components/dashboard/CreateLinkButton.tsx`  
**Size:** 69 lines

**Current Logic:**
```typescript
async function handleClick() {
  setState("loading");
  const res = await fetch("/api/onboarding/create-link", { method: "POST" });
  const { url } = await res.json();
  await navigator.clipboard.writeText(url);
  setState("copied");
}
```

**Flow:** Button click → API call → Copy to clipboard → Show "Copied!" state

**Text:** "Создать ссылку для клиента" (Create link for client)

### What Must Change

1. **Replace button with template selection** — Instead of "Create Link", show "Browse Templates" or "View Templates"
2. **New page: Template Management** — List all FormTemplates with:
   - Template name, description, active status
   - Public URL for each template
   - Edit, clone, deactivate actions
3. **Template creation flow** — Form to create/edit FormTemplate with:
   - Name, slug, description
   - Dynamic step/field builder
   - Live preview
4. **Public template URL** — Something like `/onboarding/{templateSlug}` (no token)
5. **Merchants table stays similar** — same data structure, but now shows which template was used

### MerchantsTable Component

**Location:** `src/components/dashboard/MerchantsTable.tsx`  
**Size:** 103 lines

**Current Columns:**
- Компания (businessName)
- Email (user.email)
- Статус (merchant.status)
- Дата подачи (merchant.createdAt)
- Действия (link to merchant detail page)

**Rows Per Merchant:**
- businessName, user.email, status badge, date, "Open" link

**What Stays:**
- Table structure and styling
- Search functionality
- Status badges and colors
- Link to merchant detail page

**What Changes:**
- Add "Template" column showing which template was used for onboarding
- Filter by template (optional enhancement)

---

## 5. Merchant Detail Page

### Current State

**Location:** `src/app/(dashboard)/merchants/[id]/page.tsx`  
**Size:** 202 lines

**Flow:**
```typescript
export default async function MerchantPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: { contacts: true },
  });
  // Render sections with InfoRow components
}
```

### Sections Displayed

**1. Header**
- Back link to dashboard
- Business name
- Logo (if present)
- Status badge

**2. About the Project**
- Project name (businessName)
- Website (link)
- Payment URLs (list of links)
- Services provided

**3. Contacts**
- Primary contact name, email, telegram

**4. Business Profile**
- Project age
- Chargeback rate %
- Refund rate %

**5. Documents**
- Privacy Policy, Terms, Refund Policy (links)
- "No legal documents available" note
- Logo link

**6. Status Changer**
- Buttons to change status: IN_REVIEW, APPROVED, REJECTED

### InfoRow Helper Component

```typescript
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  // Renders label on left, value on right (responsive)
  // Shows "—" if value is null/undefined
}
```

### How It Renders Submitted Data

**Current Mapping:**
- Hard-coded field labels (in English)
- Direct mapping from Merchant/Contact model to display
- No flexibility if form template has different fields
- File uploads shown as Document links

### What Must Change

1. **Dynamic section rendering** — Render sections based on FormTemplate, not hardcoded
2. **Field mapping from submission** — Display FieldResponse values, not Merchant fields
3. **Handle multiple templates** — Different templates have different fields → different layouts
4. **Fallback display** — For fields that don't exist in current template, show stored Merchant data
5. **File handling** — Show uploaded files from FieldResponse (JSON stored URLs), not Document table

### Proposed Flow

```typescript
// Get merchant + template used + submissions
const merchant = await prisma.merchant.findUnique({
  where: { id: params.id },
  include: {
    contacts: true,
    submissions: {  // NEW: FormSubmission
      include: {
        template: { include: { steps: { include: { fields: true } } } },
        responses: true,  // FieldResponse
      },
    },
  },
});

// Group field responses by template step
const submission = merchant.submissions[0];  // Primary submission
const responsesByStep = groupBy(submission.responses, 'fieldId')

// Render dynamically per step/field in template
```

---

## 6. Reusable Patterns

### Auth Middleware

**Location:** `src/middleware.ts`  
**Strategy:** NextAuth withAuth wrapper

**Pattern:**
```typescript
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    // Custom redirects here
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        // Check pathname against allowlist
        // Allow: /login, /register, /onboarding, /api/auth, /api/onboarding/submit, /api/health
        // Otherwise require token
        return !!token;
      },
    },
  }
);
```

**Reuse for new feature:** Add `/api/forms/*` endpoints to authorized paths (no auth for public form submission)

### Rate Limiting

**Location:** `src/lib/rate-limit.ts`  
**Strategy:** In-memory store with automatic cleanup

**Implementation:**
```typescript
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  // Returns { allowed: boolean; remaining: number }
}
```

**Cleanup:** Every 5 minutes, remove expired entries

**Reuse for new feature:**
- Rate limit template submission by IP/email (prevent spam)
- Rate limit template creation by user (prevent template explosion)

**Example:**
```typescript
const { allowed } = rateLimit(`form-submit:${ip}`, 10, 60 * 60 * 1000); // 10 per hour per IP
```

### Supabase Storage Integration

**Location:** `src/lib/supabase.ts`  
**Strategy:** Lazy-initialize singleton client with service role key

```typescript
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    _client = createClient(url, key);
  }
  return _client;
}
```

**Current usage in submit endpoint:**
```typescript
// Upload logo to Supabase Storage
const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const storagePath = `${merchant.id}/logo-${Date.now()}-${safeName}`;
const buffer = await logoFile.arrayBuffer();

const { error: uploadError } = await getSupabaseAdmin().storage
  .from(LOGOS_BUCKET)
  .upload(storagePath, buffer, { contentType: logoFile.type, upsert: false });

const { data: { publicUrl } } = getSupabaseAdmin().storage
  .from(LOGOS_BUCKET)
  .getPublicUrl(storagePath);
```

**Reuse for new feature:**
- Same pattern for any file uploads in FormField responses
- Create submission-specific folder: `${submissionId}/field-${fieldId}-${fileName}`
- Store public URLs in FieldResponse.value JSON

### Auth Options & Session

**Location:** `src/lib/auth/auth-options.ts`  
**Strategy:** NextAuth with Prisma adapter + JWT strategy

**Key callbacks:**
```typescript
// JWT callback: adds custom fields to token
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.role = user.role ?? "MERCHANT";
  }
  return token;
}

// Session callback: adds custom fields to session
async session({ session, token }) {
  if (token && session.user) {
    session.user.id = token.id;
    session.user.role = token.role;
  }
  return session;
}
```

**Reuse for new feature:** No changes needed; role-based checks work as-is

### Prisma Client Setup

**Location:** `src/lib/db.ts`  
**Strategy:** Singleton with PrismaPg adapter (PostgreSQL)

```typescript
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}
```

**Reuse:** No changes; just add new models to schema and regenerate

### API Route Pattern

**Pattern across all routes:**
```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Permission check (ADMIN/REVIEWER for management endpoints)
    if (token.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 3. Rate limiting (if public endpoint)
    const { allowed } = rateLimit(key, limit, windowMs);
    if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    // 4. Validation
    const body = await req.json();
    if (!body.field) return NextResponse.json({ error: "Missing field" }, { status: 400 });

    // 5. Business logic with Prisma
    const result = await prisma.model.create({ data: {...} });

    // 6. Success response
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[endpoint]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

**Reuse for form-builder endpoints:** Follow exact pattern for all new routes

---

## 7. Risk Analysis & Migration Path

### Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Backward compatibility with OnboardingToken** | Existing URLs will break on transition | Run both systems in parallel; migrate existing tokens to FormSubmissions before cutover |
| **Dynamic validation complexity** | More error cases, harder to test | Use Zod for schema generation from template definition |
| **File upload handling in FieldResponse** | Need to handle multiple file types per template | Store as { type: "file", url: "...", mimeType: "...", size: ... } JSON |
| **Template evolution** | What if admin edits template after submissions? | Snapshot template structure in FormSubmission; allow template versioning |
| **Missing Merchant user relationship** | New templates might not map to Merchant fields | Allow "merchant mapping" in template definition; manual mapping for admin review |
| **Default template assumption** | What if no template is selected? | Create "Standard Onboarding" template as default; seed on db init |

### Phased Cutover Strategy

**Phase 1: Setup (Week 1)**
- Add new models (FormTemplate, FormStep, FormField, FormSubmission, FieldResponse)
- Create seed script with default template
- Build template management API endpoints
- Deploy without UI changes (no users affected yet)

**Phase 2: Parallel Running (Week 2-3)**
- Implement template submission endpoint (`/api/forms/{slug}/submit`)
- Merchants can submit via old token URLs (OnboardingToken) OR new template URLs
- Both create entries: old path creates Merchant directly; new path creates FormSubmission
- Add migration logic to convert old tokens to FormSubmission records

**Phase 3: UI Migration (Week 3)**
- Replace CreateLinkButton with TemplateSelector
- Build template management dashboard
- Update merchant detail page to render dynamic fields
- Run in parallel with existing UI

**Phase 4: Deprecation (Week 4+)**
- Keep OnboardingToken system for 30 days (backward compat)
- Redirect old URLs to new system
- Remove OnboardingToken code after deprecation period

---

## 8. Files & Components Summary

### Files to CREATE (New)

**Models & Schema:**
- `prisma/migrations/[timestamp]_add_form_templates.sql`

**API Routes:**
- `src/app/api/admin/form-templates/route.ts` (GET all, POST create)
- `src/app/api/admin/form-templates/[id]/route.ts` (GET, PATCH, DELETE)
- `src/app/api/admin/form-templates/[id]/steps/route.ts` (manage steps)
- `src/app/api/admin/form-templates/[id]/fields/route.ts` (manage fields)
- `src/app/api/forms/[slug]/route.ts` (GET template for public display)
- `src/app/api/forms/[slug]/submit/route.ts` (POST submission)
- `src/app/api/forms/submissions/route.ts` (GET submissions for admin)
- `src/app/api/forms/submissions/[id]/route.ts` (GET, PATCH submission)

**Pages & Components:**
- `src/app/(dashboard)/templates/page.tsx` (template list/management)
- `src/app/(dashboard)/templates/[id]/edit/page.tsx` (template editor)
- `src/app/(dashboard)/templates/new/page.tsx` (create template)
- `src/app/(onboarding)/forms/[slug]/page.tsx` (public form display)
- `src/app/(onboarding)/forms/[slug]/DynamicForm.tsx` (component)
- `src/components/dashboard/TemplateList.tsx`
- `src/components/dashboard/TemplateEditor.tsx`
- `src/components/dashboard/FieldBuilder.tsx`

**Utilities:**
- `src/lib/form-validation.ts` (Zod schema generator from template)
- `src/lib/form-mapper.ts` (map submission → Merchant/Contact)

### Files to MODIFY (Existing)

**Schema:**
- `prisma/schema.prisma` (add new models, remove OnboardingToken)

**Pages:**
- `src/app/(dashboard)/dashboard/page.tsx` (replace CreateLinkButton)
- `src/app/(dashboard)/merchants/[id]/page.tsx` (render dynamic fields)
- `src/app/(onboarding)/onboarding/[token]/page.tsx` (add backward compat redirect)

**Components:**
- `src/components/dashboard/CreateLinkButton.tsx` (replace with TemplateSelector)
- `src/components/dashboard/MerchantsTable.tsx` (add template column)

**API Routes:**
- `src/app/api/onboarding/submit/route.ts` (deprecate, redirect to new system)
- `src/app/api/onboarding/create-link/route.ts` (deprecate)
- `src/middleware.ts` (add new routes to authorized paths)

**Seed:**
- `prisma/seed.ts` (add default template creation)

### Files to DELETE (Deprecated)

- `src/app/api/onboarding/create-link/route.ts` (after deprecation period)
- `src/app/api/onboarding/submit/route.ts` (after deprecation period)
- `src/app/(onboarding)/onboarding/[token]/OnboardingForm.tsx` (after deprecation period)
- `src/app/(onboarding)/onboarding/[token]/page.tsx` (after deprecation period)

---

## 9. Key Implementation Notes

### Template Slug Design

- Must be URL-safe (alphanumeric + dashes)
- Unique per template
- Immutable (or migration complexity)
- Example: `standard-merchant`, `high-risk-gaming`, `saas-providers`

### Field Response Storage

Store as JSON to handle any field type:
```json
{
  "text-field": "company name",
  "email-field": "contact@example.com",
  "file-field": {
    "type": "file",
    "url": "https://...",
    "mimeType": "application/pdf",
    "size": 1024
  },
  "number-field": 42.5,
  "checkbox-field": true,
  "array-field": ["url1", "url2"]
}
```

### Merchant Mapping

When FormSubmission is approved → create Merchant:
1. **Template defines mapping** — which fields → which Merchant columns
2. **Admin review** — review submission data before creating Merchant
3. **Create transaction** — atomically create User + Merchant + Contact + Documents
4. **Link submission** — FormSubmission.merchantId = created Merchant ID

### Validation Schema Generation

Use Zod to build validation from template:
```typescript
function buildZodSchema(fields: FormField[]): z.ZodSchema {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === "email") shape[field.name] = z.string().email();
    else if (field.type === "url") shape[field.name] = z.string().url();
    else if (field.type === "number") shape[field.name] = z.number().min(validation.min).max(validation.max);
    // ... etc
    if (field.required) shape[field.name] = shape[field.name].min(1);
    else shape[field.name] = shape[field.name].optional();
  }
  return z.object(shape);
}
```

### Rate Limiting Strategy

- **Public form submission:** 10 per IP per hour (spam prevention)
- **Template creation:** 5 per user per day (admin limit)
- **Submission list query:** Paginate; no rate limit needed (authenticated)

---

## Summary of Changes by Scope

### Changes Required for Success

| Component | Change Type | Effort |
|-----------|------------|--------|
| Database Schema | Add 5 new models | Medium |
| API Layer | 8 new routes + 3 modify | Large |
| Dashboard UI | New template management page | Medium |
| Public Pages | New dynamic form page | Medium |
| Merchant Detail | Dynamic rendering | Small |
| Utilities | Validation + mapping helpers | Medium |
| Seed Script | Add default template | Small |

### What Can Be Reused Unchanged

- Auth middleware + session handling
- Rate limiting framework
- Supabase storage integration
- Prisma client setup
- NextAuth configuration
- API route error handling pattern
- Component styling & patterns

### Dependencies

- **Existing:** Next.js 14, React 18, Prisma 7.7, NextAuth 4.24, Zod 4.3
- **New:** None (use existing Zod for validation)

---

## Conclusion

The form-builder feature requires significant refactoring of the onboarding flow but can leverage most existing patterns. The core migration path is:

1. Create new data models (FormTemplate, FormStep, FormField, FormSubmission, FieldResponse)
2. Build template management API and UI
3. Implement public form endpoint with dynamic rendering
4. Create Merchant from submission (with admin review)
5. Deprecate OnboardingToken system (30-day window)

**Critical success factors:**
- Default template seed data (mirrors current form)
- Parallel running (old + new systems simultaneously)
- Atomic submission validation (prevent incomplete data)
- Template versioning or snapshots (for historical data)

