import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PAPEIS_KEY } from '../../common/decorators/papeis.decorator';
import type { Papel } from '../../generated/prisma/client';
import type { UsuarioAutenticado } from '../types/auth.types';

type RequestAutenticada = Request & {
  user?: UsuarioAutenticado;
};

@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const papeisPermitidos =
      this.reflector.getAllAndOverride<Papel[]>(
        PAPEIS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (
      !papeisPermitidos ||
      papeisPermitidos.length === 0
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestAutenticada>();

    const usuario = request.user;

    if (!usuario) {
      throw new UnauthorizedException(
        'Usuário não autenticado.',
      );
    }

    if (
      !papeisPermitidos.includes(usuario.papel)
    ) {
      throw new ForbiddenException(
        'Você não possui permissão para realizar esta operação.',
      );
    }

    return true;
  }
}