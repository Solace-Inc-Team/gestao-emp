import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAudit, listUsers } from "@/domain/queries";
import { parsePeriod } from "@/lib/period";
import { areas, descrever, type Area } from "@/lib/audit-text";
import { Empty, PageHeader, roleLabel } from "@/components/ui";

export const metadata = { title: "Auditoria" };

// para onde leva cada registro, quando há uma tela daquilo
const destino = (entity: string, id: string | null) =>
  !id
    ? null
    : ({ order: `/pedidos/${id}`, shift: `/caixa/${id}`, customer: `/clientes/${id}`, product: "/produtos", supplier: "/fornecedores", expense: "/despesas", user: "/equipe" } as Record<string, string>)[entity] ?? null;

const dia = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const chaveDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

export default async function Auditoria({ searchParams }: PageProps<"/auditoria">) {
  const user = await requireUser("dono");
  const sp = await searchParams;
  const { fromStr, toStr, from, to } = parsePeriod(sp);
  const pessoa = typeof sp.pessoa === "string" ? sp.pessoa : "";
  const area = typeof sp.area === "string" && sp.area in areas ? (sp.area as Area) : "";
  const pagina = Math.max(0, Number(sp.pagina) || 0);

  const [equipe, { rows, nomes, more }] = await Promise.all([
    listUsers(user.tenantId),
    listAudit(user.tenantId, { from, to, userId: pessoa || undefined, area: area || undefined, page: pagina }),
  ]);
  const link = (p: number) => `/auditoria?${new URLSearchParams({ de: fromStr, ate: toStr, ...(pessoa && { pessoa }), ...(area && { area }), ...(p && { pagina: String(p) }) })}`;

  // agrupa por dia, mantendo a ordem do mais novo para o mais antigo
  const dias: { chave: string; titulo: string; itens: typeof rows }[] = [];
  for (const r of rows) {
    const chave = chaveDia.format(r.createdAt);
    if (dias.at(-1)?.chave !== chave) dias.push({ chave, titulo: dia.format(r.createdAt), itens: [] });
    dias.at(-1)!.itens.push(r);
  }

  return (
    <>
      <PageHeader
        title="Auditoria"
        
      />
      <form className="panel mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_auto] lg:items-end">
        <div>
          <label className="label" htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={fromStr} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={toStr} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="pessoa">Pessoa</label>
          <select id="pessoa" name="pessoa" defaultValue={pessoa} className="input">
            <option value="">Todas</option>
            {equipe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({roleLabel[u.role].toLowerCase()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="area">Área</label>
          <select id="area" name="area" defaultValue={area} className="input">
            <option value="">Todas</option>
            {Object.entries(areas).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary">Filtrar</button>
      </form>

      {dias.length ? (
        <div className="space-y-6">
          {dias.map((d) => (
            <section key={d.chave} className="panel">
              <h2 className="h2 border-b border-line px-4 py-3 first-letter:uppercase">{d.titulo}</h2>
              <ul>
                {d.itens.map((r) => {
                  const alvo = (r.entityId && nomes[r.entityId]) || "";
                  const l = descrever(r.action, r.data as Record<string, unknown> | null, nomes, alvo);
                  const href = destino(r.entity, r.entityId);
                  return (
                    <li key={r.id} className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[4rem_10rem_1fr]">
                      <span className="num text-[13px] text-muted">{hora.format(r.createdAt)}</span>
                      <span className="text-[13px] font-medium">{r.userName ?? "Equipe Solace"}</span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {href ? (
                            <Link href={href} className="hover:text-accent hover:underline">{l.titulo}</Link>
                          ) : (
                            l.titulo
                          )}
                        </p>
                        {l.detalhes.length > 0 && <p className="text-[13px] text-muted">{l.detalhes.join(" · ")}</p>}
                        {l.mudancas.length > 0 && (
                          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
                            {l.mudancas.map(([campo, antes, depois], i) => (
                              <div key={i} className="contents">
                                <dt className="text-muted">{campo}</dt>
                                <dd className="num">
                                  <s className="text-muted">{antes}</s> <span aria-hidden="true">→</span>
                                  <span className="sr-only">passou para</span> <span className="font-medium">{depois}</span>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty>Nada registrado com esses filtros.</Empty>
        </div>
      )}

      {(pagina > 0 || more) && (
        <nav className="mt-6 flex justify-between" aria-label="Páginas">
          {pagina > 0 ? <Link href={link(pagina - 1)} className="btn">Mais recentes</Link> : <span />}
          {more && <Link href={link(pagina + 1)} className="btn">Mais antigos</Link>}
        </nav>
      )}
    </>
  );
}
