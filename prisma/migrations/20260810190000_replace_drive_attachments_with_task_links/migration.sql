ALTER TABLE "tarefas"
ADD COLUMN "links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DROP TABLE IF EXISTS "anexos_tarefa";
DROP TABLE IF EXISTS "google_drive_tokens";
