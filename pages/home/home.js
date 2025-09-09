/* =============================================================================
 * HOME (listagem de produtos) — JS
 * - Paginação com elipses (“...”) clicáveis em blocos
 * - Filtros por categoria (checkbox)
 * - Busca (desktop e mobile; prioriza nome, depois descrição)
 * - Carrossel de destaques
 * - Sidebar off-canvas no mobile (CONTROLADA PELO JS GLOBAL)
 * ============================================================================= */

/* ============================================================================
 * Estado global
 * ========================================================================== */
const pageSize = 10;
let produtos = [];
let totalItems = 0;
let totalPages = 0;
let currentPage = 0;
let categoriasSelecionadas = [];
let indiceAtual = 0; // carrossel

/* ============================================================================
 * Utilidades de DOM / Estilo
 * ========================================================================== */
function limparEstilosMensagemVazia() {
  const productGrid = document.getElementById("productGrid");
  if (!productGrid) return;
  productGrid.style.display = "";
  productGrid.style.justifyContent = "";
  productGrid.style.alignItems = "";
  productGrid.style.minHeight = "";
  productGrid.style.width = "";
}

function aplicarEstiloMensagemCentralizada(el) {
  el.style.display = "flex";
  el.style.justifyContent = "center";
  el.style.alignItems = "center";
  el.style.minHeight = "400px";
  el.style.width = "100%";
}

/* ============================================================================
 * Carregamento inicial de produtos
 * ========================================================================== */
function carregarProdutos() {
  const loadingDiv = document.getElementById("loadingProdutos");
  if (loadingDiv) loadingDiv.style.display = "flex";

  fetch(`${window.apiBaseUrl}/produto/obter-todos`)
    .then(res => res.json())
    .then(data => {
      if (loadingDiv) loadingDiv.style.display = "none";

      setTimeout(() => {
        produtos = Array.isArray(data) ? data : [];
        totalItems = produtos.length;

        // ✅ catálogo totalmente vazio vindo do backend
        if (totalItems === 0) {
          mostrarMensagemCatalogoVazio();
          bindCategoryCheckboxes(); // ainda pode manter os filtros visíveis
          return; // não segue para renderProducts
        }

        totalPages = Math.ceil(totalItems / pageSize);
        renderProducts();

        // checkboxes das categorias (idempotente)
        bindCategoryCheckboxes();
      }, 500);
    })
    .catch(() => {
      if (loadingDiv) loadingDiv.style.display = "none";

      setTimeout(() => {
        const productGrid = document.getElementById("productGrid");
        if (!productGrid) return;

        aplicarEstiloMensagemCentralizada(productGrid);
        productGrid.innerHTML = `
          <div style="
            background-color: #facc15;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            text-align: center;
            max-width: 700px;
            margin: auto;">
            <p style="
              color: black;
              font-size: 2rem;
              font-weight: bold;
              line-height: 1.4;">
              Tivemos um imprevisto ao carregar os produtos.<br>
              Volte em instantes — força & fé! ✝️💪
            </p>
          </div>`;
      }, 500);
    });
}

/* ============================================================================
 * Vínculo dos checkboxes de categoria (idempotente)
 * ========================================================================== */
function bindCategoryCheckboxes() {
  const categoriaBtns = document.querySelectorAll(".checkbox-amarelo");
  categoriaBtns.forEach((checkbox) => {
    if (checkbox.dataset.bound === "1") return; // evita múltiplos binds

    checkbox.addEventListener("change", (event) => {
      const categoria = event.target.getAttribute("data-category")?.toLowerCase();
      if (!categoria) return;

      if (event.target.checked) {
        if (!categoriasSelecionadas.includes(categoria)) {
          categoriasSelecionadas.push(categoria);
        }
      } else {
        categoriasSelecionadas = categoriasSelecionadas.filter(c => c !== categoria);
      }

      currentPage = 0;
      renderProducts(getSearchQuery());
    });

    checkbox.dataset.bound = "1";
  });
}

/* ============================================================================
 * Renderização da grade de produtos + paginação
 * ========================================================================== */
