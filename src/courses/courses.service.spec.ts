import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  plainToInstance,
} from 'class-transformer';
import {
  validate,
} from 'class-validator';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import type {
  UsuarioAutenticado,
} from '../auth/types/auth.types';
import {
  Papel,
} from '../generated/prisma/client';
import {
  PrismaService,
} from '../prisma/prisma.service';
import {
  CoursesService,
} from './courses.service';
import {
  AlterarStatusCursoDto,
} from './dto/alterar-status-curso.dto';
import {
  AtualizarCursoDto,
} from './dto/atualizar-curso.dto';
import {
  ListarCursosQueryDto,
} from './dto/listar-cursos-query.dto';

const CURSO_ID =
  '11111111-1111-4111-8111-111111111111';

const MENTOR_ID =
  '22222222-2222-4222-8222-222222222222';

const COORDENADORA_ID =
  '33333333-3333-4333-8333-333333333333';

const DATA_CRIACAO =
  new Date(
    '2026-08-01T12:00:00.000Z',
  );

const DATA_ATUALIZACAO =
  new Date(
    '2026-08-01T13:00:00.000Z',
  );

const coordenadora:
  UsuarioAutenticado = {
  id: COORDENADORA_ID,
  nome: 'Coordenadora',
  email:
    'coordenadora@exemplo.com',
  papel: Papel.COORDENADORA,
};

const mentor:
  UsuarioAutenticado = {
  id: MENTOR_ID,
  nome: 'Mentor',
  email: 'mentor@exemplo.com',
  papel: Papel.MENTOR,
};

function criarCurso(
  ativo = true,
) {
  return {
    id: CURSO_ID,
    nome:
      'Técnico em Administração',
    ativo,
    criadoEm: DATA_CRIACAO,
    atualizadoEm:
      DATA_ATUALIZACAO,
  };
}

function criarCursoDaLista(
  ativo = true,
) {
  return {
    ...criarCurso(ativo),

    _count: {
      mentores: 2,
    },
  };
}

const criarMockAssincrono = () =>
  jest.fn<
    (
      ...argumentos: unknown[]
    ) => Promise<unknown>
  >();

const prismaMock = {
  curso: {
    findMany:
      criarMockAssincrono(),

    count:
      criarMockAssincrono(),

    create:
      criarMockAssincrono(),

    findUnique:
      criarMockAssincrono(),

    update:
      criarMockAssincrono(),
  },

  usuario: {
    findUnique:
      criarMockAssincrono(),
  },

  cursoMentor: {
    findMany:
      criarMockAssincrono(),

    createMany:
      criarMockAssincrono(),

    deleteMany:
      criarMockAssincrono(),
  },

  $transaction: jest.fn<
    (
      argumento: unknown,
    ) => Promise<unknown>
  >(),
};

