import { BadRequestException } from '@nestjs/common';

const MILISSEGUNDOS_POR_DIA = 86_400_000;
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function converterDataAcademica(
  valor: string,
  campo: string,
): Date {
  if (!FORMATO_DATA.test(valor)) {
    throw new BadRequestException(
      `${campo} deve estar no formato AAAA-MM-DD.`,
    );
  }

  const [ano, mes, dia] = valor
    .split('-')
    .map(Number);

  const data = new Date(
    Date.UTC(ano, mes - 1, dia),
  );

  const dataValida =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;

  if (!dataValida) {
    throw new BadRequestException(
      `${campo} contém uma data inválida.`,
    );
  }

  return data;
}

export function validarPeriodo(
  inicio: Date,
  fim: Date,
  entidade: string,
): void {
  if (fim < inicio) {
    throw new BadRequestException(
      `A data final de ${entidade} não pode ser anterior à data inicial.`,
    );
  }
}

export function validarDentroDoPeriodo(
  inicio: Date,
  fim: Date,
  periodoInicio: Date,
  periodoFim: Date,
  entidade: string,
  periodoPai: string,
): void {
  if (
    inicio < periodoInicio ||
    fim > periodoFim
  ) {
    throw new BadRequestException(
      `O período de ${entidade} deve estar dentro do período de ${periodoPai}.`,
    );
  }
}

export function diferencaEmDias(
  dataDestino: Date,
  dataOrigem: Date,
): number {
  return Math.round(
    (dataDestino.getTime() -
      dataOrigem.getTime()) /
      MILISSEGUNDOS_POR_DIA,
  );
}

export function adicionarDias(
  data: Date,
  dias: number,
): Date {
  return new Date(
    data.getTime() +
      dias * MILISSEGUNDOS_POR_DIA,
  );
}