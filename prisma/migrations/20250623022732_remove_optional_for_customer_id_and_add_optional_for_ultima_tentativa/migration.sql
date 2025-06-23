/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `Usuario` will be added. If there are existing duplicate values, this will fail.
  - Made the column `customerId` on table `Usuario` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Otp" ALTER COLUMN "ultimaTentativa" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "customerId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_customerId_key" ON "Usuario"("customerId");
