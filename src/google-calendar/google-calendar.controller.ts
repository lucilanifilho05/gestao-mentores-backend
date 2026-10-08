import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Publico } from '../common/decorators/publico.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleApiError } from './google-calendar.client';

const STATE_COOKIE = 'google_calendar_state';

@Controller('integracoes/google-agenda')
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);
  constructor(
    private readonly calendar: GoogleCalendarService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/integracoes/google-agenda',
      maxAge: 10 * 60_000,
    };
  }

  @Get()
  status(@UsuarioAtual() user: UsuarioAutenticado) {
    return this.calendar.status(user.id);
  }

  @Post('autorizar')
  @HttpCode(200)
  async authorize(
    @UsuarioAtual() user: UsuarioAutenticado,
    @Res({ passthrough: true }) response: Response,
  ) {
    const authorization = await this.calendar.authorize(user.id);
    response.cookie(STATE_COOKIE, authorization.state, this.cookieOptions());
    return { url: authorization.url };
  }

  @Publico()
  @Get('callback')
  async callback(
    @Query('state') state: string,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const cookie: unknown = (
      request.cookies as Record<string, unknown> | undefined
    )?.[STATE_COOKIE];
    const options = this.cookieOptions();
    delete options.maxAge;
    response.clearCookie(STATE_COOKIE, options);
    let result: 'conectado' | 'erro' = 'erro';
    try {
      await this.calendar.callback(
        state,
        typeof cookie === 'string' ? cookie : '',
        code,
        Boolean(error),
      );
      result = 'conectado';
    } catch (error: unknown) {
      // Only known, bounded diagnostic codes are logged. Never serialize errors:
      // their messages and stacks may contain credentials or authorization codes.
      let diagnostic = 'internal_error';
      if (error instanceof GoogleApiError) {
        const allowed = [
          'invalid_client',
          'invalid_grant',
          'access_denied',
          'insufficientPermissions',
          'accessNotConfigured',
          'rateLimitExceeded',
          'userRateLimitExceeded',
        ];
        diagnostic = `google_http_${error.status}:${allowed.includes(error.reason) ? error.reason : 'unknown'}`;
      } else if (error instanceof HttpException) {
        const messages: Record<string, string> = {
          'Autorização inválida.': 'state_invalid_or_cookie_missing',
          'Autorização expirada.': 'authorization_expired',
          'Autorização já utilizada.': 'authorization_replayed',
          'Acesso ao Google Agenda não autorizado.': 'consent_denied',
          'Autorize o acesso ao calendário para continuar.':
            'scope_or_refresh_token_missing',
          'Conta Google inválida.': 'google_identity_invalid',
          'Desconecte a conta atual antes de conectar outra.':
            'google_account_mismatch',
        };
        diagnostic =
          messages[error.message] ?? `application_http_${error.getStatus()}`;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        /^P\d{4}$/.test(error.code)
      ) {
        diagnostic = `prisma_${error.code}`;
      }
      this.logger.warn(`Falha no callback do Google Agenda: ${diagnostic}`);
    }
    response.redirect(this.calendar.callbackUrl(result));
  }

  @Delete()
  @HttpCode(204)
  disconnect(@UsuarioAtual() user: UsuarioAutenticado) {
    return this.calendar.disconnect(user.id);
  }

  @Post('tentar-novamente')
  @HttpCode(204)
  retry(@UsuarioAtual() user: UsuarioAutenticado) {
    return this.calendar.retry(user.id);
  }
}
