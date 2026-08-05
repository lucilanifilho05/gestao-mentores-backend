import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papeis } from '../common/decorators/papeis.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel } from '../generated/prisma/client';
import { AcademicService } from './academic.service';
import { ClonarTurmaDto } from './dto/clonar-turma.dto';
import { AlterarStatusTurmaDto } from './dto/alterar-status-turma.dto';
import { AtualizarTurmaDto } from './dto/atualizar-turma.dto';
import { CriarTurmaDto } from './dto/criar-turma.dto';
import { ListarTurmasQueryDto } from './dto/listar-turmas-query.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Turmas')
@ApiAutenticado()
@Controller('turmas')
export class TurmasController {
  constructor(
    private readonly academicService:
      AcademicService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarTurmasQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.academicService.listarTurmas(
      query,
      usuario,
    );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarTurmaDto,
  ) {
    return this.academicService.criarTurma(
      dto,
    );
  }

  @Patch(':turmaId/status')
  @Papeis(Papel.COORDENADORA)
  alterarStatus(
    @Param(
      'turmaId',
      new ParseUUIDPipe({ version: '4' }),
    )
    turmaId: string,

    @Body()
    dto: AlterarStatusTurmaDto,
  ) {
    return this.academicService
      .alterarStatusTurma(turmaId, dto);
  }

  @Patch(':turmaId')
  @Papeis(Papel.COORDENADORA)
  atualizar(
    @Param(
      'turmaId',
      new ParseUUIDPipe({ version: '4' }),
    )
    turmaId: string,

    @Body()
    dto: AtualizarTurmaDto,
  ) {
    return this.academicService
      .atualizarTurma(turmaId, dto);
  }

  @Post(':turmaId/clonar')
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  clonar(
    @Param(
      'turmaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    turmaId: string,

    @Body()
    dto: ClonarTurmaDto,
  ) {
    return this.academicService.clonarTurma(
      turmaId,
      dto,
    );
  }
}
