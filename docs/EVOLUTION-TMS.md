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
- Tipos de anexo sem MIME permitido ou acima de 10 MiB aparecem como indisponíveis.
- O módulo não envia preço automaticamente. A equipe revisa todos os campos da cotação.
- Nenhuma conexão ou número real foi pareado pela implementação local.
