import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const ESCOPOS_TAREFA = [
  'curso',
  'turma',
  'evento_macro',
] as const;

export type EscopoTarefaEntrada =
  (typeof ESCOPOS_TAREFA)[number];

export class CriarTarefaDto {
  @IsUUID('4', {
    message: 'tipoAtividadeId deve ser um UUID válido.',
  })
  tipoAtividadeId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ')
      : value,
  )
  @IsString()
  @MinLength(2, {
    message: 'O título deve ter pelo menos 2 caracteres.',
  })
  @MaxLength(200, {
    message: 'O título deve ter no máximo 200 caracteres.',
  })
  titulo!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsUUID('4', {
    message: 'responsavelId deve ser um UUID válido.',
  })
  responsavelId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsIn([...ESCOPOS_TAREFA], {
    message:
      'escopo deve ser curso, turma ou evento_macro.',
  })
  escopo!: EscopoTarefaEntrada;

  @IsOptional()
  @IsUUID('4', {
    message: 'cursoId deve ser um UUID válido.',
  })
  cursoId?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'turmaId deve ser um UUID válido.',
  })
  turmaId?: string;

  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'prazoInicio deve ser uma data ISO válida.',
    },
  )
  prazoInicio?: string;

  @IsDateString(
    {},
    {
      message:
        'prazoAtual deve ser uma data ISO válida.',
    },
  )
  prazoAtual!: string;
}