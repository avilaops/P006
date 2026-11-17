# WhatsApp Evolution no TMS • plano de implementação

> Implementação nativa no worktree `feat/tms-whatsapp-evolution`; execução sequencial sem delegação.

**Objetivo:** integrar o WhatsApp Evolution ao funil comercial do TMS, com caixa de entrada por transportadora e mídia privada no R2.

**Arquitetura:** Next.js recebe webhooks com token aleatório no caminho, persiste conversas e mensagens em modelos tenant-scoped, importa o histórico disponível por páginas e usa R2 privado para bytes de anexos. A interface oferece pareamento, caixa, resposta e criação manual de uma cotação vinculada à conversa.

**Tecnologias:** Next.js App Router, TypeScript, Prisma, PostgreSQL com RLS, Evolution API v2, Cloudflare R2 via API S3 compatível.

**Spec:** `docs/superpowers/specs/2026-11-17-whatsapp-evolution-tms.md`

## Restrições globais

- Preservar sessão, autorização e RLS por tenant.
- Nunca expor `EVOLUTION_API_KEY`, segredo de webhook ou chaves R2 ao navegador.
- R2 privado com chave gerada pelo servidor e prefixo tenant/conversa.
- Não criar cotação com campos ausentes nem enviar preço sem revisão humana.
- Não mexer em alterações locais que existiam no checkout principal.
- Integração em produção depende de Evolution URL/API key e credenciais R2 no ambiente do TMS. O bucket dedicado já foi criado.

## Foco de revisão

- Webhook com tenant ou assinatura inválida • rejeitar sem acessar dados do tenant.
- Webhook repetido • preservar uma mensagem por ID externo/tenant.
- Evento de grupo ou mensagem própria • não abrir lead de cotação.
- Mídia ausente, acima do limite ou MIME inválido • manter mensagem e indicar anexo indisponível.
- Usuário tenta acessar ID de conversa/mídia de outro tenant • responder como inexistente.

## Tarefas

### 1 • Persistência, RLS e configuração R2

**Arquivos:** `prisma/schema.prisma`, `prisma/sql/010-rls.sql`, `src/lib/whatsapp-storage.ts`, `package.json` e lockfile.

- [x] Adicionar modelos de conexão, conversa e mensagem com `tenantId`, índices compostos, unicidade por mensagem externa e relação opcional com `QuoteLead`.
- [x] Adicionar política RLS automática e gatilho de mesmo tenant para as relações novas.
- [x] Implementar armazenamento S3/R2 com chave tenant/conversa, hash SHA-256, MIME, limite de tamanho e leitura autenticada.
- [x] Falhar explicitamente quando faltar qualquer variável do R2.

### 2 • Cliente Evolution e pareamento

**Arquivos:** `src/lib/evolution-whatsapp.ts`, `src/app/api/empresa/whatsapp/route.ts`.

- [x] Derivar nome de instância do tenant no servidor e proteger conexão por `empresa` e atendimento por `crm`.
- [x] Implementar consulta de status, criação/pairing e envio de texto usando timeout e validação de URL.
- [x] Registrar `MESSAGES_UPSERT` e `CONNECTION_UPDATE` no webhook tenant-scoped da aplicação, com token validado por hash.
- [x] Não retornar API key nem token do webhook.

### 3 • Webhook e ingestão idempotente

**Arquivos:** `src/app/api/integracoes/whatsapp/evolution/[tenantId]/[token]/route.ts`, `src/lib/whatsapp-ingest.ts`.

- [x] Validar UUID do tenant, token e formato do evento antes de processar.
- [x] Ignorar grupos e status; importar mensagens recebidas e enviadas da instância.
- [x] Deduplicar por `externalId` dentro do tenant e atualizar resumo/atividade da conversa.
- [x] Baixar anexos com limite, persistir no R2 e registrar falha de mídia sem perder o texto.
- [x] Importar o histórico já disponível em páginas, sem contar mensagens antigas como não lidas.

### 4 • APIs e interface da caixa

**Arquivos:** APIs tenant-scoped da caixa, `src/app/dashboard/crm/whatsapp/page.tsx`, componentes sob `src/components/whatsapp/`, `src/app/dashboard/menu.ts`.

- [x] Listar conversas com busca e estados de abertas/aguardando/arquivadas.
- [x] Renderizar mensagens em ordem cronológica e anexos pela rota autenticada.
- [x] Responder com texto pela Evolution e persistir a confirmação com o ID externo.
- [x] Permitir arquivar/restaurar conversa.
- [x] Ligar a ação “Criar cotação” ao formulário comercial e persistir o vínculo só após validação completa.
- [x] Registrar as novas rotas na matriz de permissões e incluir a página interna no inventário MDX sem exportá-la ao catálogo público.

### 5 • Configurações, documentação e atualização do registro da equipe

**Arquivos:** `src/app/dashboard/crm/whatsapp/page.tsx`, `docs/EVOLUTION-TMS.md`, `.agents/equipe/controle.json`.

- [x] Mostrar conexão, QR e telefone vinculado sem expor segredos.
- [x] Documentar variáveis, eventos habilitados, R2 privado, limites e passos para ambiente real.
- [x] Registrar a integração como implementação local; não marcar publicação como concluída.

## Verificação local

- [x] `prisma validate`, `typecheck`, ESLint do escopo e `git diff --check` aprovados.
- [ ] CI da PR #45: a primeira execução encontrou inventário de rotas/perfis e página MDX desatualizados; correções enviadas na cabeça `fb233d0` e a nova execução ainda precisa ser confirmada.
- [ ] Aplicar `npm run db:push` no ambiente do TMS para criar as tabelas e reaplicar as políticas RLS.
- [ ] Publicar a aplicação e validar pareamento, histórico e atendimento com o número real.
- [x] Guardar credenciais somente no `.env` root-only do TMS e nunca no repositório.
