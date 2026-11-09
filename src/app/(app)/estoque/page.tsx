import { requireUser } from "@/lib/auth";
import { listProducts, recentMovements, stockOverview } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { adjustAction, purchaseAction } from "@/app/actions";
import { PageHeader, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Estoque" };

export default async function Estoque() {
  const user = await requireUser("dono", "atendente");
  const [stock, moves, products] = await Promise.all([
    stockOverview(user.tenantId),
    recentMovements(user.tenantId),
    listProducts(user.tenantId, true),
  ]);

  return (
    <>
      <PageHeader title="Estoque" />
      <section className="panel mb-6 overflow-x-auto">
        <table className="table min-w-[40rem]">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="text-right">Cheios na loja</th>
              <th className="text-right">Vazios na loja</th>
              <th className="text-right">Cheios em rota</th>
              <th className="text-right">Vazios em rota</th>
              <th className="text-right">Total de vasilhames</th>
            </tr>
          </thead>
          <tbody>
            {stock.filter((p) => p.active).map((p) => (
              <tr key={p.id}>
                <td className="font-medium">
                  {p.name}
                  {!p.returnable && <p className="text-sm font-normal text-muted">não retornável</p>}
                </td>
                <td className={`num text-right text-xl font-semibold ${p.low ? "text-danger" : ""}`}>
                  {p.fullStore}
                  {p.low && <span className="block text-sm font-medium">abaixo do mínimo ({p.minStock})</span>}
                </td>
                <td className="num text-right text-xl">{p.returnable ? p.emptyStore : "-"}</td>
                <td className="num text-right text-xl text-accent">{p.fullTransit}</td>
                <td className="num text-right text-xl text-accent">{p.returnable ? p.emptyTransit : "-"}</td>
                <td className="num text-right text-xl text-muted">
                  {p.returnable ? p.fullStore + p.emptyStore + p.fullTransit + p.emptyTransit : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          O total de vasilhames deve ficar estável: cada venda com troca tira um cheio e devolve um vazio. Se ele cair, há botijão ou galão sem retorno.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="h2 mb-1">Entrada de compra</h2>
          <p className="mb-3 text-sm text-muted">Cheios recebidos do fornecedor e vazios entregues a ele na troca.</p>
          <ActionForm action={purchaseAction} className="grid gap-3 sm:grid-cols-2" reset>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-product">Produto</label>
              <select id="p-product" name="productId" className="input" required>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-full">Cheios recebidos</label>
              <input id="p-full" name="full" type="number" min={1} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-empties">Vazios devolvidos</label>
              <input id="p-empties" name="empties" type="number" min={0} defaultValue={0} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-note">Nota ou fornecedor</label>
              <input id="p-note" name="note" className="input" />
            </div>
            <button className="btn btn-primary sm:col-span-2 sm:justify-self-start">Registrar entrada</button>
          </ActionForm>
        </section>

        {user.role === "dono" && (
          <section className="panel p-4">
            <h2 className="h2 mb-1">Ajuste por contagem</h2>
            <p className="mb-3 text-sm text-muted">Informe quanto existe fisicamente na loja. A diferença fica registrada com o motivo.</p>
            <ActionForm action={adjustAction} className="grid gap-3 sm:grid-cols-2" reset confirm="Registrar o ajuste de estoque?">
              <div>
                <label className="label" htmlFor="a-product">Produto</label>
                <select id="a-product" name="productId" className="input" required>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="a-state">Tipo</label>
                <select id="a-state" name="state" className="input">
                  <option value="cheio">Cheios</option>
                  <option value="vazio">Vazios</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="a-counted">Quantidade contada</label>
                <input id="a-counted" name="counted" type="number" min={0} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="a-reason">Motivo</label>
                <input id="a-reason" name="reason" required minLength={3} className="input" />
              </div>
              <button className="btn sm:col-span-2 sm:justify-self-start">Registrar ajuste</button>
            </ActionForm>
          </section>
        )}
      </div>

      <section className="panel mt-6 overflow-x-auto">
        <h2 className="h2 border-b border-line px-4 py-3">Últimas movimentações</h2>
        <table className="table min-w-[44rem]">
          <thead>
            <tr><th>Quando</th><th>Produto</th><th>Onde</th><th className="text-right">Qtd.</th><th>Motivo</th><th>Por</th></tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                <td>{m.productName}, {m.state === "cheio" ? "cheio" : "vazio"}</td>
                <td>{m.driverName ?? "Loja"}</td>
                <td className={`num text-right font-semibold ${m.quantity < 0 ? "text-danger" : "text-ok"}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </td>
                <td>{m.reason}</td>
                <td className="text-muted">{m.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
