import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papeis } from '../common/decorators/papeis.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel,} from '../generated/prisma/client';
import { CoursesService } from './courses.service';
import { CriarCursoDto } from './dto/criar-curso.dto';
import { ListarCursosQueryDto } from './dto/listar-cursos-query.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Cursos')
@ApiAutenticado()
@Controller('cursos')
export class CoursesController {
  constructor(
    private readonly coursesService:
      CoursesService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarCursosQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.coursesService.listar(
      query,
      usuario,
    );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarCursoDto,
  ) {
    return this.coursesService.criar(dto);
  }

  @Get(':cursoId/mentores')
  listarMentores(
    @Param(
      'cursoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    cursoId: string,
  ) {
    return this.coursesService.listarMentores(
      cursoId,
    );
  }

  @Post(':cursoId/mentores/:mentorId')
  @Papeis(Papel.COORDENADORA)
  vincularMentor(
    @Param(
      'cursoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    cursoId: string,

    @Param(
      'mentorId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    mentorId: string,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.coursesService.vincularMentor(
      cursoId,
      mentorId,
      usuario.id,
    );
  }

  @Delete(':cursoId/mentores/:mentorId')
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.OK)
  desvincularMentor(
    @Param(
      'cursoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    cursoId: string,

    @Param(
      'mentorId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    mentorId: string,
  ) {
    return this.coursesService.desvincularMentor(
      cursoId,
      mentorId,
    );
  }
}