"use client";

import { useState } from "react";

// Perfil e acesso de quem entra na equipe. Entregador pode trabalhar sem celular (a lei não obriga a usar o
// aparelho pessoal): aí não tem e-mail nem senha, e a loja lança as entregas dele pela folha da rota.
export function AcessoCampos() {
  const [perfil, setPerfil] = useState("entregador");
  const [semCelular, setSemCelular] = useState(false);
  const semAcesso = perfil === "entregador" && semCelular;
  return (
    <>
      <div>
        <label className="label" htmlFor="u-role">Perfil</label>
        <select id="u-role" name="role" className="input" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
          <option value="entregador">Entregador</option>
          <option value="atendente">Atendente</option>
          <option value="caixa">Caixa (faz os acertos)</option>
          <option value="dono">Dono</option>
        </select>
      </div>
      <div className="recolhe" data-aberto={perfil === "entregador" || undefined} inert={perfil !== "entregador"}>
        <div>
          <label className="flex min-h-11 items-start gap-2 pt-1 text-sm">
            <input type="checkbox" name="semAcesso" value="true" checked={semCelular} onChange={(e) => setSemCelular(e.target.checked)} className="mt-1" />
            <span>
              Trabalha sem celular
              <span className="block text-[13px] text-muted">Não entra no sistema; sai com a folha da rota.</span>
            </span>
          </label>
        </div>
      </div>
      {/* e-mail e senha recolhem quando não há acesso; fechados, ficam fora do teclado e da validação */}
      <div className="recolhe" data-aberto={!semAcesso || undefined} inert={semAcesso}>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="u-email">E-mail de acesso</label>
            <input id="u-email" name="email" type="email" required={!semAcesso} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-pass">Senha inicial</label>
            <input id="u-pass" name="password" type="password" minLength={8} required={!semAcesso} autoComplete="new-password" className="input" />
          </div>
        </div>
      </div>
    </>
  );
}
