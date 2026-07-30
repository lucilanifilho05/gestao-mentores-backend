import type { Papel } from '../../generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  tokenVersion: number;
  tipo: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  tokenVersion: number;
  tipo: 'refresh';
}

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: UsuarioAutenticado;
}

export interface ResultadoAutenticacao {
  resposta: LoginResponse;
  refreshToken: string;
}

export interface MetadadosSessao {
  userAgent?: string;
  enderecoIp?: string;
}