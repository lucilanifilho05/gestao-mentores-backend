import {
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class RelatorioTarefasQueryDto {
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'inicio deve ser uma data ISO válida.',
    },
  )
  inicio?: string;

  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'fim deve ser uma data ISO válida.',
    },
  )
  fim?: string;

  @IsOptional()
  @IsUUID('4', {
    message:
      'mentorId deve ser um UUID válido.',
  })
  mentorId?: string;

  @IsOptional()
  @IsUUID('4', {
    message:
      'cursoId deve ser um UUID válido.',
  })
  cursoId?: string;

  @IsOptional()
  @IsUUID('4', {
    message:
      'turmaId deve ser um UUID válido.',
  })
  turmaId?: string;

  @IsOptional()
  @IsUUID('4', {
    message:
      'tipoAtividadeId deve ser um UUID válido.',
  })
  tipoAtividadeId?: string;
}
