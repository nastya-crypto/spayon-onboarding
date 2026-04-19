export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildZodSchema } from "@/lib/form-validation";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const FORM_UPLOADS_BUCKET = "form-uploads";

type FieldType = "TEXT" | "EMAIL" | "URL" | "NUMBER" | "TEXTAREA" | "FILE" | "CHECKBOX";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: templateId } = params;

  // Rate limit: 5 submissions per IP per template per hour
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = rateLimit(`submit:${templateId}:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // Fetch template with all steps and fields
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          fields: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const allFields = template.steps.flatMap((s) => s.fields);

  // Parse form data
  const formData = await req.formData();

  // Validate FILE fields first (size/MIME checks before any DB writes)
  const fileFieldMeta = allFields.filter((f) => f.type === "FILE");
  const fileBuffers = new Map<string, { file: File; buffer: ArrayBuffer }>();

  for (const field of fileFieldMeta) {
    const file = formData.get(field.fieldKey) as File | null;
    if (file && file.size > 0) {
      // Size check before loading into memory
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${field.label}" exceeds the 10 MB limit` },
          { status: 400 }
        );
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File "${field.label}" has an unsupported type: ${file.type}` },
          { status: 400 }
        );
      }
      const buffer = await file.arrayBuffer();
      fileBuffers.set(field.fieldKey, { file, buffer });
    } else if (field.required) {
      return NextResponse.json(
        { error: `File "${field.label}" is required` },
        { status: 400 }
      );
    }
  }

  // Check company name early for a specific error message (before Zod)
  const protectedField = allFields.find((f) => f.isProtected);
  if (protectedField) {
    const raw = formData.get(protectedField.fieldKey) as string | null;
    if (!raw || !raw.trim()) {
      return NextResponse.json({ error: "Company Name field is required" }, { status: 400 });
    }
  }

  // Build validation data for non-FILE fields
  const nonFileFields = allFields.filter((f) => f.type !== "FILE");
  const validationData: Record<string, unknown> = {};
  for (const field of nonFileFields) {
    const raw = formData.get(field.fieldKey);
    if (field.type === "NUMBER") {
      validationData[field.fieldKey] = raw !== null && raw !== "" ? Number(raw) : undefined;
    } else if (field.type === "CHECKBOX") {
      validationData[field.fieldKey] = raw === "true";
    } else {
      validationData[field.fieldKey] = raw !== null ? (raw as string) : undefined;
    }
  }

  const schema = buildZodSchema(
    nonFileFields.map((f) => ({
      fieldKey: f.fieldKey,
      type: f.type as FieldType,
      required: f.required,
    }))
  );
  const parsed = schema.safeParse(validationData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  // Extract company name — protectedField check above guarantees it's non-empty
  const companyName = protectedField
    ? ((validationData[protectedField.fieldKey] as string | undefined) ?? "")
    : "";

  // Extract email from the first EMAIL-type field if present
  const emailField = allFields.find((f) => f.type === "EMAIL");
  const email = emailField
    ? ((validationData[emailField.fieldKey] as string | undefined) ?? null)
    : null;

  // Create FormSubmission
  const submission = await prisma.formSubmission.create({
    data: {
      templateId,
      templateName: template.name,
      companyName,
      email,
      status: "NEW",
    },
  });

  // Upload files to Supabase Storage
  const fileValues = new Map<string, string>(); // fieldKey → JSON value
  for (const [fieldKey, { file, buffer }] of Array.from(fileBuffers.entries())) {
    const field = allFields.find((f) => f.fieldKey === fieldKey)!;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${submission.id}/${field.id}-${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await getSupabaseAdmin()
      .storage.from(FORM_UPLOADS_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("[templates/submit] Supabase upload error:", uploadError.message);
      // Best-effort cleanup
      await prisma.formSubmission.delete({ where: { id: submission.id } }).catch(() => {});
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }

    const { data: { publicUrl } } = getSupabaseAdmin()
      .storage.from(FORM_UPLOADS_BUCKET)
      .getPublicUrl(storagePath);

    fileValues.set(fieldKey, JSON.stringify({ url: publicUrl, mimeType: file.type, size: file.size }));
  }

  // Create FieldResponse records for all fields
  for (const field of allFields) {
    let value: string;
    if (field.type === "FILE") {
      value = fileValues.get(field.fieldKey) ?? "";
    } else {
      const raw = validationData[field.fieldKey];
      value = raw !== undefined ? String(raw) : "";
    }

    await prisma.fieldResponse.create({
      data: {
        submissionId: submission.id,
        fieldId: field.id,
        fieldLabel: field.label,
        value,
      },
    });
  }

  return NextResponse.json({ success: true, submissionId: submission.id }, { status: 201 });
}
