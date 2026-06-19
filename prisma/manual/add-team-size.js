const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "teamSize" INTEGER;');
  console.log('teamSize column added to Company table');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
