import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CriarComentarioTarefaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'O comentário deve ser um texto.' })
  @MinLength(1, { message: 'Informe o comentário.' })
  @MaxLength(2000, { message: 'O comentário deve ter no máximo 2.000 caracteres.' })
  conteudo!: string;
}
