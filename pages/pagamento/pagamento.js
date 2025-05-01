async function carregarTelaPagamento() {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const idProduto = parseInt(urlParams.get('idProduto'));
  const quantidadeProduto = parseInt(urlParams.get('quantidade'));

  let produtosCarrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

  if (idProduto && quantidadeProduto) {
    const jaNoCarrinho = produtosCarrinho.find(p => p.idProduto === idProduto);
    if (!jaNoCarrinho) {
      produtosCarrinho.push({ idProduto, quantidade: quantidadeProduto });
      localStorage.setItem("carrinho", JSON.stringify(produtosCarrinho));
    }
  }

  // Ao invés de pegar produto por produto, vamos pegar todos de uma vez
  await renderizarProdutosCompletos(produtosCarrinho);
}

async function renderizarProdutosCompletos(produtosCarrinho) {
  if (!produtosCarrinho.length) return;

  const ids = produtosCarrinho.map(item => item.idProduto);

  try {
      const resposta = await fetch(`${window.apiBaseUrl}/produto/obter-por-ids`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids)
      });

      if (!resposta.ok) throw new Error("Erro ao buscar produtos");

      const produtos = await resposta.json();
      let total = 0;

      const container = document.getElementById("resumoProdutos");
      container.innerHTML = "";

      produtosCarrinho.forEach(item => {
          const produto = produtos.find(p => p.produtoID === item.idProduto);
          if (!produto) return;

          const subtotal = produto.preco * item.quantidade;
          total += subtotal;

          const itemDiv = document.createElement("div");
          itemDiv.className = "border p-4 rounded-xl shadow-sm text-center bg-white";

          itemDiv.innerHTML = `
              <div class="flex flex-col items-center gap-2">
                  <img src="${produto.imagemUrl}" alt="${produto.nome}" class="w-24 h-24 object-cover rounded-lg border cursor-pointer"
                       onclick="navigateTo('produto-detalhes', 'id=${produto.produtoID}')"/>

                  <h4 class="text-base font-bold text-gray-800 cursor-pointer hover:underline break-words"
                      onclick="navigateTo('produto-detalhes', 'id=${produto.produtoID}')">
                      ${produto.nome}
                  </h4>

                  <p class="text-sm text-gray-600">Tamanho: <span class="font-semibold text-gray-800">${item.tamanho || '-'}</span></p>

                  <div class="flex items-center justify-center gap-2 mt-1 flex-row">
                      <button onclick="diminuirQuantidade(${item.idProduto}, '${item.tamanho}')" class="quant-btn">−</button>
                      <span class="min-w-[24px] text-center font-semibold text-gray-800">${item.quantidade}</span>
                      <button onclick="aumentarQuantidade(${item.idProduto}, '${item.tamanho}')" class="quant-btn">+</button>
                  </div>
              </div>
          `;

          container.appendChild(itemDiv);
      });

      document.getElementById("valorTotal").textContent = `R$ ${total.toFixed(2)}`;
      atualizarEstadoBotaoFinalizar();
  } catch (erro) {
      console.error("Erro ao carregar produtos:", erro);
      container.innerHTML = `<p class="text-center text-red-500">Erro ao carregar os produtos.</p>`;
      document.getElementById("valorTotal").textContent = "R$ 0,00";
  }
}

  
  function renderizarResumo(lista) {
    const container = document.getElementById("resumoProdutos");
    if (!container) return;
    container.innerHTML = "";

    let total = 0;

    lista.forEach(prod => {
        total += prod.preco * prod.quantidade;

        const item = document.createElement("div");
        item.className = "border p-4 rounded-xl shadow-sm text-center bg-white";

        item.innerHTML = `
            <div class="flex flex-col items-center gap-2">
                <img src="${prod.imagem}" alt="${prod.nome}" class="w-24 h-24 object-cover rounded-lg border cursor-pointer"
                     onclick="navigateTo('produto-detalhes', 'id=${prod.idProduto}')"/>

                <h4 class="text-base font-bold text-gray-800 cursor-pointer hover:underline break-words"
                    onclick="navigateTo('produto-detalhes', 'id=${prod.idProduto}')">
                    ${prod.nome}
                </h4>

                <p class="text-sm text-gray-600">Tamanho: <span class="font-semibold text-gray-800">${prod.tamanho || '-'}</span></p>

                <div class="flex items-center justify-center gap-2 mt-1 flex-row">
                    <button onclick="diminuirQuantidade(${prod.idProduto}, '${prod.tamanho}')" class="quant-btn">−</button>
                    <span class="min-w-[24px] text-center font-semibold text-gray-800">${prod.quantidade}</span>
                    <button onclick="aumentarQuantidade(${prod.idProduto}, '${prod.tamanho}')" class="quant-btn">+</button>
                </div>

                <p class="text-yellow-600 font-semibold mt-2">R$ ${(prod.preco * prod.quantidade).toFixed(2)}</p>
            </div>
        `;

        container.appendChild(item);
    });

    // Aplica o scroll se tiver mais de 3 produtos
    if (lista.length > 3) {
      container.style.maxHeight = "700px";
      container.style.overflowY = "auto";
      } 
    else {
      container.style.maxHeight = "";
      container.style.overflowY = "";
      }  

    document.getElementById("valorTotal").textContent = `R$ ${total.toFixed(2)}`;
    atualizarEstadoBotaoFinalizar();
}

  
  function aplicarCupom() {
    const input = document.getElementById("cupomInput");
    const feedback = document.getElementById("cupomFeedback");
  
    if (input.value.toLowerCase() === "desconto10") {
      feedback.textContent = "Cupom aplicado: 10% de desconto.";
      feedback.classList.remove("hidden", "text-red-500");
      feedback.classList.add("text-green-600");
    } else {
      feedback.textContent = "Cupom inválido.";
      feedback.classList.remove("hidden");
      feedback.classList.add("text-red-500");
    }
  }
  
  function finalizarPagamento() {
    const popup = document.getElementById("popupPagamento");
    popup.classList.remove("opacity-0", "pointer-events-none");
  
    setTimeout(() => {
      popup.classList.add("opacity-0", "pointer-events-none");
      localStorage.removeItem("carrinho");
      atualizarContadorCarrinho();
      navigateTo("home");
    }, 2000);
  }
  
  function mostrarFormularioPagamento(tipo) {
    const todos = ["formPix", "formCartaoCredito", "formCartaoDebito", "formBoleto"];
    todos.forEach(id => document.getElementById(id).classList.add("hidden"));
  
    if (tipo === 1) document.getElementById("formPix").classList.remove("hidden");
    if (tipo === 2) document.getElementById("formCartaoCredito").classList.remove("hidden");
    if (tipo === 3) document.getElementById("formCartaoDebito").classList.remove("hidden");
    if (tipo === 4) document.getElementById("formBoleto").classList.remove("hidden");
  
    window.metodoPagamentoSelecionado = tipo;
    atualizarEstadoBotaoFinalizar();
  }
  
  function aumentarQuantidade(idProduto, tamanho) {
    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const item = carrinho.find(i => i.idProduto === idProduto && i.tamanho === tamanho);
    
    if (item) {
      item.quantidade += 1;  // Aumenta a quantidade do produto
      localStorage.setItem("carrinho", JSON.stringify(carrinho));  // Atualiza o localStorage
  
      // Atualiza a interface imediatamente
      atualizarContadorCarrinho(); 
      renderizarProdutosCompletos(carrinho);  // Atualiza a tela com os produtos atualizados
    }
  }
  
  function diminuirQuantidade(idProduto, tamanho) {
    let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const index = carrinho.findIndex(i => i.idProduto === idProduto && i.tamanho === tamanho);
  
    if (index !== -1) {
      if (carrinho[index].quantidade > 1) {
        carrinho[index].quantidade -= 1;  // Diminui a quantidade do produto
      } else {
        carrinho.splice(index, 1);  // Remove o produto do carrinho se a quantidade for 1
      }
      
      localStorage.setItem("carrinho", JSON.stringify(carrinho));  // Atualiza o localStorage
  
      // Atualiza a interface imediatamente
      atualizarContadorCarrinho();
      renderizarProdutosCompletos(carrinho);  // Atualiza a tela com os produtos atualizados
  
      if (carrinho.length === 0) {
        navigateTo("home");  // Redireciona para a home se o carrinho estiver vazio
        return; // Importante parar aqui para não tentar renderizar vazio depois
      }
    }
  }
  

  // Verifique se a página carregada é a de pagamento
