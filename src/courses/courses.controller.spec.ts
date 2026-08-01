import 'reflect-metadata';

import {
  describe,
  expect,
  it,
} from '@jest/globals';

import {
  PAPEIS_KEY,
} from '../common/decorators/papeis.decorator';
import {
  Papel,
} from '../generated/prisma/client';
import {
  CoursesController,
} from './courses.controller';

describe('CoursesController', () => {
  it('deve restringir atualização de nome à coordenadora', () => {
    const metodo =
      CoursesController.prototype
        .atualizar;

    expect(
      typeof metodo,
    ).toBe('function');

    const papeis =
      Reflect.getMetadata(
        PAPEIS_KEY,
        metodo,
      ) as Papel[] | undefined;

    expect(papeis).toEqual([
      Papel.COORDENADORA,
    ]);
  });

  it('deve restringir alteração de status à coordenadora', () => {
    const metodo =
      CoursesController.prototype
        .alterarStatus;

    expect(
      typeof metodo,
    ).toBe('function');

    const papeis =
      Reflect.getMetadata(
        PAPEIS_KEY,
        metodo,
      ) as Papel[] | undefined;

    expect(papeis).toEqual([
      Papel.COORDENADORA,
    ]);
  });
});