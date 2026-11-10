import Link from "next/link";
import { HandCoins } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listDebtors } from "@/domain/receivables";
import { Money, PageHeader, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Fiado" };

const daysSince = (d: string | Date) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);

export default async function Fiado() {
  const user = await requireUser("dono", "atendente", "caixa");
  const debtors = await listDebtors(user.tenantId);
  const total = debtors.reduce((s, d) => s + d.owed, 0);

  return (
    <>
      <PageHeader title="Fiado" description="Clientes com compra fiado entregue e ainda não paga, da dívida mais antiga para a mais nova." />

      <section className="panel mb-6 grid sm:grid-cols-2 sm:divide-x sm:divide-line">
        <div className="p-5">
          <p className="text-[13px] text-muted">A receber</p>
          <Money cents={total} className="mt-1 block text-[2rem] leading-tight font-semibold tracking-[-0.03em]" />
        </div>
        <div className="border-t border-line p-5 sm:border-t-0">
          <p className="text-[13px] text-muted">Clientes devendo</p>
          <p className="num mt-1 text-[2rem] leading-tight font-semibold tracking-[-0.03em]">{debtors.length}</p>
        </div>
      </section>

      <div className="panel overflow-x-auto">
        {debtors.length ? (
          <table className="table min-w-[40rem]">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Deve desde</th>
                <th>Último pagamento</th>
                <th className="text-right">Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => {
                const age = daysSince(d.oldest);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/clientes/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                      {d.phone && <p className="text-[13px] text-muted">{d.phone}</p>}
                    </td>
                    <td className={age > 30 ? "font-medium text-warn-fg" : "text-muted"}>
                      {age === 0 ? "hoje" : `há ${age} ${age === 1 ? "dia" : "dias"}`}
                    </td>
                    <td className="text-muted">{d.last_payment ? fmtDateTime(new Date(d.last_payment)) : "nunca"}</td>
                    <td className="text-right font-medium"><Money cents={d.owed} /></td>
                    <td className="text-right">
                      <Link href={`/clientes/${d.id}#receber`} className="btn h-8 text-[13px]">Receber</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <HandCoins size={28} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
            <p className="mt-3 font-medium">Ninguém devendo</p>
            <p className="mt-1 text-muted">Vendas fiado entregues aparecem aqui até o cliente pagar.</p>
          </div>
        )}
      </div>
    </>
  );
}
