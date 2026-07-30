import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papeis } from '../common/decorators/papeis.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel } from '../generated/prisma/client';
import { AcademicService } from './academic.service';
import { CriarUnidadeCurricularDto } from './dto/criar-unidade-curricular.dto';
import { ListarUnidadesCurricularesQueryDto } from './dto/listar-unidades-curriculares-query.dto';

@Controller('unidades-curriculares')
export class UnidadesCurricularesController {
  constructor(
    private readonly academicService:
      AcademicService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarUnidadesCurricularesQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.academicService
      .listarUnidadesCurriculares(
        query.moduloId,
        usuario,
      );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarUnidadeCurricularDto,
  ) {
    return this.academicService
      .criarUnidadeCurricular(dto);
  }
}