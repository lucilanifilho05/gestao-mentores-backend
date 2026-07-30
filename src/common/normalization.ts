export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

export function normalizarChave(texto: string): string {
  return normalizarNome(texto).toLowerCase();
}