function renderProducts(filtro = "") {
  const productGrid = document.getElementById("productGrid");
  const pagination  = document.getElementById("pagination");
  if (produtos.length === 0) {
  // ✅ garante a mesma mensagem caso alguém chame renderProducts() direto
  mostrarMensagemCatalogoVazio();
  return;
}
  if (!productGrid || !pagination) return;

  productGrid.innerHTML = "";

  // ----- filtro por texto (nome + descrição) e categorias -----
  const q = normalizeTxt(filtro);
  const produtosFiltrados = produtos.filter((p) => {
    const categoriasProduto = (p.categorias || "")
      .split(";")
      .map((c) => c.trim().toLowerCase());

    const correspondeAosFiltrosCategoria =
      categoriasSelecionadas.length === 0 ||
      categoriasSelecionadas.some((categoria) =>
        categoriasProduto.includes(String(categoria).toLowerCase())
      );

    if (!q) return correspondeAosFiltrosCategoria; // sem texto, só categorias

    const nomeNorm = normalizeTxt(p.nome);
    const descNorm = normalizeTxt(p.descricao || "");

    const hitNome = nomeNorm.includes(q);
    const hitDesc = descNorm.includes(q);

    return correspondeAosFiltrosCategoria && (hitNome || hitDesc);
  });

  // ----- ordenação: prioriza match NO NOME; depois posição do match -----
  let ordenados;
  if (!q) {
    ordenados = produtosFiltrados.slice(); // mantém ordem natural quando sem busca
  } else {
    const rankeados = produtosFiltrados.map((p, idx) => {
      const nomeNorm = normalizeTxt(p.nome);
      const descNorm = normalizeTxt(p.descricao || "");
      const idxNome  = nomeNorm.indexOf(q);
      const idxDesc  = descNorm.indexOf(q);
      const score    = (idxNome !== -1 ? 2 : 0) + (idxDesc !== -1 ? 1 : 0); // nome vale mais
      return { p, score, idxNome: idxNome === -1 ? 9999 : idxNome, idxDesc: idxDesc === -1 ? 9999 : idxDesc, idx };
    });

    rankeados.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;            // nome+desc > nome > desc
      if (a.idxNome !== b.idxNome) return a.idxNome - b.idxNome;    // começa mais cedo no nome
      if (a.idxDesc !== b.idxDesc) return a.idxDesc - b.idxDesc;    // começa mais cedo na descrição
      return a.idx - b.idx;                                         // estável
    });

    ordenados = rankeados.map((r) => r.p);
  }

  // ----- paginação/slice -----
  const start = currentPage * pageSize;
  const end   = start + pageSize;

  if (ordenados.length === 0) {
    aplicarEstiloMensagemCentralizada(productGrid);
    productGrid.innerHTML = `
      <div style="
        background-color: #facc15;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        text-align: center;
        max-width: 700px;
        margin: auto;">
        <p style="color: black; font-size: 2rem; font-weight: bold; line-height: 1.4;">
          Ops! Não encontramos nada com esses critérios.<br>
          Ajuste a busca ou os filtros e tente de novo. ✝️🏋️
        </p>
      </div>`;
  } else {
    limparEstilosMensagemVazia();

    for (let i = start; i < end && i < ordenados.length; i++) {
      const produto = ordenados[i];
      const imagemUrl = produto.imagemUrl?.trim()
        ? produto.imagemUrl
        : "https://via.placeholder.com/300x200?text=Sem+Imagem";

      const card = document.createElement("div");
      card.className = "bg-white rounded-lg shadow hover:shadow-lg transition p-4 cursor-pointer";
      card.onclick = () => {
        navigateTo("produto-detalhes", `id=${produto.produtoID}`);
      };

      card.innerHTML = `
        <img src="${imagemUrl}" alt="Produto" class="w-full h-40 object-cover rounded mb-4" />
        <h3 class="text-lg font-bold text-gray-900">${produto.nome}</h3>
        <p class="text-sm text-gray-600 truncate">${produto.descricao}</p>
        <p class="text-yellow-600 font-bold mt-2">R$ ${produto.preco.toFixed(2)}</p>
      `;
      productGrid.appendChild(card);
    }
  }

  totalPages = Math.ceil(ordenados.length / pageSize);
  renderPagination();
}

/* ============================================================================
 * Paginação com elipses (“...”) clicáveis
 * ========================================================================== */
