# Gestão de Mentores — Backend

API REST para gerenciamento de mentores, cursos, turmas, módulos, unidades curriculares, tarefas, links e relatórios.

O projeto foi desenvolvido com NestJS, Prisma ORM e PostgreSQL.

> Esta versão está preparada para apresentação como beta em ambiente local ou controlado.

---

## Tecnologias

* Node.js
* TypeScript
* NestJS
* Prisma ORM
* PostgreSQL
* Docker Compose
* JWT
* Argon2
* Swagger
* ExcelJS
* PDFKit
* Jest

---

## Funcionalidades

### Autenticação

* Login com e-mail e senha
* Access token JWT
* Refresh token armazenado em cookie
* Renovação de sessão
* Logout
* Revogação de todas as sessões do usuário
* Consulta do usuário autenticado

### Usuários

* Cadastro de coordenadoras e mentores
* Listagem de usuários
* Ativação e desativação de usuários
* Controle de permissões por papel

Papéis disponíveis:

* Coordenadora
* Mentor

### Cursos

* Cadastro e listagem de cursos
* Vinculação de mentores aos cursos
* Consulta dos mentores vinculados

### Estrutura acadêmica

* Cadastro e listagem de turmas
* Cadastro e listagem de módulos
* Cadastro e listagem de unidades curriculares
* Organização da estrutura acadêmica por curso
* Clonagem de estruturas acadêmicas

### Tipos de atividade

* Cadastro de tipos de atividade
* Listagem de tipos ativos
* Utilização dos tipos na criação de tarefas

### Tarefas

* Criação de tarefas vinculadas obrigatoriamente a projetos
* Listagem com filtros e paginação
* Consulta detalhada
* Reagendamento
* Histórico de reagendamentos
* Conclusão de tarefas
* Controle de acesso por responsável
* Validação do prazo da tarefa dentro do prazo final do projeto

### Projetos

* Criação e listagem de projetos
* Agrupamento neutro de tarefas, sem curso, escopo, responsável ou links próprios
* Agrupamento de tarefas sem níveis de subtarefas
* Conclusão condicionada à finalização das tarefas pendentes
* Cancelamento com preservação do histórico

Escopos disponíveis:

* Curso
* Turma
* Evento macro

Status disponíveis:

* Pendente
* Concluída

### Links de arquivos

* Registro de links HTTP/HTTPS diretamente nas tarefas
* Compatibilidade com qualquer serviço de armazenamento em nuvem
* Redirecionamento direto para arquivos previamente compartilhados

### Relatórios

* Relatório de tarefas em JSON
* Exportação para Excel
* Exportação para PDF
* Filtros por período, mentor, curso e turma

### Documentação

* Swagger disponível para consulta e teste das rotas
* Documentação dos endpoints protegidos por JWT
* Respostas de erro padronizadas

---

## Requisitos

Para executar o projeto, é necessário ter instalado:

* Node.js
* npm
* Docker
* Docker Compose

---

## Instalação

Clone o repositório e acesse a pasta do backend:

```bash
git clone <URL_DO_REPOSITORIO>
cd gestao-backend
```

Instale as dependências:

```bash
npm install
```

---

## Configuração do ambiente

Crie um arquivo `.env` na raiz do projeto.

Exemplo:

```dotenv
NODE_ENV=development
PORT=3000

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gestao_mentores?schema=public"

JWT_ACCESS_SECRET="substitua-por-uma-chave-segura"
JWT_REFRESH_SECRET="substitua-por-outra-chave-segura"

JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

SWAGGER_ENABLED=true

```

---

## Banco de dados

Inicie o PostgreSQL com Docker Compose:

```bash
docker compose up -d
```

Verifique o estado do container:

```bash
docker compose ps
```

Gere o Prisma Client:

```bash
npx prisma generate
```

Aplique as migrations:

```bash
npx prisma migrate deploy
```

Caso exista um seed configurado:

```bash
npx prisma db seed
```

Para visualizar os registros do banco:

```bash
npx prisma studio
```

---

## Executando a aplicação

### Desenvolvimento

```bash
npm run start:dev
```

A API será iniciada em:

```text
http://localhost:3000
```

### Produção local

Gere o build:

```bash
npm run build
```

Inicie a versão compilada:

```bash
npm run start:prod
```

---

## Verificação da aplicação

### Status da API

```text
GET http://localhost:3000/health
```

### Swagger

```text
http://localhost:3000/docs
```

O Swagger permite visualizar e testar os endpoints disponíveis.

Para testar rotas protegidas:

1. Execute o login.
2. Copie o `accessToken` retornado.
3. Clique no botão **Authorize** do Swagger.
4. Informe o token JWT.
5. Execute as rotas protegidas.

