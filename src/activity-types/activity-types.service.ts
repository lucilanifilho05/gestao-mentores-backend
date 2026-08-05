import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  normalizarChave,
  normalizarNome,
} from '../common/normalization';
import type {
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarTipoAtividadeDto } from './dto/criar-tipo-atividade.dto';
import type { ListarTiposAtividadeQueryDto } from './dto/listar-tipos-atividade-query.dto';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papel } from '../generated/prisma/client';
import type { AtualizarTipoAtividadeDto } from './dto/atualizar-tipo-atividade.dto';
import type { AlterarStatusTipoAtividadeDto } from './dto/alterar-status-tipo-atividade.dto';

const tipoSelect = { id: true, nome: true, ativo: true, criadoEm: true, atualizadoEm: true } as const;

@Injectable()
export class ActivityTypesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listar(
    query: ListarTiposAtividadeQueryDto,
    usuario: UsuarioAutenticado,
  ) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const busca = query.busca?.trim();

    const where: Prisma.TipoAtividadeWhereInput = {
      ...(usuario.papel === Papel.MENTOR
        ? { ativo: true }
        : query.ativo !== undefined
          ? { ativo: query.ativo }
          : {}),

      ...(busca
        ? {
            nome: {
              contains: busca,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [tipos, total] =
      await this.prisma.$transaction([
        this.prisma.tipoAtividade.findMany({
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
          select: tipoSelect,
        }),

        this.prisma.tipoAtividade.count({
          where,
        }),
      ]);

    return {
      data: tipos,
      meta: {
        pagina,
        limite,
        total,
        totalPaginas:
          Math.ceil(total / limite),
      },
    };
  }

  async criar(
    dto: CriarTipoAtividadeDto,
  ) {
    const nome = normalizarNome(dto.nome);
    const nomeNormalizado =
      normalizarChave(nome);

    try {
      return await this.prisma.tipoAtividade.create({
        data: {
          nome,
          nomeNormalizado,
          ativo: true,
        },
        select: tipoSelect,
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) {
        throw new ConflictException(
          'Já existe um tipo de atividade com esse nome.',
        );
      }

      throw erro;
    }
  }

  async atualizar(id: string, dto: AtualizarTipoAtividadeDto) {
    await this.garantirExistencia(id);
    const nome = normalizarNome(dto.nome);
    try {
      return await this.prisma.tipoAtividade.update({
        where: { id },
        data: { nome, nomeNormalizado: normalizarChave(nome) },
        select: tipoSelect,
      });
    } catch (erro: unknown) {
      if (this.ehErroUniqueConstraint(erro)) throw new ConflictException('Já existe um tipo de atividade com esse nome.');
      throw erro;
    }
  }

  async alterarStatus(id: string, dto: AlterarStatusTipoAtividadeDto) {
    const atual = await this.garantirExistencia(id);
    if (atual.ativo === dto.ativo) return atual;
    return this.prisma.tipoAtividade.update({ where: { id }, data: { ativo: dto.ativo }, select: tipoSelect });
  }

  private async garantirExistencia(id: string) {
    const tipo = await this.prisma.tipoAtividade.findUnique({ where: { id }, select: tipoSelect });
    if (!tipo) throw new NotFoundException('Tipo de atividade não encontrado.');
    return tipo;
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
