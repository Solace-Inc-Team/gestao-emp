import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { stockOverview } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { inventoryAction } from "@/app/actions";
import { CountInput } from "./count-input";

export const metadata = { title: "Inventário" };

export default async function Inventario() {
  const user = await requireUser("dono");
  const stock = (await stockOverview(user.tenantId)).filter((p) => p.active);
  const inRoute = stock.some((p) => p.fullTransit + p.emptyTransit > 0);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Link href="/estoque" className="alvo text-accent hover:underline">Estoque</Link>
        <span className="text-muted">/</span>
        <h1 className="h1">Inventário</h1>
      </div>
      <p className="mb-6 max-w-2xl text-muted">
        Conte o que está fisicamente na loja e digite ao lado do que o sistema espera. Só as diferenças viram ajuste, cada uma registrada no histórico.
        Deixe em branco o que não foi contado.
      </p>
      {inRoute && (
        <p className="mb-6 rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-warn-fg">
          Há produtos com entregadores na rua. Eles não entram nesta contagem: conte só o que está na loja, de preferência com todos os turnos fechados.
        </p>
      )}
      <ActionForm action={inventoryAction} className="space-y-4" confirm="Registrar o inventário? As diferenças serão ajustadas no estoque.">
        <section className="panel overflow-x-auto">
          <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="text-right">Cheios</th>
                <th className="text-right">Vazios</th>
                <th className="text-right">Avariados</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <Count id={p.id} state="cheio" name={p.name} expected={p.fullStore} />
                  {p.returnable ? <Count id={p.id} state="vazio" name={p.name} expected={p.emptyStore} /> : <td className="text-right text-muted">-</td>}
                  <Count id={p.id} state="avariado" name={p.name} expected={p.damaged} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="max-w-xl">
          <label className="label" htmlFor="inv-note">Observação (opcional)</label>
          <input id="inv-note" name="note" maxLength={120} className="input" placeholder="Ex.: inventário de abertura, contado por Marina e Rita" />
        </div>
        <div className="max-w-xs">
          <label className="label" htmlFor="inv-pw">Sua senha, para confirmar</label>
          <input id="inv-pw" name="confirmPassword" type="password" autoComplete="current-password" required className="input" />
        </div>
        <button className="btn btn-primary">Registrar inventário</button>
      </ActionForm>
    </>
  );
}

function Count({ id, state, name, expected }: { id: string; state: string; name: string; expected: number }) {
  return (
    <td className="text-right">
      <CountInput name={`c:${state}:${id}`} label={`${name}, ${state}s contados`} expected={expected} />
    </td>
  );
}
