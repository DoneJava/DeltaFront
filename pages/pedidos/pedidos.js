/* ============================================================
 *  Inicialização
 * ============================================================ */
(async function initPedidos() {
  try {
    bindProdutoLinks(document); // 🔗 ativa navegação por delegação
    await carregarPedidosDoCliente();
  } catch (e) {
    console.error(e);
  }
})();

/* ============================================================
 *  Navegação para produto-detalhes (delegação)
 * ============================================================ */

// qualquer elemento com [data-link-produto] navega para produto-detalhes
function bindProdutoLinks(root = document) {
  root.addEventListener("click", function (e) {
    const el = e.target.closest("[data-link-produto]");
    if (!el) return;
    const id = el.getAttribute("data-produto-id") || el.dataset.produtoId;
    if (!id) return;
    e.preventDefault();
    navigateTo("produto-detalhes", "id=" + id);
  });

  // acessível por teclado
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest("[data-link-produto]");
    if (!el) return;
    const id = el.getAttribute("data-produto-id") || el.dataset.produtoId;
    if (!id) return;
    e.preventDefault();
    navigateTo("produto-detalhes", "id=" + id);
  });
}

// atributos prontos para colar no HTML
function produtoLinkAttrs(id) {
  return `data-link-produto data-produto-id="${id}" role="link" tabindex="0"`;
}

/* ============================================================
 *  Utilidades de formatação
 * ============================================================ */

/** Formata número como BRL (com fallback manual). */
function formatCurrencyBRL(valor) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(Number(valor || 0));
  } catch {
    return `R$ ${(Number(valor || 0)).toFixed(2).replace('.', ',')}`;
  }
}

