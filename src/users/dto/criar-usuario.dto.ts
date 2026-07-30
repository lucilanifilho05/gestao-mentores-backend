import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/security/password-policy';
import { Papel } from '../../generated/prisma/client';

export class CriarUsuarioDto {
  @Transform(
    ({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.trim().replace(/\s+/g, ' ')
        : value,
  )
  @IsString()
  @MinLength(3, {
    message:
      'O nome deve possuir pelo menos 3 caracteres.',
  })
  @MaxLength(150, {
    message:
      'O nome deve possuir no máximo 150 caracteres.',
  })
  nome!: string;

  @Transform(
    ({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : value,
  )
  @IsEmail({}, {
    message:
      'Informe um endereço de e-mail válido.',
  })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message:
      `A senha deve possuir pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message:
      `A senha deve possuir no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  })
  senha!: string;

  @IsOptional()
  @IsEnum(Papel, {
    message:
      'O papel deve ser COORDENADORA ou MENTOR.',
  })
  papel?: Papel;
}