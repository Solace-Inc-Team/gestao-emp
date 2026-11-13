import { Fragment } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { otpauthUri } from "@/lib/totp";
import { changePasswordAction, confirmTotpAction, disableTotpAction, startTotpAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Conta e segurança" };

export default async function Senha() {
  const user = await requireUser();
  const back = user.platformAdmin ? "/admin" : user.role === "entregador" ? "/entregador" : "/";
  const [u] = await db.select({ secret: users.totpSecret, enabled: users.totpEnabled }).from(users).where(eq(users.id, user.userId));
  const settingUp = !!u.secret && !u.enabled;
  const qr = settingUp ? await QRCode.toString(otpauthUri(u.secret!, user.email), { type: "svg", margin: 1, width: 176 }) : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href={back} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Voltar
      </Link>
      <h1 className="h1 mt-6">Conta e segurança</h1>
      <p className="mt-1 text-muted">{user.email}</p>

      <section className="panel mt-8 p-5">
        <h2 className="h2">Senha</h2>
        <ActionForm action={changePasswordAction} className="mt-4 space-y-4" reset>
          <div>
            <label className="label" htmlFor="current">Senha atual</label>
            <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="next">Nova senha</label>
              <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Repita a nova senha</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
            </div>
          </div>
          <button className="btn btn-primary">Salvar nova senha</button>
        </ActionForm>
      </section>

      <section className="panel mt-6 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="h2">Verificação em duas etapas</h2>
            <p className="mt-1 text-[13px] text-muted">
              Além da senha, o login pede um código do app autenticador do celular (Google Authenticator, Authy, 1Password).
            </p>
          </div>
          {u.enabled && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
              Ativa
            </span>
          )}
        </div>

        {u.enabled ? (
          <ActionForm action={disableTotpAction} className="mt-5 flex flex-wrap items-end gap-3" reset confirm="Desativar a verificação em duas etapas?">
            <div className="min-w-56 flex-1">
              <label className="label" htmlFor="pw">Senha, para desativar</label>
              <input id="pw" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
            <button className="btn btn-danger">Desativar</button>
          </ActionForm>
        ) : settingUp ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr]">
            <div
              className="size-[176px] overflow-hidden rounded-lg border border-line bg-white"
              role="img"
              aria-label="QR code para o app autenticador"
              dangerouslySetInnerHTML={{ __html: qr! }}
            />
            <div className="min-w-0 flex-1">
              <ol className="list-decimal space-y-1.5 pl-4 text-[13px] text-muted">
                <li>No app autenticador, adicione uma conta pelo QR code.</li>
                <li>Sem câmera? Digite a chave: <code className="num text-fg">
                    {u.secret!.match(/.{1,4}/g)!.map((g, i) => (
                      <Fragment key={i}>{i ? " " : ""}<span className="whitespace-nowrap">{g}</span></Fragment>
                    ))}
                  </code></li>
                <li>Digite abaixo o código de 6 dígitos que aparecer.</li>
              </ol>
              <ActionForm action={confirmTotpAction} className="mt-4 flex flex-wrap items-end gap-3">
                <div className="w-36">
                  <label className="label" htmlFor="code">Código</label>
                  <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="input num tracking-[0.2em]" />
                </div>
                <button className="btn btn-primary">Ativar</button>
              </ActionForm>
            </div>
          </div>
        ) : (
          <ActionForm action={startTotpAction} className="mt-5">
            <button className="btn">
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
              Configurar
            </button>
          </ActionForm>
        )}
      </section>
      <p className="mt-10 flex gap-4 text-[13px] text-muted">
        <Link href="/termos" className="hover:text-fg">Termos de uso</Link>
        <Link href="/privacidade" className="hover:text-fg">Política de privacidade</Link>
      </p>
    </main>
  );
}
