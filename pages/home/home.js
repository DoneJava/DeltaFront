const pageSize = 10;
let produtos = [];
let totalItems = 0;
let totalPages = 0;
let currentPage = 0;

let categoriasSelecionadas = [];

function carregarProdutos() {
  fetch(`${window.apiBaseUrl}/produto/obter-todos`)
    .then(res => res.json())
    .then(data => {
      produtos = data;
      totalItems = produtos.length;
      totalPages = Math.ceil(totalItems / pageSize);
      renderProducts();

      // ✅ Captura checkboxes DEPOIS do HTML estar 100% carregado
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
    })
    .catch(erro => {
      console.error("Erro ao carregar produtos:", erro);
      document.getElementById("productGrid").innerHTML =
        `<p class='text-red-500'>Erro ao carregar os produtos. Tente novamente mais tarde.</p>`;
    });
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
    productGrid.innerHTML = "<p class='text-red-500'>Nenhum produto encontrado com os filtros aplicados.</p>";
  } else {
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
  carregarProdutos();

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

  // ✅ Evita múltiplos carregamentos do carrossel
  setInterval(() => moverCarrossel(1), 3000);
});


let indiceAtual = 0;

function moverCarrossel(direcao) {
  const carrossel = document.getElementById("carousel");
  const totalSlides = carrossel.children.length;
  indiceAtual = (indiceAtual + direcao + totalSlides) % totalSlides;
  carrossel.style.transform = `translateX(-${indiceAtual * 100}%)`;
}

// Carrossel automático (executado após o DOM estar carregado)
document.addEventListener("DOMContentLoaded", () => {
  setInterval(() => moverCarrossel(1), 3000);
});
