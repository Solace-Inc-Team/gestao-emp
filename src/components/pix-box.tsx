import QRCode from "qrcode";
import { CopyButton } from "./copy-button";

/** QR do Pix e o código copia e cola, para o cliente pagar pelo celular. */
export async function PixBox({ code, size = 176 }: { code: string; size?: number }) {
  const qr = await QRCode.toString(code, { type: "svg", margin: 1, width: size });
  return (
    // no celular o QR vem em cima e o código embaixo, na largura toda; lado a lado, o código virava uma coluna estreita
    <div className="flex flex-col items-start gap-4 sm:flex-row">
      {/* SVG gerado aqui a partir do código Pix, sem nada digitado por usuário */}
      <div className="shrink-0 rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="w-full min-w-0 flex-1 space-y-2">
        <p className="text-[13px] text-muted">Pix copia e cola</p>
        <p className="num rounded-md bg-subtle p-2 text-[12px] break-all">{code}</p>
        <CopyButton text={code} />
      </div>
    </div>
  );
}
