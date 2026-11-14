import { requireUser } from "@/lib/auth";
import { getSettings } from "@/domain/queries";
import { ActionForm } from "@/components/action-form";
import { saveSettingsAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { ConfigNav } from "@/components/config-nav";

export const metadata = { title: "Regras da casa" };

export default async function Configuracoes() {
  const user = await requireUser("dono");
  const s = await getSettings(user.tenantId);
  return (
    <>
      <ConfigNav />
      <PageHeader title="Regras da casa" description="Valem para toda a equipe a partir do próximo pedido." />
      <section className="panel max-w-xl p-4">
        <ActionForm action={saveSettingsAction} className="space-y-4">
          <input type="hidden" name="section" value="regras" />
          <div>
            <label className="label" htmlFor="staffDiscountPct">Desconto máximo que a equipe pode dar (%)</label>
            <input id="staffDiscountPct" name="staffDiscountPct" type="number" min={0} max={100} required defaultValue={s.staffDiscountPct} className="input w-28" />
            <p className="mt-1 text-[13px] text-muted">Sobre o valor dos produtos. Acima disso, só você lança. Use 0 para ninguém da equipe dar desconto.</p>
          </div>
          <div>
            <label className="label" htmlFor="lateAfterMinutes">Pedido conta como atrasado depois de (minutos)</label>
            <input id="lateAfterMinutes" name="lateAfterMinutes" type="number" min={10} max={1440} required defaultValue={s.lateAfterMinutes} className="input w-28" />
            <p className="mt-1 text-[13px] text-muted">Contado desde o lançamento. Os atrasados ficam em destaque na tela de Entregas e no Painel.</p>
          </div>
          <button className="btn btn-primary">Salvar regras</button>
        </ActionForm>
      </section>
    </>
  );
}
