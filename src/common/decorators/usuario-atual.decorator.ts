import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { UsuarioAutenticado } from '../../auth/types/auth.types';

type RequestAutenticada = Request & {
  user: UsuarioAutenticado;
};

export const UsuarioAtual = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): UsuarioAutenticado => {
    const request = context
      .switchToHttp()
      .getRequest<RequestAutenticada>();

    return request.user;
  },
);