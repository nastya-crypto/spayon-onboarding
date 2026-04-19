import { buildZodSchema } from "@/lib/form-validation";

describe("buildZodSchema", () => {
  test("TEXT field valid", () => {
    const schema = buildZodSchema([
      { fieldKey: "name", type: "TEXT", required: true },
    ]);
    expect(() => schema.parse({ name: "hello" })).not.toThrow();
  });

  test("EMAIL field accepts valid email", () => {
    const schema = buildZodSchema([
      { fieldKey: "email", type: "EMAIL", required: true },
    ]);
    expect(() => schema.parse({ email: "user@example.com" })).not.toThrow();
  });

  test("URL field accepts valid URL", () => {
    const schema = buildZodSchema([
      { fieldKey: "url", type: "URL", required: true },
    ]);
    expect(() => schema.parse({ url: "https://example.com" })).not.toThrow();
  });

  test("EMAIL field rejects non-email", () => {
    const schema = buildZodSchema([
      { fieldKey: "email", type: "EMAIL", required: true },
    ]);
    expect(() => schema.parse({ email: "notanemail" })).toThrow();
  });

  test("URL field rejects non-URL", () => {
    const schema = buildZodSchema([
      { fieldKey: "url", type: "URL", required: true },
    ]);
    expect(() => schema.parse({ url: "notaurl" })).toThrow();
  });

  test("required field rejects empty string", () => {
    const schema = buildZodSchema([
      { fieldKey: "name", type: "TEXT", required: true },
    ]);
    expect(() => schema.parse({ name: "" })).toThrow();
  });

  test("optional field passes with undefined", () => {
    const schema = buildZodSchema([
      { fieldKey: "name", type: "TEXT", required: false },
    ]);
    expect(() => schema.parse({})).not.toThrow();
  });

  test("NUMBER field rejects non-finite", () => {
    const schema = buildZodSchema([
      { fieldKey: "amount", type: "NUMBER", required: true },
    ]);
    expect(() => schema.parse({ amount: Infinity })).toThrow();
    expect(() => schema.parse({ amount: 42 })).not.toThrow();
  });

  test("CHECKBOX field accepts boolean", () => {
    const schema = buildZodSchema([
      { fieldKey: "agreed", type: "CHECKBOX", required: true },
    ]);
    expect(() => schema.parse({ agreed: true })).not.toThrow();
    expect(() => schema.parse({ agreed: false })).not.toThrow();
  });

  test("TEXTAREA field valid with long text", () => {
    const schema = buildZodSchema([
      { fieldKey: "bio", type: "TEXTAREA", required: true },
    ]);
    expect(() => schema.parse({ bio: "a".repeat(10000) })).not.toThrow();
    expect(() => schema.parse({ bio: "a".repeat(10001) })).toThrow();
  });

  test("FILE field accepts string value", () => {
    const schema = buildZodSchema([
      { fieldKey: "doc", type: "FILE", required: true },
    ]);
    expect(() =>
      schema.parse({ doc: '{"url":"https://x.com/f.pdf","mimeType":"application/pdf","size":1024}' })
    ).not.toThrow();
  });
});