function renderPagination() {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";
  pagination.className =
    "flex flex-row flex-nowrap justify-center items-center gap-2 mt-6 overflow-x-auto no-scrollbar";

  if (totalPages <= 1) return;

  const maxVisible = 3; // botões por bloco
  const currentBlockStart = Math.floor(currentPage / maxVisible) * maxVisible;
  const currentBlockEnd   = Math.min(currentBlockStart + maxVisible, totalPages);

  if (currentPage > 0) {
    pagination.appendChild(pageNavBtn("‹", () => gotoPage(currentPage - 1), true));
  }

  if (currentBlockStart > 0) {
    pagination.appendChild(ellipsisBtn(() => gotoPage(Math.max(0, currentPage - maxVisible))));
  }

  for (let i = currentBlockStart; i < currentBlockEnd; i++) {
    pagination.appendChild(pageNumberBtn(i + 1, () => gotoPage(i), i === currentPage));
  }

  if (currentBlockEnd < totalPages) {
    pagination.appendChild(ellipsisBtn(() => gotoPage(Math.min(totalPages - 1, currentPage + maxVisible))));
  }

  if (currentPage < totalPages - 1) {
    pagination.appendChild(pageNavBtn("›", () => gotoPage(currentPage + 1), true));
  }
}

function pageNumberBtn(label, onClick, active = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerText = String(label);
  btn.className = [
    "px-3 h-10 inline-flex items-center justify-center text-center rounded font-bold transition",
    active
      ? "bg-yellow-400 text-black ring-2 ring-yellow-600"
      : "bg-yellow-300 text-black hover:bg-yellow-200"
  ].join(" ");
  btn.onclick = onClick;
  return btn;
}

function pageNavBtn(label, onClick, subtle = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", label === "‹" ? "Página anterior" : "Próxima página");
  btn.innerText = label;
  btn.className = [
    "px-3 h-10 inline-flex items-center justify-center text-center rounded font-bold transition",
    subtle ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-yellow-300 text-black hover:bg-yellow-200"
  ].join(" ");
  btn.onclick = onClick;
  return btn;
}

function ellipsisBtn(onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerText = "...";
  btn.setAttribute("aria-label", "Ver mais páginas");
  btn.className =
    "px-2 h-10 inline-flex items-center justify-center text-center rounded font-bold text-gray-400 hover:text-gray-600";
  btn.onclick = onClick;
  return btn;
}

function gotoPage(i) {
  currentPage = i;
  renderProducts(getSearchQuery());
}

/* ============================================================================
 * Busca (desktop e mobile)
 * ========================================================================== */
function getSearchQuery() {
  const isMobile = window.innerWidth < 640;
  const input = isMobile
    ? document.getElementById("searchBarMobile")
    : document.getElementById("searchBar");
  return (input?.value || "").trim();
}

function searchProducts() {
  currentPage = 0;
  renderProducts(getSearchQuery());
}

/* ============================================================================
 * Carrossel de destaques
 * ========================================================================== */
function moverCarrossel(direcao) {
  const carrossel = document.getElementById("carousel");
  if (!carrossel) return;

  const totalSlides = carrossel.querySelectorAll(".slide-grupo").length;

  // ainda não carregou ou só 1 slide -> nada pra mover
  if (totalSlides <= 1) return;

  // se alguma chamada anterior quebrou e virou NaN, reseta
  if (!Number.isFinite(indiceAtual) || indiceAtual < 0) indiceAtual = 0;

  indiceAtual = (indiceAtual + direcao + totalSlides) % totalSlides;
  carrossel.style.transform = `translateX(-${indiceAtual * 100}%)`;
}


