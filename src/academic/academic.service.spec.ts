import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Papel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicService } from './academic.service';

const TURMA_ID =
  '11111111-1111-4111-8111-111111111111';
const CURSO_ID =
  '22222222-2222-4222-8222-222222222222';

const criarMockAssincrono = () =>
  jest.fn<
    Promise<unknown>,
    unknown[]
  >();

const prismaMock = {
  turma: {
    findUnique: criarMockAssincrono(),
    findMany: criarMockAssincrono(),
    count: criarMockAssincrono(),
    update: criarMockAssincrono(),
  },
  $transaction: jest.fn(),
};

const turma = {
  id: TURMA_ID,
  codigo: 'TURMA-01',
  dataInicio: new Date('2026-01-01T00:00:00.000Z'),
  dataFim: new Date('2026-12-31T00:00:00.000Z'),
  ativo: true,
  criadoEm: new Date('2026-01-01T12:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T12:00:00.000Z'),
  curso: {
    id: CURSO_ID,
    nome: 'Curso',
    ativo: true,
  },
};

describe('AcademicService - turmas', () => {
  let service: AcademicService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AcademicService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('deve atualizar código e período da turma', async () => {
    prismaMock.turma.findUnique.mockResolvedValue({
      id: TURMA_ID,
      modulos: [],
    });
    prismaMock.turma.update.mockResolvedValue(turma);

    await service.atualizarTurma(TURMA_ID, {
      codigo: ' TURMA-02 ',
      dataInicio: '2026-02-01',
      dataFim: '2026-11-30',
    });

    expect(prismaMock.turma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TURMA_ID },
        data: {
          codigo: 'TURMA-02',
          dataInicio: new Date('2026-02-01T00:00:00.000Z'),
          dataFim: new Date('2026-11-30T00:00:00.000Z'),
        },
      }),
    );
  });

  it('deve impedir período que deixe módulo fora da turma', async () => {
    prismaMock.turma.findUnique.mockResolvedValue({
      id: TURMA_ID,
      modulos: [{
        nome: 'Módulo 1',
        dataInicio: new Date('2026-01-10T00:00:00.000Z'),
        dataFim: new Date('2026-03-31T00:00:00.000Z'),
      }],
    });

    await expect(service.atualizarTurma(TURMA_ID, {
      codigo: 'TURMA-01',
      dataInicio: '2026-02-01',
      dataFim: '2026-12-31',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.turma.update).not.toHaveBeenCalled();
  });

  it('deve retornar 404 ao atualizar turma inexistente', async () => {
    prismaMock.turma.findUnique.mockResolvedValue(null);

    await expect(service.atualizarTurma(TURMA_ID, {
      codigo: 'TURMA-01',
      dataInicio: '2026-01-01',
      dataFim: '2026-12-31',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve traduzir código duplicado em conflito', async () => {
    prismaMock.turma.findUnique.mockResolvedValue({
      id: TURMA_ID,
      modulos: [],
    });
    prismaMock.turma.update.mockRejectedValue({ code: 'P2002' });

    await expect(service.atualizarTurma(TURMA_ID, {
      codigo: 'DUPLICADA',
      dataInicio: '2026-01-01',
      dataFim: '2026-12-31',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve alterar o status da turma', async () => {
    prismaMock.turma.findUnique.mockResolvedValue(turma);
    prismaMock.turma.update.mockResolvedValue({
      ...turma,
      ativo: false,
    });

    await service.alterarStatusTurma(TURMA_ID, { ativo: false });

    expect(prismaMock.turma.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TURMA_ID },
        data: { ativo: false },
      }),
    );
  });

  it('deve impedir reativação quando o curso estiver inativo', async () => {
    prismaMock.turma.findUnique.mockResolvedValue({
      ...turma,
      ativo: false,
      curso: { ...turma.curso, ativo: false },
    });

    await expect(
      service.alterarStatusTurma(TURMA_ID, { ativo: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve manter mentores restritos a turmas ativas', async () => {
    prismaMock.turma.findMany.mockResolvedValue([]);
    prismaMock.turma.count.mockResolvedValue(0);
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await service.listarTurmas(
      { pagina: 1, limite: 20, ativo: false },
      {
        id: '33333333-3333-4333-8333-333333333333',
        nome: 'Mentor',
        email: 'mentor@exemplo.com',
        papel: Papel.MENTOR,
      },
    );

    expect(prismaMock.turma.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ativo: true }),
      }),
    );
  });
});
