export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function validarTamanhoSenha(senha: string): void {
  if (
    senha.length < PASSWORD_MIN_LENGTH ||
    senha.length > PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `A senha deve possuir entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`,
    );
  }
}