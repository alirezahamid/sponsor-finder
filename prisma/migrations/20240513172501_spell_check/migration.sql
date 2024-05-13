/*
  Warnings:

  - You are about to drop the `Organisation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Organisation";

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "townCity" TEXT,
    "county" TEXT,
    "typeRating" TEXT,
    "route" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
