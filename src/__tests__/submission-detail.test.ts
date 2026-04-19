import { isValidFileUrl } from "@/lib/submission-utils";

describe("isValidFileUrl", () => {
  test("accepts https://", () => {
    expect(isValidFileUrl("https://example.com/file.pdf")).toBe(true);
  });

  test("accepts http://", () => {
    expect(isValidFileUrl("http://example.com/file.pdf")).toBe(true);
  });

  test("rejects javascript: URI", () => {
    expect(isValidFileUrl("javascript:alert(1)")).toBe(false);
  });

  test("rejects data: URI", () => {
    expect(isValidFileUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isValidFileUrl("")).toBe(false);
  });

  test("rejects relative path", () => {
    expect(isValidFileUrl("/uploads/file.pdf")).toBe(false);
  });
});
