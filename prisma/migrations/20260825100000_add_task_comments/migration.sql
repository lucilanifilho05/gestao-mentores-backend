CREATE TABLE "comentarios_tarefa" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tarefa_id" UUID NOT NULL,
  "autor_id" UUID NOT NULL,
  "conteudo" TEXT NOT NULL,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lido_em" TIMESTAMPTZ(3),

  CONSTRAINT "comentarios_tarefa_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "comentarios_tarefa"
  ADD CONSTRAINT "comentarios_tarefa_tarefa_id_fkey"
  FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios_tarefa"
  ADD CONSTRAINT "comentarios_tarefa_autor_id_fkey"
  FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "comentarios_tarefa_tarefa_criado_em_idx"
  ON "comentarios_tarefa"("tarefa_id", "criado_em");
CREATE INDEX "comentarios_tarefa_tarefa_lido_em_idx"
  ON "comentarios_tarefa"("tarefa_id", "lido_em");
CREATE INDEX "comentarios_tarefa_autor_idx"
  ON "comentarios_tarefa"("autor_id");
