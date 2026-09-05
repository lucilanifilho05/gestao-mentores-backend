-- Recria o enum para que o novo valor possa ser usado como default na mesma
-- transação da migration. As tarefas abertas existentes são preservadas como
-- atividades já em andamento.
ALTER TABLE "tarefas" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "status_tarefa" RENAME TO "status_tarefa_anterior";
CREATE TYPE "status_tarefa" AS ENUM ('planejada', 'em_andamento', 'concluida');

ALTER TABLE "tarefas"
  ALTER COLUMN "status" TYPE "status_tarefa"
  USING (
    CASE "status"::text
      WHEN 'pendente' THEN 'em_andamento'
      ELSE "status"::text
    END
  )::"status_tarefa";

DROP TYPE "status_tarefa_anterior";

ALTER TABLE "tarefas"
  ALTER COLUMN "status" SET DEFAULT 'planejada',
  ADD COLUMN "iniciado_em" TIMESTAMPTZ(3);

-- Não existe uma data histórica de início; a criação é a melhor referência
-- disponível para os registros migrados.
UPDATE "tarefas"
SET "iniciado_em" = "criado_em"
WHERE "status" = 'em_andamento';
