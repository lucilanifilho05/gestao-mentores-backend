import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListarTurmasQueryDto {
  @IsOptional()
  @IsUUID('4')
  cursoId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const texto = value.trim().toLowerCase();

    if (texto === 'true') return true;
    if (texto === 'false') return false;

    return value;
  })
  @IsBoolean({
    message: 'ativo deve ser true ou false.',
  })
  ativo?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}
