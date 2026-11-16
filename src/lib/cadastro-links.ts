export const CADASTRO_LOGIN = "/login?callbackUrl=%2Fcadastro";
export const CADASTRO_AUTH = "https://auth.avilaops.com/criar?app=tms&returnTo=" +
  encodeURIComponent("https://tms.avilaops.com" + CADASTRO_LOGIN);

/** Destinos de áreas conhecidos, sem queries, esquemas ou escapes de URL. */
export function callbackLocal(valor: string | null): string {
  if (!valor || !/^\/(?:cadastro|empresa|dashboard|driver|portal)(?:\/[a-zA-Z0-9_-]+)*$/.test(valor)) return "/";
  return valor;
}
