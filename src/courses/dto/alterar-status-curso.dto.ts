import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AlterarStatusCursoDto {
  @ApiProperty({
    example: false,
    description:
      'Define se o curso está ativo.',
  })
  @IsBoolean({
    message:
      'ativo deve ser true ou false.',
  })
  ativo!: boolean;
}