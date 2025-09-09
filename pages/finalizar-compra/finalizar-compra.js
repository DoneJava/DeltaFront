// ======================================================================
//  CONFIG GERAL
// ======================================================================
let cardPaymentBrickController = null;
const ROTA_ACOMPANHAR = "acompanhar-pedido";
const ROTA_PEDIDOS    = "pedidos";

// ======================================================================
//  HELPERS
// ======================================================================
function getUsarDadosUsuarioFromFluxo() {
  const a = window.dadosResumoPagamentoFinal?.dadosUsuario?.usarDadosUsuario;
  const b = window.dadosPagamentoFinal?.dadosEnvio?.usarDadosUsuario;
  const c = window.dadosResumoPagamentoFinal?.usarDadosUsuario;
  const d = window.dadosPagamentoFinal?.usarDadosUsuario;
  return !!(a ?? b ?? c ?? d);
}

function getCpfCompraFromFluxo() {
  const r = window.dadosResumoPagamentoFinal?.dadosUsuario;
  const f = window.dadosPagamentoFinal?.dadosEnvio;
  return (
    r?.cpf ?? f?.cpf ??
    r?.cpf_CNPJ ?? f?.cpf_CNPJ ??
    r?.cpF_CNPJ ?? f?.cpF_CNPJ ?? ""
  );
}

function getPedidoIdFromResponse(result) {
  const r = result || {};
  const cands = [
    r.pedidoId, r.idPedido, r.id,
    r?.pedido?.id, r?.pedido?.pedidoId,
    r?.Objeto?.pedidoId, r?.Objeto?.PedidoId,
    r?.objeto?.pedidoId, r?.objeto?.PedidoId
  ];
  for (const c of cands) if (c !== undefined && c !== null && `${c}` !== "") return c;
  if (typeof r.Objeto === "number") return r.Objeto;
  if (typeof r.Objeto === "string" && /^\d+$/.test(r.Objeto)) return r.Objeto;
  return null;
}

// 🔒 Envia Authorization APENAS se usarDadosUsuario === true
function buildApiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (getUsarDadosUsuarioFromFluxo()) {
    const tk = (typeof getTokenDosCookies === "function") ? getTokenDosCookies() : null;
    if (tk) headers["Authorization"] = `Bearer ${tk}`;
  }
  return headers;
}
// compat com código antigo
const buildProcessarPagamentoHeaders = buildApiHeaders;

function normalizarCpf(v) { return (v || "").toString().replace(/\D+/g, ""); }
function formatarCpf(cpf) {
  const d = normalizarCpf(cpf);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "";
}

function mostrarPopup(mensagem) {
  const popup = document.createElement("div");
  popup.innerHTML = mensagem;
  popup.className = `
    fixed top-8 left-1/2 transform -translate-x-1/2 
    bg-yellow-400 text-black font-semibold 
    px-6 py-3 rounded-lg shadow-lg 
    border border-yellow-500 z-50 animate-slide-down
  `;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.classList.add("opacity-0","transition-opacity","duration-500");
    setTimeout(() => popup.remove(), 5000);
  }, 5000);
}

function limparCarrinhoPosCompra() {
  try { localStorage.removeItem("carrinho"); } catch {}
  try { localStorage.removeItem("resultadoCupom"); } catch {}
  try { localStorage.removeItem("freteGratisOK"); } catch {}
  try { window.valorFreteAtual = 0; window.freteGratisOK = false; } catch {}
  if (typeof atualizarContadorCarrinho === "function") {
    try { atualizarContadorCarrinho(); } catch {}
  }
}

function copiarDadosPedido(pedidoId, cpf) {
  const texto = `Pedido: ${pedidoId} | CPF: ${normalizarCpf(cpf)}`;
  navigator.clipboard?.writeText(texto).then(
    () => mostrarPopup("Dados do pedido copiados!"),
    () => mostrarPopup("Não foi possível copiar. Copie manualmente.")
  );
}

// id sintético para sandbox
function sandboxPaymentId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

