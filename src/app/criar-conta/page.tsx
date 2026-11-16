import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicPageFrame, PublicShell } from "@/components/publico/PublicShell";
import { CADASTRO_AUTH, CADASTRO_LOGIN } from "@/lib/cadastro-links";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false, follow: false } };
export default function CriarConta() {
  return <PublicShell><PublicPageFrame eyebrow="TMS • PRIMEIROS PASSOS" title="Uma conta. Sua transportadora." description="Crie sua conta Avila Ops e continue o cadastro da sua empresa no TMS.">
    <section className="public-prose">
      <h2>Do cadastro ao primeiro acesso</h2>
      <ol><li><strong>Crie sua conta.</strong> Informe nome e e-mail no login único.</li><li><strong>Confirme o e-mail.</strong> Abra o link recebido e escolha sua senha.</li><li><strong>Cadastre a transportadora.</strong> Entre com sua conta e informe os dados da empresa quando o cadastro estiver liberado.</li><li><strong>Acesse o TMS.</strong> Você administra sua empresa e os acessos da equipe. Use Sair da conta ao terminar.</li></ol>
      <p>A criação da identidade é separada da contratação da transportadora. Se você já tem uma conta Avila Ops, pode continuar com ela.</p>
      <div className="public-actions"><a className="public-button public-button-primary" href={CADASTRO_AUTH}>Criar minha conta <ArrowRight size={18} aria-hidden="true" /></a><a className="public-button" href={CADASTRO_LOGIN}>Já tenho conta • continuar</a></div>
      <h2>Condições comerciais do TMS</h2>
      <p><strong>R$350 por mês</strong> de base por transportadora. A cada usuário criado, a taxa é de <strong>R$99</strong>, com acréscimo de <strong>R$60 na mensalidade</strong>.</p>
      <p>A composição final e as condições aplicáveis à sua empresa são confirmadas com a equipe antes da contratação. Criar sua conta de acesso não autoriza uma cobrança.</p>
      <p><CheckCircle2 size={18} aria-hidden="true" /> Sua conta pode acessar somente as empresas às quais estiver vinculada.</p>
      <p><a href="https://avilaops.com/contato/">Falar sobre a contratação</a> • <a href="/login">Acessar uma empresa já cadastrada</a></p>
    </section>
  </PublicPageFrame></PublicShell>;
}
