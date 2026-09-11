import { jest } from '@jest/globals';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { Papel, StatusProjeto } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

const mentor = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Mentor',
  email: 'mentor@exemplo.com',
  papel: Papel.MENTOR,
  tokenVersion: 0,
} as UsuarioAutenticado;

const projeto = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Projeto sem tarefas do mentor',
  descricao: null,
  criadoPorId: '33333333-3333-4333-8333-333333333333',
  dataInicio: null,
  prazoFinal: new Date('2026-12-31T23:59:59.000Z'),
  status: StatusProjeto.PLANEJAMENTO,
  criadoEm: new Date('2026-09-01T12:00:00.000Z'),
  atualizadoEm: new Date('2026-09-01T12:00:00.000Z'),
  concluidoEm: null,
  criadoPor: {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Coordenadora',
    email: 'coordenadora@exemplo.com',
  },
  _count: { tarefas: 0 },
};

describe('ProjectsService', () => {
  const findMany = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const count = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const prisma = {
    projeto: { findMany, count, findFirst },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const service = new ProjectsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('lista para o mentor projetos sem tarefas atribuídas anteriormente', async () => {
    findMany.mockResolvedValue([projeto]);
    count.mockResolvedValue(1);

    const resultado = await service.listar(
      { pagina: 1, limite: 20, status: 'planejamento' },
      mentor,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: StatusProjeto.PLANEJAMENTO },
      }),
    );
    expect(resultado.data).toHaveLength(1);
  });

  it('permite ao mentor consultar projeto sem tarefa anterior', async () => {
    findFirst.mockResolvedValue(projeto);

    const resultado = await service.buscarPorId(projeto.id, mentor);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: projeto.id } }),
    );
    expect(resultado.id).toBe(projeto.id);
  });
});
