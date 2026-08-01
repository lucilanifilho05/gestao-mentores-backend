import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import type {
  UsuarioAutenticado,
} from '../auth/types/auth.types';
import {
  ApiAutenticado,
} from '../common/decorators/api-autenticado.decorator';
import {
  Papeis,
} from '../common/decorators/papeis.decorator';
import {
  UsuarioAtual,
} from '../common/decorators/usuario-atual.decorator';
import {
  Papel,
} from '../generated/prisma/client';
import {
  CoursesService,
} from './courses.service';
import {
  AlterarStatusCursoDto,
} from './dto/alterar-status-curso.dto';
import {
  AtualizarCursoDto,
} from './dto/atualizar-curso.dto';
import {
  CriarCursoDto,
} from './dto/criar-curso.dto';
import {
  ListarCursosQueryDto,
} from './dto/listar-cursos-query.dto';

@ApiTags('Cursos')
@ApiAutenticado()
@Controller('cursos')
export class CoursesController {
  constructor(
    private readonly coursesService:
      CoursesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar cursos',
  })
  @ApiQuery({
    name: 'ativo',
    required: false,
    type: Boolean,
    description:
      'Filtra cursos ativos ou inativos. Quando omitido, lista ambos.',
  })
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
  @ApiOperation({
    summary: 'Criar curso',
  })
  criar(
    @Body()
    dto: CriarCursoDto,
  ) {
    return this.coursesService.criar(
      dto,
    );
  }

  @Patch(':cursoId/status')
  @Papeis(Papel.COORDENADORA)
  @ApiOperation({
    summary:
      'Ativar ou desativar curso',
  })
  @ApiParam({
    name: 'cursoId',
    format: 'uuid',
    description:
      'Identificador do curso.',
  })
  @ApiOkResponse({
    description:
      'Status do curso alterado.',
  })
  @ApiBadRequestResponse({
    description:
      'UUID ou corpo inválido.',
  })
  @ApiNotFoundResponse({
    description:
      'Curso não encontrado.',
  })
  alterarStatus(
    @Param(
      'cursoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    cursoId: string,

    @Body()
    dto: AlterarStatusCursoDto,
  ) {
    return this.coursesService
      .alterarStatus(
        cursoId,
        dto,
      );
  }

  @Patch(':cursoId')
  @Papeis(Papel.COORDENADORA)
  @ApiOperation({
    summary:
      'Atualizar nome do curso',
  })
  @ApiParam({
    name: 'cursoId',
    format: 'uuid',
    description:
      'Identificador do curso.',
  })
  @ApiOkResponse({
    description:
      'Curso atualizado.',
  })
  @ApiBadRequestResponse({
    description:
      'UUID ou nome inválido.',
  })
  @ApiNotFoundResponse({
    description:
      'Curso não encontrado.',
  })
  @ApiConflictResponse({
    description:
      'Já existe um curso com esse nome.',
  })
  atualizar(
    @Param(
      'cursoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    cursoId: string,

    @Body()
    dto: AtualizarCursoDto,
  ) {
    return this.coursesService
      .atualizar(
        cursoId,
        dto,
      );
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
    return this.coursesService
      .listarMentores(
        cursoId,
      );
  }

  @Post(
    ':cursoId/mentores/:mentorId',
  )
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
    return this.coursesService
      .vincularMentor(
        cursoId,
        mentorId,
        usuario.id,
      );
  }

  @Delete(
    ':cursoId/mentores/:mentorId',
  )
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
    return this.coursesService
      .desvincularMentor(
        cursoId,
        mentorId,
      );
  }
}