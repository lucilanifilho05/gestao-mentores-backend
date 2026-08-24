import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type {
  Response,
} from 'express';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { RelatorioTarefasQueryDto } from './dto/relatorio-tarefas-query.dto';
import { ReportsService } from './reports.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiAutenticado } from '../common/decorators/api-autenticado.decorator';

@ApiTags('Relatórios')
@ApiAutenticado()
@Controller('relatorios')
export class ReportsController {
  constructor(
    private readonly reportsService:
      ReportsService,
  ) {}

  @Get('tarefas')
  gerarJson(
    @Query()
    query: RelatorioTarefasQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,
  ) {
    return this.reportsService
      .gerarJson(
        query,
        usuario,
      );
  }

  @Get('tarefas/excel')
  async gerarExcel(
    @Query()
    query: RelatorioTarefasQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<StreamableFile> {
    const arquivo =
      await this.reportsService
        .gerarExcel(
          query,
          usuario,
        );

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    response.setHeader(
      'Content-Disposition',
      'attachment; filename="relatorio_tarefas.xlsx"',
    );

    response.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    return new StreamableFile(
      arquivo,
    );
  }

  @Get('tarefas/pdf')
  async gerarPdf(
    @Query()
    query: RelatorioTarefasQueryDto,

    @UsuarioAtual()
    usuario: UsuarioAutenticado,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<StreamableFile> {
    const arquivo =
      await this.reportsService
        .gerarPdf(
          query,
          usuario,
        );

    response.setHeader(
      'Content-Type',
      'application/pdf',
    );

    response.setHeader(
      'Content-Disposition',
      'attachment; filename="relatorio_tarefas.pdf"',
    );

    response.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    return new StreamableFile(
      arquivo,
    );
  }
}
