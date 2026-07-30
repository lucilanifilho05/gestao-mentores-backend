-- CreateTable
CREATE TABLE "anexos_tarefa" (
    "id" UUID NOT NULL,
    "tarefa_id" UUID NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "drive_file_id" VARCHAR(255) NOT NULL,
    "enviado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_drive_tokens" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'principal',
    "refresh_token_cifrado" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "google_drive_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anexos_tarefa_drive_file_id_key" ON "anexos_tarefa"("drive_file_id");

-- CreateIndex
CREATE INDEX "anexos_tarefa_tarefa_criado_em_idx" ON "anexos_tarefa"("tarefa_id", "criado_em");

-- CreateIndex
CREATE INDEX "anexos_tarefa_enviado_por_idx" ON "anexos_tarefa"("enviado_por_id");

-- AddForeignKey
ALTER TABLE "anexos_tarefa" ADD CONSTRAINT "anexos_tarefa_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos_tarefa" ADD CONSTRAINT "anexos_tarefa_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "anexos_tarefa"
ADD CONSTRAINT "anexos_tarefa_tamanho_check"
CHECK ("tamanho_bytes" > 0);