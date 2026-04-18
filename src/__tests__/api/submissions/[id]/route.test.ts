/**
 * Tests for GET /api/submissions/[id] (admin-only detail)
 * TDD: written before implementation
 */

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth/auth-options", () => ({ authOptions: {} }));
jest.mock("@/lib/db", () => ({
  prisma: {
    formSubmission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";

const mockGetSession = getServerSession as jest.Mock;
const mockFindUnique = prisma.formSubmission.findUnique as jest.Mock;

describe("GET /api/submissions/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/sub-1") as any;
    const res = await GET(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 for non-admin role", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "MERCHANT" } });

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/sub-1") as any;
    const res = await GET(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("test_get_detail_not_found — returns 404 for non-existent id", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/nonexistent") as any;
    const res = await GET(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("test_get_detail_includes_email — response includes email field", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({
      id: "sub-1",
      companyName: "Acme Corp",
      templateName: "Standard",
      email: "contact@acme.com",
      status: "NEW",
      createdAt: new Date("2024-01-01"),
      responses: [],
    });

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/sub-1") as any;
    const res = await GET(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("email", "contact@acme.com");
  });

  it("test_get_detail_includes_orphan_responses — FieldResponse with fieldId=null present in response", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({
      id: "sub-1",
      companyName: "Acme Corp",
      templateName: "Standard",
      email: "contact@acme.com",
      status: "NEW",
      createdAt: new Date("2024-01-01"),
      responses: [
        {
          id: "resp-1",
          submissionId: "sub-1",
          fieldId: null,
          fieldLabel: "Deleted Field",
          value: "some value",
        },
        {
          id: "resp-2",
          submissionId: "sub-1",
          fieldId: "field-1",
          fieldLabel: "Active Field",
          value: "another value",
        },
      ],
    });

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/sub-1") as any;
    const res = await GET(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.responses).toHaveLength(2);
    const orphan = data.responses.find((r: any) => r.fieldId === null);
    expect(orphan).toBeDefined();
    expect(orphan.fieldLabel).toBe("Deleted Field");
  });

  it("calls findUnique with include responses", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({
      id: "sub-1",
      companyName: "Test Co",
      templateName: "Basic",
      email: null,
      status: "NEW",
      createdAt: new Date("2024-01-01"),
      responses: [],
    });

    const { GET } = await import("@/app/api/submissions/[id]/route");
    const req = new Request("http://localhost/api/submissions/sub-1") as any;
    await GET(req, { params: { id: "sub-1" } });

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        include: { responses: true },
      })
    );
  });
});