// ======================================================================
//  CARD DE INFORMAÇÕES (dinâmico por fluxo)
// ======================================================================
function renderInfoCard() {
  const usarDadosUsuario = getUsarDadosUsuarioFromFluxo();

  // tenta achar um card já existente
  const card =
    document.getElementById("infoCardPayment") ||
    document.querySelector('[data-info-card]') ||
    [...document.querySelectorAll('.lg\\:col-span-5')].find(el =>
      el.querySelector('h3')?.textContent?.trim().toLowerCase().includes('informações importantes')
    );

  if (!card) return;

  card.className = "lg:col-span-5 bg-yellow-100 p-6 rounded-xl space-y-4 text-gray-800 shadow-md";
  card.id = card.id || "infoCardPayment";

  const htmlUsandoConta = `
  <h3 class="text-xl font-semibold">Obrigado pela compra! 🧡</h3>
  <p class="text-sm font-medium">
    Iremos processar seu pagamento. Assim que for confirmado,
    <strong>você será redirecionado para Meus Pedidos</strong> para acompanhar cada etapa.
  </p>
  <p class="text-sm font-medium">
    Se demorar um pouquinho, tudo bem — a atualização acontece por lá.
  </p>
  <p class="text-sm font-medium">
    Dica de segurança: prefira <strong>cartão virtual</strong>. Não armazenamos dados do seu cartão.
  </p>
  <p class="text-sm font-medium">
    Força, foco e fé — vista a mensagem, treine com propósito.
  </p>
`;

  const htmlGuest = `
  <h3 class="text-xl font-semibold">Obrigado pela compra! 🧡</h3>
  <p class="text-sm font-medium">
    Iremos processar seu pagamento. Quando for confirmado,
    <strong>mostraremos aqui o nº do seu pedido</strong>.
  </p>
  <p class="text-sm font-medium">
    Guarde esse número e o CPF da compra para consultar em
    <strong>“Acompanhar Pedido”</strong>.
  </p>
  <p class="text-sm font-medium">
    Dica de segurança: prefira <strong>cartão virtual</strong>. Não armazenamos dados do seu cartão.
  </p>
  <p class="text-sm font-medium">
    Força, foco e fé — vista a mensagem, treine com propósito.
  </p>
`;

  card.innerHTML = usarDadosUsuario ? htmlUsandoConta : htmlGuest;
}

// ======================================================================
//  PÓS-PAGAMENTO (visual amarelo + botões-ícone)
// ======================================================================
async function handlePosPagamento(result, cpfCompra) {
  const usarDadosUsuario = getUsarDadosUsuarioFromFluxo();
  const cpfDaCompra      = cpfCompra || getCpfCompraFromFluxo();

  if (usarDadosUsuario) {
    setTimeout(() => navigateTo(ROTA_PEDIDOS), 2000);
    return;
  }

  const pedidoId = getPedidoIdFromResponse(result);

  const container = document.querySelector(".lg\\:col-span-7") || document.body;

  // evita duplicar bloco em reloads de função
  document.getElementById("postpay-block")?.remove();

  const bloco = document.createElement("div");
  bloco.id = "postpay-block";
  bloco.className = [
    "mt-8 rounded-2xl shadow-lg border",
    "bg-yellow-50 border-yellow-300",
    "px-6 py-6 lg:px-8 lg:py-7"
  ].join(" ");

  const cpfFmt = formatarCpf(cpfDaCompra);
  const numeroPedidoHtml = pedidoId
    ? `<span class="text-3xl lg:text-4xl font-extrabold tracking-wide text-gray-900">${pedidoId}</span>`
    : `<span class="text-red-700 font-semibold">não disponível</span>`;

  bloco.innerHTML = `
    <div class="text-center">
      <p class="text-yellow-900 font-extrabold text-2xl lg:text-3xl leading-tight">
        Seu pedido foi realizado com sucesso!
      </p>

      <div class="mt-3 text-lg lg:text-xl text-gray-900">
        <span class="font-semibold">Nº do pedido:</span> ${numeroPedidoHtml}
      </div>

      <div class="mt-2 text-base text-gray-800">
        <span class="font-medium">CPF da compra:</span>
        ${cpfFmt ? `<span class="font-semibold">${cpfFmt}</span>` : `<em>não informado</em>`}
      </div>

      <p class="mt-4 text-gray-800">
        Para acompanhar, use o nº do pedido e o CPF na tela
        <span class="font-semibold">Acompanhar Pedido</span>.
      </p>

      <div class="mt-5 flex items-center justify-center gap-8">
        <!-- Ir para acompanhar -->
        <div class="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Ir para Acompanhar Pedido"
            title="Ir para Acompanhar Pedido"
            class="h-11 w-11 rounded-full flex items-center justify-center
                   bg-yellow-400 hover:bg-yellow-500 text-black shadow
                   border border-yellow-500 transition"
            onclick="navigateTo('${ROTA_ACOMPANHAR}')"
          >
            <i class="fas fa-location-arrow"></i>
          </button>
          <span class="text-xs text-gray-700">Acompanhar</span>
        </div>

        ${pedidoId ? `
        <!-- Copiar número + CPF -->
        <div class="flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Copiar nº do pedido e CPF"
            title="Copiar nº do pedido e CPF"
            class="h-11 w-11 rounded-full flex items-center justify-center
                   bg-white hover:bg-gray-50 text-gray-900 shadow
                   border border-gray-300 transition"
            onclick="copiarDadosPedido('${pedidoId}', '${cpfDaCompra || ""}')"
          >
            <i class="fas fa-copy"></i>
          </button>
          <span class="text-xs text-gray-700">Copiar nº + CPF</span>
        </div>` : ``}
      </div>
    </div>
  `;

  container.appendChild(bloco);
}

