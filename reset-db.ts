import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    // Disable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = 'replica';`;

    // Truncate tables and reset auto-increment IDs
    await prisma.$executeRaw`TRUNCATE TABLE "Organization" RESTART IDENTITY CASCADE;`;
    await prisma.$executeRaw`TRUNCATE TABLE "OrganizationChange" RESTART IDENTITY CASCADE;`;

    // Enable foreign key checks
    await prisma.$executeRaw`SET session_replication_role = 'origin';`;

    console.log('Database has been reset.');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
