import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CADASTRO_LOGIN } from "@/lib/cadastro-links";
import CadastroEmpresa from "./CadastroEmpresa";

export const metadata: Metadata = { title: "Cadastrar transportadora", robots: { index: false, follow: false } };
export default async function Cadastro() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(CADASTRO_LOGIN);
  return <CadastroEmpresa />;
}
