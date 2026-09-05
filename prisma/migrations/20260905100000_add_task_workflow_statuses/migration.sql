-- Recria o enum para que o novo valor possa ser usado como default na mesma
-- transação da migration. As tarefas abertas existentes são preservadas como
-- atividades já em andamento.
ALTER TABLE "tarefas" DROP CONSTRAINT IF EXISTS "tarefas_conclusao_check";
ALTER TABLE "tarefas" ALTER COLUMN "status" DROP DEFAULT;

-- Os testes abaixo também permitem repetir a migration com segurança caso uma
-- execução anterior tenha parado depois de renomear/criar os tipos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type tipo
    JOIN pg_enum valor ON valor.enumtypid = tipo.oid
    WHERE tipo.typname = 'status_tarefa'
      AND valor.enumlabel = 'pendente'
  ) THEN
    ALTER TYPE "status_tarefa" RENAME TO "status_tarefa_anterior";
  END IF;

  IF to_regtype('status_tarefa') IS NULL THEN
    CREATE TYPE "status_tarefa" AS ENUM (
      'planejada',
      'em_andamento',
      'concluida'
    );
  END IF;
END
$$;

ALTER TABLE "tarefas"
  ALTER COLUMN "status" TYPE "status_tarefa"
  USING (
    CASE "status"::text
      WHEN 'pendente' THEN 'em_andamento'
      ELSE "status"::text
    END
  )::"status_tarefa";

DROP TYPE IF EXISTS "status_tarefa_anterior";

ALTER TABLE "tarefas"
  ALTER COLUMN "status" SET DEFAULT 'planejada',
  ADD COLUMN IF NOT EXISTS "iniciado_em" TIMESTAMPTZ(3);

ALTER TABLE "tarefas"
ADD CONSTRAINT "tarefas_conclusao_check"
CHECK (
  (
    "status" IN ('planejada', 'em_andamento')
    AND "concluido_em" IS NULL
  )
  OR
  (
    "status" = 'concluida'
    AND "concluido_em" IS NOT NULL
  )
);

-- Não existe uma data histórica de início; a criação é a melhor referência
-- disponível para os registros migrados.
UPDATE "tarefas"
SET "iniciado_em" = "criado_em"
WHERE "status" = 'em_andamento';
