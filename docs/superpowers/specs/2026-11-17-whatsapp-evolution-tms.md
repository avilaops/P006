# WhatsApp Evolution no TMS • especificação

## Objetivo

Receber e responder conversas de WhatsApp dentro do TMS para ajudar a equipe comercial a organizar o alto volume de pedidos de cotação.

## Fluxo

1. Cada transportadora conecta o próprio número à Evolution API por QR Code. Instância, conversa, mensagem e mídia pertencem ao tenant da transportadora.
2. O TMS recebe eventos `MESSAGES_UPSERT` e `CONNECTION_UPDATE` por webhook autenticado, deduplica pelo identificador externo e atualiza a caixa de entrada.
3. A equipe importa o histórico que a Evolution ainda disponibiliza e consulta/responde mensagens individuais. Mensagens e metadados ficam no PostgreSQL; anexos binários ficam no bucket privado R2, com chave sob `tenants/<tenantId>/conversations/<conversationId>/`.
4. A equipe pode iniciar uma cotação a partir da conversa. Os campos comerciais são conferidos e enviados pelo fluxo de cotação existente; o sistema não presume origem, destino, carga ou preço.

## Segurança e operação

- A URL e a chave mestre da Evolution API ficam somente no ambiente do servidor.
- A instância é derivada no servidor do UUID do tenant. O navegador nunca escolhe tenant, instância ou segredo.
- A conexão usa um token de webhook aleatório e independente da chave da Evolution, transmitido no caminho da URL e armazenado somente como SHA-256 no banco. A rota valida o token antes de gravar dados.
- Todas as leituras e escritas usam `paraEmpresa()` e as políticas RLS existentes.
- Eventos de grupo, status e mensagens próprias não abrem conversas de cotação.
- IDs externos são únicos por tenant; webhooks repetidos e páginas de histórico sobrepostas não criam mensagens duplicadas.
- Mídia é servida por rota autenticada com isolamento por tenant. O bucket não é público e não recebe domínio público.
- Falha de R2 não marca mídia como disponível. O histórico textual continua consultável.

## Armazenamento

- PostgreSQL: conexão, conversa, mensagem, status, vínculo opcional com `QuoteLead` e metadados da mídia.
- Cloudflare R2: bytes dos anexos, sem URL pública.
- O TMS usará bucket dedicado configurado por `R2_BUCKET`; credenciais de objeto devem ter acesso restrito a esse bucket.

## Limites desta entrega

- Caixa de entrada de WhatsApp e conexão Evolution por transportadora.
- Mensagens de texto e anexos recebidos; resposta de texto pela caixa.
- Criação manual de cotação vinculada à conversa.
- Sem envio automático de proposta/preço ou classificação generativa. Mensagens que já não estejam disponíveis na Evolution não podem ser recuperadas; mídia só é copiada quando o provedor ainda consegue baixá-la.
- Conectar número real e implantar dependem das credenciais do serviço e da configuração segura do webhook/R2.
