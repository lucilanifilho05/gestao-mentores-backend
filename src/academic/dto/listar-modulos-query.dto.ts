import { IsUUID } from 'class-validator';

export class ListarModulosQueryDto {
  @IsUUID('4')
  turmaId!: string;
}