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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }

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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
