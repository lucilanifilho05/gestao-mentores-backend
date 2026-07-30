import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import { verificarHashSenha } from '../common/security/password';
import {
  compararHashToken,
  gerarHashToken,
} from '../common/security/token-hash';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import type {
  AccessTokenPayload,
  LoginResponse,
  MetadadosSessao,
  RefreshTokenPayload,
  ResultadoAutenticacao,
  UsuarioAutenticado,
} from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
    metadados: MetadadosSessao,
  ): Promise<ResultadoAutenticacao> {
    const usuario =
      await this.usersService.buscarPorEmailParaAutenticacao(
        dto.email,
      );

    if (!usuario) {
      throw this.credenciaisInvalidas();
    }

    const senhaValida = await verificarHashSenha(
      usuario.senhaHash,
      dto.senha,
    );

    if (!senhaValida || !usuario.ativo) {
      throw this.credenciaisInvalidas();
    }

    const sessionId = randomUUID();

    const usuarioAutenticado: UsuarioAutenticado = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    };

    const resultado = await this.gerarTokens(
      usuarioAutenticado,
      usuario.tokenVersion,
      sessionId,
    );

    const agora = new Date();
    const refreshTtl = this.obterNumeroConfig(
      'JWT_REFRESH_TTL_SECONDS',
    );

    await this.prisma.$transaction([
      this.prisma.sessao.create({
        data: {
          id: sessionId,
          usuarioId: usuario.id,
          refreshTokenHash: gerarHashToken(
            resultado.refreshToken,
          ),
          userAgent: this.limitarTexto(
            metadados.userAgent,
            512,
          ),
          enderecoIp: this.limitarTexto(
            metadados.enderecoIp,
            64,
          ),
          expiraEm: this.adicionarSegundos(
            agora,
            refreshTtl,
          ),
        },
      }),

      this.prisma.usuario.update({
        where: {
          id: usuario.id,
        },
        data: {
          ultimoLoginEm: agora,
        },
      }),
    ]);

    return resultado;
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<ResultadoAutenticacao> {
    if (!refreshToken) {
      throw this.refreshTokenInvalido();
    }

    const payload =
      await this.verificarRefreshToken(refreshToken);

    const agora = new Date();

    const sessao =
      await this.prisma.sessao.findUnique({
        where: {
          id: payload.sessionId,
        },
        select: {
          id: true,
          usuarioId: true,
          refreshTokenHash: true,
          revogadaEm: true,
          expiraEm: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              papel: true,
              ativo: true,
              tokenVersion: true,
            },
          },
        },
      });

    if (
      !sessao ||
      sessao.usuarioId !== payload.sub ||
      sessao.revogadaEm !== null ||
      sessao.expiraEm <= agora ||
      !sessao.usuario.ativo ||
      sessao.usuario.tokenVersion !==
        payload.tokenVersion
    ) {
      throw this.refreshTokenInvalido();
    }

    const hashValido = compararHashToken(
      refreshToken,
      sessao.refreshTokenHash,
    );

    if (!hashValido) {
      await this.revogarSessao(sessao.id);
      throw this.refreshTokenInvalido();
    }

    const usuario: UsuarioAutenticado = {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      papel: sessao.usuario.papel,
    };

    const resultado = await this.gerarTokens(
      usuario,
      sessao.usuario.tokenVersion,
      sessao.id,
    );

    const novoHash = gerarHashToken(
      resultado.refreshToken,
    );

    const refreshTtl = this.obterNumeroConfig(
      'JWT_REFRESH_TTL_SECONDS',
    );

    /*
     * O updateMany inclui o hash antigo na condição.
     * Assim, apenas uma requisição consegue rotacionar
     * determinado refresh token.
     */
    const atualizacao =
      await this.prisma.sessao.updateMany({
        where: {
          id: sessao.id,
          usuarioId: sessao.usuarioId,
          refreshTokenHash:
            sessao.refreshTokenHash,
          revogadaEm: null,
          expiraEm: {
            gt: agora,
          },
        },
        data: {
          refreshTokenHash: novoHash,
          ultimoUsoEm: agora,
          expiraEm: this.adicionarSegundos(
            agora,
            refreshTtl,
          ),
        },
      });

    if (atualizacao.count !== 1) {
      await this.revogarSessao(sessao.id);
      throw this.refreshTokenInvalido();
    }

    return resultado;
  }

  async logout(
    refreshToken: string | undefined,
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload =
        await this.verificarRefreshToken(refreshToken);

      await this.prisma.sessao.updateMany({
        where: {
          id: payload.sessionId,
          usuarioId: payload.sub,
          revogadaEm: null,
        },
        data: {
          revogadaEm: new Date(),
        },
      });
    } catch {
      /*
       * Logout é idempotente.
       * Mesmo com token ausente, expirado ou inválido,
       * o controller removerá o cookie.
       */
    }
  }

  async logoutTodos(usuarioId: string): Promise<void> {
    const agora = new Date();

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: {
          id: usuarioId,
        },
        data: {
          tokenVersion: {
            increment: 1,
          },
        },
      }),

      this.prisma.sessao.updateMany({
        where: {
          usuarioId,
          revogadaEm: null,
        },
        data: {
          revogadaEm: agora,
        },
      }),
    ]);
  }

  private async gerarTokens(
    usuario: UsuarioAutenticado,
    tokenVersion: number,
    sessionId: string,
  ): Promise<ResultadoAutenticacao> {
    const accessTtl = this.obterNumeroConfig(
      'JWT_ACCESS_TTL_SECONDS',
    );

    const refreshTtl = this.obterNumeroConfig(
      'JWT_REFRESH_TTL_SECONDS',
    );

    const accessPayload: AccessTokenPayload = {
      sub: usuario.id,
      tokenVersion,
      tipo: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: usuario.id,
      sessionId,
      tokenVersion,
      tipo: 'refresh',
    };

    const issuer =
      this.configService.getOrThrow<string>(
        'JWT_ISSUER',
      );

    const audience =
      this.configService.getOrThrow<string>(
        'JWT_AUDIENCE',
      );

    const [accessToken, refreshToken] =
      await Promise.all([
        this.jwtService.signAsync(
          accessPayload,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_ACCESS_SECRET',
              ),
            expiresIn: accessTtl,
            issuer,
            audience,
          },
        ),

        this.jwtService.signAsync(
          refreshPayload,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
            expiresIn: refreshTtl,
            issuer,
            audience,
          },
        ),
      ]);

    const resposta: LoginResponse = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: accessTtl,
      usuario,
    };

    return {
      resposta,
      refreshToken,
    };
  }

  private async verificarRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(
          refreshToken,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
            issuer:
              this.configService.getOrThrow<string>(
                'JWT_ISSUER',
              ),
            audience:
              this.configService.getOrThrow<string>(
                'JWT_AUDIENCE',
              ),
          },
        );

      if (
        payload.tipo !== 'refresh' ||
        !payload.sub ||
        !payload.sessionId ||
        !Number.isInteger(payload.tokenVersion)
      ) {
        throw new Error(
          'Payload de refresh inválido.',
        );
      }

      return payload;
    } catch {
      throw this.refreshTokenInvalido();
    }
  }

  private async revogarSessao(
    sessionId: string,
  ): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: {
        id: sessionId,
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }

  private obterNumeroConfig(nome: string): number {
    const valor =
      this.configService.getOrThrow<string | number>(
        nome,
      );

    const numero = Number(valor);

    if (
      !Number.isSafeInteger(numero) ||
      numero <= 0
    ) {
      throw new Error(
        `A configuração ${nome} deve ser um inteiro positivo.`,
      );
    }

    return numero;
  }

  private adicionarSegundos(
    data: Date,
    segundos: number,
  ): Date {
    return new Date(
      data.getTime() + segundos * 1_000,
    );
  }

  private limitarTexto(
    valor: string | undefined,
    limite: number,
  ): string | undefined {
    const texto = valor?.trim();

    if (!texto) {
      return undefined;
    }

    return texto.slice(0, limite);
  }

  private credenciaisInvalidas(): UnauthorizedException {
    return new UnauthorizedException(
      'E-mail ou senha inválidos.',
    );
  }

  private refreshTokenInvalido(): UnauthorizedException {
    return new UnauthorizedException(
      'Refresh token inválido ou expirado.',
    );
  }
}