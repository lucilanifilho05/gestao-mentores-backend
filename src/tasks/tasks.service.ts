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

const tarefaResumoSelect = {
  id: true,
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
    },
  },
} satisfies Prisma.TarefaSelect;

const tarefaDetalheSelect = {
  ...tarefaResumoSelect,

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

    const status = query.status
      ? this.converterStatus(query.status)
      : undefined;

    const escopo = query.escopo
      ? this.converterEscopo(query.escopo)
      : undefined;

    const where: Prisma.TarefaWhereInput = {
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
      return this.criarParaTodosOsMentores(dto, usuario, prazoInicio, prazoAtual);
    }

    if (!dto.responsavelId) {
      throw new BadRequestException(
        'responsavelId é obrigatório para tarefas de escopo curso ou turma.',
      );
    }

    const responsavel = await this.prisma.usuario.findUnique({
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
    if (usuario.papel === Papel.MENTOR && dto.responsavelId !== usuario.id) {
      throw new ForbiddenException(
        'Mentores só podem criar tarefas para si mesmos.',
      );
    }

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
        dto.responsavelId,
        referencias.cursoId,
      );
    }

    const tarefa = await this.prisma.tarefa.create({
      data: {
        projetoId: projeto.id,
        tipoAtividadeId: dto.tipoAtividadeId,

        titulo: dto.titulo.trim().replace(/\s+/g, ' '),

        descricao: dto.descricao?.trim() || null,

        criadoPorId: usuario.id,
        responsavelId: dto.responsavelId,

        escopo,
        cursoId: referencias.cursoId,
        turmaId: referencias.turmaId,

        prazoInicio,
        prazoAtual,

        status: StatusTarefa.PENDENTE,
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

  private async criarParaTodosOsMentores(
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
      where: { papel: Papel.MENTOR, ativo: true },
      select: { id: true },
      orderBy: { nome: 'asc' },
    });

    if (mentores.length === 0) {
      throw new BadRequestException(
        'Não há mentores ativos para receber a tarefa macro.',
      );
    }

    const tarefas = await this.prisma.$transaction(async (transaction) => {
      const criadas = await Promise.all(
        mentores.map((mentor) =>
          transaction.tarefa.create({
            data: {
              projetoId: projeto.id,
              tipoAtividadeId: dto.tipoAtividadeId,
              titulo: dto.titulo.trim().replace(/\s+/g, ' '),
              descricao: dto.descricao?.trim() || null,
              criadoPorId: usuario.id,
              responsavelId: mentor.id,
              escopo: EscopoTarefa.EVENTO_MACRO,
              cursoId: null,
              turmaId: null,
              prazoInicio,
              prazoAtual,
              status: StatusTarefa.PENDENTE,
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

  private converterStatus(valor: StatusTarefaEntrada): StatusTarefa {
    switch (valor) {
      case 'pendente':
        return StatusTarefa.PENDENTE;

      case 'concluida':
        return StatusTarefa.CONCLUIDA;
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

  private serializarStatus(status: StatusTarefa): StatusTarefaEntrada {
    switch (status) {
      case StatusTarefa.PENDENTE:
        return 'pendente';

      case StatusTarefa.CONCLUIDA:
        return 'concluida';
    }
  }

  private formatarResumo(tarefa: TarefaResumo) {
    return {
      id: tarefa.id,

      projetoId: tarefa.projetoId,
      projetoNome: tarefa.projeto.nome,

      tipoAtividadeId: tarefa.tipoAtividadeId,

      tipoAtividadeNome: tarefa.tipoAtividade.nome,

      titulo: tarefa.titulo,
      descricao: tarefa.descricao,

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

      status: this.serializarStatus(tarefa.status),

      criadoEm: tarefa.criadoEm,
      atualizadoEm: tarefa.atualizadoEm,

      concluidoEm: tarefa.concluidoEm,

      links: tarefa.links,

      quantidadeReagendamentos: tarefa._count.reagendamentos,
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
    };
  }
}
