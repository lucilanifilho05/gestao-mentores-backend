import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createHmac,
    randomBytes,
    timingSafeEqual,
} from 'node:crypto';
import { Readable } from 'node:stream';

import { google } from 'googleapis';

import {
    cifrarSegredo,
    decifrarSegredo,
} from '../common/security/secret-box';
import { PrismaService } from '../prisma/prisma.service';

interface OAuthStatePayload {
    sub: string;
    exp: number;
    nonce: string;
}

interface ArquivoDrive {
    id: string;
}

@Injectable()
export class GoogleDriveService {
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private readonly stateSecret: string;
    private readonly encryptionKey: string;
    private readonly folderId?: string;

    constructor(
        private readonly prisma: PrismaService,
        configService: ConfigService,
    ) {
        this.clientId =
            configService.getOrThrow<string>(
                'GOOGLE_CLIENT_ID',
            );

        this.clientSecret =
            configService.getOrThrow<string>(
                'GOOGLE_CLIENT_SECRET',
            );

        this.redirectUri =
            configService.getOrThrow<string>(
                'GOOGLE_REDIRECT_URI',
            );

        this.stateSecret =
            configService.getOrThrow<string>(
                'GOOGLE_OAUTH_STATE_SECRET',
            );

        this.encryptionKey =
            configService.getOrThrow<string>(
                'DRIVE_TOKEN_ENCRYPTION_KEY',
            );

        const folderId =
            configService.get<string>(
                'GOOGLE_DRIVE_FOLDER_ID',
            );

        this.folderId =
            folderId?.trim() || undefined;
    }

