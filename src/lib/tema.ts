// Tema claro, escuro ou automático (segue o aparelho). A escolha fica no próprio aparelho
// (localStorage) e vira o atributo data-tema no <html>, que é o que o CSS lê.
// Sem escolha guardada, o sistema abre escuro: é a identidade da página inicial e do login,
// que são sempre escuros; o claro e o automático ficam a um toque no botão de tema.

export type Escolha = "auto" | "claro" | "escuro";

const CHAVE = "tema";

/** Roda no <head>, antes de desenhar: sem isso a página piscaria clara antes de escurecer. */
export const scriptTema = `(function(){try{var m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=localStorage.getItem("${CHAVE}");document.documentElement.dataset.tema=t!=="claro"&&(t!=="auto"||m.matches)?"escuro":"claro"}a();m.addEventListener("change",a);window.addEventListener("storage",a)}catch(e){document.documentElement.dataset.tema="escuro"}})()`;

export function lerEscolha(): Escolha {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "auto" ? t : "escuro";
  } catch {
    return "escuro";
  }
}

/**
 * Guarda a escolha e troca o tema. Com `origem` (o centro do botão clicado), o tema novo nasce
 * dali num círculo que cobre a tela: a troca tem uma causa visível em vez de um corte seco.
 */
export function aplicar(escolha: Escolha, origem?: { x: number; y: number }) {
  try {
    // o automático também fica guardado: sem nada guardado, vale o escuro padrão
    localStorage.setItem(CHAVE, escolha);
  } catch {
    // aparelho sem armazenamento: vale só nesta página
  }
  const html = document.documentElement;
  const novo = escolha === "escuro" || (escolha === "auto" && matchMedia("(prefers-color-scheme: dark)").matches) ? "escuro" : "claro";
  const trocar = () => {
    html.dataset.tema = novo;
    // de claro para automático num aparelho claro o atributo não muda: o evento avisa mesmo assim
    window.dispatchEvent(new Event("tema"));
  };
  const animar =
    origem && novo !== html.dataset.tema && "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!animar) return trocar();
  // o raio vai até o canto mais distante do botão, para o círculo cobrir a tela toda
  const raio = Math.hypot(Math.max(origem.x, innerWidth - origem.x), Math.max(origem.y, innerHeight - origem.y));
  html.style.setProperty("--tema-x", `${origem.x}px`);
  html.style.setProperty("--tema-y", `${origem.y}px`);
  html.style.setProperty("--tema-r", `${raio}px`);
  html.dataset.trocandoTema = "";
  document.startViewTransition(trocar).finished.finally(() => delete html.dataset.trocandoTema);
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
