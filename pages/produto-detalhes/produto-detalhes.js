/* ============================================
 * PRODUTO DETALHES — JS (idempotente + zoom)
 * ============================================ */
(function () {
  // ---------- Config & helpers ----------
  window.ESTOQUE_ESGOTADO_LIMIAR = window.ESTOQUE_ESGOTADO_LIMIAR ?? 10;

  const el  = (id) => document.getElementById(id);
  const qsa = (sel) => document.querySelectorAll(sel);

  function waitForEl(selectorOrId, timeout = 4000) {
    const sel = selectorOrId.startsWith('#') ? selectorOrId : `#${selectorOrId}`;
    const start = Date.now();
    return new Promise((resolve) => {
      const existing = document.querySelector(sel);
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => {
        const node = document.querySelector(sel);
        if (node) { obs.disconnect(); resolve(node); }
        else if (Date.now() - start > timeout) { obs.disconnect(); resolve(null); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  function formatCurrencyBRL(value) {
    try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
    catch { return `R$ ${Number(value || 0).toFixed(2)}`; }
  }
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  // ---------- Estado ----------
  window.tamanhoSelecionado = window.tamanhoSelecionado || null;
  window.estoqueAtual = window.estoqueAtual || 0;
  window.carrinhoQuantidade = window.carrinhoQuantidade || 0;

  // ---------- Carrinho ----------
  function atualizarContadorCarrinho() {
    const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const total = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    window.carrinhoQuantidade = total;
    const contador = el("cart-count");
    if (contador) { contador.textContent = total; contador.style.display = "inline-block"; }
  }
  window.atualizarContadorCarrinho = atualizarContadorCarrinho;

  // ---------- Detalhes ----------
  async function carregarDetalhesProduto(id) {
    try {
      await waitForEl('productTitle');
      const resp = await fetch(`${window.apiBaseUrl}/produto/obter-por-id-detalhes/${id}`);
      if (!resp.ok) throw new Error(`Erro do backend: ${await resp.text()}`);
      const produto = await resp.json();

      el("productTitle") && (el("productTitle").textContent = produto.nome);
      el("productDescription") && (el("productDescription").textContent = produto.descricao || "");
      el("productPrice") && (el("productPrice").textContent = formatCurrencyBRL(produto.preco));

      window.estoqueAtual = Number(produto.estoque || 0);
      const estoqueBadge = el("estoqueBadge");
      const esgotado = window.estoqueAtual <= window.ESTOQUE_ESGOTADO_LIMIAR;
      if (estoqueBadge) {
        if (esgotado) {
          estoqueBadge.textContent = "Infelizmente, o estoque deste produto acabou. Em breve iremos repor!";
          estoqueBadge.className = "text-sm font-semibold text-red-600 mb-4";
          ["btnComprarDireto", "btnAdicionarCarrinho", "qtyMinus", "qtyPlus", "inputQuantidade"]
            .forEach(id => { const n = el(id); if (n) n.disabled = true; });
        } else {
          estoqueBadge.textContent = `Estoque: ${window.estoqueAtual}`;
          estoqueBadge.className = "text-xs text-gray-500 mb-4";
        }
      }

      const statsEl = el("productStats");
      if (statsEl) {
        const bruto = produto.qtdVisualizacao ?? 0;
        const valor = typeof bruto === "string" ? parseInt(bruto, 10) : Number(bruto);
        const ok = Number.isFinite(valor) && valor >= 0;
        (statsEl.querySelector("span") || statsEl).textContent =
          ` +${ok ? valor.toLocaleString("pt-BR") : "--"} ${valor === 1 ? "visualização" : "visualizações"}`;
      }

      if (Array.isArray(produto.tamanhosDisponiveis)) {
        const disp = produto.tamanhosDisponiveis.map(t => t.trim().toUpperCase());
        qsa(".tamanho-button").forEach(btn => {
          const v = btn.textContent.trim().toUpperCase();
          const ok = disp.includes(v);
          btn.disabled = !ok;
          btn.classList.toggle("opacity-50", !ok);
          btn.classList.toggle("cursor-not-allowed", !ok);
          btn.setAttribute("aria-disabled", String(!ok));
          btn.tabIndex = ok ? 0 : -1;
        });
        if (disp.length === 1) {
          const only = Array.from(qsa(".tamanho-button"))
            .find(b => b.textContent.trim().toUpperCase() === disp[0]);
          only && only.click();
        }
      } else {
        const c = el("tamanhosContainer");
        if (c) c.innerHTML = `<span class="text-sm text-gray-600">Tamanho único</span>`;
        window.tamanhoSelecionado = "ÚNICO";
        el("btnComprarDireto") && (el("btnComprarDireto").disabled = false);
        el("btnAdicionarCarrinho") && (el("btnAdicionarCarrinho").disabled = false);
      }

      el("imgSkeleton")?.classList.add("hidden");

      configurarSelecaoTamanho();
      configurarStepperQuantidade();
      setupSimpleLightbox();
    } catch (erro) {
      console.error("Erro ao carregar produto:", erro.message || erro);
      el("productTitle") && (el("productTitle").textContent = "Produto não encontrado");
      el("productDescription") && (el("productDescription").textContent = erro.message || "");
      el("productPrice") && (el("productPrice").textContent = "");
      el("productImage") && (el("productImage").src = "https://via.placeholder.com/800x800?text=Produto+não+encontrado");
      el("imgSkeleton")?.classList.add("hidden");
    }
  }
  window.carregarDetalhesProduto = carregarDetalhesProduto;

  // ---------- Imagens ----------
  async function carregarImagensProduto(id) {
    try {
      const resp = await fetch(`${window.apiBaseUrl}/produto/${id}/imagens`);
      if (!resp.ok) throw new Error("Erro ao buscar imagens do produto");
      const imagens = await resp.json();

      const mini = document.querySelector(".miniaturas-container");
      if (!mini) return;
      mini.innerHTML = "";

      if (!Array.isArray(imagens) || imagens.length === 0) {
        const img = el("productImage");
        if (img) img.src = "https://via.placeholder.com/800x800?text=Sem+imagem";
        el("imgSkeleton")?.classList.add("hidden");
        setupSimpleLightbox();
        return;
      }

      imagens.forEach((img, index) => {
        const thumb = document.createElement("img");
        thumb.src = img.url;
        thumb.alt = `Miniatura ${index + 1}`;
        thumb.className = "w-16 h-16 object-cover cursor-pointer border border-gray-300 rounded hover:ring-2 ring-yellow-400 focus:outline-none";
        thumb.tabIndex = 0;
        thumb.onclick = () => trocarImagem(img.url);
        thumb.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") trocarImagem(img.url); };
        mini.appendChild(thumb);

        if (img.imagemPrincipal || index === 0) {
          const big = el("productImage");
          if (big) big.src = img.url;
        }
      });

      el("imgSkeleton")?.classList.add("hidden");
      setupSimpleLightbox();
    } catch (erro) {
      console.error("Erro ao carregar imagens do produto:", erro);
      const img = el("productImage");
      if (img) img.src = "https://via.placeholder.com/800x800?text=Sem+imagem";
      el("imgSkeleton")?.classList.add("hidden");
      setupSimpleLightbox();
    }
  }
  window.carregarImagensProduto = carregarImagensProduto;

  function trocarImagem(src) {
    const img = el("productImage");
    if (img) img.src = src;
  }

  // ---------- Popup ----------
  function mostrarPopupSucesso(msg) {
    const popup = document.createElement("div");
    popup.textContent = msg;
    popup.className = `
      fixed top-8 left-1/2 transform -translate-x-1/2 
      bg-yellow-400 text-black font-semibold 
      px-6 py-3 rounded-lg shadow-lg 
      border border-yellow-500 z-50 
    `;
    document.body.appendChild(popup);
    setTimeout(() => { popup.style.opacity = "0"; popup.style.transition = "opacity .5s"; }, 1800);
    setTimeout(() => popup.remove(), 2400);
  }
  window.mostrarPopupSucesso = mostrarPopupSucesso;

  // ---------- Carrinho ----------
  function adicionarAoCarrinho(idProduto) {
    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const inputQ = el("inputQuantidade");
    const qtd = parseInt(inputQ?.value || "1");

    if (!window.tamanhoSelecionado) {
      alert("Por favor, selecione um tamanho antes de adicionar ao carrinho.");
      return;
    }

    const item = carrinho.find(i => i.idProduto === idProduto && i.tamanho === window.tamanhoSelecionado);
    if (item) item.quantidade += qtd;
    else carrinho.push({ idProduto, quantidade: qtd, tamanho: window.tamanhoSelecionado });

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();
    mostrarPopupSucesso("Produto adicionado ao carrinho com sucesso!");
  }
  window.adicionarAoCarrinho = adicionarAoCarrinho;

  // ---------- Seleção de tamanho ----------
  function configurarSelecaoTamanho() {
    const botoes = qsa(".tamanho-button");
    const comprar = el("btnComprarDireto");
    const addCart = el("btnAdicionarCarrinho");

    botoes.forEach((b) => {
      b.addEventListener("click", () => {
        if (b.disabled) return;
        botoes.forEach((x) => x.classList.remove("border-yellow-500", "bg-yellow-100", "font-semibold", "ring-2", "ring-yellow-300"));
        b.classList.add("border-yellow-500", "bg-yellow-100", "font-semibold", "ring-2", "ring-yellow-300");
        window.tamanhoSelecionado = b.textContent.trim();

        const indisponivel = window.estoqueAtual <= window.ESTOQUE_ESGOTADO_LIMIAR;
        if (comprar)  comprar.disabled  = indisponivel;
        if (addCart)  addCart.disabled  = indisponivel;
      });
    });

    if (comprar) comprar.disabled = true;
    if (addCart) addCart.disabled = true;
  }

  // ---------- Stepper ----------
  function configurarStepperQuantidade() {
    const minus = el("qtyMinus");
    const plus  = el("qtyPlus");
    const input = el("inputQuantidade");

    if (window.estoqueAtual <= window.ESTOQUE_ESGOTADO_LIMIAR) {
      [minus, plus, input].forEach(n => { if (n) n.disabled = true; });
      return;
    }

    const min = 1;
    const max = Math.max(1, Number(window.estoqueAtual || 99));

    if (input) {
      input.value = clamp(Number(input.value || 1), min, max);
      input.addEventListener("input", () => { input.value = clamp(Number(input.value || 1), min, max); });
    }
    if (minus) minus.onclick = () => { input.value = clamp(Number(input.value || 1) - 1, min, max); };
    if (plus)  plus.onclick  = () => { input.value = clamp(Number(input.value || 1) + 1, min, max); };
  }

  // ---------- Comprar direto ----------
  function irParaPagamentoDireto() {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const idProduto = parseInt(params.get('id'));
    const input = el("inputQuantidade");
    const quantidade = parseInt(input?.value || "1");

    if (!window.tamanhoSelecionado) { alert("Por favor, selecione um tamanho antes de comprar."); return; }
    if (!idProduto || quantidade <= 0) { alert("Produto ou quantidade inválida."); return; }

    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const item = carrinho.find(i => i.idProduto === idProduto && i.tamanho === window.tamanhoSelecionado);
    if (item) item.quantidade += quantidade;
    else carrinho.push({ idProduto, quantidade, tamanho: window.tamanhoSelecionado });

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();

    const query = `idProduto=${idProduto}&quantidade=${quantidade}`;
    navigateTo("pagamento", query);
  }
  window.irParaPagamentoDireto = irParaPagamentoDireto;

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    atualizarContadorCarrinho();
    setupSimpleLightbox(); // inicializa o lightbox simples

    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const id = parseInt(params.get('id'));
    if (id) {
      await waitForEl('productTitle');
      carregarDetalhesProduto(id);
      carregarImagensProduto(id).finally(() => {
        setupSimpleLightbox();
      });
    }
  });
})();

// ---------- Zoom / Lightbox SIMPLES (área segura + upscale) ----------
function setupSimpleLightbox() {
  const el = (id) => document.getElementById(id);

  const imgMain  = el("productImage");
  const btnZoom  = el("btnZoom");
  const overlay  = el("lightbox");
  const lbImg    = el("lightboxImg");
  const btnClose = el("lightboxClose");
  const htmlRoot = document.documentElement;

  if (!imgMain || !overlay || !lbImg || !btnZoom || !btnClose) return;

  // Área segura para header/footer fixos
  function computeSafeArea() {
    const tops = ['#siteHeader','.site-header','header.sticky','header.fixed','header','nav[role="navigation"]','.navbar','.topbar'];
    const bots = ['#siteFooter','.site-footer','footer','.footer'];

    function pickHeight(list, edge) {
      for (const sel of list) {
        const n = document.querySelector(sel);
        if (!n) continue;
        const cs = getComputedStyle(n);
        const rect = n.getBoundingClientRect();
        const fixedOrSticky = cs.position === 'fixed' || cs.position === 'sticky';
        if (!fixedOrSticky) continue;
        if (edge === 'top'    && Math.round(rect.top) <= 0)                         return rect.height;
        if (edge === 'bottom' && Math.round(window.innerHeight - rect.bottom) <= 0) return rect.height;
      }
      return 0;
    }

    let safeTop = pickHeight(tops, 'top');
    let safeBot = pickHeight(bots, 'bottom');

    safeTop = Math.max(safeTop, 16);
    safeBot = Math.max(safeBot, 16);

    overlay.style.setProperty('--lb-safe-top', `${safeTop}px`);
    overlay.style.setProperty('--lb-safe-bottom', `${safeBot}px`);

    return { safeTop, safeBot };
  }

  // Dimensiona a imagem para caber na área útil (com upscale)
  function fitImageToViewport() {
    const { safeTop, safeBot } = computeSafeArea();
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    const cs = getComputedStyle(overlay);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const usefulW = Math.max(100, window.innerWidth  - padX);
    const usefulH = Math.max(100, window.innerHeight - safeTop - safeBot);

    // usa quase tudo, mas deixa respiro (desktop e mobile)
    const targetW = usefulW * (isDesktop ? 0.98 : 0.98);
    const targetH = usefulH * 0.94;

    const iw = lbImg.naturalWidth  || imgMain.naturalWidth  || imgMain.width  || 800;
    const ih = lbImg.naturalHeight || imgMain.naturalHeight || imgMain.height || 800;

    const scale = Math.min(targetW / iw, targetH / ih);

    lbImg.style.width     = `${Math.floor(iw * scale)}px`;
    lbImg.style.height    = "auto";
    lbImg.style.maxWidth  = `${Math.floor(targetW)}px`;
    lbImg.style.maxHeight = `${Math.floor(targetH)}px`;
  }

  let resizeHandler = null;

  const open = () => {
    lbImg.src = imgMain.src || "";
    overlay.classList.remove("hidden");
    htmlRoot.classList.add("overflow-hidden");

    const ready = () => {
      fitImageToViewport();
      resizeHandler = () => {
        if (!overlay.classList.contains("hidden")) {
          fitImageToViewport();
        }
      };
      window.addEventListener("resize", resizeHandler);
      btnClose.focus?.();
    };

    if (lbImg.complete && lbImg.naturalWidth) ready();
    else {
      const once = () => { lbImg.removeEventListener("load", once); ready(); };
      lbImg.addEventListener("load", once);
    }
  };

  const close = () => {
    overlay.classList.add("hidden");
    htmlRoot.classList.remove("overflow-hidden");
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
  };

  // Binds idempotentes
  if (!btnZoom.dataset.lbBound) {
    btnZoom.addEventListener("click", open);
    btnZoom.dataset.lbBound = "1";
  }
  if (!imgMain.dataset.lbBound) {
    imgMain.addEventListener("click", open);
    imgMain.style.cursor = "zoom-in";
    imgMain.dataset.lbBound = "1";
  }
  if (!btnClose.dataset.lbBound) {
    btnClose.addEventListener("click", close);
    btnClose.dataset.lbBound = "1";
  }
  if (!overlay.dataset.lbBound) {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
    });
    overlay.dataset.lbBound = "1";
  }

  window.__closeZoom = close;
}
