/* ======================================================================
 *  Página: Acompanhar Pedido (sem login)
 *  - Usuário informa o número do pedido (ID) e vê os detalhes.
 *  - Baseia-se no layout/estilo da tela "Meus Pedidos".
 *  - API utilizada (pública): GET /api/pedido/publico/{pedidoId}
 *    (fallback automático para GET /api/pedido/obter-por-id/{id} se necessário)
 * ====================================================================== */

/* ==========================
 * Inicialização
 * ========================== */
document.addEventListener("DOMContentLoaded", () => {
  bindGuestOrderSearchUI();

  // Se vier ?pedido=123 ou ?numero=123 na URL, preenche e busca:
  const idFromUrl = getOrderIdFromQuery();
  if (idFromUrl) {
    const input = document.getElementById("inputNumeroPedido");
    if (input) input.value = idFromUrl;
    buscarPedidoGuest(idFromUrl);
  }
});

/* ==========================
 * Wire-up da UI
 * ========================== */
function bindGuestOrderSearchUI() {
  const btn = document.getElementById("btnBuscarPedido");
  const input = document.getElementById("inputNumeroPedido");
  const form = document.getElementById("formBuscarPedido");

  if (btn) {
    btn.addEventListener("click", () => {
      const raw = (input?.value || "").trim();
      buscarPedidoGuest(raw);
    });
  }

  // Permite Enter no input ou envia via <form>
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = (input?.value || "").trim();
      buscarPedidoGuest(raw);
    });
  } else if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const raw = (input?.value || "").trim();
        buscarPedidoGuest(raw);
      }
    });
  }
}

/* ==========================
 * Busca e renderização
 * ========================== */

/** Busca por ID informado (string), valida e chama a API. */
async function buscarPedidoGuest(idStr) {
  const container = ensureContainer();
  if (!idStr) {
    container.innerHTML = emptyStateHtml("Informe o número do pedido para visualizar os detalhes.");
    return;
  }

  // Aceita apenas números inteiros positivos
  const id = parseInt(String(idStr).replace(/\D/g, ""), 10);
  if (!id || id <= 0) {
    container.innerHTML = errorStateHtml("Número do pedido inválido. Digite apenas números.");
    return;
  }

  container.innerHTML = skeletonCards(1);
  try {
    const pedido = await fetchPedidoPorId(id);
    if (!pedido) {
      container.innerHTML = emptyStateHtml("Pedido não encontrado.");
      return;
    }
    container.innerHTML = renderPedidoCard(pedido);
    aplicarScrollPedidos(container, 1); // padrão visual consistente
  } catch (err) {
    console.error(err);
    container.innerHTML = errorStateHtml("Não foi possível carregar o pedido agora. Tente novamente em instantes.");
  }
}

/** Chama a API pública /api/pedido/publico/{id} (com fallback) e normaliza resposta. */
async function fetchPedidoPorId(id) {
  // 1) Tenta o endpoint público novo
  let resp = await fetchJsonSafe(`${window.apiBaseUrl}/pedido/publico/${id}`);

  // Se a rota pública não existir (405/501/404 fora do “not found do pedido”), tenta o legado:
  if (resp.kind === "error" && isRouteMissing(resp.status)) {
    resp = await fetchJsonSafe(`${window.apiBaseUrl}/pedido/obter-por-id/${id}`);
  }

  // Pedido não encontrado
  if (resp.kind === "ok" && resp.status === 404) return null;

  // Erro http real
  if (resp.kind === "error") throw new Error(`HTTP ${resp.status}`);

  const data = resp.data;

  // Se vier apenas { mensagem: "..." } consideramos como vazio
  if (isPlainMessage(data)) return null;

  // Garante Itens[]
  if (Array.isArray(data.Itens) || Array.isArray(data.itens)) {
    // ok
  } else if (data.ItensJson || data.itensJson) {
    try {
      const arr = JSON.parse(data.ItensJson || data.itensJson);
      data.Itens = Array.isArray(arr) ? arr : [];
    } catch {
      data.Itens = [];
    }
  } else {
    data.Itens = [];
  }

  return data;
}

/** Pequeno wrapper para fetch + json com informação de status */
async function fetchJsonSafe(url) {
  try {
    const resp = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
    const status = resp.status;

    // Alguns códigos não retornam JSON
    if (status === 204) return { kind: "ok", status, data: null };

    // Tenta parsear JSON — se não for JSON, ainda devolvemos o erro
    let data = null;
    try {
      data = await resp.json();
    } catch {
      // ignora parse error e deixa data = null
    }

    if (!resp.ok) return { kind: "error", status, data };
    return { kind: "ok", status, data };
  } catch (e) {
    return { kind: "error", status: 0, data: null };
  }
}

