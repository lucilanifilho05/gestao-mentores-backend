import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { basename } from 'node:path';
import { GoogleDriveService } from '../google-drive/google-drive.service';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import {
  EscopoTarefa,
  Papel,
  StatusTarefa,
} from '../generated/prisma/client';
import type {
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CriarTarefaDto,
  EscopoTarefaEntrada,
} from './dto/criar-tarefa.dto';
import type {
  ListarTarefasQueryDto,
  StatusTarefaEntrada,
} from './dto/listar-tarefas-query.dto';
import type { ReagendarTarefaDto } from './dto/reagendar-tarefa.dto';

const tarefaResumoSelect = {
  id: true,
  tipoAtividadeId: true,
  titulo: true,
  descricao: true,
  criadoPorId: true,
  responsavelId: true,
  escopo: true,
  cursoId: true,
  turmaId: true,
  prazoInicio: true,
  prazoAtual: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
  concluidoEm: true,

  tipoAtividade: {
    select: {
      id: true,
      nome: true,
    },
  },

  criadoPor: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },

  responsavel: {
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
    },
  },
} satisfies Prisma.TarefaSelect;

const tarefaDetalheSelect = {
  ...tarefaResumoSelect,

  anexos: {
    orderBy: {
      criadoEm: 'asc',
    },

    select: {
      id: true,
      nomeArquivo: true,
      mimeType: true,
      tamanhoBytes: true,
      enviadoPorId: true,
      criadoEm: true,

      enviadoPor: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  },

  reagendamentos: {
    orderBy: {
      criadoEm: 'asc',
    },

    select: {
      id: true,
      prazoAnterior: true,
      prazoNovo: true,
      justificativa: true,
      reagendadoPorId: true,
      criadoEm: true,

      reagendadoPor: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.TarefaSelect;

type TarefaResumo =
  Prisma.TarefaGetPayload<{
    select: typeof tarefaResumoSelect;
  }>;

type TarefaDetalhe =
  Prisma.TarefaGetPayload<{
    select: typeof tarefaDetalheSelect;
  }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService,
  ) { }

  async listar(
    query: ListarTarefasQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const status = query.status
      ? this.converterStatus(query.status)
      : undefined;

    const escopo = query.escopo
      ? this.converterEscopo(query.escopo)
      : undefined;

    const where: Prisma.TarefaWhereInput = {
      /*
       * O mentor sempre visualiza somente as tarefas
       * atribuídas a ele, ignorando responsavelId.
       */
      ...(usuario.papel === Papel.MENTOR
        ? {
          responsavelId: usuario.id,
        }
        : query.responsavelId
          ? {
            responsavelId:
              query.responsavelId,
          }
          : {}),

      ...(query.cursoId
        ? {
          cursoId: query.cursoId,
        }
        : {}),

      ...(query.turmaId
        ? {
          turmaId: query.turmaId,
        }
        : {}),

      ...(status
        ? {
          status,
        }
        : {}),

      ...(escopo
        ? {
          escopo,
        }
        : {}),
    };

    const [tarefas, total] =
      await this.prisma.$transaction([
        this.prisma.tarefa.findMany({
          where,
          skip: (pagina - 1) * limite,
          take: limite,
          orderBy: [
            {
              prazoAtual: 'asc',
            },
            {
              criadoEm: 'asc',
            },
          ],
          select: tarefaResumoSelect,
        }),

        this.prisma.tarefa.count({
          where,
        }),
      ]);

    return {
      data: tarefas.map((tarefa) =>
        this.formatarResumo(tarefa),
      ),

      meta: {
        pagina,
        limite,
        total,
        totalPaginas:
          Math.ceil(total / limite),
      },
    };
  }

  async buscarPorId(
    tarefaId: string,
    usuario: UsuarioAutenticado,
  ) {
    const tarefa =
      await this.prisma.tarefa.findFirst({
        where: {
          id: tarefaId,

          ...(usuario.papel === Papel.MENTOR
            ? {
              responsavelId: usuario.id,
            }
            : {}),
        },

        select: tarefaDetalheSelect,
      });

    if (!tarefa) {
      throw new NotFoundException(
        'Tarefa não encontrada ou não acessível.',
      );
    }

    return this.formatarDetalhe(tarefa);
  }

  async criar(
    dto: CriarTarefaDto,
    usuario: UsuarioAutenticado,
  ) {
    const prazoInicio = dto.prazoInicio
      ? new Date(dto.prazoInicio)
      : null;

    const prazoAtual =
      new Date(dto.prazoAtual);

    if (
      prazoInicio &&
      prazoAtual < prazoInicio
    ) {
      throw new BadRequestException(
        'O prazo final não pode ser anterior ao prazo inicial.',
      );
    }

    const tipoAtividade =
      await this.prisma.tipoAtividade.findUnique({
        where: {
          id: dto.tipoAtividadeId,
        },

        select: {
          id: true,
          ativo: true,
        },
      });

    if (!tipoAtividade) {
      throw new NotFoundException(
        'Tipo de atividade não encontrado.',
      );
    }

    if (!tipoAtividade.ativo) {
      throw new BadRequestException(
        'O tipo de atividade está inativo.',
      );
    }

    const responsavel =
      await this.prisma.usuario.findUnique({
        where: {
          id: dto.responsavelId,
        },

        select: {
          id: true,
          ativo: true,
          papel: true,
        },
      });

    if (!responsavel) {
      throw new NotFoundException(
        'Responsável não encontrado.',
      );
    }

    if (!responsavel.ativo) {
      throw new BadRequestException(
        'O responsável está inativo.',
      );
    }

    if (responsavel.papel !== Papel.MENTOR) {
      throw new BadRequestException(
        'O responsável pela tarefa deve ser um mentor.',
      );
    }

    /*
     * Coordenadora cria para qualquer mentor.
     * Mentor cria somente para si próprio.
     */
    if (
      usuario.papel === Papel.MENTOR &&
      dto.responsavelId !== usuario.id
    ) {
      throw new ForbiddenException(
        'Mentores só podem criar tarefas para si mesmos.',
      );
    }

    const escopo =
      this.converterEscopo(dto.escopo);

    const referencias =
      await this.validarEscopo(
        escopo,
        dto,
        usuario,
      );

    /*
     * Tarefas de curso ou turma só podem ser
     * atribuídas a mentor vinculado ao curso.
     */
    if (referencias.cursoId) {
      await this.validarResponsavelVinculadoAoCurso(
        dto.responsavelId,
        referencias.cursoId,
      );
    }

    const tarefa =
      await this.prisma.tarefa.create({
        data: {
          tipoAtividadeId:
            dto.tipoAtividadeId,

          titulo: dto.titulo
            .trim()
            .replace(/\s+/g, ' '),

          descricao:
            dto.descricao?.trim() || null,

          criadoPorId: usuario.id,
          responsavelId: dto.responsavelId,

          escopo,
          cursoId: referencias.cursoId,
          turmaId: referencias.turmaId,

          prazoInicio,
          prazoAtual,

          status: StatusTarefa.PENDENTE,
          concluidoEm: null,
        },

        select: tarefaDetalheSelect,
      });

    return this.formatarDetalhe(tarefa);
  }

  async reagendar(
    tarefaId: string,
    dto: ReagendarTarefaDto,
    usuario: UsuarioAutenticado,
  ) {
    const prazoNovo =
      new Date(dto.prazoNovo);

    return this.prisma.$transaction(
      async (transaction) => {
        const tarefa =
          await transaction.tarefa.findUnique({
            where: {
              id: tarefaId,
            },

            select: {
              id: true,
              responsavelId: true,
              status: true,
              prazoInicio: true,
              prazoAtual: true,
            },
          });

        if (!tarefa) {
          throw new NotFoundException(
            'Tarefa não encontrada.',
          );
        }

        const podeReagendar =
          usuario.papel ===
          Papel.COORDENADORA ||
          tarefa.responsavelId ===
          usuario.id;

        if (!podeReagendar) {
          throw new ForbiddenException(
            'Só o responsável pela tarefa ou a coordenadora pode reagendá-la.',
          );
        }

        if (
          tarefa.status ===
          StatusTarefa.CONCLUIDA
        ) {
          throw new ConflictException(
            'Uma tarefa concluída não pode ser reagendada.',
          );
        }

        if (
          tarefa.prazoInicio &&
          prazoNovo < tarefa.prazoInicio
        ) {
          throw new BadRequestException(
            'O novo prazo não pode ser anterior ao prazo inicial.',
          );
        }

        if (
          prazoNovo.getTime() ===
          tarefa.prazoAtual.getTime()
        ) {
          throw new BadRequestException(
            'O novo prazo deve ser diferente do prazo atual.',
          );
        }

        const atualizada =
          await transaction.tarefa.update({
            where: {
              id: tarefa.id,
            },

            data: {
              prazoAtual: prazoNovo,

              reagendamentos: {
                create: {
                  prazoAnterior:
                    tarefa.prazoAtual,

                  prazoNovo,

                  justificativa:
                    dto.justificativa?.trim() ||
                    null,

                  reagendadoPorId:
                    usuario.id,
                },
              },
            },

            select: tarefaDetalheSelect,
          });

        return this.formatarDetalhe(
          atualizada,
        );
      },
    );
  }

  async anexar(
    tarefaId: string,
    arquivo: Express.Multer.File,
    usuario: UsuarioAutenticado,
  ) {
    const tarefa =
      await this.prisma.tarefa.findUnique({
        where: {
          id: tarefaId,
        },

        select: {
          id: true,
          responsavelId: true,
        },
      });

    if (!tarefa) {
      throw new NotFoundException(
        'Tarefa não encontrada.',
      );
    }

    this.validarPermissaoAnexo(
      tarefa.responsavelId,
      usuario,
    );

    this.validarArquivo(arquivo);

    const nomeArquivo =
      this.sanitizarNomeArquivo(
        arquivo.originalname,
      );

    const arquivoDrive =
      await this.googleDriveService
        .uploadArquivo(
          nomeArquivo,
          arquivo.buffer,
          arquivo.mimetype,
        );

    try {
      await this.prisma.anexoTarefa.create({
        data: {
          tarefaId: tarefa.id,
          nomeArquivo,
          mimeType:
            arquivo.mimetype,
          tamanhoBytes:
            arquivo.size,
          driveFileId:
            arquivoDrive.id,
          enviadoPorId:
            usuario.id,
        },
      });
    } catch (erro: unknown) {
      await this.googleDriveService
        .excluirArquivoSilenciosamente(
          arquivoDrive.id,
        );

      throw erro;
    }

    return this.buscarPorId(
      tarefa.id,
      usuario,
    );
  }

  async gerarLinkAnexo(
    tarefaId: string,
    anexoId: string,
    usuario: UsuarioAutenticado,
  ) {
    const anexo =
      await this.prisma.anexoTarefa.findFirst({
        where: {
          id: anexoId,
          tarefaId,
        },

        select: {
          id: true,
          driveFileId: true,

          tarefa: {
            select: {
              responsavelId: true,
            },
          },
        },
      });

    if (!anexo) {
      throw new NotFoundException(
        'Anexo não encontrado.',
      );
    }

    this.validarPermissaoAnexo(
      anexo.tarefa.responsavelId,
      usuario,
    );

    const url =
      await this.googleDriveService
        .gerarLinkVisualizacao(
          anexo.driveFileId,
        );

    return {
      anexoId: anexo.id,
      url,
    };
  }

  private validarPermissaoAnexo(
    responsavelId: string,
    usuario: UsuarioAutenticado,
  ): void {
    const permitido =
      usuario.papel ===
      Papel.COORDENADORA ||
      responsavelId === usuario.id;

    if (!permitido) {
      throw new ForbiddenException(
        'Você não possui acesso aos anexos desta tarefa.',
      );
    }
  }

  private validarArquivo(
    arquivo: Express.Multer.File,
  ): void {
    const tiposPermitidos =
      new Set<string>([
        'application/pdf',

        'image/jpeg',
        'image/png',
        'image/webp',

        'text/plain',
        'text/csv',

        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',

        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ]);

    if (!arquivo.buffer?.length) {
      throw new BadRequestException(
        'O arquivo está vazio.',
      );
    }

    if (
      !tiposPermitidos.has(
        arquivo.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido.',
      );
    }
  }

  private sanitizarNomeArquivo(
    nomeOriginal: string,
  ): string {
    const nome = basename(nomeOriginal)
      .replace(
        /[\u0000-\u001f\u007f]/g,
        '',
      )
      .trim()
      .slice(0, 255);

    if (!nome) {
      throw new BadRequestException(
        'Nome de arquivo inválido.',
      );
    }

    return nome;
  }

  async concluir(
    tarefaId: string,
    usuario: UsuarioAutenticado,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const tarefa =
          await transaction.tarefa.findUnique({
            where: {
              id: tarefaId,
            },

            select: tarefaDetalheSelect,
          });

        if (!tarefa) {
          throw new NotFoundException(
            'Tarefa não encontrada.',
          );
        }

        const podeConcluir =
          usuario.papel ===
          Papel.COORDENADORA ||
          tarefa.responsavelId ===
          usuario.id;

        if (!podeConcluir) {
          throw new ForbiddenException(
            'Só o responsável pela tarefa ou a coordenadora pode concluí-la.',
          );
        }

        /*
         * Operação idempotente: se já estiver concluída,
         * devolve o estado atual.
         */
        if (
          tarefa.status ===
          StatusTarefa.CONCLUIDA
        ) {
          return this.formatarDetalhe(
            tarefa,
          );
        }

        const atualizada =
          await transaction.tarefa.update({
            where: {
              id: tarefa.id,
            },

            data: {
              status:
                StatusTarefa.CONCLUIDA,

              concluidoEm: new Date(),
            },

            select: tarefaDetalheSelect,
          });

        return this.formatarDetalhe(
          atualizada,
        );
      },
    );
  }

  private async validarEscopo(
    escopo: EscopoTarefa,
    dto: CriarTarefaDto,
    usuario: UsuarioAutenticado,
  ): Promise<{
    cursoId: string | null;
    turmaId: string | null;
  }> {
    switch (escopo) {
      case EscopoTarefa.CURSO: {
        if (!dto.cursoId) {
          throw new BadRequestException(
            'cursoId é obrigatório para tarefas de escopo curso.',
          );
        }

        if (dto.turmaId) {
          throw new BadRequestException(
            'turmaId não deve ser informado para tarefas de escopo curso.',
          );
        }

        const curso =
          await this.prisma.curso.findFirst({
            where: {
              id: dto.cursoId,
              ativo: true,

              ...(usuario.papel ===
                Papel.MENTOR
                ? {
                  mentores: {
                    some: {
                      mentorId:
                        usuario.id,
                    },
                  },
                }
                : {}),
            },

            select: {
              id: true,
            },
          });

        if (!curso) {
          throw new NotFoundException(
            'Curso não encontrado, inativo ou não acessível.',
          );
        }

        return {
          cursoId: curso.id,
          turmaId: null,
        };
      }

      case EscopoTarefa.TURMA: {
        if (!dto.cursoId) {
          throw new BadRequestException(
            'cursoId é obrigatório para tarefas de escopo turma.',
          );
        }

        if (!dto.turmaId) {
          throw new BadRequestException(
            'turmaId é obrigatório para tarefas de escopo turma.',
          );
        }

        const turma =
          await this.prisma.turma.findFirst({
            where: {
              id: dto.turmaId,
              cursoId: dto.cursoId,
              ativo: true,

              curso: {
                ativo: true,

                ...(usuario.papel ===
                  Papel.MENTOR
                  ? {
                    mentores: {
                      some: {
                        mentorId:
                          usuario.id,
                      },
                    },
                  }
                  : {}),
              },
            },

            select: {
              id: true,
              cursoId: true,
            },
          });

        if (!turma) {
          throw new NotFoundException(
            'Turma não encontrada, inativa, incompatível com o curso ou não acessível.',
          );
        }

        return {
          cursoId: turma.cursoId,
          turmaId: turma.id,
        };
      }

      case EscopoTarefa.EVENTO_MACRO: {
        if (
          dto.cursoId ||
          dto.turmaId
        ) {
          throw new BadRequestException(
            'Tarefas de evento_macro não devem possuir cursoId nem turmaId.',
          );
        }

        return {
          cursoId: null,
          turmaId: null,
        };
      }
    }
  }

  private async validarResponsavelVinculadoAoCurso(
    responsavelId: string,
    cursoId: string,
  ): Promise<void> {
    const vinculo =
      await this.prisma.cursoMentor.findFirst({
        where: {
          cursoId,
          mentorId: responsavelId,
        },

        select: {
          cursoId: true,
        },
      });

    if (!vinculo) {
      throw new BadRequestException(
        'O responsável precisa estar vinculado ao curso da tarefa.',
      );
    }
  }

  private converterEscopo(
    valor: EscopoTarefaEntrada,
  ): EscopoTarefa {
    switch (valor) {
      case 'curso':
        return EscopoTarefa.CURSO;

      case 'turma':
        return EscopoTarefa.TURMA;

      case 'evento_macro':
        return EscopoTarefa.EVENTO_MACRO;
    }
  }

  private converterStatus(
    valor: StatusTarefaEntrada,
  ): StatusTarefa {
    switch (valor) {
      case 'pendente':
        return StatusTarefa.PENDENTE;

      case 'concluida':
        return StatusTarefa.CONCLUIDA;
    }
  }

  private serializarEscopo(
    escopo: EscopoTarefa,
  ): EscopoTarefaEntrada {
    switch (escopo) {
      case EscopoTarefa.CURSO:
        return 'curso';

      case EscopoTarefa.TURMA:
        return 'turma';

      case EscopoTarefa.EVENTO_MACRO:
        return 'evento_macro';
    }
  }

  private serializarStatus(
    status: StatusTarefa,
  ): StatusTarefaEntrada {
    switch (status) {
      case StatusTarefa.PENDENTE:
        return 'pendente';

      case StatusTarefa.CONCLUIDA:
        return 'concluida';
    }
  }

  private formatarResumo(
    tarefa: TarefaResumo,
  ) {
    return {
      id: tarefa.id,

      tipoAtividadeId:
        tarefa.tipoAtividadeId,

      tipoAtividadeNome:
        tarefa.tipoAtividade.nome,

      titulo: tarefa.titulo,
      descricao: tarefa.descricao,

      criadoPorId:
        tarefa.criadoPorId,

      criadoPor: tarefa.criadoPor,

      responsavelId:
        tarefa.responsavelId,

      responsavel: tarefa.responsavel,

      escopo:
        this.serializarEscopo(
          tarefa.escopo,
        ),

      cursoId: tarefa.cursoId,
      cursoNome:
        tarefa.curso?.nome ?? null,

      turmaId: tarefa.turmaId,
      turmaCodigo:
        tarefa.turma?.codigo ?? null,

      prazoInicio:
        tarefa.prazoInicio,

      prazoAtual:
        tarefa.prazoAtual,

      status:
        this.serializarStatus(
          tarefa.status,
        ),

      criadoEm: tarefa.criadoEm,
      atualizadoEm:
        tarefa.atualizadoEm,

      concluidoEm:
        tarefa.concluidoEm,

      quantidadeReagendamentos:
        tarefa._count.reagendamentos,
    };
  }

  private formatarDetalhe(
    tarefa: TarefaDetalhe,
  ) {
    return {
      ...this.formatarResumo(tarefa),

      anexos: tarefa.anexos.map(
        (anexo) => ({
          id: anexo.id,
          nomeArquivo:
            anexo.nomeArquivo,
          mimeType:
            anexo.mimeType,
          tamanhoBytes:
            anexo.tamanhoBytes,
          enviadoPorId:
            anexo.enviadoPorId,
          enviadoPor:
            anexo.enviadoPor,
          criadoEm:
            anexo.criadoEm,
        }),
      ),

      reagendamentos:
        tarefa.reagendamentos.map(
          (reagendamento) => ({
            id: reagendamento.id,

            prazoAnterior:
              reagendamento.prazoAnterior,

            prazoNovo:
              reagendamento.prazoNovo,

            justificativa:
              reagendamento.justificativa,

            reagendadoPorId:
              reagendamento.reagendadoPorId,

            reagendadoPor:
              reagendamento.reagendadoPor,

            criadoEm:
              reagendamento.criadoEm,
          }),
        ),
    };
  }
}