    gerarUrlAutorizacao(
        usuarioId: string,
    ): string {
        const oauthClient =
            this.criarOAuthClient();

        return oauthClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: true,

            scope: [
                'https://www.googleapis.com/auth/drive.file',
            ],

            state: this.gerarState(usuarioId),
        });
    }

    async processarCallback(
        code: string,
        state: string,
    ) {
        const statePayload =
            this.validarState(state);

        const oauthClient =
            this.criarOAuthClient();

        try {
            const { tokens } =
                await oauthClient.getToken(code);

            const tokenAtual =
                await this.prisma.googleDriveToken.findUnique({
                    where: {
                        id: 'principal',
                    },
                });

            const refreshTokenAnterior =
                tokenAtual
                    ? decifrarSegredo(
                        tokenAtual.refreshTokenCifrado,
                        this.encryptionKey,
                    )
                    : null;

            const refreshToken =
                tokens.refresh_token ??
                refreshTokenAnterior;

            if (!refreshToken) {
                throw new BadRequestException(
                    'O Google não retornou um refresh token. Revogue o acesso anterior e autorize novamente.',
                );
            }

            await this.prisma.googleDriveToken.upsert({
                where: {
                    id: 'principal',
                },

                create: {
                    id: 'principal',

                    refreshTokenCifrado:
                        cifrarSegredo(
                            refreshToken,
                            this.encryptionKey,
                        ),
                },

                update: {
                    refreshTokenCifrado:
                        cifrarSegredo(
                            refreshToken,
                            this.encryptionKey,
                        ),
                },
            });

            return {
                autorizado: true,
                autorizadoPorId:
                    statePayload.sub,

                mensagem:
                    'Google Drive autorizado com sucesso. Esta aba pode ser fechada.',
            };
        } catch (erro: unknown) {
            if (
                erro instanceof
                BadRequestException
            ) {
                throw erro;
            }

            throw new BadGatewayException(
                'Não foi possível concluir a autorização com o Google Drive.',
            );
        }
    }

    async obterStatus() {
        const token =
            await this.prisma.googleDriveToken.findUnique({
                where: {
                    id: 'principal',
                },

                select: {
                    atualizadoEm: true,
                },
            });

        return {
            autorizado: Boolean(token),
            atualizadoEm:
                token?.atualizadoEm ?? null,
        };
    }

    async uploadArquivo(
        nomeArquivo: string,
        conteudo: Buffer,
        mimeType: string,
    ): Promise<ArquivoDrive> {
        const oauthClient =
            await this.obterOAuthAutorizado();

        const drive = google.drive({
            version: 'v3',
            auth: oauthClient,
        });

        try {
            const response =
                await drive.files.create({
                    requestBody: {
                        name: nomeArquivo,

                        ...(this.folderId
                            ? {
                                parents: [
                                    this.folderId,
                                ],
                            }
                            : {}),
                    },

                    media: {
                        mimeType,
                        body: Readable.from(conteudo),
                    },

                    fields: 'id',
                    supportsAllDrives: true,
                });

            if (!response.data.id) {
                throw new Error(
                    'Google Drive não retornou o ID do arquivo.',
                );
            }

            return {
                id: response.data.id,
            };
        } catch {
            throw new BadGatewayException(
                'Não foi possível enviar o arquivo ao Google Drive.',
            );
        }
    }

    async gerarLinkVisualizacao(
        driveFileId: string,
    ): Promise<string> {
        const oauthClient =
            await this.obterOAuthAutorizado();

        const drive = google.drive({
            version: 'v3',
            auth: oauthClient,
        });

        try {
            const response =
                await drive.files.get({
                    fileId: driveFileId,
                    fields: 'id, webViewLink',
                    supportsAllDrives: true,
                });

            return (
                response.data.webViewLink ??
                `https://drive.google.com/file/d/${encodeURIComponent(
                    driveFileId,
                )}/view`
            );
        } catch {
            throw new BadGatewayException(
                'Não foi possível obter o link do arquivo no Google Drive.',
            );
        }
    }

    async excluirArquivoSilenciosamente(
        driveFileId: string,
    ): Promise<void> {
        try {
            const oauthClient =
                await this.obterOAuthAutorizado();

            const drive = google.drive({
                version: 'v3',
                auth: oauthClient,
            });

            await drive.files.delete({
                fileId: driveFileId,
                supportsAllDrives: true,
            });
        } catch {
            /*
             * Compensação de melhor esforço.
             * O erro original da operação será preservado.
             */
        }
    }

    private criarOAuthClient() {
        return new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri,
        );
    }

    private async obterOAuthAutorizado() {
        const token =
            await this.prisma.googleDriveToken.findUnique({
                where: {
                    id: 'principal',
                },
            });

        if (!token) {
            throw new ServiceUnavailableException(
                'O Google Drive ainda não foi autorizado.',
            );
        }

        const refreshToken =
            decifrarSegredo(
                token.refreshTokenCifrado,
                this.encryptionKey,
            );

        const oauthClient =
            this.criarOAuthClient();

        oauthClient.setCredentials({
            refresh_token: refreshToken,
        });

        return oauthClient;
    }

    private gerarState(
        usuarioId: string,
    ): string {
        const payload: OAuthStatePayload = {
            sub: usuarioId,
            exp:
                Math.floor(Date.now() / 1000) +
                10 * 60,
            nonce:
                randomBytes(16).toString('hex'),
        };

        const payloadBase64 = Buffer.from(
            JSON.stringify(payload),
            'utf8',
        ).toString('base64url');

        const assinatura =
            this.assinarState(payloadBase64);

        return `${payloadBase64}.${assinatura}`;
    }

    private validarState(
        state: string,
    ): OAuthStatePayload {
        const partes = state.split('.');

        if (partes.length !== 2) {
            throw new BadRequestException(
                'State OAuth inválido.',
            );
        }

        const [
            payloadBase64,
            assinaturaRecebida,
        ] = partes;

        const assinaturaEsperada =
            this.assinarState(payloadBase64);

        const recebida = Buffer.from(
            assinaturaRecebida,
            'base64url',
        );

        const esperada = Buffer.from(
            assinaturaEsperada,
            'base64url',
        );

        if (
            recebida.length !== esperada.length ||
            !timingSafeEqual(
                recebida,
                esperada,
            )
        ) {
            throw new BadRequestException(
                'State OAuth inválido.',
            );
        }

        let payload: OAuthStatePayload;

        try {
            payload = JSON.parse(
                Buffer.from(
                    payloadBase64,
                    'base64url',
                ).toString('utf8'),
            ) as OAuthStatePayload;
        } catch {
            throw new BadRequestException(
                'State OAuth inválido.',
            );
        }

        if (
            !payload.sub ||
            !payload.exp ||
            payload.exp <
            Math.floor(Date.now() / 1000)
        ) {
            throw new BadRequestException(
                'State OAuth expirado ou inválido.',
            );
        }

        return payload;
    }

    private assinarState(
        payloadBase64: string,
    ): string {
        return createHmac(
            'sha256',
            this.stateSecret,
        )
            .update(payloadBase64)
            .digest('base64url');
    }
}