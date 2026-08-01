import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  UsuarioAutenticado,
} from '../auth/types/auth.types';
import {
  normalizarChave,
  normalizarNome,
} from '../common/normalization';
import {
  Papel,
} from '../generated/prisma/client';
import type {
  Prisma,
} from '../generated/prisma/client';
import {
  PrismaService,
} from '../prisma/prisma.service';
import type {
  AlterarStatusCursoDto,
} from './dto/alterar-status-curso.dto';
import type {
  AtualizarCursoDto,
} from './dto/atualizar-curso.dto';
import type {
  CriarCursoDto,
} from './dto/criar-curso.dto';
import type {
  ListarCursosQueryDto,
} from './dto/listar-cursos-query.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async listar(
    query: ListarCursosQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    const pagina =
      query.pagina ?? 1;

    const limite =
      query.limite ?? 20;

    const busca =
      query.busca?.trim();

    const filtrarCursosDoMentor =
      query.apenas_meus &&
      usuario.papel ===
        Papel.MENTOR;

    const where:
      Prisma.CursoWhereInput = {
      ...(query.ativo !== undefined
        ? {
            ativo: query.ativo,
          }
        : {}),

      ...(busca
        ? {
            nome: {
              contains: busca,
              mode: 'insensitive',
            },
          }
        : {}),

      ...(filtrarCursosDoMentor
        ? {
            mentores: {
              some: {
                mentorId:
                  usuario.id,
              },
            },
          }
        : {}),
    };

    const [cursos, total] =
      await this.prisma.$transaction([
        this.prisma.curso.findMany({
          where,

          skip:
            (pagina - 1) *
            limite,

          take: limite,

          orderBy: [
            {
              nome: 'asc',
            },
            {
              id: 'asc',
            },
          ],

          select: {
            id: true,
            nome: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,

            _count: {
              select: {
                mentores: true,
              },
            },
          },
        }),

        this.prisma.curso.count({
          where,
        }),
      ]);

    return {
      data: cursos.map(
        (curso) => ({
          id: curso.id,
          nome: curso.nome,
          ativo: curso.ativo,

          quantidadeMentores:
            curso._count.mentores,

          criadoEm:
            curso.criadoEm,

          atualizadoEm:
            curso.atualizadoEm,
        }),
      ),

      meta: {
        pagina,
        limite,
        total,

        totalPaginas:
          Math.ceil(
            total / limite,
          ),
      },
    };
  }

  async criar(
    dto: CriarCursoDto,
  ) {
    const nome =
      normalizarNome(dto.nome);

    const nomeNormalizado =
      normalizarChave(nome);

    try {
      return await this.prisma
        .curso.create({
          data: {
            nome,
            nomeNormalizado,
            ativo: true,
          },

          select: {
            id: true,
            nome: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        });
    } catch (erro: unknown) {
      if (
        this.ehErroUniqueConstraint(
          erro,
        )
      ) {
        throw new ConflictException(
          'Já existe um curso com esse nome.',
        );
      }

      throw erro;
    }
  }

  async atualizar(
    cursoId: string,
    dto: AtualizarCursoDto,
  ) {
    const curso =
      await this.prisma
        .curso.findUnique({
          where: {
            id: cursoId,
          },

          select: {
            id: true,
          },
        });

    if (!curso) {
      throw new NotFoundException(
        'Curso não encontrado.',
      );
    }

    const nome =
      normalizarNome(dto.nome);

    const nomeNormalizado =
      normalizarChave(nome);

    try {
      return await this.prisma
        .curso.update({
          where: {
            id: cursoId,
          },

          data: {
            nome,
            nomeNormalizado,
          },

          select: {
            id: true,
            nome: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        });
    } catch (erro: unknown) {
      if (
        this.ehErroUniqueConstraint(
          erro,
        )
      ) {
        throw new ConflictException(
          'Já existe um curso com esse nome.',
        );
      }

      throw erro;
    }
  }

  async alterarStatus(
    cursoId: string,
    dto: AlterarStatusCursoDto,
  ) {
    const curso =
      await this.prisma
        .curso.findUnique({
          where: {
            id: cursoId,
          },

          select: {
            id: true,
            nome: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        });

    if (!curso) {
      throw new NotFoundException(
        'Curso não encontrado.',
      );
    }

    if (
      curso.ativo === dto.ativo
    ) {
      return curso;
    }

    return this.prisma.curso.update({
      where: {
        id: cursoId,
      },

      data: {
        ativo: dto.ativo,
      },

      select: {
        id: true,
        nome: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  async listarMentores(
    cursoId: string,
  ) {
    await this
      .buscarCursoAtivoOuFalhar(
        cursoId,
      );

    const vinculos =
      await this.prisma
        .cursoMentor.findMany({
          where: {
            cursoId,

            mentor: {
              ativo: true,
            },
          },

          orderBy: {
            mentor: {
              nome: 'asc',
            },
          },

          select: {
            criadoEm: true,

            mentor: {
              select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
              },
            },

            vinculadoPor: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        });

    return vinculos.map(
      (vinculo) => ({
        ...vinculo.mentor,

        vinculadoEm:
          vinculo.criadoEm,

        vinculadoPor:
          vinculo.vinculadoPor,
      }),
    );
  }

  async vincularMentor(
    cursoId: string,
    mentorId: string,
    vinculadoPorId: string,
  ) {
    const [curso, mentor] =
      await this.prisma
        .$transaction([
          this.prisma.curso
            .findUnique({
              where: {
                id: cursoId,
              },

              select: {
                id: true,
                nome: true,
                ativo: true,
              },
            }),

          this.prisma.usuario
            .findUnique({
              where: {
                id: mentorId,
              },

              select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
              },
            }),
        ]);

    if (!curso) {
      throw new NotFoundException(
        'Curso não encontrado.',
      );
    }

    if (!curso.ativo) {
      throw new BadRequestException(
        'Não é possível vincular um mentor a um curso inativo.',
      );
    }

    if (!mentor) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    if (
      mentor.papel !==
      Papel.MENTOR
    ) {
      throw new BadRequestException(
        'O usuário selecionado não possui papel de mentor.',
      );
    }

    if (!mentor.ativo) {
      throw new BadRequestException(
        'Não é possível vincular um mentor inativo.',
      );
    }

    const resultado =
      await this.prisma
        .cursoMentor.createMany({
          data: {
            cursoId,
            mentorId,
            vinculadoPorId,
          },

          skipDuplicates: true,
        });

    return {
      ok: true,

      criado:
        resultado.count === 1,

      curso: {
        id: curso.id,
        nome: curso.nome,
      },

      mentor: {
        id: mentor.id,
        nome: mentor.nome,
        email: mentor.email,
      },
    };
  }

  async desvincularMentor(
    cursoId: string,
    mentorId: string,
  ) {
    await this
      .buscarCursoAtivoOuFalhar(
        cursoId,
      );

    const resultado =
      await this.prisma
        .cursoMentor.deleteMany({
          where: {
            cursoId,
            mentorId,
          },
        });

    return {
      ok: true,

      removido:
        resultado.count === 1,
    };
  }

  private async buscarCursoAtivoOuFalhar(
    cursoId: string,
  ) {
    const curso =
      await this.prisma
        .curso.findUnique({
          where: {
            id: cursoId,
          },

          select: {
            id: true,
            nome: true,
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
        'O curso está inativo.',
      );
    }

    return curso;
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
      (
        erro as {
          code?: unknown;
        }
      ).code === 'P2002'
    );
  }
}