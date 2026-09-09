import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CriarTarefaDto } from './criar-tarefa.dto';

const tarefaValida = {
  projetoId: '11111111-1111-4111-8111-111111111111',
  tipoAtividadeId: '22222222-2222-4222-8222-222222222222',
  titulo: 'Preparar atividade',
  responsavelId: '33333333-3333-4333-8333-333333333333',
  escopo: 'curso',
  cursoId: '44444444-4444-4444-8444-444444444444',
  prazoAtual: '2026-09-30T18:00:00.000Z',
};

describe('CriarTarefaDto', () => {
  it('aceita a criação sem observações', async () => {
    const dto = plainToInstance(CriarTarefaDto, tarefaValida);

    const erros = await validate(dto);

    expect(erros).toHaveLength(0);
  });

  it('aceita observações vazias como campo opcional', async () => {
    const dto = plainToInstance(CriarTarefaDto, {
      ...tarefaValida,
      descricao: undefined,
    });

    const erros = await validate(dto);

    expect(erros).toHaveLength(0);
  });

  it('retorna mensagem em português quando as observações não são texto', async () => {
    const dto = plainToInstance(CriarTarefaDto, {
      ...tarefaValida,
      descricao: 123,
    });

    const erros = await validate(dto);
    const erroDescricao = erros.find((erro) => erro.property === 'descricao');

    expect(erroDescricao?.constraints?.isString).toBe(
      'As observações devem ser um texto válido.',
    );
  });
});
