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

import { Papeis } from '../common/decorators/papeis.decorator';
import { Papel } from '../generated/prisma/client';
import { ActivityTypesService } from './activity-types.service';
import { CriarTipoAtividadeDto } from './dto/criar-tipo-atividade.dto';
import { ListarTiposAtividadeQueryDto } from './dto/listar-tipos-atividade-query.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { AtualizarTipoAtividadeDto } from './dto/atualizar-tipo-atividade.dto';
import { AlterarStatusTipoAtividadeDto } from './dto/alterar-status-tipo-atividade.dto';

@ApiTags('Tipos de atividade')
@ApiAutenticado()
@Controller('tipos-atividade')
export class ActivityTypesController {
  constructor(
    private readonly activityTypesService:
      ActivityTypesService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarTiposAtividadeQueryDto,
    @UsuarioAtual() usuario: UsuarioAutenticado,
  ) {
    return this.activityTypesService.listar(
      query,
      usuario,
    );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarTipoAtividadeDto,
  ) {
    return this.activityTypesService.criar(
      dto,
    );
  }

  @Patch(':tipoAtividadeId')
  @Papeis(Papel.COORDENADORA)
  atualizar(
    @Param('tipoAtividadeId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AtualizarTipoAtividadeDto,
  ) {
    return this.activityTypesService.atualizar(id, dto);
  }

  @Patch(':tipoAtividadeId/status')
  @Papeis(Papel.COORDENADORA)
  alterarStatus(
    @Param('tipoAtividadeId', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AlterarStatusTipoAtividadeDto,
  ) {
    return this.activityTypesService.alterarStatus(id, dto);
  }
}