/** Formata data (ISO ou ticks) para pt-BR; retorna "-" se inválida. */
function formatDateBR(dateIsoOrTicks) {
  const dt = new Date(dateIsoOrTicks);
  if (isNaN(dt)) return "-";
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Normaliza string (remove acentos e lowercase). */
function _norm(x) {
  return String(x || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

/** Pega o primeiro valor definido entre as chaves fornecidas. */
function pick(o, ...keys) {
  for (const k of keys) {
    const v = o && o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
}

/** Extrai o ID do produto considerando vários formatos vindos do back. */
function getProdutoId(item) {
  const id = pick(item, "ProdutoID","produtoID","produtoId","IdProduto","idProduto","id");
  return id != null ? String(id) : null;
}

/* ============================================================
 *  Mapping/estilo de Status (badges e textos coloridos)
 * ============================================================ */

/** Badge colorido para status do pedido (mantido exatamente como estava). */
function statusBadge(status) {
  const s = String(status || "").trim().toLowerCase();
  const map = {
    "n": "Novo", "novo": "Novo",
    "processando": "Processando", "processamento": "Processando", "em processamento": "Processando",
    "p": "Pago", "pago": "Pago", "aprovado": "Pago",
    "s": "Em separação", "separacao": "Em separação", "em separacao": "Em separação", "em separação": "Em separação",
    "e": "Enviado", "enviado": "Enviado",
    "d": "Entregue", "entregue": "Entregue",
    "c": "Cancelado", "cancelado": "Cancelado",
    "aguardando pagamento": "Aguardando pagamento"
  };
  const label = map[s] || (status || "Status");
  const cls =
    label === "Novo"                 ? "bg-yellow-100 text-yellow-800" :
    label === "Processando"          ? "bg-amber-100 text-amber-800"  :
    label === "Pago"                 ? "bg-emerald-100 text-emerald-800" :
    label === "Aguardando pagamento" ? "bg-amber-100 text-amber-800" :
    label === "Em separação"         ? "bg-blue-100 text-blue-800" :
    label === "Enviado"              ? "bg-indigo-100 text-indigo-800" :
    label === "Entregue"             ? "bg-green-100 text-green-800" :
    label === "Cancelado"            ? "bg-rose-100 text-rose-800" :
                                       "bg-gray-100 text-gray-700";
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

/** Classe de cor do texto para status do pedido. */
function orderStatusTextClass(st) {
  const s = _norm(st);
  if (s === "novo" || s === "n") return "text-yellow-700";
  if (s === "processando" || s === "processamento" || s === "em processamento") return "text-amber-700";
  if (s === "em separacao" || s === "s") return "text-blue-700";
  if (s === "enviado" || s === "e") return "text-indigo-700";
  if (s === "entregue" || s === "d") return "text-green-700";
  if (s === "cancelado" || s === "c") return "text-rose-700";
  return "text-gray-700";
}

/** Classe de cor do texto para status do pagamento. */
function paymentStatusTextClass(st) {
  const s = _norm(st);
  if (s === "aguardando pagamento" || s === "aguardando") return "text-amber-700";
  if (s === "pago")        return "text-emerald-700";
  if (s === "recusado")    return "text-rose-700";
  if (s === "estornado")   return "text-purple-700";
  return "text-gray-700";
}

/** Rótulos dos enums do back (fallback quando não vier descrição). */
function labelMetodoPagamento(v) {
  const map = { 1: "Cartão de Crédito", 2: "Cartão de Débito", 3: "Pix", 4: "Boleto" };
  const n = Number(v);
  return map[n] || (v ?? "");
}
function labelStatusPagamento(v) {
  const map = { 1: "Aguardando pagamento", 2: "Pago", 3: "Recusado", 4: "Estornado" };
  const n = Number(v);
  return map[n] || (v ?? "");
}

/* ============================================================
 *  UI helpers (placeholders/skeleton/scroll)
 * ============================================================ */

/** Imagem de item com fallback + link opcional. */
function itemImagemHtml(url, nome, productId) {
  const safeUrl = url && typeof url === "string" ? url : "";
  const alt = nome || "Produto";
  const baseCls = "w-20 h-20 object-cover rounded-lg shadow";
  const linkAttrs = productId ? `${produtoLinkAttrs(productId)} class="cursor-pointer ${baseCls}"`
                              : `class="${baseCls}"`;
  const onerr = "this.src='/imagens/placeholder-square.png'; this.classList.add('bg-gray-100');";
  return `<img src="${safeUrl || '/imagens/placeholder-square.png'}" alt="${alt}" loading="lazy"
              onerror="${onerr}"
              ${linkAttrs} />`;
}

/** Skeleton de carregamento (cards). */
function skeletonCards(qtd) {
  const item = `
    <div class="animate-pulse border p-4 rounded-xl bg-gray-50 shadow">
      <div class="flex justify-between items-center mb-4">
        <div class="h-4 w-40 bg-gray-200 rounded"></div>
        <div class="h-4 w-24 bg-gray-200 rounded"></div>
      </div>
      <div class="flex items-center gap-4 border-b py-4">
        <div class="w-20 h-20 bg-gray-200 rounded-lg"></div>
        <div class="flex-1 space-y-2">
          <div class="h-4 w-1/3 bg-gray-200 rounded"></div>
          <div class="h-3 w-1/4 bg-gray-200 rounded"></div>
          <div class="h-3 w-1/5 bg-gray-200 rounded"></div>
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-4">
        <div class="h-4 w-28 bg-gray-200 rounded"></div>
        <div class="h-5 w-40 bg-gray-200 rounded"></div>
      </div>
    </div>
  `;
  return new Array(Math.max(1, qtd || 3)).fill(item).join("");
}

/** Aplica altura/scroll do container (usa o mesmo padrão do carrinho). */
function aplicarScrollPedidos(el, qtdCards) {
  const disponivel = Math.max(320, Math.min(window.innerHeight - 260, 600));
  if (qtdCards >= 3) {
    el.style.maxHeight = `${disponivel}px`;
    el.style.overflowY = "auto";
  } else {
    el.style.maxHeight = "";
    el.style.overflowY = "";
  }
}

/** Reaplica o scroll em resize. */
function reaplicarScrollAoRedimensionar() {
  const el = document.getElementById("containerPedidos");
  if (!el) return;
  aplicarScrollPedidos(el, el.childElementCount);
}
window.addEventListener("resize", reaplicarScrollAoRedimensionar);

/* ============================================================
 *  Fluxo principal: carregar e renderizar pedidos
 * ============================================================ */

/** Busca os pedidos do cliente autenticado e renderiza a lista. */
async function carregarPedidosDoCliente() {
  const container = document.getElementById("containerPedidos");
  container.innerHTML = skeletonCards(3);

  try {
    // 1) Validação/autenticação
    await validarTokenSilenciosamente();
    if (!window.usuarioAutenticado) {
      navigateTo("login");
      return;
    }

    const token = obterCookie("token");
    if (!token) {
      navigateTo("login");
      return;
    }

    // 2) Chamada à API
    const resp = await fetch(`${window.apiBaseUrl}/pedido/meus`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    // 3) Tratamento de status HTTP
    if (resp.status === 401 || resp.status === 403) {
      navigateTo("login");
      return;
    }
    if (resp.status === 404) {
      container.innerHTML = `<p class="text-center text-gray-500">Você ainda não fez nenhum pedido.</p>`;
      return;
    }
    if (!resp.ok) {
      throw new Error(`Falha ao carregar pedidos (${resp.status}).`);
    }

    // 4) Dados
    const pedidos = await resp.json();
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-500">Você ainda não fez nenhum pedido.</p>`;
      return;
    }

    // 5) Render
    container.innerHTML = pedidos.map(p => renderPedidoCard(p)).join("");

    // 6) Scroll (mesmo comportamento do carrinho)
    aplicarScrollPedidos(container, pedidos.length);

  } catch (erro) {
    console.error(erro);
    container.innerHTML = `
      <div class="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl">
        <p class="font-semibold">Ops! Não conseguimos carregar seus pedidos agora.</p>
        <p class="text-sm mt-1">Tente novamente em instantes.</p>
      </div>
    `;
    // navigateTo("erro-servidor-505"); // mantenha comentado se preferir
  }
}

/** Monta o card de um pedido (HTML). */
function renderPedidoCard(pedido) {
  const numero  = String(pick(pedido,"PedidoID","pedidoID","pedidoId","Numero","numero","id") ?? "-");
  const data    = formatDateBR(pick(pedido,"DataPedido","dataPedido","Data","data"));
  const frete   = formatCurrencyBRL(pick(pedido,"ValorFrete","valorFrete"));
  const total   = formatCurrencyBRL(pick(pedido,"ValorTotal","valorTotal"));
  const statusG = pick(pedido,"Status","status");
  const statusHtml = statusBadge(statusG);

  const pagamentoDescApi = pick(pedido,"MetodoPagamentoDescricao","metodoPagamentoDescricao");
  const statusPagDescApi = pick(pedido,"StatusPagamentoDescricao","statusPagamentoDescricao");
  const pagamentoNum     = pick(pedido,"MetodoPagamento","metodoPagamento");
  const statusPagNum     = pick(pedido,"StatusPagamento","statusPagamento");

  const pagamentoLabel = (pagamentoDescApi && String(pagamentoDescApi).trim() !== "")
    ? pagamentoDescApi : labelMetodoPagamento(pagamentoNum);

  const statusPagLabel = (statusPagDescApi && String(statusPagDescApi).trim() !== "")
    ? statusPagDescApi : labelStatusPagamento(statusPagNum);

  const rastreio = pick(pedido,"CodigoRastreamento","codigoRastreamento");

  const itens = Array.isArray(pedido.Itens) ? pedido.Itens
             : Array.isArray(pedido.itens) ? pedido.itens : [];

  const itensHtml = itens.map(item => {
    const nome   = pick(item,"Nome","nome") ?? "Produto";
    const qtd    = Number(pick(item,"Quantidade","quantidade")) || 1;
    const img    = pick(item,"ImagemUrl","imagemUrl","ImagemPrincipal","imagemPrincipal") ?? "";
    const prodId = getProdutoId(item);

    // preço unitário salvo no pedido (sem desconto de cupom)
    const precoUnitNum = Number(pick(item,"PrecoUnitario","precoUnitario")) || 0;
    const precoUnitHtml = `
      <p class="text-sm text-gray-600">
        Preço unit.: <span class="text-gray-900 font-medium">${formatCurrencyBRL(precoUnitNum)}</span>
      </p>`;

    // tamanho comprado
    const tamanho = pick(item,"Tamanho","tamanho","TamanhoSelecionado","tamanhoSelecionado");
    const tamanhoHtml = (tamanho && !/[;,/]/.test(String(tamanho)))
      ? `<p class="text-sm text-gray-600">Tamanho: <span class="text-gray-900 font-medium">${tamanho}</span></p>`
      : "";

    // 🔗 adiciona atributos para navegação em imagem e nome
    const linkAttrs = prodId
      ? ` ${produtoLinkAttrs(prodId)} class="cursor-pointer hover:underline text-lg font-bold text-gray-900 clamp-2 break-words"`
      : ` class="text-lg font-bold text-gray-900 clamp-2 break-words"`;

    return `
      <div class="flex items-center gap-4 border-b py-4 last:border-b-0">
        ${itemImagemHtml(img, nome, prodId)}
        <div class="flex-1">
          <h3${linkAttrs}>${nome}</h3>
          ${tamanhoHtml}
          ${precoUnitHtml}
          <p class="text-sm text-gray-600">Quantidade: <span class="text-gray-900 font-medium">${qtd}</span></p>
        </div>
      </div>`;
  }).join("");

  // desconto do pedido (não por item)
  const desconto = Number(pick(pedido,"DescontoAplicado","descontoAplicado")) || 0;
  const descontoHtml = desconto > 0
    ? `<p class="text-sm text-green-700">
         Desconto (cupom): <span class="font-bold">- ${formatCurrencyBRL(desconto)}</span>
       </p>`
    : "";

  const endereco = pedido.enderecoEntrega || pedido.EnderecoEntrega || null;
  const enderecoHtml = endereco ? `
    <div class="text-sm text-gray-700">
      <p><span class="font-semibold">Entrega:</span> ${[
        endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro,
        endereco.cidade, endereco.uf, endereco.cep
      ].filter(Boolean).join(", ")}</p>
    </div>` : "";

  const rastreioHtml = rastreio
    ? `<a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener"
         class="text-sm font-semibold text-indigo-700 hover:underline">Rastrear (${rastreio})</a>`
    : `<span class="text-sm text-gray-500">Sem código de rastreio ainda</span>`;

  return `
    <div class="border p-4 rounded-xl bg-gray-50 shadow hover:shadow-md transition">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm text-gray-600">Data da compra:
            <span class="text-gray-900 font-semibold">${data}</span>
          </p>
          <p class="text-sm text-gray-600">Pedido Nº
            <span class="text-gray-900 font-semibold">${numero}</span>
          </p>
          <p class="text-sm text-gray-600">Pagamento:
            <span class="text-gray-900 font-semibold">
              ${(pagamentoLabel && pagamentoLabel !== "0") ? pagamentoLabel : "-"}
            </span>
            ${statusPagLabel ? ` · <span class="font-semibold ${paymentStatusTextClass(statusPagLabel)}">${statusPagLabel}</span>` : ""}
          </p>
          ${enderecoHtml}
        </div>
        <div class="flex flex-col items-end gap-2">
          ${statusHtml}
          ${rastreioHtml}
        </div>
      </div>

      ${itensHtml}

      <div class="mt-4 flex items-center justify-end gap-6">
        <p class="text-sm text-gray-600">Frete:
          <span class="text-yellow-600 font-bold">${frete}</span>
        </p>
        ${descontoHtml}
        <p class="text-lg text-gray-900 font-extrabold">
          Total: <span class="text-yellow-600">${total}</span>
        </p>
      </div>
    </div>`;
}
