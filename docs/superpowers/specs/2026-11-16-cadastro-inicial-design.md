# TMS • Cadastro inicial da transportadora

## Escopo da continuação

O usuário pediu disponibilizar as interfaces de criar conta até logout e
autorizou criar uma conta fora da cobrança e de sua contagem. Esta etapa
reutiliza Next.js, NextAuth e a identidade do Auth. A implementação segue o
pedido de continuar no checkout, sem novos agentes ou worktrees.

## Abordagem

Criar `/criar-conta` com os passos e preços já informados; o botão de cadastro
leva ao Auth com retorno estável para `/login?callbackUrl=/cadastro`.
Criar `/cadastro` para a identidade autenticada informar nome, identificador
e CNPJ da própria transportadora. Nenhum dado empresarial será inventado.

A criação fica fechada por padrão e exige correspondência exata com
`TMS_CADASTRO_ISENTO_EMAIL`, configurado no servidor para a conta autorizada.
Outras identidades podem entrar em empresas às quais já têm acesso ou
contatar a equipe. Não há teste grátis geral nem checkout simulado.

Criar tenant e ADMIN local em uma única transação. O e-mail e nome do
administrador vêm da sessão, nunca do formulário. `Tenant.selfSignupEmail`
único torna a criação idempotente por identidade, inclusive em concorrência.
`selfSignupExempt` registra a exclusão autorizada. Nenhum ADMIN global nasce.
Empresa inativa não é reativada por este endpoint. Uma falha na seleção da
empresa permite repetir a entrada sem duplicar cadastro.

O endpoint `/api/cadastro` é anterior à escolha de tenant, como
`/api/empresas`; usa `requireConta` e autorização específica do servidor,
com cobertura explícita em perfis. Não acrescenta capacidade a papéis de
empresas existentes. POST exige origem local, JSON limitado e campos
conhecidos. Não recebe preço, tenantId, perfil ou isenção do navegador.

O login preserva apenas caminhos locais permitidos como callback, sem
redirecionamento externo, e continua parado após logout. A saída usa a
confirmação central existente. O formulário e seus dados não recebem
analytics nem entram no sitemap.

## Limites comerciais e alternativa considerada

A alternativa de ativar contratação paga automática agora foi descartada
nesta etapa: primeiro administrador, usuários externos e relação entre
terceira conta e adicionais ainda não foram detalhados. A conta desta jornada
já foi excluída pelo usuário, portanto essas lacunas não bloqueiam suas telas.
Mello e demo permanecem fora da contagem conforme o documento comercial.

O acesso OIDC da conta deve ser conferido no Auth antes da validação real;
não mudar a política de outros apps ou atribuir papel de equipe. Não criar
identidade por banco ou compartilhar senha. O próprio usuário pode confirmar
o e-mail e concluir o formulário publicado.

## Verificação e publicação

Regressões de autorização, payload, duplicação, origem, callback, formulário,
erro e reentrada. PostgreSQL real na CI, tipos, lint e navegador em desktop
e celular. SQL 045 aditivo/idempotente aplicado antes do deploy e RLS
reaplicado. Publicação só comprovada com CI integral, imagem e saúde.
