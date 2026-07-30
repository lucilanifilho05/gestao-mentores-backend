import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Redirect,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papeis } from '../common/decorators/papeis.decorator';
import { Publico } from '../common/decorators/publico.decorator';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { Papel } from '../generated/prisma/client';
import { GoogleDriveService } from './google-drive.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Google Drive')
@Controller('drive')
export class GoogleDriveController {
  constructor(
    private readonly googleDriveService:
      GoogleDriveService,
  ) {}

  @ApiAutenticado()
  @Get('autorizar')
  @Papeis(Papel.COORDENADORA)
  @Redirect(undefined, 302)
  autorizar(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return {
      url:
        this.googleDriveService
          .gerarUrlAutorizacao(
            usuario.id,
          ),

      statusCode: 302,
    };
  }

  @Get('callback')
  @Publico()
  callback(
    @Query('code')
    code?: string,

    @Query('state')
    state?: string,

    @Query('error')
    error?: string,
  ) {
    if (error) {
      throw new BadRequestException(
        `Autorização do Google Drive negada: ${error}.`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Callback OAuth sem code ou state.',
      );
    }

    return this.googleDriveService
      .processarCallback(
        code,
        state,
      );
  }

  @ApiAutenticado()
  @Get('status')
  status() {
    return this.googleDriveService
      .obterStatus();
  }
}