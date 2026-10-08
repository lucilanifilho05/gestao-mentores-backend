import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EstadoEventoGoogle, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CALENDAR_SCOPE,
  GoogleApiError,
  GoogleCalendarClient,
} from './google-calendar.client';
import {
  decryptSecret,
  encryptSecret,
  hashState,
  sameState,
} from './google-calendar.crypto';

interface NewCalendarTask {
  id: string;
  responsavelId: string;
  titulo: string;
  numero: number;
  prazoInicio: Date | null;
  prazoAtual: Date;
}

@Injectable()
export class GoogleCalendarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private timer?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly google: GoogleCalendarClient,
  ) {}

  enabled(): boolean {
    return this.config.get<boolean>('GOOGLE_CALENDAR_ENABLED', false);
  }
  private key(): string {
    return this.config.getOrThrow<string>('GOOGLE_TOKEN_ENCRYPTION_KEY');
  }
  private requireEnabled(): void {
    if (!this.enabled())
      throw new ServiceUnavailableException(
        'A integração com o Google Agenda ainda não foi configurada.',
      );
  }

  async status(usuarioId: string) {
    if (!this.enabled())
      return {
        disponivel: false,
        conectado: false,
        email: null,
        pendentes: 0,
        falhas: 0,
      };
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { usuarioId },
    });
    const counts = connection
      ? await this.prisma.googleCalendarEvent.groupBy({
          by: ['estado'],
          where: { conexaoId: connection.id },
          _count: true,
        })
      : [];
    return {
      disponivel: true,
      conectado: connection?.ativo ?? false,
      email: connection?.email ?? null,
      pendentes: counts
        .filter((row) => row.estado === EstadoEventoGoogle.PENDENTE)
        .reduce((sum, row) => sum + row._count, 0),
      falhas: counts
        .filter((row) => row.estado === EstadoEventoGoogle.FALHA)
        .reduce((sum, row) => sum + row._count, 0),
    };
  }

  async authorize(usuarioId: string): Promise<{ url: string; state: string }> {
    this.requireEnabled();
    const user = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
    });
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    await this.prisma.$transaction(async (tx) => {
      await tx.googleCalendarAuthorization.deleteMany({
        where: { OR: [{ usuarioId }, { expiraEm: { lt: new Date() } }] },
      });
      await tx.googleCalendarAuthorization.create({
        data: {
          stateHash: hashState(state),
          usuarioId,
          tokenVersion: user.tokenVersion,
          verifier: encryptSecret(verifier, this.key()),
          expiraEm: new Date(Date.now() + 10 * 60_000),
        },
      });
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope: `${CALENDAR_SCOPE} openid email`,
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return { url: url.toString(), state };
  }

  async callback(
    state: string,
    cookieState: string,
    code?: string,
    denied = false,
  ): Promise<void> {
    this.requireEnabled();
    if (!state || !cookieState || !sameState(state, cookieState))
      throw new BadRequestException('Autorização inválida.');
    const authorization =
      await this.prisma.googleCalendarAuthorization.findUnique({
        where: { stateHash: hashState(state) },
        include: { usuario: true },
      });
    if (
      !authorization ||
      authorization.expiraEm <= new Date() ||
      !authorization.usuario.ativo ||
      authorization.tokenVersion !== authorization.usuario.tokenVersion
    )
      throw new BadRequestException('Autorização expirada.');
    const consumed = await this.prisma.googleCalendarAuthorization.deleteMany({
      where: { stateHash: authorization.stateHash },
    });
    if (!consumed.count)
      throw new BadRequestException('Autorização já utilizada.');
    if (denied || !code)
      throw new BadRequestException('Acesso ao Google Agenda não autorizado.');
    const tokens = await this.google.exchange(
      code,
      decryptSecret(authorization.verifier, this.key()),
    );
    if (
      !tokens.refresh_token ||
      !tokens.scope?.split(' ').includes(CALENDAR_SCOPE)
    )
      throw new BadRequestException(
        'Autorize o acesso ao calendário para continuar.',
      );
    const identity = await this.google.identity(tokens.access_token);
    if (!identity.sub || !identity.email || !identity.email_verified)
      throw new BadRequestException('Conta Google inválida.');
    const current = await this.prisma.googleCalendarConnection.findUnique({
      where: { usuarioId: authorization.usuarioId },
    });
    if (current && current.googleSubject !== identity.sub)
      throw new BadRequestException(
        'Desconecte a conta atual antes de conectar outra.',
      );

    // Keep Google network calls outside database transactions. If another
    // callback wins the race, the redundant calendar is removed afterwards.
    const createdCalendarId = current
      ? undefined
      : (await this.google.createCalendar(tokens.access_token)).id;
    try {
      const usedCreatedCalendar = await this.prisma.$transaction(
        async (tx) => {
          // Serialize connections for one local user across backend replicas.
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${authorization.usuarioId}))`;
          const user = await tx.usuario.findUniqueOrThrow({
            where: { id: authorization.usuarioId },
          });
          if (!user.ativo || user.tokenVersion !== authorization.tokenVersion)
            throw new BadRequestException('Autorização expirada.');
          const existing = await tx.googleCalendarConnection.findUnique({
            where: { usuarioId: authorization.usuarioId },
          });
          if (existing && existing.googleSubject !== identity.sub)
            throw new BadRequestException(
              'Desconecte a conta atual antes de conectar outra.',
            );
          if (!existing && !createdCalendarId)
            throw new ServiceUnavailableException(
              'A conexão foi alterada durante a autorização. Tente novamente.',
            );
          const calendarId = existing?.calendarId ?? createdCalendarId!;
          await tx.googleCalendarConnection.upsert({
            where: { usuarioId: authorization.usuarioId },
            create: {
              usuarioId: authorization.usuarioId,
              googleSubject: identity.sub,
              email: identity.email,
              refreshToken: encryptSecret(tokens.refresh_token!, this.key()),
              calendarId,
            },
            update: {
              email: identity.email,
              refreshToken: encryptSecret(tokens.refresh_token!, this.key()),
              ativo: true,
            },
          });
          return !existing;
        },
        { timeout: 10000 },
      );
      if (createdCalendarId && !usedCreatedCalendar)
        await this.removeUnusedCalendar(tokens.access_token, createdCalendarId);
    } catch (error) {
      if (createdCalendarId)
        await this.removeUnusedCalendar(tokens.access_token, createdCalendarId);
      throw error;
    }
  }

  private async removeUnusedCalendar(
    accessToken: string,
    calendarId: string,
  ): Promise<void> {
    try {
      await this.google.deleteCalendar(accessToken, calendarId);
    } catch {
      this.logger.warn(
        'Não foi possível remover um calendário criado durante uma autorização incompleta.',
      );
    }
  }

  callbackUrl(result: 'conectado' | 'erro'): string {
    const url = new URL(
      '/minha-conta',
      this.config.getOrThrow<string>('GOOGLE_FRONTEND_URL'),
    );
    url.searchParams.set('googleAgenda', result);
    return url.toString();
  }

  async disconnect(usuarioId: string): Promise<void> {
    this.requireEnabled();
    const connection = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${usuarioId}))`;
      const existing = await tx.googleCalendarConnection.findUnique({
        where: { usuarioId },
      });
      await tx.googleCalendarAuthorization.deleteMany({ where: { usuarioId } });
      await tx.googleCalendarConnection.deleteMany({ where: { usuarioId } });
      return existing;
    });
    if (connection) {
      try {
        await this.google.revoke(
          decryptSecret(connection.refreshToken, this.key()),
        );
      } catch {
        this.logger.warn(
          'Conexão removida localmente; revogação externa não confirmada.',
        );
      }
    }
  }

  async enqueue(
    tx: Prisma.TransactionClient,
    tasks: NewCalendarTask[],
  ): Promise<void> {
    if (!this.enabled() || tasks.length === 0) return;
    const connections = await tx.googleCalendarConnection.findMany({
      where: {
        usuarioId: { in: tasks.map((task) => task.responsavelId) },
        ativo: true,
        usuario: { ativo: true },
      },
    });
    const data = tasks.flatMap((task) => {
      const connection = connections.find(
        (item) => item.usuarioId === task.responsavelId,
      );
      if (
        !connection ||
        !task.prazoInicio ||
        task.prazoAtual <= task.prazoInicio
      )
        return [];
      return [
        {
          tarefaId: task.id,
          conexaoId: connection.id,
          titulo: task.titulo,
          numero: task.numero,
          inicio: task.prazoInicio,
          fim: task.prazoAtual,
        },
      ];
    });
    if (data.length)
      await tx.googleCalendarEvent.createMany({ data, skipDuplicates: true });
  }

  async retry(usuarioId: string): Promise<void> {
    this.requireEnabled();
    await this.prisma.googleCalendarEvent.updateMany({
      where: {
        estado: EstadoEventoGoogle.FALHA,
        conexao: { usuarioId, ativo: true },
      },
      data: {
        estado: EstadoEventoGoogle.PENDENTE,
        tentativas: 0,
        proximaEm: new Date(),
        leaseToken: null,
        erro: null,
      },
    });
  }

  onModuleInit(): void {
    if (!this.enabled()) return;
    this.timer = setInterval(() => {
      void this.processPending().catch(() => {
        this.logger.warn(
          'Não foi possível processar a fila do Google Agenda; nova tentativa ocorrerá automaticamente.',
        );
      });
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processPending(): Promise<void> {
    if (this.processing || !this.enabled()) return;
    this.processing = true;
    try {
      const jobs = await this.prisma.googleCalendarEvent.findMany({
        where: {
          estado: EstadoEventoGoogle.PENDENTE,
          proximaEm: { lte: new Date() },
          conexao: { ativo: true, usuario: { ativo: true } },
        },
        orderBy: { proximaEm: 'asc' },
        take: 10,
        include: { conexao: true },
      });
      for (const job of jobs) {
        const leaseToken = randomUUID();
        const claim = await this.prisma.googleCalendarEvent.updateMany({
          where: {
            id: job.id,
            estado: EstadoEventoGoogle.PENDENTE,
            proximaEm: { lte: new Date() },
          },
          data: {
            leaseToken,
            proximaEm: new Date(Date.now() + 120_000),
            tentativas: { increment: 1 },
          },
        });
        if (!claim.count) continue;
        try {
          const tokens = await this.google.refresh(
            decryptSecret(job.conexao.refreshToken, this.key()),
          );
          const stillActive = await this.prisma.googleCalendarConnection.count({
            where: { id: job.conexaoId, ativo: true, usuario: { ativo: true } },
          });
          if (!stillActive) continue;
          await this.google.insertEvent(
            tokens.access_token,
            job.conexao.calendarId,
            {
              id: job.id.replaceAll('-', ''),
              summary: `#${job.numero} — ${job.titulo}`,
              start: {
                dateTime: job.inicio.toISOString(),
                timeZone: 'America/Fortaleza',
              },
              end: {
                dateTime: job.fim.toISOString(),
                timeZone: 'America/Fortaleza',
              },
              transparency: 'transparent',
              description:
                'Período de execução da tarefa na Gestão de Mentores.',
              extendedProperties: { private: { tarefaId: job.tarefaId } },
            },
          );
          await this.prisma.googleCalendarEvent.updateMany({
            where: { id: job.id, leaseToken },
            data: {
              estado: EstadoEventoGoogle.SINCRONIZADO,
              sincronizadoEm: new Date(),
              leaseToken: null,
              erro: null,
            },
          });
        } catch (error) {
          const revoked =
            error instanceof GoogleApiError && error.reason === 'invalid_grant';
          if (revoked)
            await this.prisma.googleCalendarConnection.updateMany({
              where: {
                id: job.conexaoId,
                refreshToken: job.conexao.refreshToken,
              },
              data: { ativo: false },
            });
          const retryable =
            !(error instanceof GoogleApiError) ||
            error.status === 429 ||
            error.status >= 500 ||
            [
              'rateLimitExceeded',
              'userRateLimitExceeded',
              'quotaExceeded',
            ].includes(error.reason);
          const failed = revoked || !retryable || job.tentativas + 1 >= 8;
          await this.prisma.googleCalendarEvent.updateMany({
            where: { id: job.id, leaseToken },
            data: {
              estado: failed
                ? EstadoEventoGoogle.FALHA
                : EstadoEventoGoogle.PENDENTE,
              leaseToken: null,
              proximaEm: new Date(
                Date.now() + Math.min(3600_000, 15000 * 2 ** job.tentativas),
              ),
              erro: revoked
                ? 'Reconecte sua conta Google.'
                : 'Não foi possível criar o evento no Google Agenda.',
            },
          });
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
