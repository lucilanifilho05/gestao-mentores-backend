import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CookieOptions,
  Request,
  Response,
} from 'express';

import { Publico } from '../common/decorators/publico.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type {
  LoginResponse,
  UsuarioAutenticado,
} from './types/auth.types';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

type RequestComCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Realiza o login com e-mail e senha.
   *
   * Retorna o access token no corpo e envia o refresh token
   * em um cookie HttpOnly.
   */
  @Post('login')
  @Publico()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const resultado = await this.authService.login(dto, {
      userAgent: request.get('user-agent'),
      enderecoIp: request.ip,
    });

    this.definirRefreshCookie(
      response,
      resultado.refreshToken,
    );

    return resultado.resposta;
  }

  /**
   * Gera um novo access token e rotaciona o refresh token.
   */
  @Post('refresh')
  @Publico()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: RequestComCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const refreshToken =
      request.cookies?.[REFRESH_TOKEN_COOKIE];

    const resultado =
      await this.authService.refresh(refreshToken);

    this.definirRefreshCookie(
      response,
      resultado.refreshToken,
    );

    return resultado.resposta;
  }

  /**
   * Revoga a sessão correspondente ao refresh token atual.
   *
   * É uma rota pública para que o cookie possa ser apagado
   * mesmo quando o access token estiver expirado.
   */
  @Post('logout')
  @Publico()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestComCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken =
      request.cookies?.[REFRESH_TOKEN_COOKIE];

    await this.authService.logout(refreshToken);

    this.removerRefreshCookie(response);
  }

  /**
   * Revoga todas as sessões e invalida todos os access tokens
   * emitidos anteriormente para o usuário.
   *
   * Esta rota é protegida pelo AccessTokenGuard global.
   */
  @ApiAutenticado()
  @Post('logout-todos')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutTodos(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.authService.logoutTodos(usuario.id);
  }

  /**
   * Retorna os dados do usuário autenticado.
   *
   * Esta rota é protegida pelo AccessTokenGuard global.
   */
  @ApiAutenticado()
  @Get('eu')
  eu(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return usuario;
  }

  private definirRefreshCookie(
    response: Response,
    refreshToken: string,
  ): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.obterOpcoesCookie(),
    );
  }

  private removerRefreshCookie(
    response: Response,
  ): void {
    const opcoesCookie =
      this.obterOpcoesCookie();

    const opcoesRemocao: CookieOptions = {
      httpOnly: opcoesCookie.httpOnly,
      secure: opcoesCookie.secure,
      sameSite: opcoesCookie.sameSite,
      path: opcoesCookie.path,
    };

    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      opcoesRemocao,
    );
  }

  private obterOpcoesCookie(): CookieOptions {
    const refreshTtlSeconds = Number(
      this.configService.getOrThrow<
        string | number
      >('JWT_REFRESH_TTL_SECONDS'),
    );

    if (
      !Number.isSafeInteger(refreshTtlSeconds) ||
      refreshTtlSeconds <= 0
    ) {
      throw new Error(
        'JWT_REFRESH_TTL_SECONDS deve ser um inteiro positivo.',
      );
    }

    const nodeEnv =
      this.configService.getOrThrow<string>(
        'NODE_ENV',
      );

    return {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: refreshTtlSeconds * 1_000,
    };
  }
}