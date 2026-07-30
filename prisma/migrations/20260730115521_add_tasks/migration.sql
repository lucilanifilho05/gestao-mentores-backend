-- CreateEnum
CREATE TYPE "escopo_tarefa" AS ENUM ('curso', 'turma', 'evento_macro');

-- CreateEnum
CREATE TYPE "status_tarefa" AS ENUM ('pendente', 'concluida');

-- CreateTable
CREATE TABLE "tarefas" (
    "id" UUID NOT NULL,
    "tipo_atividade_id" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "criado_por_id" UUID NOT NULL,
    "responsavel_id" UUID NOT NULL,
    "escopo" "escopo_tarefa" NOT NULL,
    "curso_id" UUID,
    "turma_id" UUID,
    "prazo_inicio" TIMESTAMPTZ(3),
    "prazo_atual" TIMESTAMPTZ(3) NOT NULL,
    "status" "status_tarefa" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "concluido_em" TIMESTAMPTZ(3),

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reagendamentos" (
    "id" UUID NOT NULL,
    "tarefa_id" UUID NOT NULL,
    "prazo_anterior" TIMESTAMPTZ(3) NOT NULL,
    "prazo_novo" TIMESTAMPTZ(3) NOT NULL,
    "justificativa" TEXT,
    "reagendado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reagendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarefas_responsavel_status_prazo_idx" ON "tarefas"("responsavel_id", "status", "prazo_atual");

-- CreateIndex
CREATE INDEX "tarefas_curso_prazo_idx" ON "tarefas"("curso_id", "prazo_atual");

-- CreateIndex
CREATE INDEX "tarefas_turma_prazo_idx" ON "tarefas"("turma_id", "prazo_atual");

-- CreateIndex
CREATE INDEX "tarefas_tipo_atividade_idx" ON "tarefas"("tipo_atividade_id");

-- CreateIndex
CREATE INDEX "tarefas_criado_por_idx" ON "tarefas"("criado_por_id");

-- CreateIndex
CREATE INDEX "reagendamentos_tarefa_criado_em_idx" ON "reagendamentos"("tarefa_id", "criado_em");

-- CreateIndex
CREATE INDEX "reagendamentos_usuario_idx" ON "reagendamentos"("reagendado_por_id");

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_tipo_atividade_id_fkey" FOREIGN KEY ("tipo_atividade_id") REFERENCES "tipos_atividade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reagendamentos" ADD CONSTRAINT "reagendamentos_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reagendamentos" ADD CONSTRAINT "reagendamentos_reagendado_por_id_fkey" FOREIGN KEY ("reagendado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tarefas"
ADD CONSTRAINT "tarefas_prazo_check"
CHECK (
  "prazo_inicio" IS NULL
  OR "prazo_atual" >= "prazo_inicio"
);

ALTER TABLE "tarefas"
ADD CONSTRAINT "tarefas_escopo_check"
CHECK (
  (
    "escopo" = 'curso'
    AND "curso_id" IS NOT NULL
    AND "turma_id" IS NULL
  )
  OR
  (
    "escopo" = 'turma'
    AND "curso_id" IS NOT NULL
    AND "turma_id" IS NOT NULL
  )
  OR
  (
    "escopo" = 'evento_macro'
    AND "curso_id" IS NULL
    AND "turma_id" IS NULL
  )
);

ALTER TABLE "tarefas"
ADD CONSTRAINT "tarefas_conclusao_check"
CHECK (
  (
    "status" = 'pendente'
    AND "concluido_em" IS NULL
  )
  OR
  (
    "status" = 'concluida'
    AND "concluido_em" IS NOT NULL
  )
);