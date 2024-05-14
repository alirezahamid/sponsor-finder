-- CreateTable
CREATE TABLE "Organisation" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "townCity" TEXT,
    "county" TEXT,
    "typeRating" TEXT,
    "route" TEXT,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);
