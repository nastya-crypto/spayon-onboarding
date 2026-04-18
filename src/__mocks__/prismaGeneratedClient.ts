// Manual mock for @/generated/prisma/client
// Prisma 7 generates ESM files with import.meta.url which Jest (CJS mode) can't parse.
// This mock re-exports all enum values needed by tests.

export enum SubmissionStatus {
  NEW = "NEW",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum FieldType {
  TEXT = "TEXT",
  EMAIL = "EMAIL",
  URL = "URL",
  NUMBER = "NUMBER",
  TEXTAREA = "TEXTAREA",
  FILE = "FILE",
  CHECKBOX = "CHECKBOX",
}
