CREATE TYPE "estado_evento_google" AS ENUM ('PENDENTE', 'SINCRONIZADO', 'FALHA');

ALTER TABLE "google_calendar_events"
  ALTER COLUMN "estado" DROP DEFAULT,
  ALTER COLUMN "estado" TYPE "estado_evento_google"
    USING ("estado"::text::"estado_evento_google"),
  ALTER COLUMN "estado" SET DEFAULT 'PENDENTE';