async function carregarProdutosDestaqueCarrossel() {
  const loadingCarrossel = document.getElementById("loadingCarrossel");
  const carousel = document.getElementById("carousel");
  if (loadingCarrossel) loadingCarrossel.style.display = "flex";

  try {
    const resposta = await fetch(`${window.apiBaseUrl}/produto/obter-destaques`);
    if (!resposta.ok) throw new Error("Erro ao buscar produtos de destaque.");

    const produtos = await resposta.json();
    if (!carousel) return;

    setTimeout(() => {
      if (loadingCarrossel) loadingCarrossel.style.display = "none";

      const imagensDestaque = [
        "imagens/Destaque 1.png",
        "imagens/Destaque 2.png",
        "imagens/Destaque 3.png"
      ];

      const mensagensDestaque = [
        `<div class="text-center text-yellow-900 font-extrabold leading-tight space-y-2">
          <p class="text-4xl">Força & Fé 🔥</p>
          <p class="text-3xl text-yellow-800 font-bold">Treine com propósito.</p>
          <p class="text-3xl text-yellow-700 italic">(Fp 4:13)</p>
        </div>`,
        `<div class="text-center text-yellow-900 font-extrabold leading-tight space-y-2">
          <p class="text-4xl">Estilo que inspira 🎯</p>
          <p class="text-3xl text-yellow-800 font-bold">Conforto para ir além.</p>
          <p class="text-3xl text-yellow-700 italic">(Hb 12:1)</p>
        </div>`,
        `<div class="text-center text-yellow-900 font-extrabold leading-tight space-y-2">
          <p class="text-4xl">Atitude & Propósito 💪🏼</p>
          <p class="text-3xl text-yellow-800 font-bold">Vista o que você crê.</p>
          <p class="text-3xl text-yellow-700 italic">Seja luz na academia. ✨</p>
        </div>`
      ];

      carousel.innerHTML = "";
      carousel.style.width = "100%";
      carousel.style.display = "flex";
      carousel.style.transition = "transform 0.7s ease-in-out";

      const totalSlides = Math.ceil(produtos.length / 1);

      for (let i = 0; i < totalSlides; i++) {
        const grupo = document.createElement("div");
        grupo.className = "slide-grupo slide-gradiente flex-shrink-0 w-full h-full flex items-stretch justify-between gap-0 rounded-2xl overflow-hidden";

        const produto = produtos[i];
        const imagemProduto = produto?.imagemUrl?.trim()
          ? produto.imagemUrl
          : "https://via.placeholder.com/300x200?text=Sem+Imagem";

        const imagemDestaque = imagensDestaque[i % imagensDestaque.length];

        const card = document.createElement("div");
        card.className = "w-full flex flex-row items-center cursor-pointer";
        card.onclick = () => navigateTo('produto-detalhes', `id=${produto?.produtoID}`);

        card.innerHTML = `
          <!-- IMAGEM DESTAQUE -->
          <div class="banner-suave w-[calc(50%+50px)] h-96 overflow-hidden flex items-center justify-center">
            <img src="${imagemDestaque}" alt="Promoção" class="h-full w-auto object-fill rounded-none" />
          </div>

          <!-- PRODUTO -->
          <div class="tinta-suave w-[20%] h-96 flex items-center justify-center">
            <img src="${imagemProduto}"
                 class="h-72 sm:h-80 md:h-96 object-contain transition-transform duration-500 hover:scale-105 rounded shadow"/>
          </div>

          <!-- TEXTO CRIATIVO -->
          <div class="bloco-transparente flex-1 h-96 flex items-center justify-center px-6">
            ${mensagensDestaque[i % mensagensDestaque.length]}
          </div>
        `;

        grupo.appendChild(card);
        carousel.appendChild(grupo);

        // reset de posição e autoplay depois que os slides existem
        indiceAtual = 0;
        requestAnimationFrame(() => {
          const carrossel = document.getElementById("carousel");
          if (carrossel) carrossel.style.transform = 'translateX(0%)';
});

// evita múltiplos timers
if (window._carouselTimer) clearInterval(window._carouselTimer);
window._carouselTimer = setInterval(() => moverCarrossel(1), 5000);

      }
    }, 500);
  } catch (erro) {
    if (loadingCarrossel) loadingCarrossel.style.display = "none";
    console.error("❌ Erro ao carregar carrossel de destaques:", erro);
  }
}

/* helpers */
function normalizeTxt(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mostrarMensagemCatalogoVazio() {
  const productGrid = document.getElementById("productGrid");
  const pagination  = document.getElementById("pagination");
  if (!productGrid) return;

  aplicarEstiloMensagemCentralizada(productGrid);
  productGrid.innerHTML = `
    <div style="
      background-color: #facc15;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      text-align: center;
      max-width: 700px;
      margin: auto;">
      <p style="color: black; font-size: 2rem; font-weight: bold; line-height: 1.4;">
        No momento não há produtos disponíveis.<br>
        Estamos repondo o estoque e novidades chegam em breve. ✝️💪
      </p>
    </div>`;
  if (pagination) pagination.innerHTML = "";
}

/* ============================================================================
 * Boot da página
 * ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  bindCategoryCheckboxes();
  const nomePagina = window.location.pathname.split('/').pop();
  if (nomePagina === 'home') {
    carregarProdutosDestaqueCarrossel();  // << carrega os slides
    setInterval(() => moverCarrossel(1), 5000);
  }
});


/* ============================================================================
 * Exposição
 * ========================================================================== */
window.carregarProdutos = carregarProdutos;
window.renderProducts = renderProducts;
window.searchProducts = searchProducts;
window.moverCarrossel = moverCarrossel;
window.carregarProdutosDestaqueCarrossel = carregarProdutosDestaqueCarrossel;
