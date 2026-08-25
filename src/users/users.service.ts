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
import { verificarHashSenha } from '../common/security/password';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
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
import type { AtualizarPerfilUsuarioDto } from './dto/atualizar-perfil-usuario.dto';
import type { AlterarPropriaSenhaDto } from './dto/alterar-propria-senha.dto';
import type { RedefinirSenhaUsuarioDto } from './dto/redefinir-senha-usuario.dto';

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
      ...(query.ativo !== undefined
    ? {
        ativo: query.ativo,
      }
    : {}),

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
    usuarioAtual: UsuarioAutenticado,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          id: true,
          ativo: true,
          papel: true,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuário não encontrado.',
      );
    }

    if (
      usuarioId === usuarioAtual.id
    ) {
      throw new BadRequestException(
        'Você não pode alterar o status do próprio usuário.',
      );
    }

    if (usuario.papel !== Papel.MENTOR) {
      throw new BadRequestException(
        'A coordenadora pode alterar o status apenas de mentores.',
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

  async atualizarPerfil(usuarioId: string, dto: AtualizarPerfilUsuarioDto) {
    return this.salvarPerfil(usuarioId, dto);
  }

  async atualizarMentor(usuarioId: string, dto: AtualizarPerfilUsuarioDto) {
    await this.garantirMentor(usuarioId);
    return this.salvarPerfil(usuarioId, dto);
  }

  async alterarPropriaSenha(usuarioId: string, dto: AlterarPropriaSenhaDto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { senhaHash: true },
    });

    if (!usuario || !(await verificarHashSenha(usuario.senhaHash, dto.senhaAtual))) {
      throw new BadRequestException('A senha atual está incorreta.');
    }

    if (await verificarHashSenha(usuario.senhaHash, dto.novaSenha)) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
    }

    await this.salvarSenhaERevogarSessoes(usuarioId, dto.novaSenha);
  }

  async redefinirSenhaMentor(usuarioId: string, dto: RedefinirSenhaUsuarioDto): Promise<void> {
    await this.garantirMentor(usuarioId);
    await this.salvarSenhaERevogarSessoes(usuarioId, dto.novaSenha);
  }

  private async salvarPerfil(usuarioId: string, dto: AtualizarPerfilUsuarioDto) {
    const nome = normalizarNome(dto.nome);
    const emailNormalizado = normalizarEmail(dto.email);

    try {
      return await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { nome, email: emailNormalizado, emailNormalizado },
        select: {
          id: true, nome: true, email: true, papel: true, ativo: true,
          criadoEm: true, atualizadoEm: true,
        },
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException('E-mail já cadastrado.');
      }
      if (this.ehErroRegistroNaoEncontrado(erro)) {
        throw new NotFoundException('Usuário não encontrado.');
      }
      throw erro;
    }
  }

  private async garantirMentor(usuarioId: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { papel: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    if (usuario.papel !== Papel.MENTOR) {
      throw new BadRequestException('A coordenadora pode editar apenas perfis de mentores.');
    }
  }

  private async salvarSenhaERevogarSessoes(usuarioId: string, novaSenha: string): Promise<void> {
    const senhaHash = await gerarHashSenha(novaSenha);
    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { senhaHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.sessao.updateMany({
        where: { usuarioId, revogadaEm: null },
        data: { revogadaEm: agora },
      }),
    ]);
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

  private ehErroRegistroNaoEncontrado(erro: unknown): erro is { code: 'P2025' } {
    return typeof erro === 'object' && erro !== null && 'code' in erro &&
      (erro as { code?: unknown }).code === 'P2025';
  }
}