document.addEventListener("DOMContentLoaded", async () => {
  const [page] = location.hash.replace("#", "").split("?");

  // Apenas chama a função para carregar os dados do pagamento quando a página for 'pagamento'
  if (page === "pagamento") {
    await carregarTelaPagamento();
    await validarCheckboxUsuarioLogado();
  }
});


  function toggleFormularioEndereco() {
    const checkbox = document.getElementById("usarDadosUsuario");
    const formulario = document.getElementById("formularioEndereco");
  
    if (!checkbox.checked) {
      formulario.classList.remove("hidden");
    } else {
      formulario.classList.add("hidden");
    }
  }
  
  async function atualizarEstadoBotaoFinalizar() {
    const produtosCarrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const metodoPagamentoSelecionado = window.metodoPagamentoSelecionado ?? null;
    const botaoFinalizar = document.getElementById("btnFinalizarCompra");
    const usarDadosUsuario = document.getElementById("usarDadosUsuario");

    if (produtosCarrinho.length === 0 || metodoPagamentoSelecionado === null) {
        botaoFinalizar.disabled = true;
        return;
    }

    // Verificar endereço (se checkbox não marcado)
    let enderecoValido = true;
    if (!usarDadosUsuario.checked) {
        const nome = document.getElementById("inputNome").value.trim();
        const endereco = document.getElementById("inputEndereco").value.trim();
        const cep = document.getElementById("inputCep").value.trim();
        const cpf = document.getElementById("cpf").value.trim();
        enderecoValido = nome !== "" && endereco !== "" && cep !== "" && cpf !== "";
    }

    let pagamentoValido = true;

    if (metodoPagamentoSelecionado === 2 || metodoPagamentoSelecionado === 3) {
        // Cartão de crédito ou débito: todos os campos obrigatórios preenchidos
        const inputsCartao = (metodoPagamentoSelecionado === 2 ? 
            document.querySelectorAll("#formCartaoCredito input[type='text']") : 
            document.querySelectorAll("#formCartaoDebito input[type='text']")
        );

        pagamentoValido = Array.from(inputsCartao).every(input => input.value.trim() !== "");
    }

    // Lógica final corrigida
    if (metodoPagamentoSelecionado === 1 || metodoPagamentoSelecionado === 4) {
        // PIX ou BOLETO
        botaoFinalizar.disabled = !enderecoValido;
    } else if (metodoPagamentoSelecionado === 2 || metodoPagamentoSelecionado === 3) {
        // CARTÃO
        botaoFinalizar.disabled = !(pagamentoValido && enderecoValido);
    } else {
        botaoFinalizar.disabled = true;
    }
}

async function validarCheckboxUsuarioLogado() {
  const checkboxContainer = document.querySelector("label[for='usarDadosUsuario']") || document.querySelector("#usarDadosUsuario")?.closest("label");

  if (!checkboxContainer) return;

  if (!window.usuarioAutenticado) {
    checkboxContainer.classList.add("hidden");
    document.getElementById("usarDadosUsuario").checked = false;
    toggleFormularioEndereco();
    console.log("🔒 Checkbox ocultado por falta de login");
  } else {
    checkboxContainer.classList.remove("hidden");
    console.log("✅ Checkbox visível - usuário autenticado");
  }
}
