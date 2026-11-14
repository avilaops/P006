# P006 • Renderização e contraste

## Diagnóstico de 14/11/2026

O relatório enviado pelo proprietário registra desempenho 100, acessibilidade 96, práticas recomendadas 100 e SEO 100. FCP e LCP de 1,1 s, TBT 0 ms e CLS 0 são dados desse relatório, não uma medição de campo. A estimativa de 550 ms para CSS não representa um ganho já medido.

Uma leitura independente com Chromium, rede sem cache e axe-core reproduziu 27 elementos com contraste insuficiente em 390 px e 28 em 1440 px. O HTML inicial também carregava 99.610 bytes descomprimidos de CSS operacional, transferidos em cerca de 18,4 KB nessa leitura, além dos estilos públicos e de fontes.

## Correção

O layout raiz passa a carregar um reset pequeno, na camada CSS `base`, com a mesma ordem de camadas do Tailwind. O stylesheet operacional permanece nos layouts de dashboard, motorista, portal, login, empresa, plataforma e rastreio. As páginas públicas e os sites publicados pelo editor utilizam seus próprios estilos.

Links públicos para login e rastreio carregam seus recursos quando acessados, evitando antecipar CSS operacional para visitantes da apresentação.

Textos secundários, legendas, metadados de artigos e rodapé utilizam uma cor com contraste suficiente nos fundos claros. Os textos sobre o CTA azul utilizam branco. O conteúdo e a estrutura das páginas permanecem iguais.

O axe-core da versão candidata retornou zero violações WCAG A/AA na landing em celular e desktop. Cinquenta e sete testes selecionados passaram, assim como tipos e lint. O navegador confirmou utilitários de cor, espaçamento e layout em oito entradas operacionais, incluindo as áreas de administração, motorista e cliente. A compilação e a suíte integral são verificadas no CI; medidas de desenvolvimento não são apresentadas como resultado de produção.

A revisão independente não encontrou problemas críticos ou importantes. O ajuste visual indicado no hover do rodapé foi incorporado, mantendo a indicação azul quando o ponteiro passa pelo link.

## Avaliação das outras sugestões

- AMP Optimizer trabalha com documentos AMP. O P006 usa o App Router do Next.js 16, que removeu o suporte integrado a AMP. As otimizações foram aplicadas ao CSS da aplicação existente.
- Os polyfills citados no relatório correspondem ao código de compatibilidade distribuído pelo Next.js. A correção não modifica pacotes instalados nem remove compatibilidade do runtime.
- A contagem de 420 elementos não demonstra, isoladamente, uma falha de desempenho. O relatório apresentado não indica TBT ou CLS a corrigir.
- O recurso experimental `inlineCss` do Next.js é global e duplica estilos no payload inicial. Não foi necessário ativá-lo para eliminar o CSS dos painéis da entrada pública.

## Referências

- [AMP Optimizer • documentação](https://amp.dev/documentation/guides-and-tutorials/optimize-and-measure/amp-optimizer-guide/)
- [Next.js 16 • remoção do suporte a AMP](https://nextjs.org/docs/app/guides/upgrading/version-16#amp-support)
- [Next.js • inlineCss e limites](https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss)
- [WCAG 2.2 • contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Chrome • tamanho do DOM](https://developer.chrome.com/docs/performance/insights/dom-size)

Evidências locais: `C:/Users/nicol/.config/avilaops/p006-performance-20261114/`.
