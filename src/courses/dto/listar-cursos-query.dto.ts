import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
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

  const texto =
    value.trim().toLowerCase();

  if (texto === 'true') {
    return true;
  }

  if (texto === 'false') {
    return false;
  }

  return value;
}

export class ListarCursosQueryDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;

  @ApiPropertyOptional({
    example: 'gestão',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({
    name: 'apenas_meus',
    default: false,
    type: Boolean,
    description:
      'Para mentores, restringe a listagem aos cursos vinculados.',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) =>
      transformarBooleano(value),
  )
  @IsBoolean({
    message:
      'apenas_meus deve ser true ou false.',
  })
  apenas_meus: boolean = false;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtra cursos ativos ou inativos. Quando omitido, lista ambos.',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) =>
      transformarBooleano(value),
  )
  @IsBoolean({
    message:
      'ativo deve ser true ou false.',
  })
  ativo?: boolean;
}