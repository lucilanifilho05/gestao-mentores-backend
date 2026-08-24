-- O UUID permanece como chave técnica. O número é um identificador público,
-- sequencial e imutável para facilitar a localização das tarefas.
ALTER TABLE "tarefas" ADD COLUMN "numero" INTEGER;

-- Numera registros existentes de forma determinística.
WITH "tarefas_numeradas" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "criado_em", "id")::INTEGER AS "numero"
  FROM "tarefas"
)
UPDATE "tarefas" AS "tarefa"
SET "numero" = "tarefas_numeradas"."numero"
FROM "tarefas_numeradas"
WHERE "tarefa"."id" = "tarefas_numeradas"."id";

CREATE SEQUENCE "tarefas_numero_seq";

-- Em uma base vazia, o primeiro nextval retorna 1. Em uma base com tarefas,
-- continua a partir do maior número atribuído acima.
SELECT setval(
  '"tarefas_numero_seq"',
  COALESCE((SELECT MAX("numero") FROM "tarefas"), 1),
  EXISTS(SELECT 1 FROM "tarefas")
);

ALTER SEQUENCE "tarefas_numero_seq" OWNED BY "tarefas"."numero";
ALTER TABLE "tarefas"
  ALTER COLUMN "numero" SET DEFAULT nextval('"tarefas_numero_seq"'),
  ALTER COLUMN "numero" SET NOT NULL;

CREATE UNIQUE INDEX "tarefas_numero_key" ON "tarefas"("numero");
