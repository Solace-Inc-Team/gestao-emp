import { ContornoBotijao, ContornoGalao } from "@/app/inicio/prateleira";

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
