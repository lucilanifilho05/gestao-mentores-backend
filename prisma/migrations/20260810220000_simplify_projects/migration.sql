DROP INDEX IF EXISTS "projetos_responsavel_status_idx";
DROP INDEX IF EXISTS "projetos_curso_prazo_idx";
DROP INDEX IF EXISTS "projetos_turma_prazo_idx";

ALTER TABLE "projetos" DROP CONSTRAINT IF EXISTS "projetos_responsavel_id_fkey";
ALTER TABLE "projetos" DROP CONSTRAINT IF EXISTS "projetos_curso_id_fkey";
ALTER TABLE "projetos" DROP CONSTRAINT IF EXISTS "projetos_turma_id_fkey";

ALTER TABLE "projetos"
  DROP COLUMN "responsavel_id",
  DROP COLUMN "escopo",
  DROP COLUMN "curso_id",
  DROP COLUMN "turma_id",
  DROP COLUMN "links";
