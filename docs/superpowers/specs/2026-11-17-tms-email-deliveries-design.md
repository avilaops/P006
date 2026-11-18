# Envios de documentos por e-mail no TMS

## Objetivo

Permitir que a transportadora envie comprovantes, documentos de CT-e, faturas e avisos de cobrança aos contatos selecionados por cliente. A transportadora escolhe o serviço padrão do TMS (quando provisionado) ou configura seu próprio SMTP.

## Estado atual confirmado

• Clientes já guardam até 20 destinatários, categorias e documentos habilitados em `notificationRecipients`, além de `notificationPreferences`.
• `DocumentDelivery` já registra destinatário, tipo, status, tentativas, identificador do provedor e checksum.
• `OutboxEvent` já agenda eventos operacionais, fiscais, faturamento e vencimentos, mas sua entrega atual é apenas webhook.
• Há SMTP ausente no código do TMS; `nodemailer` está no lockfile como dependência transitiva e será declarado diretamente para transporte SMTP.
• Os documentos já disponíveis têm formatos diferentes: imagens do comprovante, XML e DACTE gerado sob demanda, fatura consultada pelo portal e cobrança com links de pagamento.

## Abordagens

1. Enviar pelo n8n/webhook • reutiliza integração, mas exige que cada empresa construa e mantenha seu próprio fluxo de e-mail. Não atende ao pedido de envio integrado configurável.
2. SMTP próprio por empresa, com opção do serviço central do TMS • recomendado. Mantém a operação no TMS, permite credenciais próprias, usa os destinatários já cadastrados e registra cada documento por destinatário.
3. Um provedor de e-mail fixo do TMS • configuração simples, mas não permite que a empresa use sua conta e domínio.

## Decisão de implementação

Usar uma configuração SMTP por tenant. `TMS` usa as variáveis de ambiente SMTP do serviço; `PROPRIO` usa host, porta, TLS, remetente e usuário configurados pela transportadora. Senhas ficam cifradas com `TMS_CHAVE_DE_DADOS`, usando o contexto do tenant e do campo. Se o modo TMS não estiver provisionado, a interface explica que a opção ainda não está disponível; o SMTP próprio continua utilizável.

O fluxo usa o despachante existente e `DocumentDelivery`, separado do estado de entrega do webhook. Só cria envios quando o cliente habilitou notificações e associou documentos aos destinatários. Cada destinatário/documento tem chave idempotente, tentativas independentes e estado auditável. Falha de SMTP não deve marcar o webhook como falho, nem bloquear outros eventos.

Os documentos e avisos suportados são: comprovante após entrega, CT-e autorizado em produção, fatura emitida e título vencido. CT-e envia XML e DACTE quando disponíveis; comprovante envia os dados e fotos atuais da entrega; fatura e cobrança incluem valores, vencimentos, Pix/link de boleto. Links para áreas que exigem autenticação são identificados como tal. Não enviar XML/DACTE de homologação, CT-e cancelado, fatura cancelada/paga como cobrança, nem cobrança já paga.

Configuração administrativa em Empresa • E-mail: modo de envio, remetente, SMTP, senha, teste para o endereço do administrador, estado da configuração e histórico recente. Senha nunca retorna pela API ou aparece na auditoria. Erros não incluem credenciais nem conteúdo de documentos.

## Segurança e limites

• SMTP só via TLS/STARTTLS conforme porta e opção de segurança; rejeitar destinos locais, loopback, IP privado e metadados para reduzir SSRF.
• RLS e vínculos por tenant em configurações e entregas.
• Segredos cifrados em repouso e omitidos de respostas, logs e auditoria.
• No máximo 20 destinatários por cliente; validação de endereço e limites de tamanho por mensagem/anexo.
• Aceite do SMTP é registrado como `SENT`; sem DSN não afirmar que a caixa postal recebeu ou abriu a mensagem.
• Envio automático desabilitado até o cliente marcar preferências e a empresa configurar um transporte válido.

## Fora do escopo

• Garantir entrega/abertura por SMTP sem confirmação do servidor destinatário.
• Configurar credenciais reais do serviço central sem acesso e autorização para a conta de e-mail remetente.
• Criar canal WhatsApp ou SMS neste trabalho.
