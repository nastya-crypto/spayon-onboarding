/**
 * Tests for GET /api/submissions (admin-only list)
 * TDD: written before implementation
 */
import { NextResponse } from "next/server";

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
const mockFindMany = prisma.formSubmission.findMany as jest.Mock;

describe("GET /api/submissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("test_get_list_forbidden_non_admin — returns 403 for non-admin role", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "MERCHANT" } });

    const { GET } = await import("@/app/api/submissions/route");
    const req = new Request("http://localhost/api/submissions") as any;
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/submissions/route");
    const req = new Request("http://localhost/api/submissions") as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("test_get_list_excludes_email — response does not contain email field", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindMany.mockResolvedValue([
      {
        id: "sub-1",
        companyName: "Acme Corp",
        templateName: "Standard",
        status: "NEW",
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const { GET } = await import("@/app/api/submissions/route");
    const req = new Request("http://localhost/api/submissions") as any;
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0]).not.toHaveProperty("email");
  });

  it("test_get_list_ordered_by_created_at_desc — prisma called with orderBy createdAt desc", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/submissions/route");
    const req = new Request("http://localhost/api/submissions") as any;
    await GET(req);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns submissions array in response", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindMany.mockResolvedValue([
      {
        id: "sub-1",
        companyName: "Test Co",
        templateName: "Basic",
        status: "NEW",
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const { GET } = await import("@/app/api/submissions/route");
    const req = new Request("http://localhost/api/submissions") as any;
    const res = await GET(req);
    const data = await res.json();

    expect(data).toHaveProperty("submissions");
    expect(Array.isArray(data.submissions)).toBe(true);
  });
});
