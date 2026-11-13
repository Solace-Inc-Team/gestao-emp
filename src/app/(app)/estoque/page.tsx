import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { listProducts, listSuppliers, recentMovements, stockOverview } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { adjustAction, damagedAction, purchaseAction } from "@/app/actions";
import { PageHeader, fmtDateTime } from "@/components/ui";
import { NivelVasilhame } from "@/components/nivel-vasilhame";

export const metadata = { title: "Estoque" };

export default async function Estoque() {
  const user = await requireUser("dono", "atendente", "caixa");
  const [stock, moves, products, suppliers] = await Promise.all([
    stockOverview(user.tenantId),
    recentMovements(user.tenantId, 20),
    listProducts(user.tenantId, true),
    listSuppliers(user.tenantId, true),
  ]);
  const stateLabel = { cheio: "cheio", vazio: "vazio", avariado: "avariado" } as const;

  return (
    <>
      <PageHeader title="Estoque">
        <Link href="/fornecedores" className="btn">Fornecedores</Link>
        {user.role === "dono" && <Link href="/estoque/inventario" className="btn">Fazer inventário</Link>}
      </PageHeader>
      <section className="panel mb-6 overflow-x-auto">
        <table className="table min-w-[40rem]">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="text-right">Cheios na loja</th>
              <th className="text-right">Vazios na loja</th>
              <th className="text-right">Cheios em rota</th>
              <th className="text-right">Vazios em rota</th>
              <th className="text-right">Avariados</th>
              <th className="text-right">Total de vasilhames</th>
            </tr>
          </thead>
          <tbody>
            {stock.filter((p) => p.active).map((p, i) => (
              <tr key={p.id}>
                <td className="font-medium">
                  <div className="flex items-center gap-3">
                    {/* sem casco que volta não há cheio e vazio para comparar; o espaço fica para alinhar os nomes */}
                    {p.returnable ? (
                      <NivelVasilhame nome={p.name} cheios={p.fullStore} vazios={p.emptyStore} baixo={p.low} ordem={i} />
                    ) : (
                      <span className="w-[25px] shrink-0" />
                    )}
                    <div>
                      {p.name}
                      {!p.returnable && <p className="text-sm font-normal text-muted">não retornável</p>}
                    </div>
                  </div>
                </td>
                <td className={`num text-right text-xl font-semibold ${p.low ? "text-danger" : ""}`}>
                  {p.fullStore}
                  {p.low && <span className="block text-sm font-medium">abaixo do mínimo ({p.minStock})</span>}
                  {p.reserved > 0 && <span className="block text-sm font-normal text-muted">{p.reserved} em pedidos aguardando</span>}
                </td>
                <td className="num text-right text-xl">{p.returnable ? p.emptyStore : "-"}</td>
                <td className="num text-right text-xl">{p.fullTransit}</td>
                <td className="num text-right text-xl">{p.returnable ? p.emptyTransit : "-"}</td>
                {/* traço só quando não se aplica (produto que não volta); zero é zero */}
                <td className={`num text-right text-xl ${p.damaged ? "text-warn-fg" : "text-muted"}`}>{p.damaged}</td>
                <td className="num text-right text-xl text-muted">
                  {p.returnable ? p.fullStore + p.emptyStore + p.fullTransit + p.emptyTransit + p.damaged : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-[13px] text-muted sm:hidden">Arraste a tabela para o lado para ver todas as colunas.</p>
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
              <input id="p-full" name="full" type="number" min={1} max={100000} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-empties">Vazios devolvidos</label>
              <input id="p-empties" name="empties" type="number" min={0} defaultValue={0} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-supplier">Fornecedor</label>
              <select id="p-supplier" name="supplierId" className="input" defaultValue="">
                <option value="">Não informar</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-note">Nota fiscal ou observação</label>
              <input id="p-note" name="note" maxLength={120} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="p-cost">Valor pago (opcional)</label>
              <input id="p-cost" name="cost" inputMode="decimal" maxLength={12} className="input" placeholder="0,00" />
            </div>
            <div>
              <label className="label" htmlFor="p-method">Pago com</label>
              <select id="p-method" name="costMethod" className="input" defaultValue="boleto">
                <option value="boleto">Boleto</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
            <p className="text-[13px] text-muted sm:col-span-2">Com o valor preenchido, a compra já entra nas despesas de hoje.</p>
            <button className="btn btn-primary sm:col-span-2 sm:justify-self-start">Registrar entrada</button>
          </ActionForm>
        </section>

        <section className="panel p-4">
          <h2 className="h2 mb-1">Registrar avaria</h2>
          <p className="mb-3 text-sm text-muted">Botijão vazando, galão trincado, lacre rompido. Sai do estoque de venda e fica separado até voltar ao fornecedor.</p>
          <ActionForm action={damagedAction} className="grid gap-3 sm:grid-cols-2" reset>
            <div>
              <label className="label" htmlFor="d-product">Produto</label>
              <select id="d-product" name="productId" className="input" required>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-from">Estava</label>
              <select id="d-from" name="from" className="input">
                <option value="cheio">Cheio</option>
                <option value="vazio">Vazio</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-qty">Quantidade</label>
              <input id="d-qty" name="quantity" type="number" min={1} max={100000} required defaultValue={1} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="d-note">Defeito</label>
              <input id="d-note" name="note" required minLength={3} maxLength={120} className="input" />
            </div>
            <button className="btn sm:col-span-2 sm:justify-self-start">Registrar avaria</button>
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
                  <option value="avariado">Avariados</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="a-counted">Quantidade contada</label>
                <input id="a-counted" name="counted" type="number" min={0} max={100000} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="a-reason">Motivo</label>
                <input id="a-reason" name="reason" required minLength={3} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a-pw">Sua senha, para confirmar</label>
                <input id="a-pw" name="confirmPassword" type="password" autoComplete="current-password" required className="input sm:max-w-xs" />
              </div>
              <button className="btn sm:col-span-2 sm:justify-self-start">Registrar ajuste</button>
            </ActionForm>
          </section>
        )}
      </div>

      <section className="panel mt-6 overflow-x-auto">
        <h2 className="h2 border-b border-line px-4 py-3">Últimas movimentações</h2>
        {/* no celular cada movimentação vira um bloco empilhado, em vez de seis colunas espremidas */}
        <table className="table tabela-pilha movimentos sm:min-w-[44rem]">
          <thead>
            <tr><th>Quando</th><th>Produto</th><th>Onde</th><th className="text-right">Qtd.</th><th>Motivo</th><th>Por</th></tr>
          </thead>
          <tbody>
            {moves.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                <td>{m.productName}, {stateLabel[m.state]}</td>
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
