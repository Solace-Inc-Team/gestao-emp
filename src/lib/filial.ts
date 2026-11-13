// Relatórios e despesas: o dono com mais de uma filial pode ver todas juntas (?filial=todas);
// fora isso, cada um vê a filial atual (a sua, ou a escolhida pelo dono no menu).
export function filialDoRelatorio(u: { role: string; branchId: string; branches: unknown[] }, sp: Record<string, string | string[] | undefined>) {
  return u.role === "dono" && u.branches.length > 1 && sp.filial === "todas" ? null : u.branchId;
}
