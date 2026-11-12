import { ActionForm } from "./action-form";
import { Revelar } from "./revelar";
import { occurrenceAction } from "@/app/actions";
import { occurrenceKinds } from "@/domain/orders";
import { PartialDeliveryForm, type PartialOrder } from "./partial-delivery-form";

type Item = { id: string; name: string; quantity: number; unitPriceCents: number };

/** Os dois desvios da entrega: chegou só parte do pedido, ou não deu para entregar. Usados no celular do entregador e na tela do pedido. */
export function DeliveryExceptions({ order, items, forDriver = false }: { order: PartialOrder; items: Item[]; forDriver?: boolean }) {
  const orderId = order.id;
  return (
    // botões secundários de verdade: no celular do entregador são alvo de dedo, não texto solto
    <div className="grid gap-2">
      <Revelar label="Entreguei só uma parte">
        <PartialDeliveryForm order={order} items={items} forDriver={forDriver} />
      </Revelar>
      <Revelar label="Não consegui entregar">
        <ActionForm action={occurrenceAction} className="space-y-3 rounded-lg bg-subtle p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <div>
            <label className="label" htmlFor={`okind-${orderId}`}>O que aconteceu</label>
            <select id={`okind-${orderId}`} name="kind" className="input" required defaultValue="">
              <option value="" disabled>Escolha</option>
              {Object.entries(occurrenceKinds).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`onote-${orderId}`}>Detalhe (opcional)</label>
            <input id={`onote-${orderId}`} name="note" maxLength={160} className="input" />
          </div>
          <p className="text-[13px] text-muted">
            O pedido volta para a fila da loja e os produtos saem da conta {forDriver ? "sua" : "do entregador"}.
          </p>
          <button className="btn btn-danger w-full">Registrar e devolver à fila</button>
        </ActionForm>
      </Revelar>
    </div>
  );
}
