jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth/auth-options", () => ({ authOptions: {} }));
jest.mock("@/lib/db", () => ({
  prisma: {
    formTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    formStep: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    formField: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

const mockSession = getServerSession as jest.Mock;
const mockCreate = prisma.formTemplate.create as jest.Mock;
const mockFindMany = prisma.formTemplate.findMany as jest.Mock;
const mockFindUnique = prisma.formTemplate.findUnique as jest.Mock;
const mockDelete = prisma.formTemplate.delete as jest.Mock;
const mockFieldFindMany = prisma.formField.findMany as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const adminSession = { user: { role: "ADMIN", id: "user-1" } };
const merchantSession = { user: { role: "MERCHANT", id: "user-2" } };

describe("GET /api/templates — unauthorized", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 with no session", async () => {
    mockSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/templates/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/templates — wrong role", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for MERCHANT role", async () => {
    mockSession.mockResolvedValue(merchantSession);
    const { GET } = await import("@/app/api/templates/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("POST /api/templates — happy path", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 201 and response contains auto-inserted Company Name field as first field of first step", async () => {
    mockSession.mockResolvedValue(adminSession);
    const createdTemplate = {
      id: "tpl-1",
      name: "Test Template",
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: [
        {
          id: "step-1",
          title: "Step 1",
          order: 0,
          fields: [
            {
              id: "f-0",
              label: "Company Name",
              fieldKey: "company-name",
              type: "TEXT",
              isProtected: true,
              required: true,
              order: 0,
            },
            {
              id: "f-1",
              label: "Website",
              fieldKey: "website",
              type: "URL",
              isProtected: false,
              required: false,
              order: 1,
            },
          ],
        },
      ],
    };
    mockCreate.mockResolvedValue(createdTemplate);

    const { POST } = await import("@/app/api/templates/route");
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Template",
        steps: [{ title: "Step 1", fields: [{ label: "Website", type: "URL", required: false }] }],
      }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    const firstField = data.steps[0].fields[0];
    expect(firstField.label).toBe("Company Name");
    expect(firstField.isProtected).toBe(true);
  });
});

describe("POST /api/templates — no steps", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when steps array is empty", async () => {
    mockSession.mockResolvedValue(adminSession);
    const { POST } = await import("@/app/api/templates/route");
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", steps: [] }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/templates — empty fields in step", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when a step has empty fields array", async () => {
    mockSession.mockResolvedValue(adminSession);
    const { POST } = await import("@/app/api/templates/route");
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        steps: [{ title: "Step 1", fields: [] }],
      }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/templates/[id] — protected field removal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 with message when Company Name field is omitted", async () => {
    mockSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({ id: "tpl-1", name: "Test" });
    mockFieldFindMany.mockResolvedValue([
      { id: "f-0", fieldKey: "company-name", isProtected: true },
    ]);

    const { PATCH } = await import("@/app/api/templates/[id]/route");
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated",
        steps: [
          {
            title: "Step 1",
            fields: [{ label: "Email", type: "EMAIL", required: true }],
          },
        ],
      }),
    }) as any;

    const res = await PATCH(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Company Name field cannot be removed");
  });
});

describe("DELETE /api/templates/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 204 and deletes template", async () => {
    mockSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({ id: "tpl-1", name: "Test" });
    mockDelete.mockResolvedValue({ id: "tpl-1" });

    const { DELETE } = await import("@/app/api/templates/[id]/route");
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "DELETE",
    }) as any;

    const res = await DELETE(req, { params: { id: "tpl-1" } });
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "tpl-1" } });
  });
});
