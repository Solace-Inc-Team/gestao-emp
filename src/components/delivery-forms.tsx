import { ActionForm } from "./action-form";
import { occurrenceAction, partialDeliveryAction } from "@/app/actions";
import { occurrenceKinds } from "@/domain/orders";

type Item = { id: string; name: string; quantity: number };

/** Os dois desvios da entrega: chegou só parte do pedido, ou não deu para entregar. Usados no celular do entregador e na tela do pedido. */
export function DeliveryExceptions({ orderId, items }: { orderId: string; items: Item[] }) {
  return (
    <div className="space-y-1">
      <details>
        <summary className="tap cursor-pointer text-[13px] text-muted hover:text-fg">Entreguei só uma parte</summary>
        <ActionForm action={partialDeliveryAction} className="mt-2 space-y-3 rounded-lg bg-subtle p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <p className="text-[13px] text-muted">Informe quanto o cliente recebeu de cada item. O total é refeito e o resto volta com você.</p>
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3">
              <label htmlFor={`qty-${i.id}`} className="min-w-0 flex-1">
                {i.name} <span className="text-muted">(pedido: {i.quantity})</span>
              </label>
              <input
                id={`qty-${i.id}`}
                name={`qty:${i.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={i.quantity}
                defaultValue={i.quantity}
                required
                className="input num w-20 text-center"
              />
            </div>
          ))}
          <div>
            <label className="label" htmlFor={`pnote-${orderId}`}>Por quê</label>
            <input id={`pnote-${orderId}`} name="note" required minLength={3} maxLength={160} className="input" placeholder="Ex.: cliente só quis 1 galão" />
          </div>
          <button className="btn w-full">Registrar entrega parcial</button>
        </ActionForm>
      </details>
      <details>
        <summary className="tap cursor-pointer text-[13px] text-muted hover:text-fg">Não consegui entregar</summary>
        <ActionForm action={occurrenceAction} className="mt-2 space-y-3 rounded-lg bg-subtle p-3">
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
          <p className="text-[13px] text-muted">O pedido volta para a fila da loja e os produtos saem da sua conta.</p>
          <button className="btn btn-danger w-full">Registrar e devolver à fila</button>
        </ActionForm>
      </details>
    </div>
  );
}
