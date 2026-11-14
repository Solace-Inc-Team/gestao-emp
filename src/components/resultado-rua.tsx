import Link from "next/link";
import { ActionForm } from "./action-form";
import { deliverAction } from "@/app/actions";
import { formatBRL } from "@/lib/money";

/**
 * O resultado de uma entrega lançado pela loja, para o entregador que não usa celular (ou que avisou por
 * telefone): "Entregue" num clique, com confirmação; parcial ou não entregue, na tela do pedido.
 */
export function ResultadoRua({ id, numero, totalCents, pagamento }: { id: string; numero: number; totalCents: number; pagamento: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ActionForm action={deliverAction} confirm={`Confirmar a entrega do pedido #${numero}? Total ${formatBRL(totalCents)}, ${pagamento.toLowerCase()}.`}>
        <input type="hidden" name="orderId" value={id} />
        <button className="btn h-8 px-3 text-[13px]">Entregue</button>
      </ActionForm>
      <Link href={`/pedidos/${id}#resultado`} className="tap text-[13px] text-muted hover:text-fg">
        Parcial ou não entregue
      </Link>
    </div>
  );
}
