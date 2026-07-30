-- CreateTable
CREATE TABLE "tipos_atividade" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_normalizado" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tipos_atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_atividade_nome_normalizado_key" ON "tipos_atividade"("nome_normalizado");

-- CreateIndex
CREATE INDEX "tipos_atividade_ativo_nome_idx" ON "tipos_atividade"("ativo", "nome");
