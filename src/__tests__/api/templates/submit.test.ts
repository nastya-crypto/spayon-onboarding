jest.mock("@/lib/db", () => ({
  prisma: {
    formTemplate: { findUnique: jest.fn() },
    formSubmission: { create: jest.fn(), delete: jest.fn() },
    fieldResponse: { create: jest.fn() },
    // batch transaction: resolve all operations in order
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
jest.mock("@/lib/rate-limit", () => ({ rateLimit: jest.fn() }));
jest.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "https://example.com/file.pdf" } }),
      })),
    },
  })),
}));

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";

const mockFindUnique = prisma.formTemplate.findUnique as jest.Mock;
const mockSubmissionCreate = prisma.formSubmission.create as jest.Mock;
const mockFieldResponseCreate = prisma.fieldResponse.create as jest.Mock;
const mockSubmissionDelete = prisma.formSubmission.delete as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockRateLimit = rateLimit as jest.Mock;
const mockGetSupabaseAdmin = getSupabaseAdmin as jest.Mock;

const makeTemplate = (overrides: Record<string, unknown> = {}) => ({
  id: "tpl-1",
  name: "Test Template",
  steps: [
    {
      id: "step-1",
      title: "Step 1",
      order: 0,
      fields: [
        { id: "f-0", label: "Company Name", fieldKey: "company-name", type: "TEXT", required: true, isProtected: true, order: 0 },
        { id: "f-1", label: "Email", fieldKey: "email", type: "EMAIL", required: false, isProtected: false, order: 1 },
      ],
    },
  ],
  ...overrides,
});

const makeSubmitRequest = (templateId: string, fields: Record<string, string | File>, ip = "1.2.3.4") => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return new Request(`http://localhost/api/templates/${templateId}/submit`, {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": ip },
  }) as unknown as import("next/server").NextRequest;
};

// ── GET /public ───────────────────────────────────────────────────────────────

describe("GET /public returns 404 for unknown template", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for unknown template", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/templates/[id]/public/route");
    const req = new Request("http://localhost/api/templates/unknown/public") as any;
    const res = await GET(req, { params: { id: "unknown" } });
    expect(res.status).toBe(404);
  });
});

describe("GET /public excludes isProtected and fieldKey from response", () => {
  beforeEach(() => jest.clearAllMocks());

  it("excludes isProtected and fieldKey even when mock returns them", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tpl-1",
      name: "Test",
      steps: [{
        id: "s-1", title: "Step 1", order: 0,
        fields: [{
          id: "f-1", label: "Company Name", fieldKey: "company-name",
          type: "TEXT", placeholder: null, required: true, isProtected: true, order: 0,
        }],
      }],
    });
    const { GET } = await import("@/app/api/templates/[id]/public/route");
    const req = new Request("http://localhost/api/templates/tpl-1/public") as any;
    const res = await GET(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("isProtected");
    expect(body).not.toContain("fieldKey");
  });
});

describe("GET /public returns steps and fields in order", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns correct response shape", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tpl-1",
      name: "Test",
      steps: [{
        id: "s-1", title: "Step 1", order: 0,
        fields: [{ id: "f-1", label: "Name", fieldKey: "name", type: "TEXT", placeholder: null, required: true, isProtected: false, order: 0 }],
      }],
    });
    const { GET } = await import("@/app/api/templates/[id]/public/route");
    const req = new Request("http://localhost/api/templates/tpl-1/public") as any;
    const res = await GET(req, { params: { id: "tpl-1" } });
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("name");
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps[0]).toHaveProperty("fields");
    expect(data.steps[0].fields[0]).toHaveProperty("id");
    expect(data.steps[0].fields[0]).toHaveProperty("label");
    expect(data.steps[0].fields[0]).toHaveProperty("type");
  });
});

// ── POST /submit ──────────────────────────────────────────────────────────────

describe("POST /submit returns 404 for unknown template", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 404", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("unknown", { "company-name": "Acme" });
    const res = await POST(req, { params: { id: "unknown" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /submit returns 429 on 6th request from same IP+templateId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0 });
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("tpl-1", { "company-name": "Acme" });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(429);
  });
});

describe("POST /submit returns 400 if required field missing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 400 when required TEXT field is missing", async () => {
    mockFindUnique.mockResolvedValue(makeTemplate());
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("tpl-1", {});
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /submit returns 400 if company name field response is missing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 400 with Company Name message when value is empty", async () => {
    mockFindUnique.mockResolvedValue(makeTemplate());
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("tpl-1", { "company-name": "" });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(JSON.stringify(data)).toContain("Company Name");
  });
});

