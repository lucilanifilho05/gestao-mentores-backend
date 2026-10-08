# Google Agenda — primeira entrega

O login continua sendo email e senha da aplicação. A autorização OAuth serve apenas para acessar o calendário. Cada usuário conecta sua própria conta em **Minha conta → Google Agenda**; a conta Google pode ter email diferente do cadastro local.

## Comportamento

- Novas tarefas exigem `prazoInicio` e `prazoAtual`, com fim estritamente posterior ao início. A coluna `prazo_inicio` permanece nullable para preservar tarefas antigas.
- Ao conectar, a aplicação cria um calendário secundário **Gestão de Mentores**, no fuso `America/Fortaleza`. Renovar a conexão da mesma conta reutiliza esse calendário.
- Tarefas criadas após a conexão são enviadas ao calendário do **responsável**, inclusive quando criadas pela coordenadora. Criações de evento macro geram uma tarefa/evento por responsável conectado. Mentores de apoio não recebem eventos nesta versão.
- O evento usa exatamente o início e o prazo final da criação, título e número da tarefa. Eventos aparecem como **Disponível**, sem bloquear o intervalo. Não são enviados comentários, links privados ou convidados.
- Não há importação de tarefas anteriores à conexão, nem sincronização de edições, conclusão ou reagendamento nesta entrega. As datas e o título são uma fotografia da criação, mesmo se houver edição antes do envio.
- Desconectar apaga credenciais e operações locais dessa conexão e tenta revogar o acesso no Google. Calendários e eventos existentes são preservados. Uma nova conexão após desconectar cria outro calendário; remova o antigo manualmente se desejar.

## Configurar

1. No Google Cloud, crie/selecione o projeto e habilite a **Google Calendar API**.
2. Configure a tela de consentimento, público e usuários de teste, quando aplicável.
3. Crie um cliente OAuth do tipo **Aplicativo Web**. Cadastre exatamente o endereço de retorno do backend: `https://api.seu-dominio/integracoes/google-agenda/callback`.
4. Configure no backend:

```dotenv
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=https://api.seu-dominio/integracoes/google-agenda/callback
GOOGLE_FRONTEND_URL=https://app.seu-dominio
GOOGLE_TOKEN_ENCRYPTION_KEY=chave-hexadecimal-de-64-caracteres
```

Gere a chave de criptografia com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guarde-a no gerenciador de segredos; não use uma chave JWT nem publique valores reais no repositório. Perder ou trocar essa chave exige reconectar as contas existentes. Não altere a chave sem planejar a migração dos tokens.

5. Execute `npx prisma generate`, `npx prisma migrate deploy` e o build/deploy do backend e frontend. A migração somente adiciona tabelas e não modifica os prazos históricos. O Compose recebe as novas variáveis do ambiente.
6. Use HTTPS em produção. Frontend e API devem estar no mesmo site (por exemplo, `app.exemplo.com` e `api.exemplo.com`), e `CORS_ORIGINS` deve conter o endereço exato do frontend. Isso permite definir o cookie HttpOnly usado para vincular o consentimento ao navegador e enviá-lo no retorno do Google. Em desenvolvimento, use `localhost` em ambos, com portas diferentes.
7. Entre normalmente no sistema, abra **Minha conta** e conecte o Google Agenda. Crie uma tarefa com início e fim distintos, atribuída ao usuário conectado. Verifique o evento no calendário criado e o contador de envios na página da conta.

Permissões solicitadas: `calendar.app.created`, `openid` e `email`. As duas últimas identificam a conta autorizada; não criam login Google nem sessões locais.

## Operação

Os eventos ficam em uma fila persistente no PostgreSQL, gravada na mesma transação da tarefa. Um worker do backend consulta a fila a cada 15 segundos. Falhas temporárias recebem até oito tentativas com espera crescente. O identificador do evento é determinístico, e a fila usa uma reserva temporária de dois minutos para evitar processamento simultâneo entre réplicas. Uma resposta 409 na inserção do mesmo ID é tratada como evento já criado.

Erros definitivos aparecem no contador de falhas. Use **Tentar envios novamente** após corrigir o problema. Se a autorização for revogada, reconecte a mesma conta e tente os envios novamente. Contas locais inativas não são processadas. Se o calendário tiver sido excluído manualmente, desconecte e conecte novamente; os trabalhos antigos não são transferidos ao novo calendário.

Sem `GOOGLE_CALENDAR_ENABLED=true`, os endpoints de estado indicam indisponibilidade e o worker não inicia; a criação de tarefas continua funcionando sem credenciais Google.

## Validação antes de produção

- Conferir concessão e recusa de consentimento, callback expirado e tentativa de reutilizar o callback.
- Conferir conta local e conta Google diferentes, reconexão e desconexão.
- Criar tarefa comum e evento macro com diferentes responsáveis conectados.
- Conferir horários na agenda, inclusive intervalos de vários dias.
- Simular falha de rede e confirmar que a tarefa permanece salva e a retomada não duplica eventos.
- Confirmar requisitos de publicação OAuth; tokens de projetos externos em modo de teste podem expirar em sete dias.

Referências: [OAuth Web Server](https://developers.google.com/identity/protocols/oauth2/web-server), [escopos](https://developers.google.com/workspace/calendar/api/auth), [criação de calendários](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert), [criação de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).
