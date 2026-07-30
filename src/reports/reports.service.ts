import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import ExcelJS = require('exceljs');
import PDFDocument = require('pdfkit');

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import {
  Papel,
} from '../generated/prisma/client';
import type {
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RelatorioTarefasQueryDto } from './dto/relatorio-tarefas-query.dto';

const MAXIMO_REGISTROS = 10_000;
const DATA_SIMPLES_REGEX =
  /^\d{4}-\d{2}-\d{2}$/;

const tarefaRelatorioSelect = {
  id: true,
  titulo: true,
  descricao: true,
  escopo: true,
  prazoInicio: true,
  prazoAtual: true,
  status: true,
  criadoEm: true,
  concluidoEm: true,

  tipoAtividade: {
    select: {
      id: true,
      nome: true,
    },
  },

  responsavel: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },

  criadoPor: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },

  curso: {
    select: {
      id: true,
      nome: true,
    },
  },

  turma: {
    select: {
      id: true,
      codigo: true,
    },
  },

  _count: {
    select: {
      reagendamentos: true,
      anexos: true,
    },
  },
} satisfies Prisma.TarefaSelect;

type TarefaRelatorio =
  Prisma.TarefaGetPayload<{
    select: typeof tarefaRelatorioSelect;
  }>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async gerarJson(
    query: RelatorioTarefasQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    const tarefas =
      await this.buscarTarefas(
        query,
        usuario,
      );

    return tarefas.map((tarefa) =>
      this.formatarTarefa(tarefa),
    );
  }

  async gerarExcel(
    query: RelatorioTarefasQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<Buffer> {
    const tarefas =
      await this.buscarTarefas(
        query,
        usuario,
      );

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'Gestão de Mentores';

    workbook.created =
      new Date();

    const worksheet =
      workbook.addWorksheet(
        'Relatório de Tarefas',
      );

    worksheet.columns = [
      {
        header: 'Título',
        key: 'titulo',
        width: 35,
      },
      {
        header: 'Tipo',
        key: 'tipo',
        width: 28,
      },
      {
        header: 'Responsável',
        key: 'responsavel',
        width: 28,
      },
      {
        header: 'Escopo',
        key: 'escopo',
        width: 18,
      },
      {
        header: 'Curso',
        key: 'curso',
        width: 28,
      },
      {
        header: 'Turma',
        key: 'turma',
        width: 18,
      },
      {
        header: 'Prazo',
        key: 'prazo',
        width: 20,
      },
      {
        header: 'Status',
        key: 'status',
        width: 16,
      },
      {
        header: 'Reagendamentos',
        key: 'reagendamentos',
        width: 18,
      },
      {
        header: 'Anexos',
        key: 'anexos',
        width: 12,
      },
    ];

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    worksheet.autoFilter = {
      from: 'A1',
      to: 'J1',
    };

    const cabecalho =
      worksheet.getRow(1);

    cabecalho.font = {
      bold: true,
    };

    cabecalho.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    for (const tarefa of tarefas) {
      worksheet.addRow({
        titulo: tarefa.titulo,

        tipo:
          tarefa.tipoAtividade.nome,

        responsavel:
          tarefa.responsavel.nome,

        escopo:
          this.serializarEnum(
            tarefa.escopo,
          ),

        curso:
          tarefa.curso?.nome ?? '',

        turma:
          tarefa.turma?.codigo ?? '',

        prazo:
          this.formatarData(
            tarefa.prazoAtual,
          ),

        status:
          this.serializarEnum(
            tarefa.status,
          ),

        reagendamentos:
          tarefa._count
            .reagendamentos,

        anexos:
          tarefa._count.anexos,
      });
    }

    worksheet.eachRow((row) => {
      row.alignment = {
        vertical: 'top',
        wrapText: true,
      };
    });

    const resultado =
      await workbook.xlsx.writeBuffer();

    return Buffer.from(resultado);
  }

  async gerarPdf(
    query: RelatorioTarefasQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<Buffer> {
    const tarefas =
      await this.buscarTarefas(
        query,
        usuario,
      );

    return new Promise<Buffer>(
      (resolve, reject) => {
        const documento =
          new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 36,
            info: {
              Title:
                'Relatório de Tarefas',
              Author:
                'Gestão de Mentores',
            },
          });

        const partes: Buffer[] = [];

        documento.on(
          'data',
          (parte: Buffer) => {
            partes.push(
              Buffer.from(parte),
            );
          },
        );

        documento.on(
          'end',
          () => {
            resolve(
              Buffer.concat(partes),
            );
          },
        );

        documento.on(
          'error',
          reject,
        );

        documento
          .font('Helvetica-Bold')
          .fontSize(17)
          .text(
            'Relatório de Tarefas',
          );

        documento
          .moveDown(0.3)
          .font('Helvetica')
          .fontSize(9)
          .text(
            `Gerado em ${this.formatarData(
              new Date(),
            )}`,
          )
          .text(
            `Quantidade de tarefas: ${tarefas.length}`,
          );

        documento.moveDown(1);

        const larguras = [
          180,
          105,
          125,
          85,
          100,
          75,
          55,
        ];

        const titulos = [
          'Título',
          'Tipo',
          'Responsável',
          'Escopo',
          'Prazo',
          'Status',
          'Reag.',
        ];

        let posicaoY =
          documento.y;

        const desenharCabecalho = () => {
          let posicaoX =
            documento.page.margins.left;

          documento
            .font('Helvetica-Bold')
            .fontSize(8);

          for (
            let indice = 0;
            indice < titulos.length;
            indice += 1
          ) {
            const largura =
              larguras[indice];

            documento
              .rect(
                posicaoX,
                posicaoY,
                largura,
                24,
              )
              .stroke();

            documento.text(
              titulos[indice],
              posicaoX + 4,
              posicaoY + 7,
              {
                width:
                  largura - 8,
                align: 'left',
              },
            );

            posicaoX += largura;
          }

          posicaoY += 24;
        };

        const adicionarPagina = () => {
          documento.addPage({
            size: 'A4',
            layout: 'landscape',
            margin: 36,
          });

          posicaoY =
            documento.page
              .margins.top;

          desenharCabecalho();
        };

        const desenharLinha = (
          valores: string[],
        ) => {
          documento
            .font('Helvetica')
            .fontSize(7.5);

          const alturas =
            valores.map(
              (valor, indice) =>
                documento.heightOfString(
                  valor,
                  {
                    width:
                      larguras[indice] -
                      8,
                  },
                ),
            );

          const alturaLinha =
            Math.max(
              22,
              ...alturas.map(
                (altura) =>
                  altura + 10,
              ),
            );

          const limitePagina =
            documento.page.height -
            documento.page
              .margins.bottom;

          if (
            posicaoY +
              alturaLinha >
            limitePagina
          ) {
            adicionarPagina();
          }

          let posicaoX =
            documento.page
              .margins.left;

          for (
            let indice = 0;
            indice <
            valores.length;
            indice += 1
          ) {
            const largura =
              larguras[indice];

            documento
              .rect(
                posicaoX,
                posicaoY,
                largura,
                alturaLinha,
              )
              .stroke();

            documento.text(
              valores[indice],
              posicaoX + 4,
              posicaoY + 5,
              {
                width:
                  largura - 8,
                align: 'left',
              },
            );

            posicaoX += largura;
          }

          posicaoY += alturaLinha;
        };

        desenharCabecalho();

        for (const tarefa of tarefas) {
          desenharLinha([
            tarefa.titulo,

            tarefa
              .tipoAtividade
              .nome,

            tarefa.responsavel
              .nome,

            this.serializarEnum(
              tarefa.escopo,
            ),

            this.formatarData(
              tarefa.prazoAtual,
            ),

            this.serializarEnum(
              tarefa.status,
            ),

            String(
              tarefa._count
                .reagendamentos,
            ),
          ]);
        }

        if (tarefas.length === 0) {
          documento
            .font('Helvetica')
            .fontSize(10)
            .text(
              'Nenhuma tarefa encontrada para os filtros informados.',
              documento.page
                .margins.left,
              posicaoY + 12,
            );
        }

        documento.end();
      },
    );
  }

  private async buscarTarefas(
    query: RelatorioTarefasQueryDto,
    usuario: UsuarioAutenticado,
  ): Promise<TarefaRelatorio[]> {
    const inicio =
      query.inicio
        ? this.converterInicio(
            query.inicio,
          )
        : undefined;

    const fim =
      query.fim
        ? this.converterFim(
            query.fim,
          )
        : undefined;

    if (
      inicio &&
      fim &&
      inicio > fim
    ) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    const where: Prisma.TarefaWhereInput = {
      /*
       * Mentores sempre veem apenas
       * as próprias tarefas.
       */
      ...(usuario.papel === Papel.MENTOR
        ? {
            responsavelId:
              usuario.id,
          }
        : query.mentorId
          ? {
              responsavelId:
                query.mentorId,
            }
          : {}),

      ...(query.cursoId
        ? {
            cursoId:
              query.cursoId,
          }
        : {}),

      ...(query.turmaId
        ? {
            turmaId:
              query.turmaId,
          }
        : {}),

      ...(inicio || fim
        ? {
            prazoAtual: {
              ...(inicio
                ? {
                    gte: inicio,
                  }
                : {}),

              ...(fim
                ? {
                    lte: fim,
                  }
                : {}),
            },
          }
        : {}),
    };

    const tarefas =
      await this.prisma.tarefa.findMany({
        where,

        take:
          MAXIMO_REGISTROS + 1,

        orderBy: [
          {
            prazoAtual: 'asc',
          },
          {
            titulo: 'asc',
          },
        ],

        select:
          tarefaRelatorioSelect,
      });

    if (
      tarefas.length >
      MAXIMO_REGISTROS
    ) {
      throw new BadRequestException(
        `O relatório ultrapassou ${MAXIMO_REGISTROS} registros. Informe filtros mais específicos.`,
      );
    }

    return tarefas;
  }

  private converterInicio(
    valor: string,
  ): Date {
    if (
      DATA_SIMPLES_REGEX.test(
        valor,
      )
    ) {
      return new Date(
        `${valor}T00:00:00.000-03:00`,
      );
    }

    return new Date(valor);
  }

  private converterFim(
    valor: string,
  ): Date {
    if (
      DATA_SIMPLES_REGEX.test(
        valor,
      )
    ) {
      return new Date(
        `${valor}T23:59:59.999-03:00`,
      );
    }

    return new Date(valor);
  }

  private formatarTarefa(
    tarefa: TarefaRelatorio,
  ) {
    return {
      id: tarefa.id,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,

      tipoAtividade: {
        id:
          tarefa.tipoAtividade.id,
        nome:
          tarefa.tipoAtividade.nome,
      },

      responsavel:
        tarefa.responsavel,

      criadoPor:
        tarefa.criadoPor,

      escopo:
        this.serializarEnum(
          tarefa.escopo,
        ),

      curso:
        tarefa.curso,

      turma:
        tarefa.turma,

      prazoInicio:
        tarefa.prazoInicio,

      prazoAtual:
        tarefa.prazoAtual,

      status:
        this.serializarEnum(
          tarefa.status,
        ),

      quantidadeReagendamentos:
        tarefa._count
          .reagendamentos,

      quantidadeAnexos:
        tarefa._count.anexos,

      criadoEm:
        tarefa.criadoEm,

      concluidoEm:
        tarefa.concluidoEm,
    };
  }

  private serializarEnum(
    valor: string,
  ): string {
    return valor.toLowerCase();
  }

  private formatarData(
    data: Date,
  ): string {
    return new Intl.DateTimeFormat(
      'pt-BR',
      {
        timeZone:
          'America/Fortaleza',
        dateStyle: 'short',
        timeStyle: 'short',
      },
    ).format(data);
  }
}