// Tema claro, escuro ou automático (segue o aparelho). A escolha fica no próprio aparelho
// (localStorage) e vira o atributo data-tema no <html>, que é o que o CSS lê.

export type Escolha = "auto" | "claro" | "escuro";

const CHAVE = "tema";

/** Roda no <head>, antes de desenhar: sem isso a página piscaria clara antes de escurecer. */
export const scriptTema = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=localStorage.getItem("${CHAVE}");document.documentElement.dataset.tema=t==="escuro"||(t!=="claro"&&m.matches)?"escuro":"claro"}a();m.addEventListener("change",a);window.addEventListener("storage",a)}catch(e){document.documentElement.dataset.tema="claro"}})()`;

export function lerEscolha(): Escolha {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function aplicar(escolha: Escolha) {
  try {
    if (escolha === "auto") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, escolha);
  } catch {
    // aparelho sem armazenamento: vale só nesta página
  }
  const escuro = escolha === "escuro" || (escolha === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
  // de claro para automático num aparelho claro o atributo não muda: o evento avisa mesmo assim
  window.dispatchEvent(new Event("tema"));
}

/** Para quem precisa reagir ao tema em JavaScript (as demos da página inicial). */
export const temaEscuro = {
  assinar(fn: () => void) {
    const obs = new MutationObserver(fn);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    window.addEventListener("tema", fn);
    return () => {
      obs.disconnect();
      window.removeEventListener("tema", fn);
    };
  },
  agora: () => document.documentElement.dataset.tema === "escuro",
};
