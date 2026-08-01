import {
  Transform,
  Type,
} from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Papel } from '../../generated/prisma/client';

export class ListarUsuariosQueryDto {
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
  @Transform(
    ({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(100)
  busca?: string;

  @IsOptional()
  @IsEnum(Papel)
  papel?: Papel;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => {
      if (
        value === true ||
        value === 'true'
      ) {
        return true;
      }

      if (
        value === false ||
        value === 'false'
      ) {
        return false;
      }

      return value;
    },
  )
  @IsBoolean({
    message:
      'O filtro ativo deve ser true ou false.',
  })
  ativo?: boolean;
}