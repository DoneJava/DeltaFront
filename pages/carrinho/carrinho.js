async function carregarCarrinho() {
  const container = document.getElementById("cartItems");
  const totalContainer = document.getElementById("totalCarrinho");

  const carrinho = (JSON.parse(localStorage.getItem("carrinho")) || [])
      .filter(item => item && typeof item === "object" && "idProduto" in item && "quantidade" in item);

  if (carrinho.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-500">Seu carrinho está vazio.</p>`;
      totalContainer.textContent = "R$ 0,00";
      return;
  }

  try {
      const ids = carrinho.map(p => p.idProduto);

      const resposta = await fetch(`${window.apiBaseUrl}/produto/obter-por-ids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids)
      });

      if (!resposta.ok) throw new Error("Erro ao buscar produtos");

      const produtos = await resposta.json();
      let total = 0;
      container.innerHTML = "";

      carrinho.forEach(item => {
          const produto = produtos.find(p => p.produtoID === item.idProduto);
          if (!produto) return;

          const subtotal = produto.preco * item.quantidade;
          total += subtotal;

          const itemDiv = document.createElement("div");
          itemDiv.className = "flex items-center justify-between border-b py-4";

          itemDiv.innerHTML = `
              <div class="flex items-start justify-between w-full gap-4">
                  <div class="block w-24 h-24 shrink-0 cursor-pointer" onclick="navigateTo('produto-detalhes', 'id=${produto.produtoID}')">
                      <img src="${produto.imagemUrl}" alt="${produto.nome}" class="w-24 h-24 object-cover rounded-lg shadow hover:brightness-90 transition" />
                  </div>

                  <div class="flex flex-col justify-between flex-1">
                      <div>
                          <h3 onclick="navigateTo('produto-detalhes', 'id=${produto.produtoID}')" class="text-lg font-bold text-gray-800 hover:underline cursor-pointer">
                              ${produto.nome}
                          </h3>
                          <p class="text-sm text-gray-700 mt-1">
                              Tamanho: <span class="font-semibold text-gray-800">${item.tamanho || '-'}</span>
                          </p>
                          <p class="text-sm text-gray-600 mt-1">
                              Preço unitário: <span class="text-yellow-600 font-bold">R$ ${produto.preco.toFixed(2)}</span>
                          </p>

                          <div style="display: flex; flex-direction: row; gap: 4px; align-items: center; margin-top: 12px;">
                              <button onclick="diminuirQuantidade(${item.idProduto}, '${item.tamanho}')"
                                  style="background-color: #facc15; color: black; font-weight: bold; width: 32px; height: 32px; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); font-size: 18px; display: flex; align-items: center; justify-content: center;">
                                  −
                              </button>

                              <span style="min-width: 24px; text-align: center; font-weight: 600; color: #1f2937;">
                                  ${item.quantidade}
                              </span>

                              <button onclick="aumentarQuantidade(${item.idProduto}, '${item.tamanho}')"
                                  style="background-color: #facc15; color: black; font-weight: bold; width: 32px; height: 32px; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.2); font-size: 18px; display: flex; align-items: center; justify-content: center;">
                                  +
                              </button>
                          </div>
                      </div>
                  </div>

                  <div class="text-right flex flex-col justify-between items-end h-full">
                      <p class="text-sm text-gray-600">
                          Subtotal: <span class="text-yellow-600 font-bold">R$ ${subtotal.toFixed(2)}</span>
                      </p>
                      <button onclick="removerDoCarrinho(${item.idProduto})"
                          class="mt-4 inline-flex items-center text-sm text-red-600 hover:text-red-700 transition gap-1 font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Remover
                      </button>
                  </div>
              </div>
          `;

          container.appendChild(itemDiv);
      });

      totalContainer.textContent = `R$ ${total.toFixed(2)}`;
  } catch (erro) {
      console.error("Erro ao carregar carrinho:", erro);
      container.innerHTML = `<p class="text-center text-red-500">Erro ao carregar o carrinho.</p>`;
      totalContainer.textContent = "R$ 0,00";
  }
  const botaoFinalizar = document.getElementById("btnFinalizarCompra");
if (botaoFinalizar) {
  botaoFinalizar.addEventListener("click", () => {
    console.log("✅ Clique no botão finalizar detectado");
    navigateTo("pagamento");
  });
}

}

// 🔥 Função para remover item
function removerDoCarrinho(idProduto) {
  let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  carrinho = carrinho.filter(item => item.idProduto !== idProduto);
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
  if (typeof atualizarContadorCarrinho === "function") {
      atualizarContadorCarrinho();
  }
  carregarCarrinho();
}

function aumentarQuantidade(idProduto, tamanho) {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const item = carrinho.find(i => i.idProduto === idProduto && i.tamanho === tamanho);
  if (item) {
      item.quantidade += 1;
      localStorage.setItem("carrinho", JSON.stringify(carrinho));
      atualizarContadorCarrinho();
      carregarCarrinho();
  }
}

function diminuirQuantidade(idProduto, tamanho) {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const index = carrinho.findIndex(i => i.idProduto === idProduto && i.tamanho === tamanho);
  if (index !== -1) {
      if (carrinho[index].quantidade > 1) {
          carrinho[index].quantidade -= 1;
      } else {
          carrinho.splice(index, 1);
      }
      localStorage.setItem("carrinho", JSON.stringify(carrinho));
      atualizarContadorCarrinho();
      carregarCarrinho();
  }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("cartItems") && document.getElementById("totalCarrinho")) {
      carregarCarrinho();
    }
  
    if (typeof atualizarContadorCarrinho === "function") {
      atualizarContadorCarrinho();  
    }
  });
  
  