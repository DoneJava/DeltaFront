const pageSize = 10;
let produtos = [];
let totalItems = 0;
let totalPages = 0;
let currentPage = 0;

let categoriasSelecionadas = [];

function carregarProdutos() {
  const loadingDiv = document.getElementById("loadingProdutos");
  if (loadingDiv) loadingDiv.style.display = "flex";
  fetch(`${window.apiBaseUrl}/produto/obter-todos`)
    .then(res => res.json())
    .then(data => {
      if (loadingDiv) loadingDiv.style.display = "none";
      setTimeout(() => {
      produtos = data;
      totalItems = produtos.length;
      totalPages = Math.ceil(totalItems / pageSize);
      renderProducts();

      const categoriaBtns = document.querySelectorAll(".checkbox-amarelo");
      categoriaBtns.forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
          const categoria = event.target.getAttribute("data-category")?.toLowerCase();
          if (event.target.checked) {
            if (!categoriasSelecionadas.includes(categoria)) {
              categoriasSelecionadas.push(categoria);
            }
          } else {
            categoriasSelecionadas = categoriasSelecionadas.filter(c => c !== categoria);
          }
          currentPage = 0;
          console.log("✅ Categorias selecionadas:", categoriasSelecionadas);
          renderProducts();
        });
      });
    }, 500); // ⏱️ Delay de 1 segundo após o loading sumir
  })
    .catch(erro => {
    if (loadingDiv) loadingDiv.style.display = "none";

    setTimeout(() => {
      const productGrid = document.getElementById("productGrid");

      if (productGrid) {
        productGrid.style.display = "flex";
        productGrid.style.justifyContent = "center";
        productGrid.style.alignItems = "center";
        productGrid.style.minHeight = "400px";
        productGrid.style.width = "100%";

        productGrid.innerHTML = `
          <div style="
            background-color: #facc15;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            text-align: center;
            max-width: 700px;
            margin: auto;
          ">
            <p style="
              color: black;
              font-size: 2rem;
              font-weight: bold;
              line-height: 1.4;
            ">
              Infelizmente tivemos um problema ao carregar os produtos no momento.<br>
              Por favor, tente novamente mais tarde. 😔
            </p>
          </div>
        `;
      }
    }, 500); // ⏱️ Delay de 1 segundo antes de mostrar erro
  });
}

function limparEstilosMensagemVazia() {
  const productGrid = document.getElementById("productGrid");
  if (!productGrid) return;

  // Remove apenas os estilos aplicados dinamicamente no modo "vazio"
  productGrid.style.display = "";
  productGrid.style.justifyContent = "";
  productGrid.style.alignItems = "";
  productGrid.style.minHeight = "";
  productGrid.style.width = "";
}


