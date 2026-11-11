import { NextResponse, type NextRequest } from "next/server";

// quem chega na raiz sem sessão vê a apresentação; logado, cai direto no painel
export function proxy(request: NextRequest) {
  if (request.cookies.has("sessao")) return;
  return NextResponse.rewrite(new URL("/inicio", request.url));
}

export const config = { matcher: "/" };
