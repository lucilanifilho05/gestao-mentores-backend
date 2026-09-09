import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReagendarTarefaDto {
  @IsDateString(
    {},
    {
      message:
        'prazoNovo deve ser uma data ISO válida.',
    },
  )
  prazoNovo!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString({ message: 'A justificativa deve ser um texto válido.' })
  @MaxLength(2000)
  justificativa?: string;
}
