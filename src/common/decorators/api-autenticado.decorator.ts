import {
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ApiAutenticado() {
  return applyDecorators(
    ApiBearerAuth(
      'access-token',
    ),

    ApiUnauthorizedResponse({
      description:
        'Token ausente, inválido ou expirado.',
    }),

    ApiForbiddenResponse({
      description:
        'Usuário autenticado sem permissão para executar a operação.',
    }),
  );
}