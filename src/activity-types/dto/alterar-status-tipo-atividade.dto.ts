import { IsBoolean } from 'class-validator';

export class AlterarStatusTipoAtividadeDto {
  @IsBoolean({ message: 'ativo deve ser true ou false.' })
  ativo!: boolean;
}
