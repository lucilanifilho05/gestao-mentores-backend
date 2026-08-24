import { Papel } from '../generated/prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const findMany = jest.fn();
  const service = new ReportsService({ tarefa: { findMany } } as never);

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('filtra o relatório pelo tipo de atividade', async () => {
    const tipoAtividadeId = '10000000-0000-4000-8000-000000000001';

    await service.gerarJson(
      { tipoAtividadeId },
      {
        id: '20000000-0000-4000-8000-000000000001',
        nome: 'Coordenação',
        email: 'coordenacao@example.com',
        papel: Papel.COORDENADORA,
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoAtividadeId }),
      }),
    );
  });

  it('mantém o relatório do mentor restrito às próprias tarefas', async () => {
    const mentorId = '30000000-0000-4000-8000-000000000001';

    await service.gerarJson(
      { mentorId: '40000000-0000-4000-8000-000000000001' },
      {
        id: mentorId,
        nome: 'Mentor',
        email: 'mentor@example.com',
        papel: Papel.MENTOR,
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ responsavelId: mentorId }),
      }),
    );
  });
});
