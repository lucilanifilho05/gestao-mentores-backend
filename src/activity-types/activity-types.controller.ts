import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ) {
    return this.activityTypesService.listar(
      query,
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
}