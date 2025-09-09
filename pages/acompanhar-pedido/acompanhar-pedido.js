/* ======================================================================
 *  Página: Acompanhar Pedido (sem login)
 *  API: POST /pedido/publico/buscar  { pedidoId, cpf }
 *  + Links para produto-detalhes ao clicar na imagem ou no nome
 * ====================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  bindGuestOrderSearchUI();
  bindProdutoLinks(document); // 🔗 ativa links de produto

  const idFromUrl  = getOrderIdFromQuery();
  const cpfFromUrl = getCpfFromQuery();

  const inputId  = document.getElementById("inputNumeroPedido");
  const inputCpf = document.getElementById("inputCpfPedido");

  if (inputId && idFromUrl)  inputId.value  = idFromUrl;
  if (inputCpf && cpfFromUrl) inputCpf.value = maskCPF(cpfFromUrl);

  if (idFromUrl && cpfFromUrl) buscarPedidoGuest(idFromUrl, cpfFromUrl);
});

/* ---------------- navegação para produto-detalhes ---------------- */

// Delegação global: qualquer elemento com [data-link-produto] navega
function bindProdutoLinks(root = document) {
  root.addEventListener("click", function (e) {
    const el = e.target.closest("[data-link-produto]");
    if (!el) return;
    const id = el.getAttribute("data-produto-id") || el.dataset.produtoId;
    if (!id) return;
    e.preventDefault();
    navigateTo("produto-detalhes", "id=" + id);
  });

  // Acessível por teclado
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

// Atributos prontos para colar no HTML do item
function produtoLinkAttrs(id) {
  return `data-link-produto data-produto-id="${id}" role="link" tabindex="0"`;
}

/* ---------------- busca guest ---------------- */

function bindGuestOrderSearchUI() {
  const btn   = document.getElementById("btnBuscarPedido");
  const form  = document.getElementById("formBuscarPedido");
  const input = document.getElementById("inputNumeroPedido");
  const cpf   = document.getElementById("inputCpfPedido");

  cpf?.removeAttribute?.("pattern");

  if (cpf) {
    cpf.addEventListener("input", (e) => {
      const digits = onlyDigits(e.target.value).slice(0, 11);
      e.target.value = maskCPF(digits);
    });
  }

  const trigger = () => {
    const rawId  = (input?.value || "").trim();
    const rawCpf = onlyDigits((cpf?.value || "").trim());
    buscarPedidoGuest(rawId, rawCpf);
  };

  if (btn)  btn.addEventListener("click", trigger);
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); trigger(); });
  else {
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); trigger(); } });
    cpf?.addEventListener("keydown",   (e) => { if (e.key === "Enter") { e.preventDefault(); trigger(); } });
  }
}

async function buscarPedidoGuest(idStr, cpfStr) {
  const container = ensureContainer();

  const idNum = parseInt(String(idStr || "").replace(/\D/g, ""), 10);
  if (!idNum || idNum <= 0) {
    container.innerHTML = errorStateHtml("Informe um número de pedido válido (apenas dígitos).");
    reveal(container); return;
  }

  const cpf = onlyDigits(cpfStr || "");
  if (cpf.length !== 11) {
    container.innerHTML = errorStateHtml("CPF inválido. Digite 11 números (com ou sem pontuação).");
    reveal(container); return;
  }

  container.innerHTML = skeletonCards(1);
  toggleSearchDisabled(true);
  aplicarScrollPedidos(container, 1);
  reveal(container);

  try {
    const pedido = await fetchPedidoPorIdECpf(idNum, cpf);
    if (!pedido) {
      container.innerHTML = emptyStateHtml("Pedido não encontrado para os dados informados.");
      aplicarScrollPedidos(container, 0);
      reveal(container);
      return;
    }
    container.innerHTML = renderPedidoCard(pedido);
    aplicarScrollPedidos(container, 1);
    reveal(container);
  } catch (err) {
    console.error(err);
    container.innerHTML = errorStateHtml("Não foi possível carregar o pedido agora. Tente novamente em instantes.");
    aplicarScrollPedidos(container, 0);
    reveal(container);
  } finally {
    toggleSearchDisabled(false);
  }
}

