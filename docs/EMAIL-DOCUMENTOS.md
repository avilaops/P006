# Envios documentais por e-mail

## Configuração da transportadora

Abra **Empresa • E-mail** e escolha:

• **Serviço central do TMS** • disponível somente quando o ambiente do serviço tem `TMS_SMTP_HOST`, `TMS_SMTP_PORT`, `TMS_SMTP_USER`, `TMS_SMTP_PASSWORD` e `TMS_SMTP_FROM_EMAIL` configurados. `TMS_SMTP_FROM_NAME` e `TMS_SMTP_SECURE` são opcionais.
• **Meu servidor SMTP** • informe host, porta, TLS/STARTTLS, usuário, senha e remetente. A senha fica cifrada com `TMS_CHAVE_DE_DADOS` e nunca volta para a tela.

O teste envia uma mensagem para o e-mail da conta que clicou no botão. Em SMTP próprio, o remetente precisa estar autorizado pelo provedor. A caixa de saída não está habilitada para envio em massa.

## Preferências por cliente

No cadastro do cliente, ative os envios e selecione os endereços e tipos de documento. Sem cliente habilitado, destinatário ou documento escolhido, nenhum e-mail automático sai.

• **Comprovante** • enviado depois da aprovação da conferência. Inclui fotos válidas e link para o portal do cliente.
• **CT-e autorizado** • somente em produção. XML anexado; DACTE PDF gerado pelo serviço fiscal quando disponível.
• **Fatura emitida** • resumo da fatura e link para o portal. O TMS não gera um PDF da fatura hoje.
• **Cobrança vencida** • resumo do título, Pix e link do boleto quando disponíveis. O PDF do boleto não é baixado nem anexado; o link de pagamento é incluído.

Links do portal exigem acesso do cliente. Arquivos grandes ou indisponíveis falham e aparecem no histórico da empresa. O administrador pode tentar de novo depois de corrigir o motivo.

## Estados

`PENDING`/`QUEUED` indicam fila ou processamento. `SENT` significa que o servidor SMTP aceitou a mensagem, não que ela chegou à caixa ou foi lida. `FAILED` guarda um motivo seguro e permite nova tentativa manual. O histórico é separado do estado de entrega do webhook.

SMTP não oferece idempotência universal. Uma falha do processo depois do aceite do provedor e antes de gravar o resultado pode ocasionar repetição numa tentativa posterior.
