import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import {
  adicionarDias,
  converterDataAcademica,
  diferencaEmDias,
  validarDentroDoPeriodo,
  validarPeriodo,
} from '../common/date-only';
import {
  normalizarNome,
} from '../common/normalization';
import {
  Papel,
} from '../generated/prisma/client';
import type {
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClonarTurmaDto } from './dto/clonar-turma.dto';
import type { AlterarStatusTurmaDto } from './dto/alterar-status-turma.dto';
import type { AtualizarTurmaDto } from './dto/atualizar-turma.dto';
import type { CriarModuloDto } from './dto/criar-modulo.dto';
import type { CriarTurmaDto } from './dto/criar-turma.dto';
import type { CriarUnidadeCurricularDto } from './dto/criar-unidade-curricular.dto';
import type { ListarTurmasQueryDto } from './dto/listar-turmas-query.dto';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listarTurmas(
    query: ListarTurmasQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const where: Prisma.TurmaWhereInput = {
      ...(usuario.papel === Papel.MENTOR
        ? { ativo: true }
        : query.ativo !== undefined
          ? { ativo: query.ativo }
          : {}),

      ...(query.cursoId
        ? {
            cursoId: query.cursoId,
          }
        : {}),

      ...(usuario.papel === Papel.MENTOR
        ? {
            curso: {
              mentores: {
                some: {
                  mentorId: usuario.id,
                },
              },
            },
          }
        : {}),
    };

    const [turmas, total] =
      await this.prisma.$transaction([
        this.prisma.turma.findMany({
          where,
          skip: (pagina - 1) * limite,
          take: limite,
          orderBy: [
            {
              dataInicio: 'asc',
            },
            {
              codigo: 'asc',
            },
          ],
          select: {
            id: true,
            codigo: true,
            dataInicio: true,
            dataFim: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
            curso: {
              select: {
                id: true,
                nome: true,
              },
            },
            _count: {
              select: {
                modulos: true,
              },
            },
          },
        }),

        this.prisma.turma.count({
          where,
        }),
      ]);

    return {
      data: turmas.map((turma) => ({
        id: turma.id,
        codigo: turma.codigo,
        dataInicio: turma.dataInicio,
        dataFim: turma.dataFim,
        ativo: turma.ativo,
        curso: turma.curso,
        quantidadeModulos:
          turma._count.modulos,
        criadoEm: turma.criadoEm,
        atualizadoEm: turma.atualizadoEm,
      })),
      meta: {
        pagina,
        limite,
        total,
        totalPaginas:
          Math.ceil(total / limite),
      },
    };
  }

  async criarTurma(dto: CriarTurmaDto) {
    const dataInicio =
      converterDataAcademica(
        dto.dataInicio,
        'dataInicio',
      );

    const dataFim =
      converterDataAcademica(
        dto.dataFim,
        'dataFim',
      );

    validarPeriodo(
      dataInicio,
      dataFim,
      'turma',
    );

    const curso =
      await this.prisma.curso.findUnique({
        where: {
          id: dto.cursoId,
        },
        select: {
          id: true,
          ativo: true,
        },
      });

    if (!curso) {
      throw new NotFoundException(
        'Curso não encontrado.',
      );
    }

    if (!curso.ativo) {
      throw new BadRequestException(
        'Não é possível criar uma turma em um curso inativo.',
      );
    }

    try {
      return await this.prisma.turma.create({
        data: {
          cursoId: dto.cursoId,
          codigo: dto.codigo.trim(),
          dataInicio,
          dataFim,
        },
        select: {
          id: true,
          codigo: true,
          dataInicio: true,
          dataFim: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          curso: {
            select: {
              id: true,
              nome: true,
            },
          },
        },
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException(
          'Já existe uma turma com esse código no curso.',
        );
      }

      throw erro;
    }
  }

  async atualizarTurma(
    turmaId: string,
    dto: AtualizarTurmaDto,
  ) {
    const dataInicio = converterDataAcademica(
      dto.dataInicio,
      'dataInicio',
    );
    const dataFim = converterDataAcademica(
      dto.dataFim,
      'dataFim',
    );

    validarPeriodo(dataInicio, dataFim, 'turma');

    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      select: {
        id: true,
        modulos: {
          select: {
            nome: true,
            dataInicio: true,
            dataFim: true,
          },
        },
      },
    });

    if (!turma) {
      throw new NotFoundException(
        'Turma não encontrada.',
      );
    }

    for (const modulo of turma.modulos) {
      validarDentroDoPeriodo(
        modulo.dataInicio,
        modulo.dataFim,
        dataInicio,
        dataFim,
        `módulo "${modulo.nome}"`,
        'turma',
      );
    }

    try {
      return await this.prisma.turma.update({
        where: { id: turmaId },
        data: {
          codigo: dto.codigo.trim(),
          dataInicio,
          dataFim,
        },
        select: {
          id: true,
          codigo: true,
          dataInicio: true,
          dataFim: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
          curso: {
            select: { id: true, nome: true },
          },
        },
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException(
          'Já existe uma turma com esse código no curso.',
        );
      }

      throw erro;
    }
  }

  async alterarStatusTurma(
    turmaId: string,
    dto: AlterarStatusTurmaDto,
  ) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      select: {
        id: true,
        codigo: true,
        dataInicio: true,
        dataFim: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        curso: {
          select: {
            id: true,
            nome: true,
            ativo: true,
          },
        },
      },
    });

    if (!turma) {
      throw new NotFoundException(
        'Turma não encontrada.',
      );
    }

    const respostaAtual = {
      id: turma.id,
      codigo: turma.codigo,
      dataInicio: turma.dataInicio,
      dataFim: turma.dataFim,
      ativo: turma.ativo,
      criadoEm: turma.criadoEm,
      atualizadoEm: turma.atualizadoEm,
      curso: {
        id: turma.curso.id,
        nome: turma.curso.nome,
      },
    };

    if (turma.ativo === dto.ativo) {
      return respostaAtual;
    }

    if (dto.ativo && !turma.curso.ativo) {
      throw new BadRequestException(
        'Não é possível ativar uma turma de um curso inativo.',
      );
    }

    return this.prisma.turma.update({
      where: { id: turmaId },
      data: { ativo: dto.ativo },
      select: {
        id: true,
        codigo: true,
        dataInicio: true,
        dataFim: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        curso: {
          select: { id: true, nome: true },
        },
      },
    });
  }

  async clonarTurma(
    turmaId: string,
    dto: ClonarTurmaDto,
  ) {
    const novaDataInicio =
      converterDataAcademica(
        dto.dataInicio,
        'dataInicio',
      );

    const novaDataFim =
      converterDataAcademica(
        dto.dataFim,
        'dataFim',
      );

    validarPeriodo(
      novaDataInicio,
      novaDataFim,
      'turma',
    );

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const origem =
            await transaction.turma.findUnique({
              where: {
                id: turmaId,
              },
              include: {
                curso: {
                  select: {
                    id: true,
                    ativo: true,
                  },
                },
                modulos: {
                  orderBy: {
                    dataInicio: 'asc',
                  },
                  include: {
                    unidadesCurriculares: {
                      orderBy: {
                        dataInicio: 'asc',
                      },
                    },
                  },
                },
              },
            });

          if (!origem) {
            throw new NotFoundException(
              'Turma de origem não encontrada.',
            );
          }

          if (!origem.ativo) {
            throw new BadRequestException(
              'Não é possível clonar uma turma inativa.',
            );
          }

          if (!origem.curso.ativo) {
            throw new BadRequestException(
              'Não é possível clonar uma turma de um curso inativo.',
            );
          }

          const deslocamento =
            diferencaEmDias(
              novaDataInicio,
              origem.dataInicio,
            );

          const modulos =
            origem.modulos.map((modulo) => {
              const moduloInicio =
                adicionarDias(
                  modulo.dataInicio,
                  deslocamento,
                );

              const moduloFim =
                adicionarDias(
                  modulo.dataFim,
                  deslocamento,
                );

              validarDentroDoPeriodo(
                moduloInicio,
                moduloFim,
                novaDataInicio,
                novaDataFim,
                `módulo "${modulo.nome}"`,
                'nova turma',
              );

              const unidadesCurriculares =
                modulo.unidadesCurriculares.map(
                  (unidade) => {
                    const unidadeInicio =
                      adicionarDias(
                        unidade.dataInicio,
                        deslocamento,
                      );

                    const unidadeFim =
                      adicionarDias(
                        unidade.dataFim,
                        deslocamento,
                      );

                    validarDentroDoPeriodo(
                      unidadeInicio,
                      unidadeFim,
                      moduloInicio,
                      moduloFim,
                      `unidade curricular "${unidade.nome}"`,
                      `módulo "${modulo.nome}"`,
                    );

                    return {
                      nome: unidade.nome,
                      dataInicio:
                        unidadeInicio,
                      dataFim: unidadeFim,
                      cargaHoraria:
                        unidade.cargaHoraria,
                    };
                  },
                );

              return {
                nome: modulo.nome,
                dataInicio: moduloInicio,
                dataFim: moduloFim,

                ...(unidadesCurriculares.length >
                0
                  ? {
                      unidadesCurriculares: {
                        create:
                          unidadesCurriculares,
                      },
                    }
                  : {}),
              };
            });

          return transaction.turma.create({
            data: {
              cursoId: origem.cursoId,
              codigo: dto.codigo.trim(),
              dataInicio: novaDataInicio,
              dataFim: novaDataFim,

              ...(modulos.length > 0
                ? {
                    modulos: {
                      create: modulos,
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              codigo: true,
              dataInicio: true,
              dataFim: true,
              ativo: true,
              curso: {
                select: {
                  id: true,
                  nome: true,
                },
              },
              modulos: {
                orderBy: {
                  dataInicio: 'asc',
                },
                select: {
                  id: true,
                  nome: true,
                  dataInicio: true,
                  dataFim: true,
                  unidadesCurriculares: {
                    orderBy: {
                      dataInicio: 'asc',
                    },
                    select: {
                      id: true,
                      nome: true,
                      dataInicio: true,
                      dataFim: true,
                      cargaHoraria: true,
                    },
                  },
                },
              },
            },
          });
        },
      );
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException(
          'Já existe uma turma com esse código no curso.',
        );
      }

      throw erro;
    }
  }

  async listarModulos(
    turmaId: string,
    usuario: UsuarioAutenticado,
  ) {
    await this.buscarTurmaAcessivel(
      turmaId,
      usuario,
    );

    return this.prisma.modulo.findMany({
      where: {
        turmaId,
      },
      orderBy: {
        dataInicio: 'asc',
      },
      select: {
        id: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        turmaId: true,
        criadoEm: true,
        atualizadoEm: true,
        _count: {
          select: {
            unidadesCurriculares: true,
          },
        },
      },
    });
  }

  async criarModulo(dto: CriarModuloDto) {
    const dataInicio =
      converterDataAcademica(
        dto.dataInicio,
        'dataInicio',
      );

    const dataFim =
      converterDataAcademica(
        dto.dataFim,
        'dataFim',
      );

    validarPeriodo(
      dataInicio,
      dataFim,
      'módulo',
    );

    const turma =
      await this.prisma.turma.findUnique({
        where: {
          id: dto.turmaId,
        },
        select: {
          id: true,
          ativo: true,
          dataInicio: true,
          dataFim: true,
        },
      });

    if (!turma) {
      throw new NotFoundException(
        'Turma não encontrada.',
      );
    }

    if (!turma.ativo) {
      throw new BadRequestException(
        'Não é possível criar um módulo em uma turma inativa.',
      );
    }

    validarDentroDoPeriodo(
      dataInicio,
      dataFim,
      turma.dataInicio,
      turma.dataFim,
      'módulo',
      'turma',
    );

    return this.prisma.modulo.create({
      data: {
        turmaId: dto.turmaId,
        nome: normalizarNome(dto.nome),
        dataInicio,
        dataFim,
      },
      select: {
        id: true,
        turmaId: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  async listarUnidadesCurriculares(
    moduloId: string,
    usuario: UsuarioAutenticado,
  ) {
    await this.buscarModuloAcessivel(
      moduloId,
      usuario,
    );

    return this.prisma.unidadeCurricular.findMany({
      where: {
        moduloId,
      },
      orderBy: {
        dataInicio: 'asc',
      },
      select: {
        id: true,
        moduloId: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        cargaHoraria: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  async criarUnidadeCurricular(
    dto: CriarUnidadeCurricularDto,
  ) {
    const dataInicio =
      converterDataAcademica(
        dto.dataInicio,
        'dataInicio',
      );

    const dataFim =
      converterDataAcademica(
        dto.dataFim,
        'dataFim',
      );

    validarPeriodo(
      dataInicio,
      dataFim,
      'unidade curricular',
    );

    const modulo =
      await this.prisma.modulo.findUnique({
        where: {
          id: dto.moduloId,
        },
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          turma: {
            select: {
              ativo: true,
            },
          },
        },
      });

    if (!modulo) {
      throw new NotFoundException(
        'Módulo não encontrado.',
      );
    }

    if (!modulo.turma.ativo) {
      throw new BadRequestException(
        'Não é possível criar uma unidade curricular em uma turma inativa.',
      );
    }

    validarDentroDoPeriodo(
      dataInicio,
      dataFim,
      modulo.dataInicio,
      modulo.dataFim,
      'unidade curricular',
      'módulo',
    );

    return this.prisma.unidadeCurricular.create({
      data: {
        moduloId: dto.moduloId,
        nome: normalizarNome(dto.nome),
        dataInicio,
        dataFim,
        cargaHoraria: dto.cargaHoraria,
      },
      select: {
        id: true,
        moduloId: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        cargaHoraria: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  private async buscarTurmaAcessivel(
    turmaId: string,
    usuario: UsuarioAutenticado,
  ) {
    const turma =
      await this.prisma.turma.findFirst({
        where: {
          id: turmaId,
          ativo: true,

          ...(usuario.papel === Papel.MENTOR
            ? {
                curso: {
                  mentores: {
                    some: {
                      mentorId: usuario.id,
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

    if (!turma) {
      throw new NotFoundException(
        'Turma não encontrada ou não acessível.',
      );
    }

    return turma;
  }

  private async buscarModuloAcessivel(
    moduloId: string,
    usuario: UsuarioAutenticado,
  ) {
    const modulo =
      await this.prisma.modulo.findFirst({
        where: {
          id: moduloId,
          turma: {
            ativo: true,

            ...(usuario.papel === Papel.MENTOR
              ? {
                  curso: {
                    mentores: {
                      some: {
                        mentorId:
                          usuario.id,
                      },
                    },
                  },
                }
              : {}),
          },
        },
        select: {
          id: true,
        },
      });

    if (!modulo) {
      throw new NotFoundException(
        'Módulo não encontrado ou não acessível.',
      );
    }

    return modulo;
  }

  private ehErroUniqueConstraint(
    erro: unknown,
  ): erro is {
    code: 'P2002';
  } {
    return (
      typeof erro === 'object' &&
      erro !== null &&
      'code' in erro &&
      (erro as { code?: unknown }).code ===
        'P2002'
    );
  }
}
