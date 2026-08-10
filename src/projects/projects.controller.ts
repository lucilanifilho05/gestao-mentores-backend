import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';
import { Papeis } from '../common/decorators/papeis.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel } from '../generated/prisma/client';
import { CriarProjetoDto } from './dto/criar-projeto.dto';
import { ListarProjetosQueryDto } from './dto/listar-projetos-query.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projetos')
@ApiAutenticado()
@Controller('projetos')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  listar(
    @Query() query: ListarProjetosQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.projectsService.listar(query, usuario);
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body() dto: CriarProjetoDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.projectsService.criar(dto, usuario);
  }

  @Get(':projetoId')
  buscar(
    @Param('projetoId', new ParseUUIDPipe({ version: '4' })) projetoId: string,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.projectsService.buscarPorId(projetoId, usuario);
  }

  @Post(':projetoId/concluir')
  @Papeis(Papel.COORDENADORA)
  concluir(
    @Param('projetoId', new ParseUUIDPipe({ version: '4' })) projetoId: string,
  ) {
    return this.projectsService.concluir(projetoId);
  }

  @Post(':projetoId/cancelar')
  @Papeis(Papel.COORDENADORA)
  cancelar(
    @Param('projetoId', new ParseUUIDPipe({ version: '4' })) projetoId: string,
  ) {
    return this.projectsService.cancelar(projetoId);
  }
}
