/*
  Warnings:

  - A unique constraint covering the columns `[dataHash]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dataHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_dataHash_key" ON "Organization"("dataHash");
