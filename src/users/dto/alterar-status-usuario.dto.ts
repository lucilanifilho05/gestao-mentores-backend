import { IsBoolean } from 'class-validator';

export class AlterarStatusUsuarioDto {
  @IsBoolean({
    message:
      'A propriedade ativo deve ser booleana.',
  })
  ativo!: boolean;
}