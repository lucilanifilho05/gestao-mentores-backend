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
import { CriarModuloDto } from './dto/criar-modulo.dto';
import { ListarModulosQueryDto } from './dto/listar-modulos-query.dto';

@Controller('modulos')
export class ModulosController {
  constructor(
    private readonly academicService:
      AcademicService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarModulosQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.academicService.listarModulos(
      query.turmaId,
      usuario,
    );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarModuloDto,
  ) {
    return this.academicService.criarModulo(
      dto,
    );
  }
}