CREATE TABLE "tarefa_participantes" (
  "tarefa_id" UUID NOT NULL,
  "mentor_id" UUID NOT NULL,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visualizado_em" TIMESTAMPTZ(3),

  CONSTRAINT "tarefa_participantes_pkey" PRIMARY KEY ("tarefa_id", "mentor_id")
);

CREATE INDEX "tarefa_participantes_mentor_visualizado_idx"
  ON "tarefa_participantes"("mentor_id", "visualizado_em");

ALTER TABLE "tarefa_participantes"
  ADD CONSTRAINT "tarefa_participantes_tarefa_id_fkey"
  FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tarefa_participantes"
  ADD CONSTRAINT "tarefa_participantes_mentor_id_fkey"
  FOREIGN KEY ("mentor_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