function renderProducts(filtro = "") {
  const productGrid = document.getElementById("productGrid");
  const pagination = document.getElementById("pagination");

  if (!productGrid || !pagination) return;
  console.log("Categorias selecionadas:", categoriasSelecionadas);
  console.log("Primeiro produto retornado:", produtos[0]);
  
  productGrid.innerHTML = "";

  // Filtra os produtos com base no nome e nas categorias selecionadas
  const produtosFiltrados = produtos.filter((p) => {
    // Protege caso p.categorias venha undefined ou null
    const categoriasProduto = (p.categorias || "")
      .split(";")
      .map(c => c.trim().toLowerCase());
  
    const correspondeAoFiltroNome = p.nome.toLowerCase().includes(filtro.toLowerCase());
  
    const correspondeAosFiltrosCategoria =
      categoriasSelecionadas.length === 0 ||
      categoriasSelecionadas.some(categoria =>
        categoriasProduto.includes(categoria.toLowerCase())
      );
  
    return correspondeAoFiltroNome && correspondeAosFiltrosCategoria;
  });
  

  const start = currentPage * pageSize;
  const end = start + pageSize;

  // Verifica se algum produto foi filtrado
  if (produtosFiltrados.length === 0) {
   productGrid.style.display = "flex";
productGrid.style.justifyContent = "center";
productGrid.style.alignItems = "center";
productGrid.style.minHeight = "400px";
productGrid.style.width = "100%";

productGrid.innerHTML = `
  <div style="
    background-color: #facc15;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    text-align: center;
    max-width: 700px;
    margin: auto;
  ">
    <p style="
      color: black;
      font-size: 2rem;
      font-weight: bold;
      line-height: 1.4;
    ">
      Ops! Nenhum produto encontrado com os filtros escolhidos.<br>
      Tente ajustar os filtros para encontrar algo incrível! 🏋️‍♂️👟
    </p>
  </div>
`;

  } else {
     limparEstilosMensagemVazia(); 
    for (let i = start; i < end && i < produtosFiltrados.length; i++) {
      const produto = produtosFiltrados[i];

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

  totalPages = Math.ceil(produtosFiltrados.length / pageSize);
  renderPagination();
}

function renderPagination() {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";
  pagination.style.flexDirection = "row";
  pagination.className = "flex justify-center items-center flex-wrap gap-2 mt-6";

  const maxVisibleButtons = 4;
  let start = Math.max(currentPage - 1, 0);
  let end = Math.min(start + maxVisibleButtons, totalPages);

  if (end - start < maxVisibleButtons && start > 0) {
    start = Math.max(end - maxVisibleButtons, 0);
  }

  if (start > 0) {
    const prevDots = document.createElement("span");
    prevDots.innerText = "...";
    prevDots.className = "px-2 text-gray-400 text-lg";
    pagination.appendChild(prevDots);
  }

  for (let i = start; i < end; i++) {
    const btn = document.createElement("button");
    btn.innerText = i + 1;
    btn.className = `px-3 h-10 flex items-center justify-center text-center rounded font-bold transition ${
      i === currentPage
        ? "bg-yellow-400 text-black ring-2 ring-yellow-600"
        : "bg-yellow-300 text-black hover:bg-yellow-200"
    }`;
    btn.onclick = () => {
      currentPage = i;
      const input = window.innerWidth < 640
        ? document.getElementById("searchBarMobile")
        : document.getElementById("searchBar");
      renderProducts(input?.value || "");
    };
    pagination.appendChild(btn);
  }

  if (end < totalPages) {
    const nextDots = document.createElement("span");
    nextDots.innerText = "...";
    nextDots.className = "px-2 text-gray-400 text-lg";
    pagination.appendChild(nextDots);
  }
}

// 🔍 Função de busca atualizada para mobile e desktop
function searchProducts() {
  const isMobile = window.innerWidth < 640;
  const input = isMobile
    ? document.getElementById("searchBarMobile")
    : document.getElementById("searchBar");

  const searchQuery = input?.value || "";
  currentPage = 0;
  renderProducts(searchQuery);
}

document.addEventListener("DOMContentLoaded", () => {

  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  const categoriaBtns = document.querySelectorAll(".checkbox-amarelo");


  const isMobile = () => window.innerWidth < 1024;

  const updateSidebarVisibility = () => {
    if (isMobile()) {
      sidebar.classList.add("hidden");
      toggleBtn.textContent = "Mostrar Categorias";
    } else {
      sidebar.classList.remove("hidden");
      toggleBtn.textContent = "";
    }
  };

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
      toggleBtn.textContent = sidebar.classList.contains("hidden")
        ? "Mostrar Categorias"
        : "Fechar Categorias";
    });

    window.addEventListener("resize", updateSidebarVisibility);
    updateSidebarVisibility();
  }

  // ✅ Aqui está o ponto crítico: checkbox precisa converter o nome pra lowercase
  categoriaBtns.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const categoria = event.target.getAttribute("data-category")?.toLowerCase();

      if (event.target.checked) {
        if (!categoriasSelecionadas.includes(categoria)) {
          categoriasSelecionadas.push(categoria);
        }
      } else {
        categoriasSelecionadas = categoriasSelecionadas.filter(
          (cat) => cat !== categoria
        );
      }

      currentPage = 0; // volta pra página 1
      console.log("✅ Categorias selecionadas:", categoriasSelecionadas);
      renderProducts();
    });
  });

  let nomePagina = window.location.pathname.split('/').pop();

  if(nomePagina == 'home'){
    // ✅ Evita múltiplos carregamentos do carrossel
    setInterval(() => moverCarrossel(1), 5000);
  }
});


