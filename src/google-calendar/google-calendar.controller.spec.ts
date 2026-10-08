import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { GoogleApiError } from './google-calendar.client';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';

describe('GoogleCalendarController callback diagnostics', () => {
  const redirectUrl = 'https://jusana.space/minha-conta?googleAgenda=erro';
  let warn: jest.SpiedFunction<Logger['warn']>;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
  });

  async function failWith(error: unknown) {
    const calendar = {
      callback: jest.fn().mockRejectedValue(error),
      callbackUrl: jest.fn().mockReturnValue(redirectUrl),
    };
    const response = {
      setHeader: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
    const controller = new GoogleCalendarController(
      calendar as unknown as GoogleCalendarService,
      new ConfigService({ NODE_ENV: 'production' }),
    );
    await controller.callback(
      'private-state',
      'private-code',
      undefined,
      {
        cookies: { google_calendar_state: 'private-state' },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.redirect).toHaveBeenCalledWith(redirectUrl);
    expect(response.clearCookie).toHaveBeenCalledWith('google_calendar_state', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/integracoes/google-agenda',
    });
    return warn.mock.calls.flat().join(' ');
  }

  it('reports missing browser state without revealing the authorization', async () => {
    const log = await failWith(
      new BadRequestException('Autorização inválida.'),
    );
    expect(log).toContain('state_invalid_or_cookie_missing');
    expect(log).not.toContain('private-state');
    expect(log).not.toContain('private-code');
  });
  it('reports a Prisma error by its code only', async () => {
    const log = await failWith({
      code: 'P2010',
      message: 'secret database details',
    });
    expect(log).toContain('prisma_P2010');
    expect(log).not.toContain('secret database details');
  });
  it('reports known Google errors without arbitrary response contents', async () => {
    expect(await failWith(new GoogleApiError(400, 'invalid_client'))).toContain(
      'google_http_400:invalid_client',
    );
  });
  it('does not log arbitrary Google reasons or error messages', async () => {
    const log = await failWith(
      new GoogleApiError(400, 'private-refresh-token'),
    );
    expect(log).toContain('google_http_400:unknown');
    expect(log).not.toContain('private-refresh-token');
    const unknownLog = await failWith(new Error('private-client-secret'));
    expect(unknownLog).toContain('internal_error');
    expect(unknownLog).not.toContain('private-client-secret');
  });
});