function isRouteMissing(status) {
  // 404 pode ser "pedido não encontrado" ou "rota inexistente".
  // Para fallback ser conservador, tentamos em 404, 405 (method not allowed) e 501 (not implemented).
  return status === 404 || status === 405 || status === 501;
}

/* ==========================
 * Helpers de UI / Estado
 * ========================== */

function ensureContainer() {
  const el = document.getElementById("containerPedidoGuest");
  if (el) return el;
  // fallback: cria dinamicamente um container se não existir
  const div = document.createElement("div");
  div.id = "containerPedidoGuest";
  div.className = "space-y-6 bg-gray-50 p-4 rounded-xl border overflow-hidden overflow-y-auto";
  document.body.appendChild(div);
  return div;
}

function emptyStateHtml(msg) {
  return `
    <div class="border p-4 rounded-xl bg-gray-50 text-gray-600">
      <p class="text-center">${msg}</p>
    </div>
  `;
}

function errorStateHtml(msg) {
  return `
    <div class="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl">
      <p class="font-semibold">Ops!</p>
      <p class="text-sm mt-1">${msg}</p>
    </div>
  `;
}

/** Pega ?pedido=123 ou ?numero=123 da URL (retorna string numérica ou null). */
function getOrderIdFromQuery() {
  try {
    const u = new URL(window.location.href);
    const val = u.searchParams.get("pedido") || u.searchParams.get("numero");
    if (!val) return null;
    const onlyDigits = String(val).replace(/\D/g, "");
    return onlyDigits || null;
  } catch {
    return null;
  }
}

/* ==========================
 * Utilidades de formatação
 * (mesmas da tela "Meus Pedidos")
 * ========================== */

function formatCurrencyBRL(valor) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(Number(valor || 0));
  } catch {
    return `R$ ${(Number(valor || 0)).toFixed(2).replace(".", ",")}`;
  }
}

