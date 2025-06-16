-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "customerId" TEXT,
    "estaPago" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "foiUsado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativa" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefone_key" ON "Usuario"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Otp_telefone_key" ON "Otp"("telefone");

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_telefone_fkey" FOREIGN KEY ("telefone") REFERENCES "Usuario"("telefone") ON DELETE RESTRICT ON UPDATE CASCADE;
