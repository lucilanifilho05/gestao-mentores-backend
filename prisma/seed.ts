import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import {
  Papel,
  PrismaClient,
} from '../src/generated/prisma/client';
import {
  normalizarEmail,
  normalizarNome,
} from '../src/common/normalization';
import { gerarHashSenha } from '../src/common/security/password';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('A variável DATABASE_URL não foi definida.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

function obterVariavelObrigatoria(nome: string): string {
  const valor = process.env[nome];

  if (!valor || valor.trim().length === 0) {
    throw new Error(`A variável ${nome} não foi definida.`);
  }

  return valor;
}

function validarEmail(email: string): void {
  const formatoBasicoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!formatoBasicoEmail.test(email)) {
    throw new Error('INITIAL_ADMIN_EMAIL possui formato inválido.');
  }
}

async function main(): Promise<void> {
  const nome = normalizarNome(
    obterVariavelObrigatoria('INITIAL_ADMIN_NAME'),
  );

  const email = normalizarEmail(
    obterVariavelObrigatoria('INITIAL_ADMIN_EMAIL'),
  );

  const senha = obterVariavelObrigatoria(
    'INITIAL_ADMIN_PASSWORD',
  );

  if (nome.length < 3 || nome.length > 150) {
    throw new Error(
      'INITIAL_ADMIN_NAME deve possuir entre 3 e 150 caracteres.',
    );
  }

  validarEmail(email);

  if (senha.length < 8 || senha.length > 128) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD deve possuir entre 12 e 128 caracteres.',
    );
  }

  const coordenadoraExistente =
    await prisma.usuario.findFirst({
      where: {
        papel: Papel.COORDENADORA,
      },
      select: {
        email: true,
      },
    });

  if (coordenadoraExistente) {
    console.log(
      `Uma coordenadora já existe: ${coordenadoraExistente.email}`,
    );
    console.log('Nenhuma senha ou usuário foi alterado.');
    return;
  }

  const usuarioComMesmoEmail =
    await prisma.usuario.findUnique({
      where: {
        emailNormalizado: email,
      },
      select: {
        id: true,
        papel: true,
      },
    });

  if (usuarioComMesmoEmail) {
    throw new Error(
      'O e-mail informado já pertence a outro usuário.',
    );
  }

  const senhaHash = await gerarHashSenha(senha);

  const coordenadora = await prisma.usuario.create({
    data: {
      nome,
      email,
      emailNormalizado: email,
      senhaHash,
      papel: Papel.COORDENADORA,
      ativo: true,
    },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      criadoEm: true,
    },
  });

  console.log('Coordenadora inicial criada com sucesso:');
  console.log({
    id: coordenadora.id,
    nome: coordenadora.nome,
    email: coordenadora.email,
    papel: coordenadora.papel,
    criadoEm: coordenadora.criadoEm,
  });
}

main()
  .catch((erro: unknown) => {
    console.error('Falha ao criar a coordenadora inicial.');

    if (erro instanceof Error) {
      console.error(erro.message);
    } else {
      console.error(erro);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });