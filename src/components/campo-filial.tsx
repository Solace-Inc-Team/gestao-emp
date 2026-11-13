// Campo dos filtros de período (relatórios, fechamento, despesas): só para o dono com mais de uma filial.
// Vazio é a filial que ele está vendo; "todas" soma a empresa inteira.
export function CampoFilial({ user, valor, rotulo = true }: { user: { role: string; branchName: string; branches: unknown[] }; valor: unknown; rotulo?: boolean }) {
  if (user.role !== "dono" || user.branches.length < 2) return null;
  return (
    <div>
      <label className={rotulo ? "label" : "sr-only"} htmlFor="filial">Filial</label>
      <select id="filial" name="filial" defaultValue={valor === "todas" ? "todas" : ""} className="input">
        <option value="">{user.branchName}</option>
        <option value="todas">Todas as filiais</option>
      </select>
    </div>
  );
}
