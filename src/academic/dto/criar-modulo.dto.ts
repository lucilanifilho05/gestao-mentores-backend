import { Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class CriarModuloDto {
  @IsUUID('4')
  turmaId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ')
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @Matches(DATA_REGEX, {
    message:
      'dataInicio deve estar no formato AAAA-MM-DD.',
  })
  dataInicio!: string;

  @Matches(DATA_REGEX, {
    message:
      'dataFim deve estar no formato AAAA-MM-DD.',
  })
  dataFim!: string;
}