---

## Rotas principais

### Autenticação

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/eu
POST /auth/logout-todos
```

### Usuários

```text
GET   /usuarios
POST  /usuarios
PATCH /usuarios/:usuarioId/status
```

### Cursos

```text
GET  /cursos
POST /cursos
```

### Estrutura acadêmica

```text
GET  /turmas
POST /turmas

GET  /modulos
POST /modulos

GET  /unidades-curriculares
POST /unidades-curriculares
```

### Tipos de atividade

```text
GET  /tipos-atividade
POST /tipos-atividade
```

### Tarefas

```text
GET  /tarefas
POST /tarefas
GET  /tarefas/:tarefaId

POST /tarefas/:tarefaId/reagendar
POST /tarefas/:tarefaId/concluir

```

### Projetos

```text
GET  /projetos
POST /projetos
GET  /projetos/:projetoId
POST /projetos/:projetoId/concluir
POST /projetos/:projetoId/cancelar
```

### Relatórios

```text
GET /relatorios/tarefas
GET /relatorios/tarefas/excel
GET /relatorios/tarefas/pdf
```

Os parâmetros exatos de cada rota podem ser consultados no Swagger.

---

## Permissões

### Coordenadora

A coordenadora pode:

* cadastrar usuários;
* ativar e desativar usuários;
* criar cursos;
* vincular mentores;
* criar estruturas acadêmicas;
* criar tipos de atividade;
* criar tarefas para mentores;
* visualizar tarefas dos usuários;
* reagendar e concluir tarefas;
* gerar relatórios.

### Mentor

O mentor pode:

* consultar os cursos aos quais está vinculado;
* visualizar suas próprias tarefas;
* criar tarefas para si;
* reagendar suas próprias tarefas;
* concluir suas próprias tarefas;
* consultar links das tarefas permitidas;
* gerar relatórios limitados às próprias tarefas.

---

## Testes

Execute os testes unitários:

```bash
npm test
```

Execute um arquivo específico:

```bash
npm test -- tasks.service.spec.ts
```

Gere o build para validar a compilação:

```bash
npm run build
```

Os testes E2E estão previstos para uma etapa posterior do projeto.

---

## Fluxo sugerido para apresentação

Para demonstrar a versão beta:

1. Inicie o PostgreSQL.
2. Execute as migrations e o seed.
3. Inicie a API.
4. Abra o Swagger.
5. Faça login como coordenadora.
6. Consulte o usuário autenticado.
7. Liste os mentores cadastrados.
8. Liste os cursos e a estrutura acadêmica.
9. Crie uma tarefa para um mentor.
10. Consulte a tarefa criada.
11. Reagende ou conclua a tarefa.
12. Faça login como mentor.
13. Demonstre que o mentor visualiza somente suas tarefas.
14. Gere um relatório em JSON, Excel ou PDF.

---

## Dados recomendados para demonstração

Antes da apresentação, recomenda-se deixar cadastrados:

* uma coordenadora ativa;
* dois mentores ativos;
* um curso;
* um mentor vinculado ao curso;
* uma turma;
* um módulo;
* duas unidades curriculares;
* dois tipos de atividade;
* tarefas pendentes;
* tarefas concluídas.

Isso reduz a quantidade de cadastros necessários durante a apresentação.

---

## Limitações da versão beta

Esta versão foi preparada para execução em ambiente local ou controlado.

Alguns itens foram planejados para etapas posteriores:

* testes E2E completos;
* rate limiting;
* logs estruturados;
* monitoramento;
* CI/CD;
* backup automatizado;
* containerização completa da API;
* políticas avançadas de segurança;
* documentação de implantação em produção.

Antes de disponibilizar a aplicação publicamente, será necessário revisar configurações de segurança, HTTPS, CORS, cookies, segredos e limites de requisição.

---

## Estrutura resumida

```text
src/
├── academic/
├── activity-types/
├── auth/
├── common/
├── config/
├── courses/
├── generated/
├── health/
├── prisma/
├── projects/
├── reports/
├── tasks/
├── users/
├── app.module.ts
└── main.ts

prisma/
├── migrations/
├── schema.prisma
└── seed.ts
```

---

## Comandos principais

```bash
# Instalar dependências
npm install

# Iniciar PostgreSQL
docker compose up -d

# Gerar Prisma Client
npx prisma generate

# Aplicar migrations
npx prisma migrate deploy

# Executar seed
npx prisma db seed

# Iniciar em desenvolvimento
npm run start:dev

# Executar testes
npm test

# Gerar build
npm run build

# Iniciar build
npm run start:prod
```

---

## Licença

Projeto desenvolvido para fins acadêmicos e de demonstração.
