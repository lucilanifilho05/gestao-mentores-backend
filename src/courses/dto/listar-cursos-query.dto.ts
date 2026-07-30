import {
  Transform,
  Type,
} from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function transformarBooleano(
  value: unknown,
): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const texto = value.trim().toLowerCase();

  if (texto === 'true') {
    return true;
  }

  if (texto === 'false') {
    return false;
  }

  return value;
}

export class ListarCursosQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(100)
  busca?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    transformarBooleano(value),
  )
  @IsBoolean({
    message:
      'apenas_meus deve ser true ou false.',
  })
  apenas_meus: boolean = false;
}