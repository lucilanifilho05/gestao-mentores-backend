import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
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

  @Post(':tarefaId/anexar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),

      limits: {
        files: 1,
        fileSize:
          20 * 1024 * 1024,
      },
    }),
  )
  anexar(
    @Param(
      'tarefaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tarefaId: string,

    @UploadedFile()
    arquivo:
      | Express.Multer.File
      | undefined,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    if (!arquivo) {
      throw new BadRequestException(
        'O campo arquivo é obrigatório.',
      );
    }

    return this.tasksService.anexar(
      tarefaId,
      arquivo,
      usuario,
    );
  }

  @Get(
    ':tarefaId/anexos/:anexoId/link',
  )
  gerarLinkAnexo(
    @Param(
      'tarefaId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tarefaId: string,

    @Param(
      'anexoId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    anexoId: string,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.tasksService
      .gerarLinkAnexo(
        tarefaId,
        anexoId,
        usuario,
      );
  }

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

