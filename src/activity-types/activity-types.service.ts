import {
  ConflictException,
  Injectable,
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

@Injectable()
export class ActivityTypesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listar(
    query: ListarTiposAtividadeQueryDto,
  ) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const busca = query.busca?.trim();

    const where: Prisma.TipoAtividadeWhereInput = {
      ativo: true,

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
          select: {
            id: true,
            nome: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true,
          },
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
        select: {
          id: true,
          nome: true,
          ativo: true,
          criadoEm: true,
          atualizadoEm: true,
        },
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