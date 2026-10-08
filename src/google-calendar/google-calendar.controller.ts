import {
  Controller,
  Delete,
  Get,
  HttpCode,
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

const STATE_COOKIE = 'google_calendar_state';

@Controller('integracoes/google-agenda')
export class GoogleCalendarController {
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
    } catch {
      /* Never expose Google tokens or authorization codes in errors. */
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
