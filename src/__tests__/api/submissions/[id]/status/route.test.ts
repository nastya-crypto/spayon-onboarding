/**
 * Tests for PATCH /api/submissions/[id]/status (admin-only status change)
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
const mockUpdate = prisma.formSubmission.update as jest.Mock;

describe("PATCH /api/submissions/[id]/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("test_patch_status_forbidden — returns 403 for non-admin role", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "MERCHANT" } });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("returns 404 for non-existent submission", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/nonexistent/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("test_patch_status_valid_transition — NEW→IN_REVIEW returns 200 with updated status", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "NEW" });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "IN_REVIEW" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("IN_REVIEW");
  });

  it("IN_REVIEW→APPROVED is valid", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "IN_REVIEW" });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "APPROVED" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("APPROVED");
  });

  it("IN_REVIEW→REJECTED is valid", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "IN_REVIEW" });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "REJECTED" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "REJECTED" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("REJECTED");
  });

  it("test_patch_status_invalid_transition — NEW→APPROVED returns 400", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "NEW" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("test_patch_status_unknown_value — unknown status returns 400", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "NEW" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "BANANA" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("APPROVED→anything returns 400 (terminal state)", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "APPROVED" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(400);
  });

  it("same status transition returns 400 (IN_REVIEW→IN_REVIEW)", async () => {
    mockGetSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "sub-1", status: "IN_REVIEW" });

    const { PATCH } = await import("@/app/api/submissions/[id]/status/route");
    const req = new Request("http://localhost/api/submissions/sub-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_REVIEW" }),
      headers: { "Content-Type": "application/json" },
    }) as any;
    const res = await PATCH(req, { params: { id: "sub-1" } });

    expect(res.status).toBe(400);
  });
});
