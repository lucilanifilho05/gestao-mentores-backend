-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_curriculares" (
    "id" UUID NOT NULL,
    "modulo_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "carga_horaria" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "unidades_curriculares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turmas_curso_data_inicio_idx" ON "turmas"("curso_id", "data_inicio");

-- CreateIndex
CREATE INDEX "turmas_ativo_data_inicio_idx" ON "turmas"("ativo", "data_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_curso_codigo_key" ON "turmas"("curso_id", "codigo");

-- CreateIndex
CREATE INDEX "modulos_turma_data_inicio_idx" ON "modulos"("turma_id", "data_inicio");

-- CreateIndex
CREATE INDEX "unidades_curriculares_modulo_data_inicio_idx" ON "unidades_curriculares"("modulo_id", "data_inicio");

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_curriculares" ADD CONSTRAINT "unidades_curriculares_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "turmas"
ADD CONSTRAINT "turmas_periodo_check"
CHECK ("data_fim" >= "data_inicio");

ALTER TABLE "modulos"
ADD CONSTRAINT "modulos_periodo_check"
CHECK ("data_fim" >= "data_inicio");

ALTER TABLE "unidades_curriculares"
ADD CONSTRAINT "unidades_curriculares_periodo_check"
CHECK ("data_fim" >= "data_inicio");

ALTER TABLE "unidades_curriculares"
ADD CONSTRAINT "unidades_curriculares_carga_horaria_check"
CHECK ("carga_horaria" > 0);