function formatDateBR(dateIsoOrTicks) {
  const dt = new Date(dateIsoOrTicks);
  if (isNaN(dt)) return "-";
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function _norm(x) {
  return String(x || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

function pick(o, ...keys) {
  for (const k of keys) {
    const v = o && o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
}

/* ==========================
 * Status e rótulos (iguais ao "Meus Pedidos")
 * ========================== */

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

function paymentStatusTextClass(st) {
  const s = _norm(st);
  if (s === "aguardando pagamento" || s === "aguardando") return "text-amber-700";
  if (s === "pago")        return "text-emerald-700";
  if (s === "recusado")    return "text-rose-700";
  if (s === "estornado")   return "text-purple-700";
  return "text-gray-700";
}

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

/* ==========================
 * UI helpers (imagem/placeholder/scroll)
 * ========================== */

function itemImagemHtml(url, nome) {
  const safeUrl = url && typeof url === "string" ? url : "";
  const alt = nome || "Produto";
  return `<img src="${safeUrl}" alt="${alt}" loading="lazy"
              onerror="this.src='/imagens/placeholder-square.png'; this.classList.add('bg-gray-100');"
              class="w-20 h-20 object-cover rounded-lg shadow" />`;
}

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
  return new Array(Math.max(1, qtd || 1)).fill(item).join("");
}

function aplicarScrollPedidos(el, qtdCards) {
  const disponivel = Math.max(320, Math.min(window.innerHeight - 260, 600));
  if (qtdCards >= 1) {
    el.style.maxHeight = `${disponivel}px`;
    el.style.overflowY = "auto";
  } else {
    el.style.maxHeight = "";
    el.style.overflowY = "";
  }
}

window.addEventListener("resize", () => {
  const el = document.getElementById("containerPedidoGuest");
  if (!el) return;
  aplicarScrollPedidos(el, el.childElementCount);
});

/* ==========================
 * Render do Card (mesmo padrão da outra tela)
 * ========================== */

function renderPedidoCard(pedido) {
  // Cabeçalho
  const numero  = String(pick(pedido, "PedidoID", "pedidoID", "pedidoId", "Numero", "numero", "id") ?? "-");
  const data    = formatDateBR(pick(pedido, "DataPedido", "dataPedido", "Data", "data"));
  const frete   = formatCurrencyBRL(pick(pedido, "ValorFrete", "valorFrete"));
  const total   = formatCurrencyBRL(pick(pedido, "ValorTotal", "valorTotal"));
  const statusG = pick(pedido, "Status", "status");
  const statusHtml = statusBadge(statusG);

  // Pagamento (usa descrição da PROC quando vier, senão mapeia enum numérico)
  const pagamentoDescApi = pick(pedido, "MetodoPagamentoDescricao", "metodoPagamentoDescricao");
  const statusPagDescApi = pick(pedido, "StatusPagamentoDescricao", "statusPagamentoDescricao");
  const pagamentoNum     = pick(pedido, "MetodoPagamento", "metodoPagamento");
  const statusPagNum     = pick(pedido, "StatusPagamento", "statusPagamento");

  const pagamentoLabel = (pagamentoDescApi && String(pagamentoDescApi).trim() !== "")
    ? pagamentoDescApi
    : labelMetodoPagamento(pagamentoNum);

  const statusPagLabel = (statusPagDescApi && String(statusPagDescApi).trim() !== "")
    ? statusPagDescApi
    : labelStatusPagamento(statusPagNum);

  // Rastreio
  const rastreio = pick(pedido, "CodigoRastreamento", "codigoRastreamento");

  // Itens
  const itens = Array.isArray(pedido.Itens) ? pedido.Itens
             : Array.isArray(pedido.itens) ? pedido.itens : [];

  const itensHtml = itens.map(item => {
    const nome = pick(item, "Nome", "nome") ?? "Produto";
    const qtd  = pick(item, "Quantidade", "quantidade") ?? 1;
    const img  = pick(item, "ImagemUrl", "imagemUrl", "ImagemPrincipal", "imagemPrincipal") ?? "";

    const tamanhoSelecionado = pick(item, "TamanhoSelecionado", "tamanhoSelecionado", "Tamanho", "tamanho");
    const isLista = tamanhoSelecionado && /[;,/]/.test(String(tamanhoSelecionado));
    const tamanhoHtml = (!tamanhoSelecionado || isLista) ? "" :
      `<p class="text-sm text-gray-600 mt-1">Tamanho: <span class="text-gray-900 font-medium">${tamanhoSelecionado}</span></p>`;

    return `
      <div class="flex items-center gap-4 border-b py-4 last:border-b-0">
        ${itemImagemHtml(img, nome)}
        <div class="flex-1">
          <h3 class="text-lg font-bold text-gray-900 clamp-2 break-words">${nome}</h3>
          ${tamanhoHtml}
          <p class="text-sm text-gray-600">Quantidade: <span class="text-gray-900 font-medium">${qtd}</span></p>
        </div>
      </div>
    `;
  }).join("");

  // Endereço opcional (se vier)
  const endereco = pedido.enderecoEntrega || pedido.EnderecoEntrega || null;
  const enderecoHtml = endereco ? `
    <div class="text-sm text-gray-700">
      <p><span class="font-semibold">Entrega:</span> ${[
        endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro,
        endereco.cidade, endereco.uf, endereco.cep
      ].filter(Boolean).join(", ")}</p>
    </div>
  ` : "";

  // Rastreio link/placeholder
  const rastreioHtml = rastreio ? `
    <a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" rel="noopener"
       class="text-sm font-semibold text-indigo-700 hover:underline">Rastrear (${rastreio})</a>
  ` : `<span class="text-sm text-gray-500">Sem código de rastreio ainda</span>`;

  // Card final
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
            ${statusPagLabel
              ? ` · <span class="font-semibold ${paymentStatusTextClass(statusPagLabel)}">${statusPagLabel}</span>`
              : ""
            }
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
        <p class="text-lg font-extrabold text-gray-900">
          Total: <span class="text-yellow-600">${total}</span>
        </p>
      </div>
    </div>
  `;
}

/* ==========================
 * Pequenos utilitários
 * ========================== */

function isPlainMessage(obj) {
  if (!obj || typeof obj !== "object") return true;
  const keys = Object.keys(obj);
  const looksLikePedido =
    keys.includes("PedidoID") || keys.includes("pedidoID") ||
    keys.includes("pedidoId") || keys.includes("Numero")   ||
    keys.includes("numero")   || keys.includes("id")       ||
    keys.includes("Itens")    || keys.includes("itens");
  if (!looksLikePedido && (keys.includes("mensagem") || keys.includes("Mensagem"))) {
    return true;
  }
  return false;
}
