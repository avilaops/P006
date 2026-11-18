# WhatsApp no TMS • Evolution API e Cloudflare R2

## O que fica no sistema

- Uma instância Evolution por transportadora, derivada no servidor do UUID do tenant.
- Histórico de texto, estado e metadados de conversa no PostgreSQL, com RLS por tenant.
- Anexos no bucket privado `tms-avilaops-com-media`, sob `tenants/<tenantId>/conversations/<conversationId>/`.
- Leitura de anexos somente pela rota autenticada do TMS; não configure domínio público no bucket.
- Webhooks habilitados para `MESSAGES_UPSERT` e `CONNECTION_UPDATE`; grupos e status do WhatsApp são ignorados.
- Importação do histórico disponível em páginas, com deduplicação por ID externo. Mídias antigas só são recuperadas enquanto a Evolution ainda consegue baixá-las.
- Criação de cotação manual a partir da conversa, com origem, destino, volumes e peso informados pela equipe.

## Variáveis no servidor TMS

Configure somente no ambiente do serviço, nunca em variáveis `NEXT_PUBLIC_*`:

```dotenv
EVOLUTION_API_URL=https://evolution-api.example.com
EVOLUTION_API_KEY=<chave-da-api>
R2_ACCOUNT_ID=<id-da-conta-cloudflare>
R2_ACCESS_KEY_ID=<id-do-token-r2>
R2_SECRET_ACCESS_KEY=<segredo-do-token-r2>
R2_BUCKET=tms-avilaops-com-media
NEXTAUTH_URL=https://tms.avilaops.com
```

Crie um token de objeto R2 com leitura e gravação somente nesse bucket. O bucket foi criado sem domínio público. A aplicação exige as quatro variáveis `R2_*` para gravar anexos. Texto de mensagens continua sendo salvo no PostgreSQL.

## Banco e conexão

Depois de atualizar o esquema Prisma, aplique a rotina de banco já usada pelo TMS:

```powershell
npm run db:push
```

Ela atualiza o esquema e reaplica as políticas RLS em `prisma/sql/010-rls.sql`. A conexão é iniciada em Comercial → WhatsApp por um administrador; o QR é exibido uma vez para parear o aparelho. A mesma tela permite importar o histórico que a Evolution disponibiliza.

## Limites conhecidos

- Importação começa após conectar. Mensagens que não existem mais na Evolution não podem ser recuperadas pelo TMS.
- A importação completa é paginada e iniciada manualmente pela caixa; não importa automaticamente todo o histórico pessoal.
- Tipos de anexo sem MIME permitido ou acima de 10 MiB aparecem como indisponíveis.
- O módulo não envia preço automaticamente. A equipe revisa todos os campos da cotação.

## Verificação de produção • 17/11/2026

- A instância da Ávila Transportes está conectada (`open`) e o webhook está ativo em `https://tms.avilaops.com`.
- O painel autenticado exibiu 34 conversas e 379 mensagens importadas; a Evolution informa 61.047 mensagens disponíveis e a importação continua sob ação do atendente.
- A leitura autenticada de um anexo privado no bucket R2 respondeu HTTP 200 (`audio/ogg`, 15.745 bytes).
- O TMS responde HTTP 200 no health check, na revisão `64abe5a`.
- O envio real de uma mensagem pela caixa não foi usado como teste, para não enviar conteúdo a um contato sem escolha explícita.
