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
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { ListarTarefasQueryDto } from './dto/listar-tarefas-query.dto';
import { ReagendarTarefaDto } from './dto/reagendar-tarefa.dto';
import { TasksService } from './tasks.service';
import {ApiTags,} from '@nestjs/swagger';

import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Tarefas')
@ApiAutenticado()
@Controller('tarefas')
export class TasksController {
  constructor(
    private readonly tasksService:
      TasksService,
  ) { }

  @Get()
  listar(
    @Query()
    query: ListarTarefasQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.listar(
      query,
      usuario,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarTarefaDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.criar(
      dto,
      usuario,
    );
  }

  @Get(':tarefaId')
  buscarPorId(
    @Param(
      'tarefaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tarefaId: string,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.buscarPorId(
      tarefaId,
      usuario,
    );
  }

  @Patch(':tarefaId')
  atualizar(
    @Param('tarefaId', new ParseUUIDPipe({ version: '4' })) tarefaId: string,
    @Body() dto: AtualizarTarefaDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.atualizar(tarefaId, dto, usuario);
  }

  @Post(':tarefaId/reagendar')
  @HttpCode(HttpStatus.OK)
  reagendar(
    @Param(
      'tarefaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tarefaId: string,

    @Body()
    dto: ReagendarTarefaDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.reagendar(
      tarefaId,
      dto,
      usuario,
    );
  }

  @Post(':tarefaId/concluir')
  @HttpCode(HttpStatus.OK)
  concluir(
    @Param(
      'tarefaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tarefaId: string,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService.concluir(
      tarefaId,
      usuario,
    );
  }
}

