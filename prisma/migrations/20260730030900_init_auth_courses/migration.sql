-- CreateEnum
CREATE TYPE "papel_usuario" AS ENUM ('coordenadora', 'mentor');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "email_normalizado" VARCHAR(254) NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "papel_usuario" NOT NULL DEFAULT 'mentor',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "ultimo_login_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" VARCHAR(512),
    "endereco_ip" VARCHAR(64),
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "ultimo_uso_em" TIMESTAMPTZ(3),
    "revogada_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nome_normalizado" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso_mentores" (
    "curso_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "vinculado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_mentores_pkey" PRIMARY KEY ("curso_id","mentor_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_normalizado_key" ON "usuarios"("email_normalizado");

-- CreateIndex
CREATE INDEX "usuarios_papel_ativo_idx" ON "usuarios"("papel", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_refresh_token_hash_key" ON "sessoes"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_revogada_expira_idx" ON "sessoes"("usuario_id", "revogada_em", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_nome_normalizado_key" ON "cursos"("nome_normalizado");

-- CreateIndex
CREATE INDEX "cursos_ativo_nome_idx" ON "cursos"("ativo", "nome");

-- CreateIndex
CREATE INDEX "curso_mentores_mentor_id_idx" ON "curso_mentores"("mentor_id");

-- CreateIndex
CREATE INDEX "curso_mentores_vinculado_por_id_idx" ON "curso_mentores"("vinculado_por_id");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_mentores" ADD CONSTRAINT "curso_mentores_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_mentores" ADD CONSTRAINT "curso_mentores_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_mentores" ADD CONSTRAINT "curso_mentores_vinculado_por_id_fkey" FOREIGN KEY ("vinculado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
