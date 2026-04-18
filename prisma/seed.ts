import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "nastya@spayon.io";
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawPassword) {
    throw new Error("ADMIN_PASSWORD env variable is required to run seed");
  }

  // --- Admin user ---
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
  } else {
    const password = await bcrypt.hash(rawPassword, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME ?? "Admin",
        password,
        role: "ADMIN",
      },
    });
    console.log(`✓ Admin user created: ${user.email} (id: ${user.id})`);
  }

  // --- Standard Onboarding template ---
  const existingTemplate = await prisma.formTemplate.findFirst({
    where: { name: "Standard Onboarding" },
  });
  if (existingTemplate) {
    console.log(`FormTemplate "Standard Onboarding" already exists, skipping.`);
  } else {
    const template = await prisma.formTemplate.create({
      data: {
        name: "Standard Onboarding",
        steps: {
          create: [
            {
              title: "About the Project",
              order: 0,
              fields: {
                create: [
                  {
                    label: "Company Name",
                    fieldKey: "company-name",
                    type: "TEXT",
                    required: true,
                    isProtected: true,
                    order: 0,
                  },
                  {
                    label: "Project Description",
                    fieldKey: "project-description",
                    type: "TEXTAREA",
                    placeholder: "Describe your project",
                    required: true,
                    order: 1,
                  },
                  {
                    label: "Website",
                    fieldKey: "website",
                    type: "URL",
                    placeholder: "https://example.com",
                    required: false,
                    order: 2,
                  },
                  {
                    label: "Services Provided",
                    fieldKey: "services-provided",
                    type: "TEXTAREA",
                    placeholder: "Describe the services you provide",
                    required: true,
                    order: 3,
                  },
                ],
              },
            },
            {
              title: "Contacts",
              order: 1,
              fields: {
                create: [
                  {
                    label: "First Name",
                    fieldKey: "first-name",
                    type: "TEXT",
                    required: true,
                    order: 0,
                  },
                  {
                    label: "Last Name",
                    fieldKey: "last-name",
                    type: "TEXT",
                    required: true,
                    order: 1,
                  },
                  {
                    label: "Email",
                    fieldKey: "email",
                    type: "EMAIL",
                    placeholder: "contact@company.com",
                    required: true,
                    order: 2,
                  },
                  {
                    label: "Phone",
                    fieldKey: "phone",
                    type: "TEXT",
                    placeholder: "+1 234 567 8900",
                    required: false,
                    order: 3,
                  },
                  {
                    label: "Telegram",
                    fieldKey: "telegram",
                    type: "TEXT",
                    placeholder: "@username",
                    required: false,
                    order: 4,
                  },
                ],
              },
            },
            {
              title: "Business Profile",
              order: 2,
              fields: {
                create: [
                  {
                    label: "Legal Name",
                    fieldKey: "legal-name",
                    type: "TEXT",
                    required: true,
                    order: 0,
                  },
                  {
                    label: "Registration Number",
                    fieldKey: "registration-number",
                    type: "TEXT",
                    required: false,
                    order: 1,
                  },
                  {
                    label: "Registration Country",
                    fieldKey: "registration-country",
                    type: "TEXT",
                    required: true,
                    order: 2,
                  },
                  {
                    label: "Tax ID",
                    fieldKey: "tax-id",
                    type: "TEXT",
                    required: false,
                    order: 3,
                  },
                ],
              },
            },
            {
              title: "Documents",
              order: 3,
              fields: {
                create: [
                  {
                    label: "Business License",
                    fieldKey: "business-license",
                    type: "FILE",
                    required: false,
                    order: 0,
                  },
                  {
                    label: "Identity Proof",
                    fieldKey: "identity-proof",
                    type: "FILE",
                    required: true,
                    order: 1,
                  },
                  {
                    label: "Bank Statement",
                    fieldKey: "bank-statement",
                    type: "FILE",
                    required: false,
                    order: 2,
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log(
      `✓ FormTemplate "Standard Onboarding" created (id: ${template.id})`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
