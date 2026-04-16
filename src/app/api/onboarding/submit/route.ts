import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
const LOGOS_BUCKET = "logos";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const token = formData.get("token") as string;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Atomically mark the token as used — prevents race condition on double-submit
    const updated = await prisma.onboardingToken.updateMany({
      where: { token, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const email = formData.get("email") as string;
    const contactName = formData.get("contactName") as string;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!contactName?.trim()) {
      return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
    }

    // Validate logo before creating any records
    const logoFile = formData.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      if (logoFile.size > MAX_LOGO_SIZE) {
        return NextResponse.json({ error: "Logo file must be under 5 MB" }, { status: 400 });
      }
      if (!ALLOWED_MIME_TYPES.includes(logoFile.type)) {
        return NextResponse.json({ error: "Logo must be PNG, JPG or SVG" }, { status: 400 });
      }
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: contactName, role: "MERCHANT" },
      });
    }

    // Parse payment URLs
    let paymentUrls: string[] = [];
    try {
      paymentUrls = JSON.parse(formData.get("paymentUrls") as string ?? "[]");
    } catch { /* keep empty */ }

    const chargebackRate = parseFloat(formData.get("chargebackRate") as string) || null;
    const refundRate = parseFloat(formData.get("refundRate") as string) || null;
    const noLegalDocs = formData.get("noLegalDocs") === "true";

    const merchant = await prisma.merchant.create({
      data: {
        userId: user.id,
        businessName: formData.get("companyName") as string,
        website: (formData.get("websiteUrl") as string) || null,
        paymentUrls,
        servicesProvided: (formData.get("servicesProvided") as string) || null,
        projectAge: (formData.get("projectAge") as string) || null,
        chargebackRate,
        refundRate,
        privacyPolicyUrl: (formData.get("privacyPolicyUrl") as string) || null,
        termsUrl: (formData.get("termsUrl") as string) || null,
        refundPolicyUrl: (formData.get("refundPolicyUrl") as string) || null,
        noLegalDocs,
        status: "NEW",
        onboardingStatus: "COMPLETED",
      },
    });

    // Contact
    const nameParts = contactName.trim().split(/\s+/);
    await prisma.contact.create({
      data: {
        merchantId: merchant.id,
        type: "OWNER",
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || "-",
        email,
        telegram: (formData.get("telegram") as string) || null,
        isPrimary: true,
      },
    });

    // Logo upload to Supabase Storage
    if (logoFile && logoFile.size > 0) {
      try {
        const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${merchant.id}/logo-${Date.now()}-${safeName}`;
        const buffer = await logoFile.arrayBuffer();

        const { error: uploadError } = await getSupabaseAdmin().storage
          .from(LOGOS_BUCKET)
          .upload(storagePath, buffer, {
            contentType: logoFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("[onboarding/submit] supabase upload error:", uploadError.message);
        } else {
          const { data: { publicUrl } } = getSupabaseAdmin().storage
            .from(LOGOS_BUCKET)
            .getPublicUrl(storagePath);

          await prisma.merchant.update({
            where: { id: merchant.id },
            data: { logoUrl: publicUrl },
          });

          await prisma.document.create({
            data: {
              merchantId: merchant.id,
              type: "OTHER",
              name: logoFile.name,
              url: publicUrl,
            },
          });
        }
      } catch (uploadErr) {
        console.error("[onboarding/submit] logo upload failed:", uploadErr);
      }
    }

    return NextResponse.json({ success: true, merchantId: merchant.id });
  } catch (err) {
    console.error("[onboarding/submit]", err);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}
