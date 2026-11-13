// contornos do galão e do botijão em linha; o nível é desenhado por baixo deles
function ContornoGalao() {
  return (
    <>
      <path d="M8 2.5h6M8.5 2.5v3.5h5V2.5" />
      <rect x="2.5" y="6" width="17" height="25" rx="4.5" />
    </>
  );
}

function ContornoBotijao() {
  return (
    <>
      <path d="M6.5 7.5V4.5a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v3" />
      <rect x="2.5" y="7.5" width="17" height="21" rx="7" />
      <path d="M5 28.5v2.5h12v-2.5" />
    </>
  );
}

// o produto não diz se é gás ou água; pelo nome dá para saber na quase totalidade dos casos
const ehGas = (nome: string) => /g[aá]s|botij|\bp\s?(2|5|8|13|20|45)\b/i.test(nome);

/**
 * O vasilhame do produto em linha, com o nível de cheios entre os que estão na loja:
 * cheio por inteiro quando não há vazio parado, vazio quando só sobrou casco.
 * Abaixo do mínimo o desenho fica na cor de alerta, junto com o número ao lado.
 */
export function NivelVasilhame({ nome, cheios, vazios, baixo, ordem = 0 }: { nome: string; cheios: number; vazios: number; baixo: boolean; ordem?: number }) {
  const gas = ehGas(nome);
  const total = cheios + vazios;
  const nivel = total ? cheios / total : 0;
  return (
    <svg
      viewBox="0 0 22 32"
      aria-hidden="true"
      className={`nivel-vasilhame h-9 w-[25px] shrink-0 ${baixo ? "text-danger" : "text-muted"}`}
      style={{ "--nivel": nivel, "--i": ordem } as React.CSSProperties}
    >
      {/* líquido com a forma de dentro do vasilhame; o CSS corta por cima até o nível */}
      <rect className="nivel" x="4" y={gas ? 9 : 7.5} width="14" height={gas ? 18 : 22} rx={gas ? 5.6 : 3.2} />
      {gas ? <ContornoBotijao /> : <ContornoGalao />}
    </svg>
  );
}