// ======================================================================
//  VERSÃO DE TESTE (ATIVA AGORA)
// ======================================================================

function addSandboxBanner() {
  if (document.getElementById("sandboxBanner")) return; // evita duplicar
  const el = document.createElement("div");
  el.id = "sandboxBanner";
  el.className = "fixed top-2 left-1/2 -translate-x-1/2 z-[9999] bg-purple-100 text-purple-900 border border-purple-300 px-4 py-2 rounded-lg shadow";
  el.textContent = "🧪 Modo de simulação de pagamento ATIVO";
  document.body.appendChild(el);
}

function inicializarFinalizarCompra() {
  addSandboxBanner();

  // Atualiza o card de informações conforme o fluxo escolhido
  renderInfoCard();

  const dados = window.dadosPagamentoFinal;
  if (!dados) {
    mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    return;
  }

  const tipo     = dados.metodoPagamento?.toString();
  const produtos = dados.produtos || [];
  const cupom    = dados.cupom || "";
  const cep      = dados.dadosEnvio?.cep?.replace(/\D/g, "") || "";

  const dadosPagamento = { produtos, cupom, cep };

  fetch(`${window.apiBaseUrl}/pagamento/calcular_valor_total`, {
    method: "POST",
    headers: buildApiHeaders(), // 🔒 só manda token se usarDadosUsuario = true
    body: JSON.stringify(dadosPagamento),
  })
  .then(res => res.json())
  .then(data => {
    const valorTotal = data?.valorTotal;
    if (!valorTotal) {
      mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
      return;
    }

    switch (tipo) {
      case "1": fluxoPixTeste({ dados, produtos, cupom, cep }); break;
      case "2": fluxoCartaoTeste({ dados, produtos, cupom, cep, valorTotal }); break;
      default:
        mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    }
  })
  .catch(() => {
    mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
  });
}

function fluxoPixTeste({ dados, produtos, cupom, cep }) {
  document.getElementById("containerPagamentoPix")?.classList.remove("hidden");

  const produtosDto = produtos.map(p => ({
    idProduto: p.idProduto, quantidade: p.quantidade, tamanho: p.tamanho || "-"
  }));

  // QR fake
  const qrcode = document.getElementById("qrcodePix");
  if (qrcode) {
    const svg = encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='#111827'>PIX SIMULADO</text></svg>"
    );
    qrcode.src = `data:image/svg+xml;charset=utf-8,${svg}`;
  }

  setTimeout(() => {
    const dtoFinal = {
      produtos: produtosDto,
      metodoPagamento: 1,
      dadosPagamento: "",
      dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
      cupom,
      cep,
      // 🔒 back exige um ID do gateway; no sandbox geramos um fake
      gatewayPaymentId: sandboxPaymentId("sandbox-pix")
    };
    chamarProcessarPagamentoTeste(dtoFinal, getCpfCompraFromFluxo());
  }, 1000);
}

