# TMS • Plano do cadastro inicial

> **For agentic workers:** Use superpowers:executing-plans nesta sessão, sem agentes adicionais.

**Goal:** Disponibilizar cadastro e primeiro acesso da transportadora isenta autorizada.

**Architecture:** Identidade no Auth, formulário no TMS e criação transacional de tenant/ADMIN local. Liberação exata por configuração do servidor, fechada por padrão; isenção não escolhida pelo cliente.

**Tech Stack:** Next.js 16, React 19, NextAuth 4, Prisma 7, PostgreSQL e Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-cadastro-inicial-design.md`.

## Global Constraints

- Preservar alterações locais; executar neste checkout e sem subagentes.
- Manter isolamento por tenant e sessão SSO, sem ADMIN global.
- Preservar regra comercial documentada e não gerar cobranças nesta etapa.
- Usar • como separador; cadastro fora de analytics e indexação.
- CI com timeout de um minuto por job; builds e testes pesados no GitHub.

## Review Focus

- E-mail/perfil/isenção forjados no corpo não mudam a identidade da sessão.
- Configuração ausente e contas não liberadas nunca criam empresas.
- Repetição/concorrência não cria outra transportadora; inativa fica inativa.
- Retorno externo ou caminho de login/logout não vira redirecionamento.
- Falha após criar empresa permite entrar novamente sem duplicação.

## Task 1 • Endpoint de cadastro e persistência

- [ ] Criar regressões em `tests/cadastro.test.ts` e `tests/cadastro-db.test.ts`; verificar RED.
- [x] Criar `src/lib/cadastro-inicial.ts`, `src/app/api/cadastro/route.ts` e campos Tenant.
- [x] SQL `prisma/sql/045-cadastro-inicial.sql` aditivo e idempotente.
- [x] Adicionar exceção pré-tenant explícita em `tests/perfis.test.ts`.
- [ ] Validar autorização, origem, corpo, rollback, repetição e concorrência.

## Task 2 • Jornada de interface

- [x] Regressões em `tests/cadastro-tela.test.tsx` e `tests/login-tela.test.tsx`.
- [x] Criar `/criar-conta` e `/cadastro`, com links do site e escolha de empresa.
- [x] Preservar callback local no login e manter estado após saída.
- [x] Documentar páginas MDX e inventário, sem exportar dados de cadastro.
- [x] Verificar telas reais com API de fixture em Chromium 1440/390 px.

## Task 3 • Entrega

- [x] Tipos, lint e regressões focadas; revisão pelo próprio agente.
- [ ] Commit seletivo e PR na `avilaops/P006`; CI integral e imagem.
- [ ] Aplicar/reaplicar SQL e RLS antes do código, configurar liberação autorizada.
- [ ] Merge/publicação conforme autorização vigente, saúde e limpeza da branch incorporada.
- [ ] Registrar prova e limites no Linear, distinguindo UI de confirmação real pelo usuário.
