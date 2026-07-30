import {
  Transform,
  Type,
} from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListarTiposAtividadeQueryDto {
  @Type(() => Number)
  @IsInt({
    message: 'pagina deve ser um número inteiro.',
  })
  @Min(1)
  pagina: number = 1;

  @Type(() => Number)
  @IsInt({
    message: 'limite deve ser um número inteiro.',
  })
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
}