describe(
  'CoursesService',
  () => {
    let service:
      CoursesService;

    beforeEach(async () => {
      jest.resetAllMocks();

      prismaMock.$transaction
        .mockImplementation(
          async (
            argumento: unknown,
          ): Promise<unknown> => {
            if (
              Array.isArray(
                argumento,
              )
            ) {
              return Promise.all(
                argumento,
              );
            }

            throw new Error(
              'Formato de transação inesperado.',
            );
          },
        );

      const module:
        TestingModule =
        await Test
          .createTestingModule({
            providers: [
              CoursesService,

              {
                provide:
                  PrismaService,

                useValue:
                  prismaMock,
              },
            ],
          })
          .compile();

      service =
        module.get(
          CoursesService,
        );
    });

    it(
      'deve estar definido',
      () => {
        expect(
          service,
        ).toBeDefined();
      },
    );

    it(
      'deve listar ativos e inativos quando ativo não for informado',
      async () => {
        prismaMock.curso
          .findMany
          .mockResolvedValue([
            criarCursoDaLista(
              true,
            ),
            {
              ...criarCursoDaLista(
                false,
              ),
              id:
                '44444444-4444-4444-8444-444444444444',
            },
          ]);

        prismaMock.curso.count
          .mockResolvedValue(2);

        const resultado =
          await service.listar(
            {
              pagina: 1,
              limite: 20,
              apenas_meus:
                false,
            },
            coordenadora,
          );

        const chamada =
          prismaMock.curso
            .findMany.mock
            .calls[0]?.[0] as {
              where:
                Record<
                  string,
                  unknown
                >;
            };

        expect(
          chamada.where,
        ).not.toHaveProperty(
          'ativo',
        );

        expect(
          resultado.data,
        ).toHaveLength(2);
      },
    );

    it(
      'deve filtrar somente cursos ativos',
      async () => {
        prismaMock.curso
          .findMany
          .mockResolvedValue([]);

        prismaMock.curso.count
          .mockResolvedValue(0);

        await service.listar(
          {
            pagina: 1,
            limite: 20,
            apenas_meus: false,
            ativo: true,
          },
          coordenadora,
        );

        expect(
          prismaMock.curso
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                ativo: true,
              }),
          }),
        );
      },
    );

    it(
      'deve filtrar somente cursos inativos sem ignorar false',
      async () => {
        prismaMock.curso
          .findMany
          .mockResolvedValue([]);

        prismaMock.curso.count
          .mockResolvedValue(0);

        await service.listar(
          {
            pagina: 1,
            limite: 20,
            apenas_meus: false,
            ativo: false,
          },
          coordenadora,
        );

        expect(
          prismaMock.curso
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                ativo: false,
              }),
          }),
        );
      },
    );

    it(
      'deve manter busca e paginação',
      async () => {
        prismaMock.curso
          .findMany
          .mockResolvedValue([]);

        prismaMock.curso.count
          .mockResolvedValue(0);

        await service.listar(
          {
            pagina: 2,
            limite: 10,
            busca: 'gestão',
            apenas_meus: false,
            ativo: true,
          },
          coordenadora,
        );

        expect(
          prismaMock.curso
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 10,

            where:
              expect.objectContaining({
                ativo: true,

                nome: {
                  contains:
                    'gestão',

                  mode:
                    'insensitive',
                },
              }),
          }),
        );
      },
    );

    it(
      'deve restringir apenas_meus aos vínculos do mentor',
      async () => {
        prismaMock.curso
          .findMany
          .mockResolvedValue([]);

        prismaMock.curso.count
          .mockResolvedValue(0);

        await service.listar(
          {
            pagina: 1,
            limite: 20,
            apenas_meus: true,
          },
          mentor,
        );

        expect(
          prismaMock.curso
            .findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                mentores: {
                  some: {
                    mentorId:
                      MENTOR_ID,
                  },
                },
              }),
          }),
        );
      },
    );

    it(
      'deve continuar criando curso ativo e normalizado',
      async () => {
        prismaMock.curso.create
          .mockResolvedValue(
            criarCurso(),
          );

        await service.criar({
          nome:
            '  Técnico   em Administração ',
        });

        expect(
          prismaMock.curso.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              nome:
                'Técnico em Administração',

              nomeNormalizado:
                'técnico em administração',

              ativo: true,
            },
          }),
        );
      },
    );

    it(
      'deve atualizar nome e nomeNormalizado',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue({
            id: CURSO_ID,
          });

        prismaMock.curso.update
          .mockResolvedValue(
            criarCurso(),
          );

        await service.atualizar(
          CURSO_ID,
          {
            nome:
              '  Técnico   em Administração ',
          },
        );

        expect(
          prismaMock.curso.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: CURSO_ID,
            },

            data: {
              nome:
                'Técnico em Administração',

              nomeNormalizado:
                'técnico em administração',
            },
          }),
        );
      },
    );

    it(
      'deve permitir atualizar nome de curso inativo',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue({
            id: CURSO_ID,
          });

        prismaMock.curso.update
          .mockResolvedValue(
            criarCurso(false),
          );

        const resultado =
          await service.atualizar(
            CURSO_ID,
            {
              nome:
                'Curso atualizado',
            },
          );

        expect(
          resultado,
        ).toEqual(
          criarCurso(false),
        );

        expect(
          prismaMock.curso.update,
        ).toHaveBeenCalled();
      },
    );

    it(
      'deve retornar 404 ao atualizar curso inexistente',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue(null);

        await expect(
          service.atualizar(
            CURSO_ID,
            {
              nome:
                'Novo curso',
            },
          ),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );

        expect(
          prismaMock.curso.update,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'deve retornar 409 ao atualizar para nome duplicado',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue({
            id: CURSO_ID,
          });

        prismaMock.curso.update
          .mockRejectedValue({
            code: 'P2002',
          });

        await expect(
          service.atualizar(
            CURSO_ID,
            {
              nome:
                'Curso duplicado',
            },
          ),
        ).rejects.toBeInstanceOf(
          ConflictException,
        );
      },
    );

    it(
      'deve desativar curso alterando somente ativo',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue(
            criarCurso(true),
          );

        prismaMock.curso.update
          .mockResolvedValue(
            criarCurso(false),
          );

        const resultado =
          await service
            .alterarStatus(
              CURSO_ID,
              {
                ativo: false,
              },
            );

        expect(
          prismaMock.curso.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: CURSO_ID,
            },

            data: {
              ativo: false,
            },
          }),
        );

        expect(
          resultado.ativo,
        ).toBe(false);

        expect(
          prismaMock.cursoMentor
            .deleteMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'deve reativar curso',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue(
            criarCurso(false),
          );

        prismaMock.curso.update
          .mockResolvedValue(
            criarCurso(true),
          );

        const resultado =
          await service
            .alterarStatus(
              CURSO_ID,
              {
                ativo: true,
              },
            );

        expect(
          resultado.ativo,
        ).toBe(true);

        expect(
          prismaMock.curso.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              ativo: true,
            },
          }),
        );
      },
    );

    it(
      'deve retornar 404 ao alterar status de curso inexistente',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue(null);

        await expect(
          service.alterarStatus(
            CURSO_ID,
            {
              ativo: false,
            },
          ),
        ).rejects.toBeInstanceOf(
          NotFoundException,
        );
      },
    );

    it(
      'deve tratar alteração para o mesmo status como idempotente',
      async () => {
        const curso =
          criarCurso(true);

        prismaMock.curso
          .findUnique
          .mockResolvedValue(
            curso,
          );

        const resultado =
          await service
            .alterarStatus(
              CURSO_ID,
              {
                ativo: true,
              },
            );

        expect(
          resultado,
        ).toEqual(curso);

        expect(
          prismaMock.curso.update,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'deve continuar bloqueando vínculo em curso inativo',
      async () => {
        prismaMock.curso
          .findUnique
          .mockResolvedValue({
            id: CURSO_ID,
            nome:
              'Curso inativo',
            ativo: false,
          });

        prismaMock.usuario
          .findUnique
          .mockResolvedValue({
            id: MENTOR_ID,
            nome: 'Mentor',
            email:
              'mentor@exemplo.com',
            papel:
              Papel.MENTOR,
            ativo: true,
          });

        await expect(
          service.vincularMentor(
            CURSO_ID,
            MENTOR_ID,
            COORDENADORA_ID,
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          prismaMock.cursoMentor
            .createMany,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

describe(
  'DTOs de cursos',
  () => {
    it(
      'deve transformar ativo=false da query em booleano',
      async () => {
        const dto =
          plainToInstance(
            ListarCursosQueryDto,
            {
              ativo: 'false',
            },
          );

        const erros =
          await validate(dto);

        expect(dto.ativo).toBe(
          false,
        );

        expect(erros).toHaveLength(
          0,
        );
      },
    );

    it(
      'deve rejeitar filtro ativo inválido',
      async () => {
        const dto =
          plainToInstance(
            ListarCursosQueryDto,
            {
              ativo: 'qualquer',
            },
          );

        const erros =
          await validate(dto);

        expect(
          erros.some(
            (erro) =>
              erro.property ===
              'ativo',
          ),
        ).toBe(true);
      },
    );

    it(
      'deve normalizar espaços no DTO de atualização',
      async () => {
        const dto =
          plainToInstance(
            AtualizarCursoDto,
            {
              nome:
                '  Curso   Técnico  ',
            },
          );

        const erros =
          await validate(dto);

        expect(dto.nome).toBe(
          'Curso Técnico',
        );

        expect(erros).toHaveLength(
          0,
        );
      },
    );

    it(
      'deve rejeitar nome muito curto',
      async () => {
        const dto =
          plainToInstance(
            AtualizarCursoDto,
            {
              nome: 'A',
            },
          );

        const erros =
          await validate(dto);

        expect(
          erros.some(
            (erro) =>
              erro.property ===
              'nome',
          ),
        ).toBe(true);
      },
    );

    it(
      'deve rejeitar status que não seja booleano',
      async () => {
        const dto =
          plainToInstance(
            AlterarStatusCursoDto,
            {
              ativo: 'false',
            },
          );

        const erros =
          await validate(dto);

        expect(
          erros.some(
            (erro) =>
              erro.property ===
              'ativo',
          ),
        ).toBe(true);
      },
    );
  },
);