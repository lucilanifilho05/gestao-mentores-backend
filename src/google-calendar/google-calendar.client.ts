import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.app.created';

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super('Falha na comunicação com o Google Agenda.');
  }
}

interface Tokens {
  access_token: string;
  refresh_token?: string;
  scope?: string;
}

@Injectable()
export class GoogleCalendarClient {
  constructor(private readonly config: ConfigService) {}

  private async request<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string | { errors?: Array<{ reason?: string }> };
      };
      const reason =
        typeof body.error === 'string'
          ? body.error
          : (body.error?.errors?.[0]?.reason ?? 'unknown');
      throw new GoogleApiError(response.status, reason);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private token(body: Record<string, string>): Promise<Tokens> {
    return this.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        ...body,
      }),
    });
  }

  exchange(code: string, verifier: string): Promise<Tokens> {
    return this.token({
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    });
  }

  refresh(refreshToken: string): Promise<Tokens> {
    return this.token({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
  }

  identity(
    accessToken: string,
  ): Promise<{ sub: string; email: string; email_verified: boolean }> {
    return this.request('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  createCalendar(accessToken: string): Promise<{ id: string }> {
    return this.request('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: 'Gestão de Mentores',
        timeZone: 'America/Fortaleza',
      }),
    });
  }

  deleteCalendar(accessToken: string, calendarId: string): Promise<void> {
    return this.request(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }

  async insertEvent(
    accessToken: string,
    calendarId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.request(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      );
    } catch (error) {
      // Deterministic event IDs make retry after an uncertain response safe.
      if (!(error instanceof GoogleApiError && error.status === 409))
        throw error;
    }
  }

  async revoke(token: string): Promise<void> {
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 400)
      throw new GoogleApiError(response.status, 'revoke');
  }
}
