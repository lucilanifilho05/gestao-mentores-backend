import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_CHAVE = 32;
const TAMANHO_IV = 12;

function obterChave(chaveBase64: string): Buffer {
  const chave = Buffer.from(
    chaveBase64,
    'base64',
  );

  if (chave.length !== TAMANHO_CHAVE) {
    throw new Error(
      'DRIVE_TOKEN_ENCRYPTION_KEY deve conter exatamente 32 bytes em Base64.',
    );
  }

  return chave;
}

export function cifrarSegredo(
  valor: string,
  chaveBase64: string,
): string {
  const chave = obterChave(chaveBase64);
  const iv = randomBytes(TAMANHO_IV);

  const cipher = createCipheriv(
    ALGORITMO,
    chave,
    iv,
  );

  const conteudoCifrado = Buffer.concat([
    cipher.update(valor, 'utf8'),
    cipher.final(),
  ]);

  const authenticationTag =
    cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authenticationTag.toString('base64url'),
    conteudoCifrado.toString('base64url'),
  ].join('.');
}

export function decifrarSegredo(
  valorCifrado: string,
  chaveBase64: string,
): string {
  const partes = valorCifrado.split('.');

  if (partes.length !== 3) {
    throw new Error(
      'Formato do segredo cifrado inválido.',
    );
  }

  const [ivBase64, tagBase64, conteudoBase64] =
    partes;

  const chave = obterChave(chaveBase64);
  const iv = Buffer.from(ivBase64, 'base64url');
  const tag = Buffer.from(
    tagBase64,
    'base64url',
  );
  const conteudo = Buffer.from(
    conteudoBase64,
    'base64url',
  );

  const decipher = createDecipheriv(
    ALGORITMO,
    chave,
    iv,
  );

  decipher.setAuthTag(tag);

  const valor = Buffer.concat([
    decipher.update(conteudo),
    decipher.final(),
  ]);

  return valor.toString('utf8');
}