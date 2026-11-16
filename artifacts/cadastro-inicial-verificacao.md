# Cadastro inicial • Verificação

Data • 16/11/2026

## Escopo e decisões

Entrada `/criar-conta`, identidade pelo Auth, retorno estável a `/cadastro`,
formulário da transportadora e ADMIN local da própria empresa. Criação
restrita à identidade configurada em `TMS_CADASTRO_ISENTO_EMAIL`, fechada por
padrão. Nenhum usuário escolhe isenção, administrador, perfil ou tenant pelo
payload. Mello, demo e a nova conta seguem a exclusão documentada; não há
automatização de cobrança ou pagamento nesta etapa.

## Evidência local

- RED observado: o login perdia `/cadastro` e não oferecia criar conta depois
  da saída; módulos de cadastro inexistentes. Cinco casos existentes passavam.
- GREEN: 52 testes em seis arquivos, incluindo 21 novos de cadastro/login e
  regressões públicas/MDX. Após a revisão de carregamento, 20 cenários de
  cadastro/login novamente aprovados.
- TypeScript aprovado. Lint dos novos módulos, interfaces e testes aprovado
  sem avisos após ajustar carregamento assíncrono e estado do login.
- Chromium com o componente real e API de fixture em 1440×1000/390×844:
  formulário, payload somente empresarial, criação, seleção de sessão e
  comando de saída verificados sem erro/overflow. Capturas acompanham este
  arquivo. Este comando de saída em fixture não comprova logout autenticado.
- `tests/cadastro-db.test.ts` verifica concorrência, unicidade, ADMIN local,
  auditoria, RLS, rejeição de identidade diferente e empresa inativa. Será
  executado contra PostgreSQL na CI; não declarar que passou por existir.
- SQL 045 aditivo/idempotente. Reaplicação verificada pelo teste de banco
  na CI antes da aplicação operacional.

## Operação e limites

Configurar no ambiente o e-mail autorizado e aplicar SQL 045/RLS antes do
código. A política atual do Auth é `clientes_liberados`; o acesso desta
identidade deve ser específico do TMS, sem criar identidade pelo banco nem
abrir outros apps. O usuário confirma o e-mail/escolhe a senha pela interface
e informa os dados empresariais. Nenhum dado empresarial foi inventado.

CI integral, imagem, migração, publicação, saúde e limpeza serão registrados
na AVL-412 após verificação. Esta evidência local não os presume aprovados.

## Preservação do checkout

Main atualizada de c207efd para 15c051a, incorporando site público e CMS já
publicados por outros trabalhos. Mudanças locais anteriores preservadas em
stash `5c53f5e4db96fff61057dd50a97fa9bdcc6a93d2`. Os ícones locais coincidem
com a nova main; a versão anterior do desenho público e do layout permanece
na cópia de preservação. Requisitos SaaS restaurados no checkout. Não incluir
exclusão de `.env.example` ou arquivos de sessão do Playwright nesta entrega.
