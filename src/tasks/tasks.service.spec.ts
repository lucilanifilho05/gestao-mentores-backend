import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';

import type { UsuarioAutenticado } from '../auth/types/auth.types';
import {
  EscopoTarefa,
  Papel,
  StatusProjeto,
  StatusTarefa,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

const ID_COORDENADORA = '11111111-1111-4111-8111-111111111111';

const ID_MENTOR = '22222222-2222-4222-8222-222222222222';

const ID_OUTRO_MENTOR = '33333333-3333-4333-8333-333333333333';

const ID_TIPO_ATIVIDADE = '44444444-4444-4444-8444-444444444444';

const ID_CURSO = '55555555-5555-4555-8555-555555555555';

const ID_TAREFA = '66666666-6666-4666-8666-666666666666';
const ID_PROJETO = '77777777-7777-4777-8777-777777777777';

const coordenadora = {
  id: ID_COORDENADORA,
  nome: 'Coordenadora',
  email: 'coordenadora@exemplo.com',
  papel: Papel.COORDENADORA,
  tokenVersion: 0,
} as UsuarioAutenticado;

const mentor = {
  id: ID_MENTOR,
  nome: 'Mentor',
  email: 'mentor@exemplo.com',
  papel: Papel.MENTOR,
  tokenVersion: 0,
} as UsuarioAutenticado;

interface OpcoesTarefa {
  responsavelId?: string;
  escopo?: EscopoTarefa;
  status?: StatusTarefa;
  cursoId?: string | null;
  concluidoEm?: Date | null;
  prazoAtual?: Date;
}

function criarTarefaDetalhe(opcoes: OpcoesTarefa = {}) {
  const responsavelId = opcoes.responsavelId ?? ID_MENTOR;

  const escopo = opcoes.escopo ?? EscopoTarefa.EVENTO_MACRO;

  const status = opcoes.status ?? StatusTarefa.EM_ANDAMENTO;

  const cursoId = opcoes.cursoId ?? null;

  const concluidoEm =
    opcoes.concluidoEm !== undefined
      ? opcoes.concluidoEm
      : status === StatusTarefa.CONCLUIDA
        ? new Date('2026-08-10T15:00:00.000Z')
        : null;

  return {
    id: ID_TAREFA,
    numero: 123,
    projetoId: ID_PROJETO,
    projeto: {
      id: ID_PROJETO,
      nome: 'Projeto teste',
      prazoFinal: new Date('2026-08-30T21:00:00.000Z'),
      status: 'EM_ANDAMENTO',
    },
    tipoAtividadeId: ID_TIPO_ATIVIDADE,
    titulo: 'Acompanhar planejamento',
    descricao: null,

    criadoPorId: ID_COORDENADORA,

    responsavelId,
    escopo,
    cursoId,
    turmaId: null,
    prazoInicio: null,

    prazoAtual: opcoes.prazoAtual ?? new Date('2026-08-15T21:00:00.000Z'),

    status,

    criadoEm: new Date('2026-08-01T12:00:00.000Z'),

    atualizadoEm: new Date('2026-08-01T12:00:00.000Z'),

    concluidoEm,
    iniciadoEm:
      status === StatusTarefa.EM_ANDAMENTO
        ? new Date('2026-08-01T12:00:00.000Z')
        : null,

    tipoAtividade: {
      id: ID_TIPO_ATIVIDADE,
      nome: 'Acompanhamento',
    },

    criadoPor: {
      id: ID_COORDENADORA,
      nome: 'Coordenadora',
      email: 'coordenadora@exemplo.com',
    },

    responsavel: {
      id: responsavelId,
      nome: 'Mentor',
      email: 'mentor@exemplo.com',
    },

    curso: cursoId
      ? {
          id: cursoId,
          nome: 'Curso de Gestão',
        }
      : null,

    turma: null,
    comentarios: [],

    _count: {
      reagendamentos: 0,
      comentarios: 0,
    },

    reagendamentos: [],
    links: [],
  };
}

const criarMockAssincrono = () =>
  jest.fn<(...argumentos: unknown[]) => Promise<unknown>>();

const prismaMock = {
  tipoAtividade: {
    findUnique: criarMockAssincrono(),
  },

  usuario: {
    findUnique: criarMockAssincrono(),
    findMany: criarMockAssincrono(),
  },

  curso: {
    findFirst: criarMockAssincrono(),
  },

  turma: {
    findFirst: criarMockAssincrono(),
  },

  cursoMentor: {
    findFirst: criarMockAssincrono(),
  },

  tarefa: {
    findMany: criarMockAssincrono(),
    count: criarMockAssincrono(),
    findFirst: criarMockAssincrono(),
    findUnique: criarMockAssincrono(),
    create: criarMockAssincrono(),
    update: criarMockAssincrono(),
  },
  comentarioTarefa: {
    create: criarMockAssincrono(),
    updateMany: criarMockAssincrono(),
    count: criarMockAssincrono(),
  },

  projeto: {
    findFirst: criarMockAssincrono(),
    updateMany: criarMockAssincrono(),
  },

  $transaction: jest.fn<(argumento: unknown) => Promise<unknown>>(),
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    jest.resetAllMocks();

    /*
     * Suporta os dois formatos usados pelo Prisma:
     *
     * $transaction([promise1, promise2])
     * $transaction(async transaction => ...)
     */
    prismaMock.$transaction.mockImplementation(
      async (argumento: unknown): Promise<unknown> => {
        if (typeof argumento === 'function') {
          const callback = argumento as (
            transaction: typeof prismaMock,
          ) => Promise<unknown>;

          return callback(prismaMock);
        }

        if (Array.isArray(argumento)) {
          return Promise.all(argumento);
        }

        throw new Error('Formato de transação inesperado no teste.');
      },
    );

    prismaMock.projeto.findFirst.mockResolvedValue({
      id: ID_PROJETO,
      escopo: EscopoTarefa.EVENTO_MACRO,
      cursoId: null,
      turmaId: null,
      prazoFinal: new Date('2026-08-30T21:00:00.000Z'),
    });
    prismaMock.projeto.updateMany.mockResolvedValue({ count: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  it('deve restringir a listagem do mentor às próprias tarefas', async () => {
    prismaMock.tarefa.findMany.mockResolvedValue([]);

    prismaMock.tarefa.count.mockResolvedValue(0);

    const resultado = await service.listar(
      {
        pagina: 1,
        limite: 20,
      },
      mentor,
    );

    expect(prismaMock.tarefa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          responsavelId: ID_MENTOR,
        }),
      }),
    );

    expect(prismaMock.tarefa.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        responsavelId: ID_MENTOR,
      }),
    });

    expect(resultado).toEqual({
      data: [],
      meta: {
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0,
      },
    });
  });

  it('deve filtrar a listagem pelo número global da tarefa', async () => {
    prismaMock.tarefa.findMany.mockResolvedValue([]);
    prismaMock.tarefa.count.mockResolvedValue(0);

    await service.listar({ numero: 123 }, coordenadora);

    expect(prismaMock.tarefa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ numero: 123 }),
      }),
    );
    expect(prismaMock.tarefa.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ numero: 123 }),
    });
  });

  it('não deve permitir que mentor crie tarefa para outro usuário', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });

    prismaMock.usuario.findUnique.mockResolvedValue({
      id: ID_OUTRO_MENTOR,
      ativo: true,
      papel: Papel.MENTOR,
    });

    await expect(
      service.criar(
        {
          tipoAtividadeId: ID_TIPO_ATIVIDADE,

          projetoId: ID_PROJETO,

          titulo: 'Tarefa para outro mentor',

          responsavelId: ID_OUTRO_MENTOR,

          escopo: 'evento_macro',

          prazoAtual: '2026-08-15T18:00:00-03:00',
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.tarefa.create).not.toHaveBeenCalled();
  });

  it('deve criar uma tarefa macro para cada mentor ativo', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });

    prismaMock.usuario.findMany.mockResolvedValue([
      { id: ID_MENTOR },
      { id: ID_OUTRO_MENTOR },
    ]);

    prismaMock.tarefa.create
      .mockResolvedValueOnce(criarTarefaDetalhe())
      .mockResolvedValueOnce(
        criarTarefaDetalhe({ responsavelId: ID_OUTRO_MENTOR }),
      );

    const resultado = await service.criar(
      {
        tipoAtividadeId: ID_TIPO_ATIVIDADE,

        projetoId: ID_PROJETO,

        titulo: ' Encontro   de mentores ',

        descricao: ' Evento institucional ',

        escopo: 'evento_macro',

        responsavelIds: [ID_MENTOR, ID_OUTRO_MENTOR],

        prazoAtual: '2026-08-15T18:00:00-03:00',
      },
      coordenadora,
    );

    expect(prismaMock.tarefa.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [ID_MENTOR, ID_OUTRO_MENTOR] },
        papel: Papel.MENTOR,
        ativo: true,
      },
      select: { id: true },
    });
    expect(prismaMock.tarefa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titulo: 'Encontro de mentores',

          descricao: 'Evento institucional',

          criadoPorId: ID_COORDENADORA,

          escopo: EscopoTarefa.EVENTO_MACRO,

          cursoId: null,
          turmaId: null,

          status: StatusTarefa.PLANEJADA,

          concluidoEm: null,
        }),
      }),
    );

    expect(prismaMock.curso.findFirst).not.toHaveBeenCalled();

    expect(prismaMock.turma.findFirst).not.toHaveBeenCalled();

    expect(resultado.quantidadeCriada).toBe(2);
    expect(resultado.tarefas).toHaveLength(2);
  });

  it('deve rejeitar evento macro quando algum mentor selecionado for inválido', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });
    prismaMock.usuario.findMany.mockResolvedValue([{ id: ID_MENTOR }]);

    await expect(
      service.criar(
        {
          tipoAtividadeId: ID_TIPO_ATIVIDADE,
          projetoId: ID_PROJETO,
          titulo: 'Evento para mentores selecionados',
          escopo: 'evento_macro',
          responsavelIds: [ID_MENTOR, ID_OUTRO_MENTOR],
          prazoAtual: '2026-08-15T18:00:00-03:00',
        },
        coordenadora,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.tarefa.create).not.toHaveBeenCalled();
  });

  it('deve exigir um projeto válido para criar tarefa', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });

    prismaMock.usuario.findUnique.mockResolvedValue({
      id: ID_MENTOR,
      ativo: true,
      papel: Papel.MENTOR,
    });

    prismaMock.projeto.findFirst.mockResolvedValue(null);

    await expect(
      service.criar(
        {
          tipoAtividadeId: ID_TIPO_ATIVIDADE,

          projetoId: ID_PROJETO,

          titulo: 'Revisar curso',

          responsavelId: ID_MENTOR,

          escopo: 'curso',

          prazoAtual: '2026-08-15T18:00:00-03:00',
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.tarefa.create).not.toHaveBeenCalled();
  });

  it('deve permitir à coordenadora criar tarefa para mentor vinculado ao curso', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });

    prismaMock.usuario.findUnique.mockResolvedValue({
      id: ID_MENTOR,
      ativo: true,
      papel: Papel.MENTOR,
    });

    prismaMock.curso.findFirst.mockResolvedValue({
      id: ID_CURSO,
    });

    prismaMock.cursoMentor.findFirst.mockResolvedValue({
      cursoId: ID_CURSO,
    });

    prismaMock.projeto.findFirst.mockResolvedValue({
      id: ID_PROJETO,
      escopo: EscopoTarefa.CURSO,
      cursoId: ID_CURSO,
      turmaId: null,
      prazoFinal: new Date('2026-08-30T21:00:00.000Z'),
    });

    prismaMock.tarefa.create.mockResolvedValue(
      criarTarefaDetalhe({
        escopo: EscopoTarefa.CURSO,

        cursoId: ID_CURSO,
      }),
    );

    const resultado = await service.criar(
      {
        tipoAtividadeId: ID_TIPO_ATIVIDADE,

        projetoId: ID_PROJETO,

        titulo: 'Revisar plano do curso',

        responsavelId: ID_MENTOR,

        escopo: 'curso',
        cursoId: ID_CURSO,

        prazoAtual: '2026-08-20T18:00:00-03:00',
      },
      coordenadora,
    );

    expect(prismaMock.cursoMentor.findFirst).toHaveBeenCalledWith({
      where: {
        cursoId: ID_CURSO,

        mentorId: ID_MENTOR,
      },

      select: {
        cursoId: true,
      },
    });

    expect(prismaMock.tarefa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          criadoPorId: ID_COORDENADORA,

          responsavelId: ID_MENTOR,

          escopo: EscopoTarefa.CURSO,

          cursoId: ID_CURSO,

          turmaId: null,
        }),
      }),
    );

    expect(resultado.escopo).toBe('curso');
  });

  it('deve atribuir automaticamente ao mentor autenticado', async () => {
    prismaMock.tipoAtividade.findUnique.mockResolvedValue({
      id: ID_TIPO_ATIVIDADE,
      ativo: true,
    });
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: ID_MENTOR,
      ativo: true,
      papel: Papel.MENTOR,
    });
    prismaMock.curso.findFirst.mockResolvedValue({ id: ID_CURSO });
    prismaMock.cursoMentor.findFirst.mockResolvedValue({ cursoId: ID_CURSO });
    prismaMock.tarefa.create.mockResolvedValue(
      criarTarefaDetalhe({ escopo: EscopoTarefa.CURSO, cursoId: ID_CURSO }),
    );

    await service.criar(
      {
        tipoAtividadeId: ID_TIPO_ATIVIDADE,
        projetoId: ID_PROJETO,
        titulo: 'Minha tarefa',
        responsavelId: ID_OUTRO_MENTOR,
        escopo: 'curso',
        cursoId: ID_CURSO,
        prazoAtual: '2026-08-20T18:00:00-03:00',
      },
      mentor,
    );

    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID_MENTOR } }),
    );
    expect(prismaMock.projeto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ID_PROJETO,
          status: {
            in: [StatusProjeto.PLANEJAMENTO, StatusProjeto.EM_ANDAMENTO],
          },
        },
      }),
    );
    expect(prismaMock.tarefa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responsavelId: ID_MENTOR }),
      }),
    );
  });

  it('deve permitir que o responsável edite conteúdo e links da tarefa', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      responsavelId: ID_MENTOR,
      tipoAtividadeId: ID_TIPO_ATIVIDADE,
      status: StatusTarefa.EM_ANDAMENTO,
    });
    prismaMock.tarefa.update.mockResolvedValue(
      criarTarefaDetalhe({ responsavelId: ID_MENTOR }),
    );

    await service.atualizar(
      ID_TAREFA,
      {
        tipoAtividadeId: ID_TIPO_ATIVIDADE,
        titulo: ' Relatório   final ',
        descricao: ' Evidências ',
        links: ['https://exemplo.com/arquivo', 'https://exemplo.com/arquivo'],
      },
      mentor,
    );

    expect(prismaMock.tarefa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ID_TAREFA,
          status: { not: StatusTarefa.CONCLUIDA },
        },
        data: expect.objectContaining({
          titulo: 'Relatório final',
          descricao: 'Evidências',
          links: ['https://exemplo.com/arquivo'],
        }),
      }),
    );
  });

  it('não deve permitir editar tarefa concluída', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      responsavelId: ID_MENTOR,
      tipoAtividadeId: ID_TIPO_ATIVIDADE,
      status: StatusTarefa.CONCLUIDA,
    });

    await expect(
      service.atualizar(
        ID_TAREFA,
        {
          tipoAtividadeId: ID_TIPO_ATIVIDADE,
          titulo: 'Tarefa concluída',
          links: [],
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();
  });

  it('não deve permitir edição por usuário sem acesso', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      responsavelId: ID_OUTRO_MENTOR,
      tipoAtividadeId: ID_TIPO_ATIVIDADE,
      status: StatusTarefa.EM_ANDAMENTO,
    });

    await expect(
      service.atualizar(
        ID_TAREFA,
        {
          tipoAtividadeId: ID_TIPO_ATIVIDADE,
          titulo: 'Tentativa de edição',
          links: [],
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('não deve permitir reagendamento por usuário sem acesso', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,

      responsavelId: ID_OUTRO_MENTOR,

      status: StatusTarefa.EM_ANDAMENTO,

      prazoInicio: null,

      prazoAtual: new Date('2026-08-15T21:00:00.000Z'),
    });

    await expect(
      service.reagendar(
        ID_TAREFA,
        {
          prazoNovo: '2026-08-20T18:00:00-03:00',

          justificativa: 'Nova necessidade',
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();
  });

  it('não deve permitir reagendar tarefa concluída', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,

      responsavelId: ID_MENTOR,

      status: StatusTarefa.CONCLUIDA,

      prazoInicio: null,

      prazoAtual: new Date('2026-08-15T21:00:00.000Z'),
    });

    await expect(
      service.reagendar(
        ID_TAREFA,
        {
          prazoNovo: '2026-08-20T18:00:00-03:00',
        },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();
  });

  it('deve concluir uma tarefa em andamento', async () => {
    const tarefaPendente = criarTarefaDetalhe({
      status: StatusTarefa.EM_ANDAMENTO,

      concluidoEm: null,
    });

    const tarefaConcluida = criarTarefaDetalhe({
      status: StatusTarefa.CONCLUIDA,

      concluidoEm: new Date('2026-08-10T15:00:00.000Z'),
    });

    prismaMock.tarefa.findUnique.mockResolvedValue(tarefaPendente);

    prismaMock.tarefa.update.mockResolvedValue(tarefaConcluida);

    const resultado = await service.concluir(ID_TAREFA, mentor);

    expect(prismaMock.tarefa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: ID_TAREFA,
        },

        data: {
          status: StatusTarefa.CONCLUIDA,

          concluidoEm: expect.any(Date),
        },
      }),
    );

    expect(resultado.status).toBe('concluida');

    expect(resultado.concluidoEm).not.toBeNull();
  });

  it('deve tratar conclusão repetida de forma idempotente', async () => {
    const tarefaConcluida = criarTarefaDetalhe({
      status: StatusTarefa.CONCLUIDA,
    });

    prismaMock.tarefa.findUnique.mockResolvedValue(tarefaConcluida);

    const resultado = await service.concluir(ID_TAREFA, mentor);

    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();

    expect(resultado.status).toBe('concluida');
  });

  it('deve permitir que o mentor responsável inicie uma tarefa planejada', async () => {
    const prazoFuturo = new Date(Date.now() + 60 * 60 * 1000);
    prismaMock.tarefa.findUnique.mockResolvedValueOnce({
      id: ID_TAREFA,
      responsavelId: ID_MENTOR,
      status: StatusTarefa.PLANEJADA,
      prazoAtual: prazoFuturo,
    });
    prismaMock.tarefa.update.mockResolvedValue(
      criarTarefaDetalhe({
        status: StatusTarefa.EM_ANDAMENTO,
        prazoAtual: prazoFuturo,
      }),
    );

    const resultado = await service.iniciar(ID_TAREFA, mentor);

    expect(prismaMock.tarefa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ID_TAREFA, status: StatusTarefa.PLANEJADA },
        data: {
          status: StatusTarefa.EM_ANDAMENTO,
          iniciadoEm: expect.any(Date),
        },
      }),
    );
    expect(resultado.status).toBe('em_andamento');
  });

  it('não deve permitir que outro mentor inicie a tarefa', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      responsavelId: ID_OUTRO_MENTOR,
      status: StatusTarefa.PLANEJADA,
      prazoAtual: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(service.iniciar(ID_TAREFA, mentor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();
  });

  it('deve apresentar como atrasada uma tarefa planejada com prazo vencido', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      responsavelId: ID_MENTOR,
      status: StatusTarefa.PLANEJADA,
      prazoAtual: new Date(Date.now() - 60 * 60 * 1000),
    });

    await expect(service.iniciar(ID_TAREFA, mentor)).rejects.toThrow(
      'Uma tarefa atrasada deve ser reagendada ou concluída.',
    );
    expect(prismaMock.tarefa.update).not.toHaveBeenCalled();
  });

  it('deve permitir que a coordenadora adicione comentário em tarefa pendente', async () => {
    prismaMock.tarefa.findUnique.mockResolvedValue({
      id: ID_TAREFA,
      status: StatusTarefa.EM_ANDAMENTO,
    });
    prismaMock.comentarioTarefa.create.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      conteudo: 'Complemente as informações.',
      criadoEm: new Date(),
      lidoEm: null,
      autor: {
        id: ID_COORDENADORA,
        nome: coordenadora.nome,
        email: coordenadora.email,
      },
    });

    await service.adicionarComentario(
      ID_TAREFA,
      { conteudo: 'Complemente as informações.' },
      coordenadora,
    );

    expect(prismaMock.comentarioTarefa.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tarefaId: ID_TAREFA,
          autorId: ID_COORDENADORA,
          conteudo: 'Complemente as informações.',
        },
      }),
    );
  });

  it('não deve permitir que mentor adicione comentário', async () => {
    await expect(
      service.adicionarComentario(
        ID_TAREFA,
        { conteudo: 'Comentário' },
        mentor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.comentarioTarefa.create).not.toHaveBeenCalled();
  });

  it('deve marcar comentários como lidos somente para o mentor responsável', async () => {
    prismaMock.tarefa.findFirst.mockResolvedValue({ id: ID_TAREFA });
    prismaMock.comentarioTarefa.updateMany.mockResolvedValue({ count: 2 });

    const resultado = await service.marcarComentariosComoLidos(
      ID_TAREFA,
      mentor,
    );

    expect(prismaMock.comentarioTarefa.updateMany).toHaveBeenCalledWith({
      where: { tarefaId: ID_TAREFA, lidoEm: null },
      data: { lidoEm: expect.any(Date) },
    });
    expect(resultado).toEqual({ quantidadeMarcada: 2 });
  });
});
