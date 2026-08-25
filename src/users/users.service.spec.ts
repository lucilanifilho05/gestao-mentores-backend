import { BadRequestException } from '@nestjs/common';
import { Papel } from '../generated/prisma/client';
import { UsersService } from './users.service';

describe('UsersService - permissões de edição', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    usuario: { findUnique, update },
    sessao: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new UsersService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('impede a coordenadora de editar outra coordenadora', async () => {
    findUnique.mockResolvedValue({ papel: Papel.COORDENADORA });

    await expect(service.atualizarMentor('usuario-id', {
      nome: 'Outra Coordenadora', email: 'outra@example.com',
    })).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('permite que a coordenadora edite um mentor', async () => {
    findUnique.mockResolvedValue({ papel: Papel.MENTOR });
    update.mockResolvedValue({ id: 'mentor-id', nome: 'Mentor Atualizado' });

    await service.atualizarMentor('mentor-id', {
      nome: 'Mentor Atualizado', email: 'mentor@example.com',
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mentor-id' } }));
  });

  it('impede alterar o status de outra coordenadora', async () => {
    findUnique.mockResolvedValue({ id: 'outra-id', ativo: true, papel: Papel.COORDENADORA });

    await expect(service.alterarStatus('outra-id', { ativo: false }, {
      id: 'atual-id', nome: 'Atual', email: 'atual@example.com', papel: Papel.COORDENADORA,
    })).rejects.toThrow(BadRequestException);
  });
});