function fluxoCartaoTeste({ dados, produtos, cupom, cep, valorTotal }) {
  const container = document.getElementById("containerPagamentoCartao");
  container?.classList.remove("hidden");

  const produtosDto = produtos.map(p => ({
    idProduto: p.idProduto, quantidade: p.quantidade, tamanho: p.tamanho || "-"
  }));

  if (container) {
    container.innerHTML = "";
    const simulador = document.createElement("div");
    simulador.className = "flex flex-col items-center gap-3 p-6 bg-white rounded-xl border border-gray-200";
    simulador.innerHTML =
      `<p class="text-gray-700">Simulação ativa: o pagamento será marcado como <strong>aprovado</strong> (R$ ${Number(valorTotal).toFixed(2)})</p>` +
      '<button id="btnSimularCartaoAprovado" class="px-4 py-2 bg-yellow-400 text-black rounded-lg font-semibold hover:bg-yellow-500 transition">Simular pagamento aprovado</button>';
    container.appendChild(simulador);

    document.getElementById("btnSimularCartaoAprovado")?.addEventListener("click", (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true; // evita duplo clique
      const dto = {
        produtos: produtosDto,
        metodoPagamento: 2,
        dadosPagamento: "",
        dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
        cupom,
        cep,
        // 🔒 idem: gera um ID de gateway fake no sandbox
        gatewayPaymentId: sandboxPaymentId("sandbox-card")
      };
      chamarProcessarPagamentoTeste(dto, getCpfCompraFromFluxo());
      setTimeout(() => { btn.disabled = false; }, 3000);
    }, { once: true });
  }
}

function chamarProcessarPagamentoTeste(dto, cpfCompra) {
  fetch(`${window.apiBaseUrl}/pagamento/processar_pagamento`, {
    method: "POST",
    headers: buildProcessarPagamentoHeaders(),
    body: JSON.stringify(dto)
  })
  .then(async res => {
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.mensagem || "Erro ao registrar o pedido.";
      throw new Error(msg);
    }
    return body;
  })
  .then(async (result) => {
    mostrarPopup("✅ Pagamento confirmado com sucesso!");
    limparCarrinhoPosCompra();
    await handlePosPagamento(result, cpfCompra);
  })
  .catch((err) => {
    mostrarPopup(`Não foi possível registrar o pedido: ${err.message}`);
    console.error(err);
  });
}

window.inicializarFinalizarCompra = inicializarFinalizarCompra;

