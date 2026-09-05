import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import {
  EscopoTarefa,
  Papel,
  StatusProjeto,
  StatusTarefa,
} from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
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
import type { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import type { CriarComentarioTarefaDto } from './dto/criar-comentario-tarefa.dto';
import { sanitizeTaskDescription } from './task-description';

const tarefaResumoSelect = {
  id: true,
  numero: true,
  projetoId: true,
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
  iniciadoEm: true,
  links: true,

  projeto: {
    select: { id: true, nome: true, prazoFinal: true, status: true },
  },

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
      comentarios: true,
    },
  },
  comentarios: {
    where: { lidoEm: null },
    take: 1,
    select: { id: true, lidoEm: true },
  },
} satisfies Prisma.TarefaSelect;

const tarefaDetalheSelect = {
  ...tarefaResumoSelect,

  comentarios: {
    orderBy: { criadoEm: 'asc' },
    select: {
      id: true,
      conteudo: true,
      criadoEm: true,
      lidoEm: true,
      autor: { select: { id: true, nome: true, email: true } },
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

type TarefaResumo = Prisma.TarefaGetPayload<{
  select: typeof tarefaResumoSelect;
}>;

type TarefaDetalhe = Prisma.TarefaGetPayload<{
  select: typeof tarefaDetalheSelect;
}>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarTarefasQueryDto, usuario: UsuarioAutenticado) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const escopo = query.escopo
      ? this.converterEscopo(query.escopo)
      : undefined;

    const inicio = query.inicio
      ? new Date(`${query.inicio}T00:00:00.000-03:00`)
      : undefined;
    const fim = query.fim
      ? new Date(`${query.fim}T23:59:59.999-03:00`)
      : undefined;

    if (inicio && fim && inicio > fim) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }

    const agora = new Date();
    const filtroStatus = this.criarFiltroStatus(query.status);
    const filtraAtrasadas = query.status === 'atrasada';
    const filtraAbertasNoPrazo =
      query.status === 'planejada' || query.status === 'em_andamento';
    const prazoMinimo =
      filtraAbertasNoPrazo && (!inicio || agora > inicio) ? agora : inicio;

    const where: Prisma.TarefaWhereInput = {
      ...(query.numero ? { numero: query.numero } : {}),
      ...(query.projetoId ? { projetoId: query.projetoId } : {}),
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
              responsavelId: query.responsavelId,
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

      ...(query.tipoAtividadeId
        ? { tipoAtividadeId: query.tipoAtividadeId }
        : {}),

      ...(inicio || fim || filtraAtrasadas || filtraAbertasNoPrazo
        ? {
            prazoAtual: {
              ...(prazoMinimo ? { gte: prazoMinimo } : {}),
              ...(fim ? { lte: fim } : {}),
              ...(filtraAtrasadas ? { lt: agora } : {}),
            },
          }
        : {}),
      ...filtroStatus,

      ...(escopo
        ? {
            escopo,
          }
        : {}),
    };

    const [tarefas, total] = await this.prisma.$transaction([
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
      data: tarefas.map((tarefa) => this.formatarResumo(tarefa)),

      meta: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    };
  }

  async buscarPorId(tarefaId: string, usuario: UsuarioAutenticado) {
    const tarefa = await this.prisma.tarefa.findFirst({
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
      throw new NotFoundException('Tarefa não encontrada ou não acessível.');
    }

    return this.formatarDetalhe(tarefa);
  }

  async adicionarComentario(
    tarefaId: string,
    dto: CriarComentarioTarefaDto,
    usuario: UsuarioAutenticado,
  ) {
    if (usuario.papel !== Papel.COORDENADORA) {
      throw new ForbiddenException(
        'Somente a coordenadora pode adicionar comentários.',
      );
    }

    const tarefa = await this.prisma.tarefa.findUnique({
      where: { id: tarefaId },
      select: { id: true, status: true },
    });

    if (!tarefa) throw new NotFoundException('Tarefa não encontrada.');
    if (tarefa.status === StatusTarefa.CONCLUIDA) {
      throw new ConflictException(
        'Não é possível comentar uma tarefa concluída.',
      );
    }

    return this.prisma.comentarioTarefa.create({
      data: { tarefaId, autorId: usuario.id, conteudo: dto.conteudo.trim() },
      select: {
        id: true,
        conteudo: true,
        criadoEm: true,
        lidoEm: true,
        autor: { select: { id: true, nome: true, email: true } },
      },
    });
  }

  async marcarComentariosComoLidos(
    tarefaId: string,
    usuario: UsuarioAutenticado,
  ) {
    if (usuario.papel !== Papel.MENTOR) {
      return { quantidadeMarcada: 0 };
    }

    const tarefa = await this.prisma.tarefa.findFirst({
      where: { id: tarefaId, responsavelId: usuario.id },
      select: { id: true },
    });
    if (!tarefa)
      throw new NotFoundException('Tarefa não encontrada ou não acessível.');

    const resultado = await this.prisma.comentarioTarefa.updateMany({
      where: { tarefaId, lidoEm: null },
      data: { lidoEm: new Date() },
    });
    return { quantidadeMarcada: resultado.count };
  }

  async contarComentariosNaoLidos(usuario: UsuarioAutenticado) {
    if (usuario.papel !== Papel.MENTOR) return { quantidade: 0 };
    const quantidade = await this.prisma.comentarioTarefa.count({
      where: { lidoEm: null, tarefa: { responsavelId: usuario.id } },
    });
    return { quantidade };
  }

  async criar(dto: CriarTarefaDto, usuario: UsuarioAutenticado) {
    const prazoInicio = dto.prazoInicio ? new Date(dto.prazoInicio) : null;

    const prazoAtual = new Date(dto.prazoAtual);

    if (prazoInicio && prazoAtual < prazoInicio) {
      throw new BadRequestException(
        'O prazo final não pode ser anterior ao prazo inicial.',
      );
    }

    const tipoAtividade = await this.prisma.tipoAtividade.findUnique({
      where: {
        id: dto.tipoAtividadeId,
      },

      select: {
        id: true,
        ativo: true,
      },
    });

    if (!tipoAtividade) {
      throw new NotFoundException('Tipo de atividade não encontrado.');
    }

    if (!tipoAtividade.ativo) {
      throw new BadRequestException('O tipo de atividade está inativo.');
    }

    const escopo = this.converterEscopo(dto.escopo);

    if (escopo === EscopoTarefa.EVENTO_MACRO) {
      return this.criarParaMentoresSelecionados(
        dto,
        usuario,
        prazoInicio,
        prazoAtual,
      );
    }

    if (dto.responsavelIds?.length) {
      throw new BadRequestException(
        'responsavelIds deve ser informado somente para tarefas de evento_macro.',
      );
    }

    const responsavelId =
      usuario.papel === Papel.MENTOR ? usuario.id : dto.responsavelId;

    if (!responsavelId) {
      throw new BadRequestException(
        'responsavelId é obrigatório para tarefas de escopo curso ou turma.',
      );
    }

    const responsavel = await this.prisma.usuario.findUnique({
      where: {
        id: responsavelId,
      },

      select: {
        id: true,
        ativo: true,
        papel: true,
      },
    });

    if (!responsavel) {
      throw new NotFoundException('Responsável não encontrado.');
    }

    if (!responsavel.ativo) {
      throw new BadRequestException('O responsável está inativo.');
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
    const projeto = await this.prisma.projeto.findFirst({
      where: {
        id: dto.projetoId,
        status: {
          in: [StatusProjeto.PLANEJAMENTO, StatusProjeto.EM_ANDAMENTO],
        },
        ...(usuario.papel === Papel.MENTOR
          ? { tarefas: { some: { responsavelId: usuario.id } } }
          : {}),
      },
      select: {
        id: true,
        prazoFinal: true,
      },
    });

    if (!projeto) {
      throw new NotFoundException(
        'Projeto não encontrado, encerrado ou não acessível.',
      );
    }

    if (prazoAtual > projeto.prazoFinal) {
      throw new BadRequestException(
        'O prazo da tarefa não pode ultrapassar o prazo final do projeto.',
      );
    }

    const referencias = await this.validarEscopo(escopo, dto, usuario);

    /*
     * Tarefas de curso ou turma só podem ser
     * atribuídas a mentor vinculado ao curso.
     */
    if (referencias.cursoId) {
      await this.validarResponsavelVinculadoAoCurso(
        responsavelId,
        referencias.cursoId,
      );
    }

    const tarefa = await this.prisma.tarefa.create({
      data: {
        projetoId: projeto.id,
        tipoAtividadeId: dto.tipoAtividadeId,

        titulo: dto.titulo.trim().replace(/\s+/g, ' '),

        descricao: sanitizeTaskDescription(dto.descricao),

        criadoPorId: usuario.id,
        responsavelId,

        escopo,
        cursoId: referencias.cursoId,
        turmaId: referencias.turmaId,

        prazoInicio,
        prazoAtual,

        status: StatusTarefa.PLANEJADA,
        iniciadoEm: null,
        concluidoEm: null,
        links: [...new Set(dto.links?.map((link) => link.trim()) ?? [])],
      },

      select: tarefaDetalheSelect,
    });

    await this.prisma.projeto.updateMany({
      where: { id: projeto.id, status: StatusProjeto.PLANEJAMENTO },
      data: { status: StatusProjeto.EM_ANDAMENTO },
    });

    return this.formatarDetalhe(tarefa);
  }

  private async criarParaMentoresSelecionados(
    dto: CriarTarefaDto,
    usuario: UsuarioAutenticado,
    prazoInicio: Date | null,
    prazoAtual: Date,
  ) {
    if (usuario.papel !== Papel.COORDENADORA) {
      throw new ForbiddenException(
        'Somente a coordenadora pode criar tarefas para todos os mentores.',
      );
    }

    if (dto.responsavelId) {
      throw new BadRequestException(
        'responsavelId não deve ser informado para tarefas de evento_macro.',
      );
    }

    const responsavelIds = [...new Set(dto.responsavelIds ?? [])];

    if (responsavelIds.length === 0) {
      throw new BadRequestException(
        'Selecione pelo menos um mentor para a tarefa de evento macro.',
      );
    }

    await this.validarEscopo(EscopoTarefa.EVENTO_MACRO, dto, usuario);

    const projeto = await this.prisma.projeto.findFirst({
      where: {
        id: dto.projetoId,
        status: {
          in: [StatusProjeto.PLANEJAMENTO, StatusProjeto.EM_ANDAMENTO],
        },
      },
      select: { id: true, prazoFinal: true },
    });

    if (!projeto) {
      throw new NotFoundException(
        'Projeto não encontrado, encerrado ou não acessível.',
      );
    }

    if (prazoAtual > projeto.prazoFinal) {
      throw new BadRequestException(
        'O prazo da tarefa não pode ultrapassar o prazo final do projeto.',
      );
    }

    const mentores = await this.prisma.usuario.findMany({
      where: {
        id: { in: responsavelIds },
        papel: Papel.MENTOR,
        ativo: true,
      },
      select: { id: true },
    });

    if (mentores.length !== responsavelIds.length) {
      throw new BadRequestException(
        'Um ou mais responsáveis não existem, estão inativos ou não são mentores.',
      );
    }

    const tarefas = await this.prisma.$transaction(async (transaction) => {
      const criadas = await Promise.all(
        responsavelIds.map((responsavelId) =>
          transaction.tarefa.create({
            data: {
              projetoId: projeto.id,
              tipoAtividadeId: dto.tipoAtividadeId,
              titulo: dto.titulo.trim().replace(/\s+/g, ' '),
              descricao: sanitizeTaskDescription(dto.descricao),
              criadoPorId: usuario.id,
              responsavelId,
              escopo: EscopoTarefa.EVENTO_MACRO,
              cursoId: null,
              turmaId: null,
              prazoInicio,
              prazoAtual,
              status: StatusTarefa.PLANEJADA,
              iniciadoEm: null,
              concluidoEm: null,
              links: [...new Set(dto.links?.map((link) => link.trim()) ?? [])],
            },
            select: tarefaDetalheSelect,
          }),
        ),
      );

      await transaction.projeto.updateMany({
        where: { id: projeto.id, status: StatusProjeto.PLANEJAMENTO },
        data: { status: StatusProjeto.EM_ANDAMENTO },
      });

      return criadas;
    });

    return {
      quantidadeCriada: tarefas.length,
      titulo: dto.titulo.trim().replace(/\s+/g, ' '),
      tarefas: tarefas.map((tarefa) => this.formatarDetalhe(tarefa)),
    };
  }

  async atualizar(
    tarefaId: string,
    dto: AtualizarTarefaDto,
    usuario: UsuarioAutenticado,
  ) {
    const tarefa = await this.prisma.tarefa.findUnique({
      where: { id: tarefaId },
      select: {
        id: true,
        responsavelId: true,
        tipoAtividadeId: true,
        status: true,
      },
    });

    if (!tarefa) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    const podeEditar =
      usuario.papel === Papel.COORDENADORA ||
      tarefa.responsavelId === usuario.id;

    if (!podeEditar) {
      throw new ForbiddenException(
        'Só o responsável pela tarefa ou a coordenadora pode editá-la.',
      );
    }

    if (tarefa.status === StatusTarefa.CONCLUIDA) {
      throw new ConflictException('Uma tarefa concluída não pode ser editada.');
    }

    if (dto.tipoAtividadeId !== tarefa.tipoAtividadeId) {
      const tipoAtividade = await this.prisma.tipoAtividade.findUnique({
        where: { id: dto.tipoAtividadeId },
        select: { id: true, ativo: true },
      });

      if (!tipoAtividade) {
        throw new NotFoundException('Tipo de atividade não encontrado.');
      }

      if (!tipoAtividade.ativo) {
        throw new BadRequestException('O tipo de atividade está inativo.');
      }
    }

    try {
      const atualizada = await this.prisma.tarefa.update({
        where: { id: tarefa.id, status: { not: StatusTarefa.CONCLUIDA } },
        data: {
          tipoAtividadeId: dto.tipoAtividadeId,
          titulo: dto.titulo.trim().replace(/\s+/g, ' '),
          descricao: sanitizeTaskDescription(dto.descricao),
          links: [...new Set(dto.links?.map((link) => link.trim()) ?? [])],
        },
        select: tarefaDetalheSelect,
      });

      return this.formatarDetalhe(atualizada);
    } catch (erro: unknown) {
      if (
        typeof erro === 'object' &&
        erro !== null &&
        'code' in erro &&
        (erro as { code?: unknown }).code === 'P2025'
      ) {
        throw new ConflictException(
          'A tarefa foi concluída enquanto estava sendo editada.',
        );
      }
      throw erro;
    }
  }

  async reagendar(
    tarefaId: string,
    dto: ReagendarTarefaDto,
    usuario: UsuarioAutenticado,
  ) {
    const prazoNovo = new Date(dto.prazoNovo);

    return this.prisma.$transaction(async (transaction) => {
      const tarefa = await transaction.tarefa.findUnique({
        where: {
          id: tarefaId,
        },

        select: {
          id: true,
          responsavelId: true,
          status: true,
          prazoInicio: true,
          prazoAtual: true,
          projeto: { select: { prazoFinal: true } },
        },
      });

      if (!tarefa) {
        throw new NotFoundException('Tarefa não encontrada.');
      }

      const podeReagendar =
        usuario.papel === Papel.COORDENADORA ||
        tarefa.responsavelId === usuario.id;

      if (!podeReagendar) {
        throw new ForbiddenException(
          'Só o responsável pela tarefa ou a coordenadora pode reagendá-la.',
        );
      }

      if (tarefa.status === StatusTarefa.CONCLUIDA) {
        throw new ConflictException(
          'Uma tarefa concluída não pode ser reagendada.',
        );
      }

      if (tarefa.prazoInicio && prazoNovo < tarefa.prazoInicio) {
        throw new BadRequestException(
          'O novo prazo não pode ser anterior ao prazo inicial.',
        );
      }

      if (prazoNovo > tarefa.projeto.prazoFinal) {
        throw new BadRequestException(
          'O novo prazo não pode ultrapassar o prazo final do projeto.',
        );
      }

      if (prazoNovo.getTime() === tarefa.prazoAtual.getTime()) {
        throw new BadRequestException(
          'O novo prazo deve ser diferente do prazo atual.',
        );
      }

      const atualizada = await transaction.tarefa.update({
        where: {
          id: tarefa.id,
        },

        data: {
          prazoAtual: prazoNovo,

          reagendamentos: {
            create: {
              prazoAnterior: tarefa.prazoAtual,

              prazoNovo,

              justificativa: dto.justificativa?.trim() || null,

              reagendadoPorId: usuario.id,
            },
          },
        },

        select: tarefaDetalheSelect,
      });

      return this.formatarDetalhe(atualizada);
    });
  }

  async concluir(tarefaId: string, usuario: UsuarioAutenticado) {
    return this.prisma.$transaction(async (transaction) => {
      const tarefa = await transaction.tarefa.findUnique({
        where: {
          id: tarefaId,
        },

        select: tarefaDetalheSelect,
      });

      if (!tarefa) {
        throw new NotFoundException('Tarefa não encontrada.');
      }

      const podeConcluir =
        usuario.papel === Papel.COORDENADORA ||
        tarefa.responsavelId === usuario.id;

      if (!podeConcluir) {
        throw new ForbiddenException(
          'Só o responsável pela tarefa ou a coordenadora pode concluí-la.',
        );
      }

      /*
       * Operação idempotente: se já estiver concluída,
       * devolve o estado atual.
       */
      if (tarefa.status === StatusTarefa.CONCLUIDA) {
        return this.formatarDetalhe(tarefa);
      }

      const atualizada = await transaction.tarefa.update({
        where: {
          id: tarefa.id,
        },

        data: {
          status: StatusTarefa.CONCLUIDA,

          concluidoEm: new Date(),
        },

        select: tarefaDetalheSelect,
      });

      return this.formatarDetalhe(atualizada);
    });
  }

  async iniciar(tarefaId: string, usuario: UsuarioAutenticado) {
    const tarefa = await this.prisma.tarefa.findUnique({
      where: { id: tarefaId },
      select: {
        id: true,
        responsavelId: true,
        status: true,
        prazoAtual: true,
      },
    });

    if (!tarefa) throw new NotFoundException('Tarefa não encontrada.');

    const podeIniciar =
      usuario.papel === Papel.COORDENADORA ||
      tarefa.responsavelId === usuario.id;
    if (!podeIniciar) {
      throw new ForbiddenException(
        'Só o responsável pela tarefa ou a coordenadora pode iniciá-la.',
      );
    }
    if (tarefa.status === StatusTarefa.CONCLUIDA) {
      throw new ConflictException(
        'Uma tarefa concluída não pode ser iniciada.',
      );
    }
    if (tarefa.status === StatusTarefa.EM_ANDAMENTO) {
      const atual = await this.prisma.tarefa.findUnique({
        where: { id: tarefa.id },
        select: tarefaDetalheSelect,
      });
      if (!atual) throw new NotFoundException('Tarefa não encontrada.');
      return this.formatarDetalhe(atual);
    }
    if (tarefa.prazoAtual.getTime() < Date.now()) {
      throw new ConflictException(
        'Uma tarefa atrasada deve ser reagendada ou concluída.',
      );
    }

    try {
      const atualizada = await this.prisma.tarefa.update({
        where: { id: tarefa.id, status: StatusTarefa.PLANEJADA },
        data: {
          status: StatusTarefa.EM_ANDAMENTO,
          iniciadoEm: new Date(),
        },
        select: tarefaDetalheSelect,
      });
      return this.formatarDetalhe(atualizada);
    } catch (erro: unknown) {
      if (
        typeof erro === 'object' &&
        erro !== null &&
        'code' in erro &&
        (erro as { code?: unknown }).code === 'P2025'
      ) {
        throw new ConflictException(
          'O status da tarefa foi alterado simultaneamente.',
        );
      }
      throw erro;
    }
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

        const curso = await this.prisma.curso.findFirst({
          where: {
            id: dto.cursoId,
            ativo: true,

            ...(usuario.papel === Papel.MENTOR
              ? {
                  mentores: {
                    some: {
                      mentorId: usuario.id,
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

        const turma = await this.prisma.turma.findFirst({
          where: {
            id: dto.turmaId,
            cursoId: dto.cursoId,
            ativo: true,

            curso: {
              ativo: true,

              ...(usuario.papel === Papel.MENTOR
                ? {
                    mentores: {
                      some: {
                        mentorId: usuario.id,
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
        if (dto.cursoId || dto.turmaId) {
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
    const vinculo = await this.prisma.cursoMentor.findFirst({
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

  private converterEscopo(valor: EscopoTarefaEntrada): EscopoTarefa {
    switch (valor) {
      case 'curso':
        return EscopoTarefa.CURSO;

      case 'turma':
        return EscopoTarefa.TURMA;

      case 'evento_macro':
        return EscopoTarefa.EVENTO_MACRO;
    }
  }

  private criarFiltroStatus(
    valor: StatusTarefaEntrada | undefined,
  ): Prisma.TarefaWhereInput {
    switch (valor) {
      case 'planejada':
        return { status: StatusTarefa.PLANEJADA };
      case 'em_andamento':
        return { status: StatusTarefa.EM_ANDAMENTO };
      case 'atrasada':
        return { status: { not: StatusTarefa.CONCLUIDA } };
      case 'concluida':
        return { status: StatusTarefa.CONCLUIDA };
      default:
        return {};
    }
  }

  private serializarEscopo(escopo: EscopoTarefa): EscopoTarefaEntrada {
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
    prazoAtual: Date,
  ): StatusTarefaEntrada {
    if (
      status !== StatusTarefa.CONCLUIDA &&
      prazoAtual.getTime() < Date.now()
    ) {
      return 'atrasada';
    }

    switch (status) {
      case StatusTarefa.PLANEJADA:
        return 'planejada';
      case StatusTarefa.EM_ANDAMENTO:
        return 'em_andamento';
      case StatusTarefa.CONCLUIDA:
        return 'concluida';
    }
  }

  private formatarResumo(tarefa: TarefaResumo) {
    return {
      id: tarefa.id,
      numero: tarefa.numero,

      projetoId: tarefa.projetoId,
      projetoNome: tarefa.projeto.nome,

      tipoAtividadeId: tarefa.tipoAtividadeId,

      tipoAtividadeNome: tarefa.tipoAtividade.nome,

      titulo: tarefa.titulo,
      descricao: sanitizeTaskDescription(tarefa.descricao),

      criadoPorId: tarefa.criadoPorId,

      criadoPor: tarefa.criadoPor,

      responsavelId: tarefa.responsavelId,

      responsavel: tarefa.responsavel,

      escopo: this.serializarEscopo(tarefa.escopo),

      cursoId: tarefa.cursoId,
      cursoNome: tarefa.curso?.nome ?? null,

      turmaId: tarefa.turmaId,
      turmaCodigo: tarefa.turma?.codigo ?? null,

      prazoInicio: tarefa.prazoInicio,

      prazoAtual: tarefa.prazoAtual,

      status: this.serializarStatus(tarefa.status, tarefa.prazoAtual),

      criadoEm: tarefa.criadoEm,
      atualizadoEm: tarefa.atualizadoEm,

      concluidoEm: tarefa.concluidoEm,
      iniciadoEm: tarefa.iniciadoEm,

      links: tarefa.links,

      quantidadeReagendamentos: tarefa._count.reagendamentos,
      quantidadeComentarios: tarefa._count.comentarios,
      possuiComentarioNaoLido: tarefa.comentarios.some(
        (comentario) => comentario.lidoEm === null,
      ),
    };
  }

  private formatarDetalhe(tarefa: TarefaDetalhe) {
    return {
      ...this.formatarResumo(tarefa),

      reagendamentos: tarefa.reagendamentos.map((reagendamento) => ({
        id: reagendamento.id,

        prazoAnterior: reagendamento.prazoAnterior,

        prazoNovo: reagendamento.prazoNovo,

        justificativa: reagendamento.justificativa,

        reagendadoPorId: reagendamento.reagendadoPorId,

        reagendadoPor: reagendamento.reagendadoPor,

        criadoEm: reagendamento.criadoEm,
      })),
      comentarios: tarefa.comentarios.map((comentario) => ({
        id: comentario.id,
        conteudo: comentario.conteudo,
        criadoEm: comentario.criadoEm,
        lidoEm: comentario.lidoEm,
        autor: comentario.autor,
      })),
    };
  }
}
