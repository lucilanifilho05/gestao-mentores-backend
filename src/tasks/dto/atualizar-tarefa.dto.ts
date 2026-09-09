import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AtualizarTarefaDto {
  @IsUUID('4', { message: 'tipoAtividadeId deve ser um UUID válido.' })
  tipoAtividadeId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'O título deve ser um texto válido.' })
  @MinLength(2, { message: 'O título deve ter pelo menos 2 caracteres.' })
  @MaxLength(200, { message: 'O título deve ter no máximo 200 caracteres.' })
  titulo!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'As observações devem ser um texto válido.' })
  @MaxLength(50000, {
    message: 'As observações formatadas devem ter no máximo 50.000 caracteres.',
  })
  descricao?: string;

  @IsOptional()
  @IsArray({ message: 'Os links devem ser enviados em uma lista.' })
  @ArrayMaxSize(20, { message: 'Uma tarefa pode possuir no máximo 20 links.' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true, message: 'Cada link deve ser uma URL HTTP ou HTTPS válida.' },
  )
  links?: string[];
}