/*
// ======================================================================
// *  VERSÃO REAL (PRODUÇÃO) — DESCOMENTE QUANDO FOR LANÇAR
// * ======================================================================

// ======== PRODUÇÃO ========
// (use a MESMA variável global cardPaymentBrickController já declarada no topo)

function inicializarFinalizarCompra() {
  // Card dinâmico (usar dados da conta x guest)
  renderInfoCard();

  const dados = window.dadosPagamentoFinal;
  if (!dados) {
    mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    return;
  }

  const tipo     = dados.metodoPagamento?.toString();
  const produtos = dados.produtos || [];
  const cupom    = dados.cupom || "";
  const cep      = (dados.dadosEnvio?.cep || "").replace(/\D/g, "");

  const dadosPagamento = { produtos, cupom, cep };

  fetch(`${window.apiBaseUrl}/pagamento/calcular_valor_total`, {
    method: "POST",
    headers: buildApiHeaders(),
    body: JSON.stringify(dadosPagamento),
  })
  .then(res => res.json())
  .then(data => {
    const valorTotal = data?.valorTotal;
    if (!valorTotal) {
      mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
      return;
    }
    switch (tipo) {
      case "1": fluxoPixReal({ dados, produtos, cupom, cep }); break;
      case "2": fluxoCartaoReal({ dados, produtos, cupom, cep, valorTotal }); break;
      default:  mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    }
  })
  .catch(() => mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!"));
}

function fluxoPixReal({ dados, produtos, cupom, cep }) {
  document.getElementById("containerPagamentoPix")?.classList.remove("hidden");

  const produtosDto = produtos.map(p => ({ idProduto: p.idProduto, quantidade: p.quantidade, tamanho: p.tamanho || "-" }));
  const dtoPix = { produtos: produtosDto, cupom, cep };

  fetch(`${window.apiBaseUrl}/pagamento/gerar-pix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dtoPix)
  })
  .then(res => res.json())
  .then(pix => {
    if (!pix.qrCodeBase64 || !pix.idPagamento) { mostrarPopup("Erro ao gerar QR Code do Pix."); return; }
    const img = document.getElementById("qrcodePix"); if (img) img.src = pix.qrCodeBase64;

    let tentativas = 0; const maxTentativas = 48;
    const intervalo = setInterval(() => {
      fetch(`${window.apiBaseUrl}/pagamento/status-pix?id=${encodeURIComponent(pix.idPagamento)}`)
        .then(res => res.json())
        .then(status => {
          if (status.status === "approved") {
            clearInterval(intervalo);

            const dtoFinal = {
              produtos: produtosDto,
              metodoPagamento: 1,
              dadosPagamento: "",
              dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
              cupom,
              cep,
              gatewayPaymentId: pix.idPagamento
            };

            fetch(`${window.apiBaseUrl}/pagamento/processar_pagamento`, {
              method: "POST",
              headers: buildProcessarPagamentoHeaders(),
              body: JSON.stringify(dtoFinal)
            })
            .then(r => r.json())
            .then(async (result) => {
              mostrarPopup("✅ Pagamento confirmado com sucesso!");
              limparCarrinhoPosCompra();
              await handlePosPagamento(result, getCpfCompraFromFluxo());
            })
            .catch(() => mostrarPopup("Pagamento confirmado, mas houve erro ao registrar o pedido."));
          } else {
            if (++tentativas >= maxTentativas) {
              clearInterval(intervalo);
              mostrarPopup("Tempo limite atingido. Não foi possível confirmar o pagamento.");
            }
          }
        })
        .catch(() => { clearInterval(intervalo); });
    }, 5000);
  })
  .catch(() => mostrarPopup("Erro ao gerar QR Code do Pix. Verifique sua conexão."));
}

function fluxoCartaoReal({ dados, produtos, cupom, cep, valorTotal }) {
  const container = document.getElementById("containerPagamentoCartao");
  container?.classList.remove("hidden");

  if (!window.mp || !window.mp.bricks) {
    mostrarPopup("Configuração do Mercado Pago ausente.");
    return;
  }

  const bricksBuilder = window.mp.bricks();
  if (cardPaymentBrickController) { cardPaymentBrickController.unmount(); cardPaymentBrickController = null; }

  bricksBuilder.create("cardPayment", "cardPaymentBrick_container", {
    initialization: { amount: valorTotal },
    customization: {
      paymentMethods: { creditCard: "all", debitCard: "all", ticket: "all", bankTransfer: "all" },
      visual: { style: { theme: "default" } }
    },
    callbacks: {
      onReady: () => {},
      onSubmit: async (cardFormData) => {
        if (window.__paying) return; // debounce
        window.__paying = true;
        try {
          const produtosDto = produtos.map(p => ({
            idProduto: p.idProduto,
            quantidade: p.quantidade,
            tamanho: p.tamanho || "-"
          }));

          const payload = {
            produtos: produtosDto,
            cupom,
            cep,
            dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
            card: {
              token: cardFormData.token,
              installments: Number(cardFormData.installments) || 1,
              paymentMethodId: cardFormData.paymentMethodId,
              issuerId: cardFormData.issuerId,
              payer: {
                email: cardFormData.payer?.email || dados?.dadosUsuario?.email || "comprador@teste.com",
                identificationType: cardFormData.payer?.identification?.type || null,
                identificationNumber: cardFormData.payer?.identification?.number || null
              }
            }
          };

          const res = await fetch(`${window.apiBaseUrl}/pagamento/mercadopago/cartao/pagar`, {
            method: "POST",
            headers: buildApiHeaders(), // 🔒 só manda Authorization se “usar dados do usuário” for true
            body: JSON.stringify(payload)
          });

          const body = await res.json().catch(() => null);
          if (!res.ok || !body) {
            throw new Error(body?.mensagem || "Falha ao processar pagamento.");
          }

          mostrarPopup("✅ Pagamento confirmado com sucesso!");
          limparCarrinhoPosCompra();

          // se veio pedidoId, é GUEST; se não, redireciona para pedidos (usuário opted-in)
          if (body.pedidoId) {
            await handlePosPagamento(body, getCpfCompraFromFluxo());
          } else {
            setTimeout(() => navigateTo("pedidos"), 1800);
          }
        } catch (err) {
          console.error(err);
          mostrarPopup("Pagamento processado, mas houve erro ao registrar o pedido.");
        } finally {
          window.__paying = false;
        }
      },
      onError: () => {
        mostrarPopup("Houve um erro. Atualize a página e tente novamente.");
        navigateTo("pagamento");
      }
    }
  }).then(controller => { cardPaymentBrickController = controller; });
}

*/