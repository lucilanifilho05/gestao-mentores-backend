import * as argon2 from 'argon2';

export async function gerarHashSenha(
  senha: string,
): Promise<string> {
  return argon2.hash(senha, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verificarHashSenha(
  hash: string,
  senha: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    return false;
  }
}