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
import { AtualizarPerfilUsuarioDto } from './dto/atualizar-perfil-usuario.dto';
import { AlterarPropriaSenhaDto } from './dto/alterar-propria-senha.dto';
import { RedefinirSenhaUsuarioDto } from './dto/redefinir-senha-usuario.dto';

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

  @Patch('eu')
  atualizarMeuPerfil(
    @Body() dto: AtualizarPerfilUsuarioDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ) {
    return this.usersService.atualizarPerfil(usuarioAtual.id, dto);
  }

  @Patch('eu/senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  async alterarMinhaSenha(
    @Body() dto: AlterarPropriaSenhaDto,
    @UsuarioAtual() usuarioAtual: UsuarioAutenticado,
  ): Promise<void> {
    await this.usersService.alterarPropriaSenha(usuarioAtual.id, dto);
  }

  @Patch(':usuarioId')
  @Papeis(Papel.COORDENADORA)
  atualizarMentor(
    @Param('usuarioId', new ParseUUIDPipe({ version: '4' })) usuarioId: string,
    @Body() dto: AtualizarPerfilUsuarioDto,
  ) {
    return this.usersService.atualizarMentor(usuarioId, dto);
  }

  @Patch(':usuarioId/senha')
  @Papeis(Papel.COORDENADORA)
  @HttpCode(HttpStatus.NO_CONTENT)
  async redefinirSenhaMentor(
    @Param('usuarioId', new ParseUUIDPipe({ version: '4' })) usuarioId: string,
    @Body() dto: RedefinirSenhaUsuarioDto,
  ): Promise<void> {
    await this.usersService.redefinirSenhaMentor(usuarioId, dto);
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
      usuarioAtual,
    );
  }
}
