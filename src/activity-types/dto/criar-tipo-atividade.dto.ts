import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CriarTipoAtividadeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ')
      : value,
  )
  @IsString({
    message:
      'O nome do tipo de atividade deve ser um texto.',
  })
  @MinLength(2, {
    message:
      'O nome deve possuir pelo menos 2 caracteres.',
  })
  @MaxLength(150, {
    message:
      'O nome deve possuir no máximo 150 caracteres.',
  })
  nome!: string;
}