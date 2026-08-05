import { Transform } from 'class-transformer';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class AtualizarTurmaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  codigo!: string;

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
