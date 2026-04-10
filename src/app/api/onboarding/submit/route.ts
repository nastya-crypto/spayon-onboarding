import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const token = formData.get("token") as string;
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const record = await prisma.onboardingToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const email = formData.get("email") as string;
    const contactName = formData.get("contactName") as string;

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

    // Logo upload
    const logoFile = formData.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", merchant.id);
      await mkdir(uploadsDir, { recursive: true });

      const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `logo-${Date.now()}-${safeName}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);

      const logoUrl = `/uploads/${merchant.id}/${filename}`;
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { logoUrl },
      });

      await prisma.document.create({
        data: {
          merchantId: merchant.id,
          type: "OTHER",
          name: logoFile.name,
          url: logoUrl,
        },
      });
    }

    // Mark token used
    await prisma.onboardingToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ success: true, merchantId: merchant.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
