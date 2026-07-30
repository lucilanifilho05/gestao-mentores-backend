import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CriarCursoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ')
      : value,
  )
  @IsString({
    message: 'O nome do curso deve ser um texto.',
  })
  @MinLength(2, {
    message:
      'O nome do curso deve possuir pelo menos 2 caracteres.',
  })
  @MaxLength(150, {
    message:
      'O nome do curso deve possuir no máximo 150 caracteres.',
  })
  nome!: string;
}