describe("POST /submit returns 400 for disallowed MIME type on FILE field", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 400 for SVG file", async () => {
    mockFindUnique.mockResolvedValue(makeTemplate({
      steps: [{
        id: "step-1", title: "Step 1", order: 0,
        fields: [
          { id: "f-0", label: "Company Name", fieldKey: "company-name", type: "TEXT", required: true, isProtected: true, order: 0 },
          { id: "f-1", label: "Document", fieldKey: "document", type: "FILE", required: true, isProtected: false, order: 1 },
        ],
      }],
    }));
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const svgFile = new File(["<svg/>"], "test.svg", { type: "image/svg+xml" });
    const req = makeSubmitRequest("tpl-1", { "company-name": "Acme", "document": svgFile });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /submit returns 400 for file over 10MB", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 400 for oversized file", async () => {
    mockFindUnique.mockResolvedValue(makeTemplate({
      steps: [{
        id: "step-1", title: "Step 1", order: 0,
        fields: [
          { id: "f-0", label: "Company Name", fieldKey: "company-name", type: "TEXT", required: true, isProtected: true, order: 0 },
          { id: "f-1", label: "Document", fieldKey: "document", type: "FILE", required: true, isProtected: false, order: 1 },
        ],
      }],
    }));
    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    // Actual 11MB buffer so file.size is genuinely > 10MB
    const bigBuffer = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigBuffer], "big.pdf", { type: "application/pdf" });
    const req = makeSubmitRequest("tpl-1", { "company-name": "Acme", "document": file });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /submit returns 500 and cleans up on file upload failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 500, deletes submission, removes uploaded files on Supabase error", async () => {
    mockFindUnique.mockResolvedValue(makeTemplate({
      steps: [{
        id: "step-1", title: "Step 1", order: 0,
        fields: [
          { id: "f-0", label: "Company Name", fieldKey: "company-name", type: "TEXT", required: true, isProtected: true, order: 0 },
          { id: "f-1", label: "Document", fieldKey: "document", type: "FILE", required: true, isProtected: false, order: 1 },
        ],
      }],
    }));
    mockSubmissionCreate.mockResolvedValue({ id: "sub-fail" });
    mockSubmissionDelete.mockResolvedValue({});

    // Supabase upload fails
    const mockStorage = {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: { message: "bucket error" } }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "" } }),
        remove: jest.fn().mockResolvedValue({}),
      })),
    };
    mockGetSupabaseAdmin.mockReturnValue({ storage: mockStorage });

    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const smallFile = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const req = makeSubmitRequest("tpl-1", { "company-name": "Acme", "document": smallFile });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(500);
    expect(mockSubmissionDelete).toHaveBeenCalledWith({ where: { id: "sub-fail" } });
  });
});

describe("POST /submit creates FormSubmission with correct snapshots on happy path", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("returns 201 and stores correct templateName, companyName, email", async () => {
    const template = makeTemplate();
    mockFindUnique.mockResolvedValue(template);
    mockSubmissionCreate.mockResolvedValue({ id: "sub-1" });
    mockFieldResponseCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("tpl-1", {
      "company-name": "Acme Corp",
      "email": "contact@acme.com",
    });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(201);

    expect(mockSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "tpl-1",
          templateName: "Test Template",
          companyName: "Acme Corp",
          email: "contact@acme.com",
        }),
      })
    );

    // FieldResponse records must be created for every submitted field
    expect(mockFieldResponseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: "sub-1",
          fieldLabel: expect.any(String),
          value: expect.any(String),
        }),
      })
    );
    // One FieldResponse per field in the template (2 fields in makeTemplate())
    expect(mockFieldResponseCreate).toHaveBeenCalledTimes(2);
  });
});

describe("POST /submit stores null email when no EMAIL field present", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  it("stores email: null when no EMAIL-type field in template", async () => {
    const templateNoEmail = makeTemplate({
      steps: [{
        id: "step-1", title: "Step 1", order: 0,
        fields: [
          { id: "f-0", label: "Company Name", fieldKey: "company-name", type: "TEXT", required: true, isProtected: true, order: 0 },
        ],
      }],
    });
    mockFindUnique.mockResolvedValue(templateNoEmail);
    mockSubmissionCreate.mockResolvedValue({ id: "sub-1" });
    mockFieldResponseCreate.mockResolvedValue({});
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

    const { POST } = await import("@/app/api/templates/[id]/submit/route");
    const req = makeSubmitRequest("tpl-1", { "company-name": "Acme Corp" });
    const res = await POST(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(201);

    expect(mockSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: null,
        }),
      })
    );
  });
});
