import {
  Transform,
  Type,
} from 'class-transformer';
import {
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
}