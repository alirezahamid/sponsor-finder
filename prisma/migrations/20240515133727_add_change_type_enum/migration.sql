-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'UPDATED', 'REMOVED');

-- CreateTable
CREATE TABLE "OrganizationChange" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ChangeType" NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "organizationId" INTEGER,

    CONSTRAINT "OrganizationChange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrganizationChange" ADD CONSTRAINT "OrganizationChange_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
