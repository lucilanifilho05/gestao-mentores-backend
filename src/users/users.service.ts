import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  normalizarEmail,
  normalizarNome,
} from '../common/normalization';
import { gerarHashSenha } from '../common/security/password';
import {
  Papel,
} from '../generated/prisma/client';
import type {
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AlterarStatusUsuarioDto } from './dto/alterar-status-usuario.dto';
import type { CriarUsuarioDto } from './dto/criar-usuario.dto';
import type { ListarUsuariosQueryDto } from './dto/listar-usuarios-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  buscarPorEmailParaAutenticacao(
    email: string,
  ) {
    const emailNormalizado =
      normalizarEmail(email);

    return this.prisma.usuario.findUnique({
      where: {
        emailNormalizado,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        emailNormalizado: true,
        senhaHash: true,
        papel: true,
        ativo: true,
        tokenVersion: true,
      },
    });
  }

  buscarPorIdParaAutorizacao(id: string) {
    return this.prisma.usuario.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        tokenVersion: true,
      },
    });
  }

  buscarPublicoPorId(id: string) {
    return this.prisma.usuario.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        ultimoLoginEm: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  async listarAtivos(
    query: ListarUsuariosQueryDto,
  ) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const busca = query.busca?.trim();

    const where: Prisma.UsuarioWhereInput = {
      ativo: true,

      ...(query.papel
        ? {
            papel: query.papel,
          }
        : {}),

      ...(busca
        ? {
            OR: [
              {
                nome: {
                  contains: busca,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: busca,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [usuarios, total] =
      await this.prisma.$transaction([
        this.prisma.usuario.findMany({
          where,
          skip: (pagina - 1) * limite,
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
            email: true,
            papel: true,
            ativo: true,
            ultimoLoginEm: true,
            criadoEm: true,
          },
        }),

        this.prisma.usuario.count({
          where,
        }),
      ]);

    return {
      data: usuarios,
      meta: {
        pagina,
        limite,
        total,
        totalPaginas:
          Math.ceil(total / limite),
      },
    };
  }

  async criar(dto: CriarUsuarioDto) {
    const nome = normalizarNome(dto.nome);

    const emailNormalizado =
      normalizarEmail(dto.email);

    const usuarioExistente =
      await this.prisma.usuario.findUnique({
        where: {
          emailNormalizado,
        },
        select: {
          id: true,
        },
      });

    if (usuarioExistente) {
      throw new ConflictException(
        'E-mail já cadastrado.',
      );
    }

    const senhaHash =
      await gerarHashSenha(dto.senha);

    try {
      return await this.prisma.usuario.create({
        data: {
          nome,
          email: emailNormalizado,
          emailNormalizado,
          senhaHash,
          papel: dto.papel ?? Papel.MENTOR,
          ativo: true,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          papel: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException(
          'E-mail já cadastrado.',
        );
      }

      throw erro;
    }
  }

  async alterarStatus(
    usuarioId: string,
    dto: AlterarStatusUsuarioDto,
    usuarioAtualId: string,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          id: true,
          ativo: true,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    if (
      usuarioId === usuarioAtualId &&
      dto.ativo === false
    ) {
      throw new BadRequestException(
        'Você não pode desativar o próprio usuário.',
      );
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const usuarioAtualizado =
          await transaction.usuario.update({
            where: {
              id: usuarioId,
            },
            data: {
              ativo: dto.ativo,

              ...(!dto.ativo
                ? {
                    tokenVersion: {
                      increment: 1,
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              nome: true,
              email: true,
              papel: true,
              ativo: true,
              criadoEm: true,
              atualizadoEm: true,
            },
          });

        if (!dto.ativo) {
          await transaction.sessao.updateMany({
            where: {
              usuarioId,
              revogadaEm: null,
            },
            data: {
              revogadaEm: new Date(),
            },
          });
        }

        return usuarioAtualizado;
      },
    );
  }

  registrarUltimoLogin(id: string) {
    return this.prisma.usuario.update({
      where: {
        id,
      },
      data: {
        ultimoLoginEm: new Date(),
      },
      select: {
        id: true,
        ultimoLoginEm: true,
      },
    });
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