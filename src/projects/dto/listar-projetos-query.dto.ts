import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const STATUS_PROJETO_ENTRADA = [
  'planejamento',
  'em_andamento',
  'concluido',
  'cancelado',
] as const;
export type StatusProjetoEntrada = (typeof STATUS_PROJETO_ENTRADA)[number];

export class ListarProjetosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn([...STATUS_PROJETO_ENTRADA])
  status?: StatusProjetoEntrada;
}
