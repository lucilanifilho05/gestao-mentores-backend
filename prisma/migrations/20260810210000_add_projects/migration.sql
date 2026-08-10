CREATE TYPE "status_projeto" AS ENUM ('planejamento', 'em_andamento', 'concluido', 'cancelado');

CREATE TABLE "projetos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "criado_por_id" UUID NOT NULL,
    "responsavel_id" UUID,
    "escopo" "escopo_tarefa" NOT NULL,
    "curso_id" UUID,
    "turma_id" UUID,
    "data_inicio" TIMESTAMPTZ(3),
    "prazo_final" TIMESTAMPTZ(3) NOT NULL,
    "status" "status_projeto" NOT NULL DEFAULT 'planejamento',
    "links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "concluido_em" TIMESTAMPTZ(3),
    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

INSERT INTO "projetos" ("id", "nome", "descricao", "criado_por_id", "responsavel_id", "escopo", "curso_id", "turma_id", "data_inicio", "prazo_final", "status", "links", "criado_em", "atualizado_em", "concluido_em")
SELECT "id", LEFT('Projeto legado - ' || "titulo", 200), "descricao", "criado_por_id", "responsavel_id", "escopo", "curso_id", "turma_id", "prazo_inicio", "prazo_atual",
  CASE WHEN "status" = 'concluida' THEN 'concluido'::"status_projeto" ELSE 'em_andamento'::"status_projeto" END,
  ARRAY[]::TEXT[], "criado_em", "atualizado_em", "concluido_em"
FROM "tarefas";

ALTER TABLE "tarefas" ADD COLUMN "projeto_id" UUID;
UPDATE "tarefas" SET "projeto_id" = "id";
ALTER TABLE "tarefas" ALTER COLUMN "projeto_id" SET NOT NULL;

CREATE INDEX "projetos_status_prazo_idx" ON "projetos"("status", "prazo_final");
CREATE INDEX "projetos_responsavel_status_idx" ON "projetos"("responsavel_id", "status");
CREATE INDEX "projetos_curso_prazo_idx" ON "projetos"("curso_id", "prazo_final");
CREATE INDEX "projetos_turma_prazo_idx" ON "projetos"("turma_id", "prazo_final");
CREATE INDEX "projetos_criado_por_idx" ON "projetos"("criado_por_id");
CREATE INDEX "tarefas_projeto_status_prazo_idx" ON "tarefas"("projeto_id", "status", "prazo_atual");

ALTER TABLE "projetos" ADD CONSTRAINT "projetos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projetos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
