import { IsUUID } from 'class-validator';

export class ListarUnidadesCurricularesQueryDto {
  @IsUUID('4')
  moduloId!: string;
}