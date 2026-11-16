# TMS: requisitos da contratação e do primeiro acesso

## Pedido do usuário

Disponibilizar e percorrer a interface desde criar conta até sair do sistema.
O usuário pode confirmar o e-mail e concluir o cadastro pessoalmente quando
necessário. A criação de conta deve acontecer pela interface, sem provisionar
uma identidade diretamente no banco.

O modelo informado em 13/11/2026 é SaaS multi-tenant, com:

- Base de R$350 por mês por empresa.
- Taxa de R$99 a cada usuário criado.
- Acréscimo de R$60 na mensalidade por usuário criado.

### Início da cobrança e exclusões da contagem

Complemento explícito do usuário em 13/11/2026: **“só a partir da terceira
conta”**. Para apurar esse marco, ficam fora da contagem:

- Mello.
- Demo.
- A conta que será criada para percorrer a jornada nesta entrega.

Essas três contas não antecipam o início da cobrança. Não usar a quantidade
bruta de cadastros existentes para concluir que o marco foi atingido.

O termo “conta” deste marco foi preservado conforme informado. A relação
entre essa contagem e os usuários considerados nos adicionais de R$99/R$60
ainda não foi detalhada. Este registro não define silenciosamente o marco
como terceiro login de cada transportadora nem resolve a inclusão do primeiro
administrador na base.

Ainda falta confirmar se o primeiro administrador está incluído na base e
se motoristas e clientes com login entram na cobrança por usuário. Essas
respostas mudam o total apresentado antes da contratação. A interpretação
de taxa de criação como cobrança única deve ficar explícita no resumo
comercial, sem transformá-la em outra mensalidade.

## Situação verificada no código e no navegador

- A página pública `https://avilaops.com/tms` oferece demonstração e acesso
  de cliente. O cadastro no menu geral leva ao contexto Minha Conta.
- A interface `https://auth.avilaops.com/criar?app=tms&returnTo=https%3A%2F%2Ftms.avilaops.com%2Flogin`
  aceita nome e e-mail, preservando o contexto TMS. O link recebido permite
  escolher a senha. A conta só é criada depois da confirmação.
- A identidade criada é cliente da plataforma, sem concessão automática de
  ADMIN global, vínculo a uma transportadora ou acesso aos dados de outra
  empresa.
- O login do TMS guarda a identidade mesmo sem tenant e encaminha essa
  situação para `/empresa`. Atualmente essa tela pede acesso a uma empresa;
  não oferece contratação nem cadastro próprio de transportadora.
- O cadastro existente de empresas está em `/api/plataforma/empresas`,
  protegido por `requireEquipe`. Não é um endpoint de contratação pública.
- O TMS não possui modelo de assinatura comercial da plataforma. As faturas
  e o gateway já existentes cobram fretes das transportadoras, não a
  mensalidade SaaS devida à Avila Ops.
- A saída encerra a sessão do TMS e leva à confirmação do login único.
  A tela central exige confirmação explícita e retorna a
  `https://tms.avilaops.com/login?saiu=1`.
- Cadastro, navegação e saída sem sessão foram percorridos em Chromium em
  desktop e celular. Ainda não foi comprovado um cadastro confirmado,
  primeiro acesso a uma transportadora própria ou logout autenticado com
  uma nova conta. A solicitação de e-mail iniciada nesta sessão não tem
  evidência recuperada de sucesso; não será repetida automaticamente.

## Entrega a projetar

A jornada deve ligar apresentação do preço, identidade confirmada,
cadastro da transportadora, contratação, primeiro acesso e saída. O
administrador contratante administra somente sua empresa. A implantação
deve preservar a escolha de empresa para quem já participa de mais de uma.

Os valores devem ser calculados no servidor em centavos, discriminando base,
usuários e taxa de criação. Confirmação de e-mail, criação de checkout e
pagamento confirmado são etapas distintas. Não apresentar pagamento
aprovado por retorno do navegador nem cobrar uma conta de teste para
validar a interface.

O provedor e a política de ativação da assinatura serão definidos no desenho
da entrega. O ERP oferece uma referência de checkout recorrente em Mercado
Pago, mas sua integração e suas credenciais pertencem a outro produto e não
foram adotadas para o TMS. Nenhuma cobrança ou alteração do ERP foi feita.

Este documento registra requisitos e diagnóstico; não representa aprovação
de um desenho nem implementação ou publicação do novo fluxo SaaS.
