# Plano • envios de documentos por e-mail

1. Declarar Nodemailer diretamente e adicionar configuração SMTP segura por tenant no Prisma, com segredo cifrado.
2. Implementar validação compartilhada, leitura/gravação/teste SMTP e política de endereços públicos permitidos.
3. Implementar mensagens e anexos por evento, usando `DocumentDelivery` para idempotência, estados e tentativas separadas do webhook.
4. Ajustar geração dos eventos para ocorrer quando webhook ou e-mail estiver configurado; cobrir comprovante entregue, CT-e autorizado, fatura emitida e título vencido.
5. Adicionar painel Empresa • E-mail para modo TMS/SMTP próprio, remetente, credenciais, teste e histórico.
6. Conectar configuração de destinatários já existente, corrigir rótulos/descrição e documentar configuração operacional e variáveis ambientais.
7. Atualizar `.agents/equipe/controle.json` com implementação, critérios e limitações de validação.

## Revisão do plano

Cada parte do objetivo possui uma tarefa. As falhas consideradas são SMTP sem TLS, credencial ausente/cifrada inválida, destino SMTP interno, anexo indisponível ou grande, repetição do mesmo evento, cliente sem preferência, provedor TMS não configurado e desacoplamento do webhook.

## Execução

Implementação local concluída. Typecheck, ESLint do escopo, `prisma validate`, validação do JSON da equipe e `git diff --check` passaram. A suíte automatizada não foi executada e a alteração não foi publicada. O modo TMS exige as variáveis `TMS_SMTP_*`; alternativamente, o administrador configura e testa o SMTP próprio em **Empresa • E-mail**.
