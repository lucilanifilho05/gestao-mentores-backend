import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { StatusProjeto, StatusTarefa } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CriarProjetoDto } from './dto/criar-projeto.dto';
import type {
  ListarProjetosQueryDto,
  StatusProjetoEntrada,
} from './dto/listar-projetos-query.dto';

const projetoSelect = {
  id: true,
  nome: true,
  descricao: true,
  criadoPorId: true,
  dataInicio: true,
  prazoFinal: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
  concluidoEm: true,
  criadoPor: { select: { id: true, nome: true, email: true } },
  _count: { select: { tarefas: true } },
} satisfies Prisma.ProjetoSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  async listar(query: ListarProjetosQueryDto, _usuario: UsuarioAutenticado) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;
    const where: Prisma.ProjetoWhereInput = {
      ...(query.status ? { status: this.converterStatus(query.status) } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.projeto.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: [{ prazoFinal: 'asc' }, { nome: 'asc' }],
        select: projetoSelect,
      }),
      this.prisma.projeto.count({ where }),
    ]);
    return {
      data: data.map((x) => this.formatar(x)),
      meta: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
    };
  }
  async buscarPorId(id: string, _usuario: UsuarioAutenticado) {
    const projeto = await this.prisma.projeto.findFirst({
      where: {
        id,
      },
      select: projetoSelect,
    });
    if (!projeto)
      throw new NotFoundException('Projeto não encontrado ou não acessível.');
    return this.formatar(projeto);
  }
  async criar(dto: CriarProjetoDto, usuario: UsuarioAutenticado) {
    const dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : null;
    const prazoFinal = new Date(dto.prazoFinal);
    if (dataInicio && prazoFinal < dataInicio)
      throw new BadRequestException(
        'O prazo final não pode ser anterior à data inicial.',
      );
    const projeto = await this.prisma.projeto.create({
      data: {
        nome: dto.nome.trim().replace(/\s+/g, ' '),
        descricao: dto.descricao?.trim() || null,
        criadoPorId: usuario.id,
        dataInicio,
        prazoFinal,
        status: StatusProjeto.PLANEJAMENTO,
      },
      select: projetoSelect,
    });
    return this.formatar(projeto);
  }
  async concluir(id: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            tarefas: { where: { status: { not: StatusTarefa.CONCLUIDA } } },
          },
        },
      },
    });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    if (projeto.status === StatusProjeto.CANCELADO)
      throw new ConflictException(
        'Um projeto cancelado não pode ser concluído.',
      );
    if (projeto._count.tarefas > 0)
      throw new ConflictException(
        'Conclua todas as tarefas abertas antes de concluir o projeto.',
      );
    return this.atualizarStatus(id, StatusProjeto.CONCLUIDO);
  }
  async cancelar(id: string) {
    return this.atualizarStatus(id, StatusProjeto.CANCELADO);
  }
  private async atualizarStatus(id: string, status: StatusProjeto) {
    try {
      const projeto = await this.prisma.projeto.update({
        where: { id },
        data: {
          status,
          concluidoEm: status === StatusProjeto.CONCLUIDO ? new Date() : null,
        },
        select: projetoSelect,
      });
      return this.formatar(projeto);
    } catch (erro: unknown) {
      if (
        typeof erro === 'object' &&
        erro &&
        'code' in erro &&
        erro.code === 'P2025'
      )
        throw new NotFoundException('Projeto não encontrado.');
      throw erro;
    }
  }
  private converterStatus(v: StatusProjetoEntrada) {
    return {
      planejamento: StatusProjeto.PLANEJAMENTO,
      em_andamento: StatusProjeto.EM_ANDAMENTO,
      concluido: StatusProjeto.CONCLUIDO,
      cancelado: StatusProjeto.CANCELADO,
    }[v];
  }
  private formatar<T extends { status: StatusProjeto }>(x: T) {
    return { ...x, status: x.status.toLowerCase() };
  }
}
