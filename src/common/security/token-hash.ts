import {
  createHash,
  timingSafeEqual,
} from 'node:crypto';

export function gerarHashToken(token: string): string {
  return createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
}

export function compararHashToken(
  token: string,
  hashArmazenado: string,
): boolean {
  const hashCalculado = Buffer.from(
    gerarHashToken(token),
    'hex',
  );

  const hashEsperado = Buffer.from(
    hashArmazenado,
    'hex',
  );

  if (hashCalculado.length !== hashEsperado.length) {
    return false;
  }

  return timingSafeEqual(
    hashCalculado,
    hashEsperado,
  );
}