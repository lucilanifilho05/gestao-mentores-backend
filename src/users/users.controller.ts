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
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel } from '../generated/prisma/client';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { AlterarStatusUsuarioDto } from './dto/alterar-status-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { ListarUsuariosQueryDto } from './dto/listar-usuarios-query.dto';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Usuários')
@ApiAutenticado()
@Controller('usuarios')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get()
  listar(
    @Query()
    query: ListarUsuariosQueryDto,
  ) {
    return this.usersService.listarAtivos(
      query,
    );
  }

  @Post()
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Body()
    dto: CriarUsuarioDto,
  ) {
    return this.usersService.criar(dto);
  }

  @Patch(':usuarioId/status')
  @Papeis(Papel.COORDENADORA)
  alterarStatus(
    @Param(
      'usuarioId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    usuarioId: string,

    @Body()
    dto: AlterarStatusUsuarioDto,

    @UsuarioAtual()
    usuarioAtual: UsuarioAutenticado,
  ) {
    return this.usersService.alterarStatus(
      usuarioId,
      dto,
      usuarioAtual.id,
    );
  }
}