async function fetchPedidoPorIdECpf(id, cpfDigits) {
  const url = `${window.apiBaseUrl}/pedido/publico/buscar`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedidoId: id, cpf: onlyDigits(cpfDigits) })
  });

  if (resp.status === 404) return null;
  if (!resp.ok) {
    const e = new Error(`HTTP ${resp.status}`);
    e.payload = await safeJson(resp);
    throw e;
  }

  const data = await resp.json();
  if (isPlainMessage(data)) return null;

  // ⚠️ Preserve itens já prontos do backend, em camelCase ou PascalCase
  const itensServer =
    Array.isArray(data.itens) ? data.itens :
    Array.isArray(data.Itens) ? data.Itens : null;

  if (itensServer) {
    data.Itens = itensServer; // normaliza para Itens
  } else if (data.ItensJson || data.itensJson) {
    try {
      const arr = JSON.parse(data.ItensJson || data.itensJson);
      data.Itens = Array.isArray(arr) ? arr : [];
    } catch { data.Itens = []; }
  } else {
    data.Itens = [];
  }

  return data;
}

/* ---------------- UI helpers / estado ---------------- */

function ensureContainer() {
  const el = document.getElementById("containerPedidoGuest");
  if (el) return el;
  const div = document.createElement("div");
  div.id = "containerPedidoGuest";
  div.className = "space-y-6 bg-gray-50 p-4 rounded-xl border";
  document.body.appendChild(div);
  return div;
}

function emptyStateHtml(msg) {
  return `<div class="border p-4 rounded-xl bg-gray-50 text-gray-600"><p class="text-center">${msg}</p></div>`;
}

function errorStateHtml(msg) {
  return `
    <div class="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl">
      <p class="font-semibold">Ops!</p>
      <p class="text-sm mt-1">${msg}</p>
    </div>`;
}

function toggleSearchDisabled(disabled) {
  const btn   = document.getElementById("btnBuscarPedido");
  const input = document.getElementById("inputNumeroPedido");
  const cpf   = document.getElementById("inputCpfPedido");
  if (btn)   btn.disabled   = !!disabled;
  if (input) input.disabled = !!disabled;
  if (cpf)   cpf.disabled   = !!disabled;
}

function getOrderIdFromQuery() {
  try {
    const u = new URL(window.location.href);
    const val = u.searchParams.get("pedido") || u.searchParams.get("numero");
    if (!val) return null;
    const onlyD = String(val).replace(/\D/g, "");
    return onlyD || null;
  } catch { return null; }
}

function getCpfFromQuery() {
  try {
    const u = new URL(window.location.href);
    const val = u.searchParams.get("cpf") || u.searchParams.get("documento");
    if (!val) return null;
    const digits = onlyDigits(val).slice(0, 11);
    return digits.length === 11 ? digits : null;
  } catch { return null; }
}

/* ---------------- utilidades ---------------- */

function onlyDigits(v){ return String(v || "").replace(/\D/g, ""); }

