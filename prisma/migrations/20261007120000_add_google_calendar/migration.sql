CREATE TABLE "google_calendar_connections" (
  "id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "google_subject" TEXT NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "calendar_id" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_calendar_connections_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "google_calendar_connections_usuario_id_key" ON "google_calendar_connections"("usuario_id");

CREATE TABLE "google_calendar_authorizations" (
  "state_hash" TEXT NOT NULL,
  "usuario_id" UUID NOT NULL,
  "token_version" INTEGER NOT NULL,
  "verifier" TEXT NOT NULL,
  "expira_em" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "google_calendar_authorizations_pkey" PRIMARY KEY ("state_hash"),
  CONSTRAINT "google_calendar_authorizations_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "google_calendar_authorizations_expira_em_idx" ON "google_calendar_authorizations"("expira_em");

CREATE TABLE "google_calendar_events" (
  "id" UUID NOT NULL,
  "tarefa_id" UUID NOT NULL,
  "conexao_id" UUID NOT NULL,
  "titulo" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "inicio" TIMESTAMPTZ(3) NOT NULL,
  "fim" TIMESTAMPTZ(3) NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "proxima_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" UUID,
  "erro" VARCHAR(200),
  "sincronizado_em" TIMESTAMPTZ(3),
  CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_calendar_events_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "google_calendar_events_conexao_id_fkey" FOREIGN KEY ("conexao_id") REFERENCES "google_calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "google_calendar_events_tarefa_id_conexao_id_key" ON "google_calendar_events"("tarefa_id", "conexao_id");
CREATE INDEX "google_calendar_events_estado_proxima_em_idx" ON "google_calendar_events"("estado", "proxima_em");
