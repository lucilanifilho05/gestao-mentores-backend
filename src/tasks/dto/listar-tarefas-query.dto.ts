import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ESCOPOS_TAREFA, type EscopoTarefaEntrada } from './criar-tarefa.dto';

export const STATUS_TAREFA = ['pendente', 'concluida'] as const;

export type StatusTarefaEntrada = (typeof STATUS_TAREFA)[number];

export class ListarTarefasQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'inicio deve ser uma data ISO válida.' })
  inicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fim deve ser uma data ISO válida.' })
  fim?: string;

  @IsOptional()
  @IsUUID('4')
  projetoId?: string;

  @IsOptional()
  @IsUUID('4')
  responsavelId?: string;

  @IsOptional()
  @IsUUID('4')
  cursoId?: string;

  @IsOptional()
  @IsUUID('4')
  turmaId?: string;

  @IsOptional()
  @IsUUID('4')
  tipoAtividadeId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn([...STATUS_TAREFA], {
    message: 'status deve ser pendente ou concluida.',
  })
  status?: StatusTarefaEntrada;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn([...ESCOPOS_TAREFA], {
    message: 'escopo deve ser curso, turma ou evento_macro.',
  })
  escopo?: EscopoTarefaEntrada;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}
