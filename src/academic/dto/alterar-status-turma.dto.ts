import { IsBoolean } from 'class-validator';

export class AlterarStatusTurmaDto {
  @IsBoolean({
    message:
      'ativo deve ser true ou false.',
  })
  ativo!: boolean;
}
