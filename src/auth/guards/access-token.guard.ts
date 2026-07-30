import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PUBLICO_KEY } from '../../common/decorators/publico.decorator';
import { UsersService } from '../../users/users.service';
import type {
  AccessTokenPayload,
  UsuarioAutenticado,
} from '../types/auth.types';

type RequestAutenticada = Request & {
  user?: UsuarioAutenticado;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const rotaPublica =
      this.reflector.getAllAndOverride<boolean>(
        PUBLICO_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (rotaPublica) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestAutenticada>();

    const token = this.extrairBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Token de acesso não informado.',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(
          token,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_ACCESS_SECRET',
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
        payload.tipo !== 'access' ||
        !payload.sub ||
        !Number.isInteger(payload.tokenVersion)
      ) {
        throw new Error('Payload inválido.');
      }

      const usuario =
        await this.usersService.buscarPorIdParaAutorizacao(
          payload.sub,
        );

      if (
        !usuario ||
        !usuario.ativo ||
        usuario.tokenVersion !==
          payload.tokenVersion
      ) {
        throw new Error('Usuário não autorizado.');
      }

      request.user = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        'Token de acesso inválido ou expirado.',
      );
    }
  }

  private extrairBearerToken(
    request: Request,
  ): string | undefined {
    const authorization =
      request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [tipo, token, excedente] =
      authorization.split(' ');

    if (
      tipo !== 'Bearer' ||
      !token ||
      excedente !== undefined
    ) {
      return undefined;
    }

    return token;
  }
}