function maskCPF(d) {
  const x = onlyDigits(d).slice(0, 11);
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0,3)}.${x.slice(3)}`;
  if (x.length <= 9) return `${x.slice(0,3)}.${x.slice(3,6)}.${x.slice(6)}`;
  return `${x.slice(0,3)}.${x.slice(3,6)}.${x.slice(6,9)}-${x.slice(9,11)}`;
}

function formatCurrencyBRL(v){
  try{ return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0)); }
  catch{ return `R$ ${(Number(v||0)).toFixed(2).replace(".",",")}`; }
}

function formatDateBR(d){ const dt=new Date(d); return isNaN(dt)? "-" : dt.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}); }

function _norm(x){ return String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }

function pick(o,...keys){ for(const k of keys){ const v=o&&o[k]; if(v!==undefined&&v!==null&&v!=="") return v; } }

// Pega o ID do produto vindo do backend (várias chaves possíveis)
function getProdutoId(item){
  const id = pick(item, "ProdutoID","produtoID","produtoId","IdProduto","idProduto","id");
  return id != null ? String(id) : null;
}

/* ---------------- status/labels ---------------- */

function statusBadge(status) {
  const s = String(status || "").trim().toLowerCase();
  const map = {
    "n":"Novo","novo":"Novo",
    "processando":"Processando","processamento":"Processando","em processamento":"Processando",
    "p":"Pago","pago":"Pago","aprovado":"Pago",
    "s":"Em separação","em separacao":"Em separação","em separação":"Em separação",
    "e":"Enviado","enviado":"Enviado",
    "d":"Entregue","entregue":"Entregue",
    "c":"Cancelado","cancelado":"Cancelado",
    "aguardando pagamento":"Aguardando pagamento"
  };
  const label = map[s] || (status || "Status");
  const cls =
    label==="Novo"?"bg-yellow-100 text-yellow-800":
    label==="Processando"?"bg-amber-100 text-amber-800":
    label==="Pago"?"bg-emerald-100 text-emerald-800":
    label==="Aguardando pagamento"?"bg-amber-100 text-amber-800":
    label==="Em separação"?"bg-blue-100 text-blue-800":
    label==="Enviado"?"bg-indigo-100 text-indigo-800":
    label==="Entregue"?"bg-green-100 text-green-800":
    label==="Cancelado"?"bg-rose-100 text-rose-800":
    "bg-gray-100 text-gray-700";
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

function paymentStatusTextClass(st){
  const s=_norm(st);
  if(s==="aguardando pagamento"||s==="aguardando") return "text-amber-700";
  if(s==="pago") return "text-emerald-700";
  if(s==="recusado") return "text-rose-700";
  if(s==="estornado") return "text-purple-700";
  return "text-gray-700";
}

/* Alinhado com a proc: 1=Pix, 2=Cartão, 3=Boleto.
   Mantém compat com mapa antigo (1=Crédito, 2=Débito, 3=Pix, 4=Boleto). */
function labelMetodoPagamento(v) {
  const n = Number(v);
  const mapNew = { 1: "Pix", 2: "Cartão", 3: "Boleto" };
  const mapOld = { 1: "Cartão de Crédito", 2: "Cartão de Débito", 3: "Pix", 4: "Boleto" };
  return mapNew[n] || mapOld[n] || (v ?? "");
}

function labelStatusPagamento(v){
  const n=Number(v);
  const map={1:"Aguardando pagamento",2:"Pago",3:"Recusado",4:"Estornado"};
  return map[n] || (v ?? "");
}

/* ---------------- imagem / scroll / reveal ---------------- */

function placeholderImg() {
  return window.PLACEHOLDER_IMG_URL || "/imagens/placeholder-square.png";
}

// ⚠️ Agora aceita productId para colar atributos de navegação
function itemImagemHtml(url, nome, productId) {
  const ph  = placeholderImg();
  const candidate = (typeof url === "string" && url.trim() !== "") ? url : ph;
  const alt = nome || "Produto";
  const linkAttrs = productId ? `${produtoLinkAttrs(productId)} class="cursor-pointer w-20 h-20 object-cover rounded-lg shadow bg-gray-100"` 
                              : `class="w-20 h-20 object-cover rounded-lg shadow bg-gray-100"`;
  return `<img src="${candidate}" alt="${alt}" loading="lazy"
              onerror="if(this.dataset.err!=='1'){this.dataset.err='1';this.src='${ph}'}"
              ${linkAttrs} />`;
}

function skeletonCards(qtd){
  const item=`
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
    </div>`;
  return new Array(Math.max(1,qtd||1)).fill(item).join("");
}

function aplicarScrollPedidos(el,qtdCards){
  el.style.maxHeight=""; el.style.overflowY="";
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  if(!isDesktop) return;
  const disponivel = Math.max(320, Math.min(window.innerHeight - 340, 600));
  if(qtdCards>=1){ el.style.maxHeight = `${disponivel}px`; el.style.overflowY="auto"; }
}

window.addEventListener("resize", () => {
  const el = document.getElementById("containerPedidoGuest");
  if (!el) return;
  aplicarScrollPedidos(el, el.childElementCount);
});

function reveal(el){ requestAnimationFrame(()=>{ el.scrollIntoView({behavior:"smooth",block:"start",inline:"nearest"}); }); }

/* ---------------- render ---------------- */

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
    const nome = pick(item,"Nome","nome") ?? "Produto";
    const qtd  = Number(pick(item,"Quantidade","quantidade")) || 1;
    const img  = pick(item,"ImagemUrl","imagemUrl","ImagemPrincipal","imagemPrincipal") ?? "";
    const prodId = getProdutoId(item);

    // unitário somente o salvo no pedido (sem cupom)
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

    // 🔗 adiciona atributos de link em imagem e nome, se tiver ID
    const linkAttrs = prodId ? ` ${produtoLinkAttrs(prodId)} class="cursor-pointer hover:underline text-lg font-bold text-gray-900 clamp-2 break-words"` 
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
  ? `<p class="text-sm text-green-700 text-emerald-700">
       Desconto (cupom):
       <span class="font-bold text-green-700 text-emerald-700">- ${formatCurrencyBRL(desconto)}</span>
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

/* ---------------- pequenos utilitários ---------------- */

function isPlainMessage(obj){
  if(!obj || typeof obj!=="object") return true;
  const keys = Object.keys(obj);
  const looksLikePedido =
    keys.includes("PedidoID") || keys.includes("pedidoID") ||
    keys.includes("pedidoId") || keys.includes("Numero")   ||
    keys.includes("numero")   || keys.includes("id")       ||
    keys.includes("Itens")    || keys.includes("itens");
  if(!looksLikePedido && (keys.includes("mensagem") || keys.includes("Mensagem"))) return true;
  return false;
}

async function safeJson(resp){ try{ return await resp.json(); } catch{ return null; } }
