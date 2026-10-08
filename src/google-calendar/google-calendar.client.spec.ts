import { ConfigService } from '@nestjs/config';
import { GoogleApiError, GoogleCalendarClient } from './google-calendar.client';

describe('GoogleCalendarClient event delivery', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const client = new GoogleCalendarClient(new ConfigService({}));

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('accepts an existing deterministic event after a retry', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { errors: [{ reason: 'duplicate' }] } }),
        { status: 409 },
      ),
    );
    await expect(
      client.insertEvent('access', 'calendar@example.com', { id: '123abc' }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/calendar%40example.com/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: '123abc' }),
      }),
    );
  });
  it('does not treat rate limits as a delivered event', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { errors: [{ reason: 'rateLimitExceeded' }] },
        }),
        { status: 403 },
      ),
    );
    await expect(
      client.insertEvent('access', 'calendar', { id: '123abc' }),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });
  it('removes a calendar and accepts the empty Google response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      client.deleteCalendar('access', 'calendar@example.com'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/calendars/calendar%40example.com',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
