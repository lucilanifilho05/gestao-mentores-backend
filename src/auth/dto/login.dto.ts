import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../common/security/password-policy';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEmail({}, {
    message: 'Informe um endereço de e-mail válido.',
  })
  @MaxLength(254, {
    message: 'O e-mail deve possuir no máximo 254 caracteres.',
  })
  email!: string;

  @IsString({
    message: 'A senha deve ser um texto.',
  })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `A senha deve possuir pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `A senha deve possuir no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  })
  senha!: string;
}