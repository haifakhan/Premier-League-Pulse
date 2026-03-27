/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv/config");

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sportsdeck.local";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin12345";

async function main() {
  const existingByEmail = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingByEmail) {
    if (existingByEmail.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { role: "ADMIN" },
      });
    }
    return;
  }

  const existingByUsername = await prisma.user.findUnique({
    where: { username: ADMIN_USERNAME },
  });

  if (existingByUsername) {
    if (existingByUsername.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existingByUsername.id },
        data: { role: "ADMIN" },
      });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      username: ADMIN_USERNAME,
      passwordHash,
      role: "ADMIN",
      isBanned: false,
    },
  });
}

main()
  .catch((error) => {
    console.error("Failed to seed admin user:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
