async function carregarDetalhesProduto(id) {
  try {
    const resposta = await fetch(`${window.apiBaseUrl}/produto/obter-por-id-detalhes/${id}`);

    if (!resposta.ok) {
      const textoErro = await resposta.text(); // ou resposta.json() se for JSON
      throw new Error(`Erro do backend: ${textoErro}`);
    }

    const produto = await resposta.json();

    document.getElementById("productTitle").textContent = produto.nome;
    document.getElementById("productDescription").textContent = produto.descricao;
    document.getElementById("productPrice").textContent = `R$ ${produto.preco.toFixed(2)}`;

    // Lógica de tamanhos
    if (Array.isArray(produto.tamanhosDisponiveis)) {
      const tamanhosDisponiveis = produto.tamanhosDisponiveis.map(t => t.trim().toUpperCase());
      const botoesTamanho = document.querySelectorAll(".tamanho-button");

      botoesTamanho.forEach(botao => {
        const valor = botao.textContent.trim().toUpperCase();
        if (!tamanhosDisponiveis.includes(valor)) {
          botao.disabled = true;
          botao.classList.add("opacity-50", "cursor-not-allowed");
        }
      });
    }

    configurarSelecaoTamanho();
  } catch (erro) {
    console.error("Erro ao carregar produto:", erro.message || erro);

    document.getElementById("productTitle").textContent = "Produto não encontrado";
    document.getElementById("productDescription").textContent = erro.message || "";
    document.getElementById("productPrice").textContent = "";
    document.getElementById("productImage").src = "https://via.placeholder.com/600x600";
  }
}

  
  async function carregarImagensProduto(id) {
    try {
      const resposta = await fetch(`${window.apiBaseUrl}/produto/${id}/imagens`);
      if (!resposta.ok) throw new Error("Erro ao buscar imagens do produto");
  
      const imagens = await resposta.json();
  
      const miniaturasContainer = document.querySelector(".miniaturas-container");
      if (!miniaturasContainer) return;
  
      miniaturasContainer.innerHTML = "";
  
      imagens.forEach((img, index) => {
        const mini = document.createElement("img");
        mini.src = img.url;
        mini.className = "miniatura w-16 h-16 object-cover cursor-pointer border border-gray-300 rounded hover:ring-2 ring-yellow-400";
        mini.onclick = () => trocarImagem(img.url);
        miniaturasContainer.appendChild(mini);
  
        if (img.imagemPrincipal || index === 0) {
          document.getElementById("productImage").src = img.url;
        }
      });
    } catch (erro) {
      console.error("Erro ao carregar imagens do produto:", erro);
    }
  }
  
  function trocarImagem(novaSrc) {
    const imagemPrincipal = document.getElementById("productImage");
    if (imagemPrincipal) {
      imagemPrincipal.src = novaSrc;
    }
  }
  
 // Variável global
window.carrinhoQuantidade = 0;

function atualizarContadorCarrinho() {
    const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const total = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
  
    window.carrinhoQuantidade = total;
  
    const contador = document.getElementById("cart-count");
    if (contador) {
      contador.textContent = total;
      contador.style.display = "inline-block";
    }
  }
  
  window.atualizarContadorCarrinho = atualizarContadorCarrinho;
  
  document.addEventListener("DOMContentLoaded", () => {
    atualizarContadorCarrinho();
  });
  

  function mostrarPopupSucesso(mensagem) {
    const popup = document.createElement("div");
    popup.textContent = mensagem;
    popup.className = `
      fixed top-8 left-1/2 transform -translate-x-1/2 
      bg-yellow-400 text-black font-semibold 
      px-6 py-3 rounded-lg shadow-lg 
      border border-yellow-500 z-50 
      animate-slide-down
    `;
  
    document.body.appendChild(popup);
  
    setTimeout(() => {
      popup.classList.add("opacity-0");
      popup.classList.add("transition-opacity", "duration-500");
      setTimeout(() => popup.remove(), 500);
    }, 2000);
  }
  
  function adicionarAoCarrinho(idProduto) {
    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

    const campoQuantidade = document.querySelector('input[type="number"]');
    const quantidadeSelecionada = parseInt(campoQuantidade?.value || "1");

    const tamanhoSelecionado = window.tamanhoSelecionado;
    if (!tamanhoSelecionado) {
        alert("Por favor, selecione um tamanho antes de adicionar ao carrinho.");
        return;
    }

    // Procurar item no carrinho que tenha MESMO idProduto E MESMO tamanho
    const itemExistente = carrinho.find(item => item.idProduto === idProduto && item.tamanho === tamanhoSelecionado);

    if (itemExistente) {
        itemExistente.quantidade += quantidadeSelecionada;
    } else {
        carrinho.push({ idProduto, quantidade: quantidadeSelecionada, tamanho: tamanhoSelecionado });
    }

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();
    mostrarPopupSucesso("Produto adicionado ao carrinho com sucesso!");
}

 
  window.tamanhoSelecionado = window.tamanhoSelecionado || null;


  function configurarSelecaoTamanho() {
    const botoesTamanho = document.querySelectorAll(".tamanho-button");
    const botaoComprarDireto = document.getElementById("btnComprarDireto");
    const botaoAdicionarCarrinho = document.getElementById("btnAdicionarCarrinho");
  
    botoesTamanho.forEach((botao) => {
      botao.addEventListener("click", () => {
        botoesTamanho.forEach((b) => {
          b.classList.remove("border-yellow-500", "bg-yellow-100", "font-semibold", "ring-2", "ring-yellow-300");
        });
  
        botao.classList.add("border-yellow-500", "bg-yellow-100", "font-semibold", "ring-2", "ring-yellow-300");
  
        window.tamanhoSelecionado = botao.textContent.trim();
        console.log("Tamanho selecionado:", window.tamanhoSelecionado);
  
        // Ativa os botões ao selecionar tamanho
        if (botaoComprarDireto && botaoAdicionarCarrinho) {
          botaoComprarDireto.disabled = false;
          botaoAdicionarCarrinho.disabled = false;
        }
      });
    });
  
    // Desabilitar os botões no início
    if (botaoComprarDireto && botaoAdicionarCarrinho) {
      botaoComprarDireto.disabled = true;
      botaoAdicionarCarrinho.disabled = true;
    }
  }
  
  
  function irParaPagamentoDireto() {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const idProduto = parseInt(params.get('id'));
    const campoQuantidade = document.querySelector('input[type="number"]');
    const quantidade = parseInt(campoQuantidade?.value || "1");

    const tamanhoSelecionado = window.tamanhoSelecionado;
    if (!tamanhoSelecionado) {
        alert("Por favor, selecione um tamanho antes de comprar.");
        return;
    }

    if (!idProduto || quantidade <= 0) {
        alert("Produto ou quantidade inválida.");
        return;
    }

    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const itemExistente = carrinho.find(item => item.idProduto === idProduto && item.tamanho === tamanhoSelecionado);

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
    } else {
        carrinho.push({ idProduto, quantidade, tamanho: tamanhoSelecionado });
    }

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();

    const query = `idProduto=${idProduto}&quantidade=${quantidade}`;
    navigateTo("pagamento", query);
}

  

// Expor funções globalmente (essencial se for HTML dinâmico)
window.atualizarContadorCarrinho = atualizarContadorCarrinho;
window.adicionarAoCarrinho = adicionarAoCarrinho;
// Ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  atualizarContadorCarrinho();
});



  