let indiceAtual = 0;

function moverCarrossel(direcao) {
  const carrossel = document.getElementById("carousel");
  const totalSlides = carrossel.querySelectorAll(".slide-grupo").length;

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
          <p class="text-4xl">Pra botar o shape! 🔥</p>
          <p class="text-3xl text-yellow-800 font-bold">Treinar com conforto!!!</p>
          <p class="text-3xl text-yellow-700 italic">Parcele em 10x 💥</p>
        </div>`,
        `<div class="text-center text-yellow-900 font-extrabold leading-tight space-y-2">
          <p class="text-4xl">Estilo garantido 🎯</p>
          <p class="text-3xl text-yellow-800 font-bold">Conforto e impacto!</p>
          <p class="text-3xl text-yellow-700 italic">Você merece! 🌟</p>
        </div>`,
        `<div class="text-center text-yellow-900 font-extrabold leading-tight space-y-2">
          <p class="text-4xl">Atitude é tudo 💪🏼</p>
          <p class="text-3xl text-yellow-800 font-bold">Vista o que representa.</p>
          <p class="text-3xl text-yellow-700 italic">Mostre quem você é 💥</p>
        </div>`
      ];

      carousel.innerHTML = "";
      carousel.style.width = "100%";
      carousel.style.display = "flex";
      carousel.style.transition = "transform 0.7s ease-in-out";

      const totalSlides = Math.ceil(produtos.length / 1);

      for (let i = 0; i < totalSlides; i++) {
        const grupo = document.createElement("div");
        grupo.className = "slide-grupo flex-shrink-0 w-full h-full flex items-stretch justify-between gap-0 bg-yellow-300";

        const produto = produtos[i];
        const imagemProduto = produto.imagemUrl?.trim()
          ? produto.imagemUrl
          : "https://via.placeholder.com/300x200?text=Sem+Imagem";

        const imagemDestaque = imagensDestaque[i % imagensDestaque.length];

        const card = document.createElement("div");
        card.className = "w-full flex flex-row items-center cursor-pointer";
        card.onclick = () => navigateTo('produto-detalhes', `id=${produto.produtoID}`);
        card.innerHTML = `
          <!-- IMAGEM DESTAQUE -->
          <div class="w-[calc(50%+50px)] h-96 overflow-hidden flex items-center justify-center bg-white">
            <img src="${imagemDestaque}" alt="Promoção"
              class="h-full w-auto object-fill rounded-none" />
          </div>

          <!-- PRODUTO -->
          <div class="w-[20%] h-96 bg-[#fccb06] flex items-center justify-center">
            <img src="${imagemProduto}"
              class="h-72 sm:h-80 md:h-96 object-contain transition-transform duration-500 hover:scale-105 rounded shadow"/>
          </div>

          <!-- TEXTO CRIATIVO -->
          <div class="flex-1 h-96 bg-gradient-to-r from-yellow-400 via-yellow-400 to-yellow-200 flex items-center justify-center px-6">
            ${mensagensDestaque[i % mensagensDestaque.length]}
          </div>
        `;

        grupo.appendChild(card);
        carousel.appendChild(grupo);
      }
    }, 500); // ⏱️ Delay de 500ms para exibir o carrossel
  } catch (erro) {
    if (loadingCarrossel) loadingCarrossel.style.display = "none";
    console.error("❌ Erro ao carregar carrossel de destaques:", erro);
  }
}

