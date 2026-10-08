import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CALENDAR_SCOPE,
  GoogleApiError,
  GoogleCalendarClient,
} from './google-calendar.client';
import { encryptSecret, hashState } from './google-calendar.crypto';
import { GoogleCalendarService } from './google-calendar.service';

function containing(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value) as unknown;
}

describe('GoogleCalendarService', () => {
  const key = 'ab'.repeat(32);
  const userId = '11111111-1111-4111-8111-111111111111';
  const connection = {
    id: 'connection',
    usuarioId: userId,
    ativo: true,
    calendarId: 'calendar',
    refreshToken: encryptSecret('refresh', key),
    googleSubject: 'subject',
    email: 'google@example.com',
  };
  const task = {
    id: 'task',
    responsavelId: userId,
    titulo: 'Preparar aula',
    numero: 12,
    prazoInicio: new Date('2026-10-10T12:00:00Z'),
    prazoAtual: new Date('2026-10-10T15:00:00Z'),
  };
  let service: GoogleCalendarService;
  let db: {
    googleCalendarAuthorization: {
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    googleCalendarConnection: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    googleCalendarEvent: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      groupBy: jest.Mock;
    };
    usuario: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let google: {
    exchange: jest.Mock;
    identity: jest.Mock;
    createCalendar: jest.Mock;
    deleteCalendar: jest.Mock;
    refresh: jest.Mock;
    insertEvent: jest.Mock;
    revoke: jest.Mock;
  };
  const config = new ConfigService({
    GOOGLE_CALENDAR_ENABLED: true,
    GOOGLE_TOKEN_ENCRYPTION_KEY: key,
    GOOGLE_CLIENT_ID: 'client',
    GOOGLE_REDIRECT_URI:
      'http://localhost:3000/integracoes/google-agenda/callback',
    GOOGLE_FRONTEND_URL: 'http://localhost:5173',
  });

  beforeEach(() => {
    db = {
      googleCalendarAuthorization: {
        findUnique: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      googleCalendarConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([connection]),
        upsert: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      googleCalendarEvent: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      usuario: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ativo: true, tokenVersion: 2 }),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };
    db.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback(db),
    );
    google = {
      exchange: jest.fn().mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
        scope: CALENDAR_SCOPE,
      }),
      identity: jest.fn().mockResolvedValue({
        sub: 'subject',
        email: 'google@example.com',
        email_verified: true,
      }),
      createCalendar: jest.fn().mockResolvedValue({ id: 'new-calendar' }),
      deleteCalendar: jest.fn(),
      refresh: jest.fn().mockResolvedValue({ access_token: 'access' }),
      insertEvent: jest.fn(),
      revoke: jest.fn(),
    };
    service = new GoogleCalendarService(
      db as unknown as PrismaService,
      config,
      google as unknown as GoogleCalendarClient,
    );
  });

  function authorization(expiraEm = new Date(Date.now() + 60000)) {
    db.googleCalendarAuthorization.findUnique.mockResolvedValue({
      stateHash: hashState('state'),
      usuarioId: userId,
      tokenVersion: 2,
      expiraEm,
      verifier: encryptSecret('verifier', key),
      usuario: { ativo: true, tokenVersion: 2 },
    });
  }

  it('requests calendar-only access plus account identity with offline access and PKCE', async () => {
    const result = await service.authorize(userId);
    const params = new URL(result.url).searchParams;
    expect(params.get('scope')).toBe(`${CALENDAR_SCOPE} openid email`);
    expect(params.get('access_type')).toBe('offline');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toBe(result.state);
    expect(db.googleCalendarAuthorization.create).toHaveBeenCalledWith(
      containing({
        data: containing({
          stateHash: hashState(result.state),
          usuarioId: userId,
        }),
      }),
    );
  });

  it('rejects a callback from a different browser before exchanging tokens', async () => {
    await expect(service.callback('state', 'other', 'code')).rejects.toThrow();
    expect(google.exchange).not.toHaveBeenCalled();
  });
  it('rejects expired and replayed authorization', async () => {
    authorization(new Date(0));
    await expect(service.callback('state', 'state', 'code')).rejects.toThrow();
    authorization();
    db.googleCalendarAuthorization.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.callback('state', 'state', 'code')).rejects.toThrow();
    expect(google.exchange).not.toHaveBeenCalled();
  });
  it('consumes denied authorization without accessing Google', async () => {
    authorization();
    await expect(
      service.callback('state', 'state', undefined, true),
    ).rejects.toThrow();
    expect(db.googleCalendarAuthorization.deleteMany).toHaveBeenCalled();
    expect(google.exchange).not.toHaveBeenCalled();
  });
  it('creates a separate calendar and binds encrypted credentials to the local user', async () => {
    authorization();
    await service.callback('state', 'state', 'code');
    expect(google.createCalendar).toHaveBeenCalledWith('access');
    expect(db.googleCalendarConnection.upsert).toHaveBeenCalledWith(
      containing({
        where: { usuarioId: userId },
        create: containing({
          calendarId: 'new-calendar',
          googleSubject: 'subject',
        }),
      }),
    );
    const calls = db.googleCalendarConnection.upsert.mock.calls as unknown[][];
    const saved = calls[0][0] as {
      create: { refreshToken: string };
    };
    expect(saved.create.refreshToken).not.toBe('refresh');
  });
  it('reuses the calendar for the same Google account', async () => {
    authorization();
    db.googleCalendarConnection.findUnique.mockResolvedValue(connection);
    await service.callback('state', 'state', 'code');
    expect(google.createCalendar).not.toHaveBeenCalled();
  });
  it('removes a redundant calendar created by a concurrent callback', async () => {
    authorization();
    db.googleCalendarConnection.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(connection);
    await service.callback('state', 'state', 'code');
    expect(google.deleteCalendar).toHaveBeenCalledWith(
      'access',
      'new-calendar',
    );
    expect(db.googleCalendarConnection.upsert).toHaveBeenCalledWith(
      containing({ update: containing({ ativo: true }) }),
    );
  });
  it('removes a newly created calendar when persistence fails', async () => {
    authorization();
    db.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.callback('state', 'state', 'code')).rejects.toThrow(
      'database unavailable',
    );
    expect(google.deleteCalendar).toHaveBeenCalledWith(
      'access',
      'new-calendar',
    );
  });
  it('does not replace a connection with another Google account', async () => {
    authorization();
    db.googleCalendarConnection.findUnique.mockResolvedValue({
      ...connection,
      googleSubject: 'other',
    });
    await expect(service.callback('state', 'state', 'code')).rejects.toThrow();
    expect(db.googleCalendarConnection.upsert).not.toHaveBeenCalled();
  });
  it('does not connect when the calendar scope was refused', async () => {
    authorization();
    google.exchange.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      scope: 'openid email',
    });
    await expect(service.callback('state', 'state', 'code')).rejects.toThrow();
    expect(google.createCalendar).not.toHaveBeenCalled();
  });
  it('queues only tasks of connected owners and snapshots both dates', async () => {
    await service.enqueue(
      db as unknown as Parameters<typeof service.enqueue>[0],
      [task, { ...task, id: 'other', responsavelId: 'other' }],
    );
    expect(db.googleCalendarEvent.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          tarefaId: 'task',
          conexaoId: 'connection',
          titulo: task.titulo,
          numero: 12,
          inicio: task.prazoInicio,
          fim: task.prazoAtual,
        },
      ],
    });
  });
  it('leaves legacy tasks without start out of the queue', async () => {
    await service.enqueue(
      db as unknown as Parameters<typeof service.enqueue>[0],
      [{ ...task, prazoInicio: null }],
    );
    expect(db.googleCalendarEvent.createMany).not.toHaveBeenCalled();
  });
  it('does not use integration tables when disabled', async () => {
    service = new GoogleCalendarService(
      db as unknown as PrismaService,
      new ConfigService({ GOOGLE_CALENDAR_ENABLED: false }),
      google as unknown as GoogleCalendarClient,
    );
    await service.enqueue(
      db as unknown as Parameters<typeof service.enqueue>[0],
      [task],
    );
    expect(await service.status(userId)).toEqual({
      disponivel: false,
      conectado: false,
      email: null,
      pendentes: 0,
      falhas: 0,
    });
    expect(db.googleCalendarConnection.findMany).not.toHaveBeenCalled();
  });

  function pendingJob() {
    db.googleCalendarEvent.findMany.mockResolvedValue([
      {
        id: userId,
        tarefaId: 'task',
        conexaoId: 'connection',
        conexao: connection,
        inicio: task.prazoInicio,
        fim: task.prazoAtual,
        titulo: task.titulo,
        numero: 12,
        tentativas: 0,
      },
    ]);
  }
  it('sends both exact timestamps with a stable ID and marks the job completed', async () => {
    pendingJob();
    await service.processPending();
    expect(google.insertEvent).toHaveBeenCalledWith(
      'access',
      'calendar',
      containing({
        id: userId.replaceAll('-', ''),
        start: {
          dateTime: task.prazoInicio.toISOString(),
          timeZone: 'America/Fortaleza',
        },
        end: {
          dateTime: task.prazoAtual.toISOString(),
          timeZone: 'America/Fortaleza',
        },
        transparency: 'transparent',
      }),
    );
    expect(db.googleCalendarEvent.updateMany).toHaveBeenLastCalledWith(
      containing({
        data: containing({ estado: 'SINCRONIZADO' }),
      }),
    );
  });
  it('does not send an event claimed by another worker', async () => {
    pendingJob();
    db.googleCalendarEvent.updateMany.mockResolvedValue({ count: 0 });
    await service.processPending();
    expect(google.insertEvent).not.toHaveBeenCalled();
  });
  it('retries transient errors without logging Google response bodies', async () => {
    pendingJob();
    google.insertEvent.mockRejectedValue(
      new GoogleApiError(429, 'rateLimitExceeded'),
    );
    await service.processPending();
    expect(db.googleCalendarEvent.updateMany).toHaveBeenLastCalledWith(
      containing({
        data: containing({
          estado: 'PENDENTE',
          erro: 'Não foi possível criar o evento no Google Agenda.',
        }),
      }),
    );
  });
  it('requires reconnection when access is revoked', async () => {
    pendingJob();
    google.refresh.mockRejectedValue(new GoogleApiError(400, 'invalid_grant'));
    await service.processPending();
    expect(google.insertEvent).not.toHaveBeenCalled();
    expect(db.googleCalendarConnection.updateMany).toHaveBeenCalledWith(
      containing({ data: { ativo: false } }),
    );
    expect(db.googleCalendarEvent.updateMany).toHaveBeenLastCalledWith(
      containing({
        data: containing({ estado: 'FALHA' }),
      }),
    );
  });
  it('removes the local connection before revoking external access', async () => {
    db.googleCalendarConnection.findUnique.mockResolvedValue(connection);
    await service.disconnect(userId);
    expect(db.googleCalendarConnection.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: userId },
    });
    expect(google.revoke).toHaveBeenCalledWith('refresh');
  });
});
