let cupomAplicado = null;

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

      const container = document.getElementById("resumoProdutosPagamento");
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
                      <button onclick="diminuirQuantidadePagamento(${item.idProduto}, '${item.tamanho}')" class="quant-btn">−</button>
                      <span class="min-w-[24px] text-center font-semibold text-gray-800">${item.quantidade}</span>
                      <button onclick="aumentarQuantidadePagamento(${item.idProduto}, '${item.tamanho}')" class="quant-btn">+</button>
                  </div>
              </div>
          `;

          container.appendChild(itemDiv);
      });

      // Aplica o scroll se houver mais de 3 produtos
      if (produtosCarrinho.length >= 3) {
        container.style.maxHeight = "600px";  // Defina a altura máxima de exibição
        container.style.overflowY = "auto";  // Ativa o scroll vertical
      } else {
        container.style.maxHeight = "";  // Remove a altura máxima
        container.style.overflowY = "";  // Remove o scroll
      }
        const valorTotalEl = document.getElementById("valorTotal");
        const valorComDesconto = aplicarDescontoSeCupom(total);

        if (cupomAplicado && window.resultadoCupom) {
          const container = valorTotalEl.closest(".border-t") || valorTotalEl.parentElement;
          container.innerHTML = `
            <div class="flex flex-col items-end">
              <span class="text-sm line-through text-yellow-500 mb-[-2px]">R$ ${total.toFixed(2).replace(".", ",")}</span>
              <div class="flex items-center justify-between w-full mt-1">
                <span class="text-base font-bold text-gray-800">Total:</span>
                <span id="valorTotal" class="text-2xl font-extrabold text-green-700 ml-2">R$ ${valorComDesconto.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          `;
        
          // Ocultar input e botão do cupom se ainda estiverem visíveis
          const input = document.getElementById("cupomInput");
          const botao = input?.nextElementSibling;
          const feedback = document.getElementById("cupomFeedback");
        
          if (input && botao && feedback) {
            input.classList.add("hidden");
            botao.classList.add("hidden");
            feedback.textContent = `🎉 Cupom aplicado com sucesso! Você ganhou ${
              window.resultadoCupom.descontoPorcentagem > 0
                ? window.resultadoCupom.descontoPorcentagem + "% de desconto"
                : "R$ " + window.resultadoCupom.descontoValor.toFixed(2).replace(".", ",") + " de desconto"
            }.`;
            feedback.classList.remove("hidden", "text-red-500");
            feedback.classList.add("text-green-600", "font-semibold");
          }
        }
         else {
          valorTotalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
          valorTotalEl.dataset.valorOriginal = total.toFixed(2); // garante que o valor original seja preservado
        }

      atualizarEstadoBotaoFinalizar();
  } catch (erro) {
      navigateTo('erro-servidor-505');
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
                    <button onclick="diminuirQuantidadePagamento(${prod.idProduto}, '${prod.tamanho}')" class="quant-btn">−</button>
                    <span class="min-w-[24px] text-center font-semibold text-gray-800">${prod.quantidade}</span>
                    <button onclick="aumentarQuantidadePagamento(${prod.idProduto}, '${prod.tamanho}')" class="quant-btn">+</button>
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
 
async function aplicarCupom() {
    const input = document.getElementById("cupomInput");
    const feedback = document.getElementById("cupomFeedback");
    const botao = input.nextElementSibling;
    const valorTotalSpan = document.getElementById("valorTotal");
  
    const codigoCupom = input.value.trim();
    if (!codigoCupom || !valorTotalSpan) return;
  
    const valorOriginal = parseFloat(valorTotalSpan.dataset.valorOriginal || valorTotalSpan.textContent.replace("R$", "").replace(",", "."));
  
    try {
      const resposta = await fetch(`${window.apiBaseUrl}/pagamento/validarcupom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigoCupom })
      });
  
      if (!resposta.ok) throw new Error("Erro ao validar cupom.");
  
      const resultado = await resposta.json();
  
      if (!resultado.valido) {
        feedback.textContent = "❌ Cupom inválido ou expirado.";
        feedback.classList.remove("hidden", "text-green-600");
        feedback.classList.add("text-red-500");
        return;
      }
      
      // Armazena os dados para uso posterior
      cupomAplicado = codigoCupom;
      window.resultadoCupom = resultado;
      localStorage.setItem("resultadoCupom", JSON.stringify(resultado));
  
  
      let desconto = 0;
      if (resultado.descontoPorcentagem > 0) {
        desconto = valorOriginal * (resultado.descontoPorcentagem / 100);
      } else if (resultado.descontoValor > 0) {
        desconto = resultado.descontoValor;
      }
  
      const novoValor = Math.max(0, valorOriginal - desconto);
  
      const container = valorTotalSpan.closest(".pt-4");
  
      container.innerHTML = `
    <div class="border-t pt-4">
      <div class="flex flex-col items-end">
        <span class="text-sm line-through text-yellow-500 mb-[-2px]">R$ ${valorOriginal.toFixed(2).replace(".", ",")}</span>
        <div class="flex items-center justify-between w-full mt-1">
          <span class="text-base font-bold text-gray-800">Total:</span>
          <span id="valorTotal" class="text-2xl font-extrabold text-green-700 ml-2">R$ ${novoValor.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>
    </div>
  `;
  
      input.classList.add("hidden");
      botao.classList.add("hidden");
  
      feedback.textContent = `🎉 Cupom aplicado com sucesso! Você ganhou ${
        resultado.descontoPorcentagem > 0
          ? resultado.descontoPorcentagem + "% de desconto"
          : "R$ " + resultado.descontoValor.toFixed(2).replace(".", ",") + " de desconto"
      }.`;
      feedback.classList.remove("hidden", "text-red-500");
      feedback.classList.add("text-green-600", "font-semibold");
  
    } catch (erro) {
      console.error("Erro ao aplicar cupom:", erro);
      feedback.textContent = "Erro ao validar o cupom. Tente novamente.";
      feedback.classList.remove("hidden", "text-green-600");
      feedback.classList.add("text-red-500");
    }
  }

function mostrarFormularioPagamento(tipo) {
    
    console.log('aeeeeeeeeeeee')
    
    window.metodoPagamentoSelecionado = tipo;
    atualizarEstadoBotaoFinalizar();
  }

function aumentarQuantidadePagamento(idProduto, tamanho) {
  let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const item = carrinho.find(i => i.idProduto === idProduto && i.tamanho === tamanho);

  if (item) {
    item.quantidade += 1;
    localStorage.setItem("carrinho", JSON.stringify(carrinho));

    atualizarContadorCarrinho(); 
    renderizarProdutosCompletos(carrinho);

    // 🔁 Recalcular frete após aumentar
    const usarDadosUsuario = document.getElementById("usarDadosUsuario")?.checked || false;
    calcularFreteComBaseNoCEP(usarDadosUsuario);
  }
}
  
function diminuirQuantidadePagamento(idProduto, tamanho) {
  let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const index = carrinho.findIndex(i => i.idProduto === idProduto && i.tamanho === tamanho);

  if (index !== -1) {
    if (carrinho[index].quantidade > 1) {
      carrinho[index].quantidade -= 1;
    } else {
      carrinho.splice(index, 1);
    }

    localStorage.setItem("carrinho", JSON.stringify(carrinho));
    atualizarContadorCarrinho();
    renderizarProdutosCompletos(carrinho);

    if (carrinho.length === 0) {
      navigateTo("home");
      return;
    }

    // 🔁 Recalcular frete após diminuir
    const usarDadosUsuario = document.getElementById("usarDadosUsuario")?.checked || false;
    calcularFreteComBaseNoCEP(usarDadosUsuario);
  }
}
 
document.addEventListener("DOMContentLoaded", async () => {
    const [page] = location.hash.replace("#", "").split("?");
  
    if (page === "pagamento") {
      // ⚠️ Limpa o cupom sempre que a página for carregada (F5 incluso)
      cupomAplicado = null;
      window.resultadoCupom = null;
      localStorage.removeItem("resultadoCupom");
    
      await carregarTelaPagamento();
      await validarCheckboxUsuarioLogado();
      const cepInput = document.getElementById("inputCep");

        console.log(cepInput + 'testando cep')
if (cepInput) {
  cepInput.addEventListener("input", function () {
    const usarDadosUsuario = document.getElementById("usarDadosUsuario")?.checked;
    const cep = this.value.replace(/\D/g, "");

    if (!usarDadosUsuario && cep.length === 8) {
      calcularFreteComBaseNoCEP(false);
    }
  });
}

    }  
  });
  
function toggleFormularioEndereco() {
  const checkbox = document.getElementById("usarDadosUsuario");
  const formulario = document.getElementById("formularioEndereco");

  if (!checkbox.checked) {
    formulario.classList.remove("hidden");
  } else {
    formulario.classList.add("hidden");

    // Limpa todos os inputs, selects e textareas dentro do formulário
    const campos = formulario.querySelectorAll("input, select, textarea");
    campos.forEach(function(campo) {
      if (campo.type === "checkbox" || campo.type === "radio") {
        campo.checked = false;
      } else {
        campo.value = "";
      }
    });
  }
}
  
async function validarCheckboxUsuarioLogado() {
  const checkboxContainer = document.querySelector("label[for='usarDadosUsuario']") || document.querySelector("#usarDadosUsuario")?.closest("label");

  if (!checkboxContainer) return;

  await validarTokenSilenciosamente(); // Chama a função que valida o token

  if (!window.usuarioAutenticado) {
    checkboxContainer.classList.add("hidden");
    document.getElementById("usarDadosUsuario").checked = false; // Desmarca o checkbox se não autenticado
    toggleFormularioEndereco(); // Esconde o formulário de dados
    console.log("🔒 Checkbox ocultado por falta de login");
  } else {
    checkboxContainer.classList.remove("hidden"); // Exibe o checkbox se o usuário estiver autenticado
    console.log("✅ Checkbox visível - usuário autenticado");
  }

  const checkbox = document.getElementById("usarDadosUsuario");
  if (checkbox) {
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        calcularFreteComBaseNoCEP(true);
      } else {
        document.getElementById("freteInfo").classList.add("hidden");
      }
    });
  }
}

function aplicarDescontoSeCupom(valorOriginal) {
  if (!cupomAplicado) return valorOriginal;

  let desconto = 0;

  // Simulação local — você pode salvar o último resultado do cupom na variável `resultadoCupom`
  if (window.resultadoCupom) {
    if (window.resultadoCupom.descontoPorcentagem > 0) {
      desconto = valorOriginal * (window.resultadoCupom.descontoPorcentagem / 100);
    } else if (window.resultadoCupom.descontoValor > 0) {
      desconto = window.resultadoCupom.descontoValor;
    }
  }

  return Math.max(0, valorOriginal - desconto);
}

function capturarDadosPagamento() {
  // Captura dos produtos do carrinho armazenados no localStorage
  const produtosCarrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const produtos = produtosCarrinho.map(produto => ({
    idProduto: produto.idProduto,
    tamanho: produto.tamanho || "-",  // Tamanho do produto, ou "-" caso não tenha
    quantidade: produto.quantidade
  }));

  // Captura do método de pagamento selecionado
  const metodoPagamento = document.querySelector('input[name="metodoPagamento"]:checked')?.value;

  // Captura das informações de pagamento (Cartão, PIX, Débito, ou Boleto)
  let dadosPagamento = {};

  if (metodoPagamento === "1") {
    dadosPagamento = { tipo: "PIX", chave: "compras@esporte.com" };
  } else if (metodoPagamento === "2") {
    dadosPagamento = { tipo: "Cartão de Crédito" }; // Detalhes preenchidos na tela de finalização
  } else if (metodoPagamento === "3") {
    dadosPagamento = { tipo: "Cartão de Débito" }; // Detalhes preenchidos na tela de finalização
  } else if (metodoPagamento === "4") {
    dadosPagamento = { tipo: "Boleto", detalhes: "Gerado após a confirmação do pedido" };
  }

  // Captura dos dados do usuário para envio
  const dadosEnvio = {
    nome: document.getElementById("inputNome")?.value || "",
    endereco: document.getElementById("inputEndereco")?.value || "",
    complemento: document.getElementById("inputComplemento")?.value || "",
    cep: document.getElementById("inputCep")?.value || "",
    cpf: document.getElementById("cpf")?.value || "",
    portaria24h: document.getElementById("portaria24h")?.checked || false,
    usarDadosUsuario: document.getElementById("usarDadosUsuario")?.checked || false
  };

  // Captura do cupom
  const cupom = document.getElementById("cupomInput")?.value || "";

  // Organiza todos os dados em um objeto
  const dadosPagamentoCompleto = {
    produtos,
    metodoPagamento,
    dadosPagamento,
    dadosEnvio,
    cupom
  };

  console.log(dadosPagamentoCompleto);
  return dadosPagamentoCompleto;
}

function aplicarMascaraCPF(campo) {
  let valor = campo.value.replace(/\D/g, ''); // Remove tudo que não é número

  if (valor.length <= 3) {
    campo.value = valor.replace(/(\d{1,3})(\d{0})/, '$1');
  } else if (valor.length <= 6) {
    campo.value = valor.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  } else if (valor.length <= 9) {
    campo.value = valor.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  } else {
    campo.value = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  }
}

function limitarCampoTexto(campo, limite = 200) {
  if (campo.value.length > limite) {
    campo.value = campo.value.slice(0, limite);  // Limita o comprimento do valor
  }
}

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    // Verificar se os campos existem antes de adicionar os eventos

    // CPF
    const cpfInput = document.getElementById("cpf");
    if (cpfInput) {
      cpfInput.addEventListener("input", function () {
        aplicarMascaraCPF(this);
      });
    }

    // CEP
    const cepInput = document.getElementById("inputCep");
    if (cepInput) {
      cepInput.addEventListener("input", function () {
        aplicarMascaraCEP(this);
      });
    } 

    // Campos de texto para endereço, nome, etc.
    const camposTexto = [
      document.getElementById("inputNome"),
      document.getElementById("inputEndereco"),
      document.getElementById("inputComplemento"),
      document.getElementById("inputCep"),
      document.getElementById("cpf")
    ];

    // Limitar todos os campos de texto a 200 caracteres
    camposTexto.forEach(campo => {
      if (campo) {
        campo.addEventListener("input", function () {
          limitarCampoTexto(this, 200);
        });
      }
    });

    // Adicionar o evento para os radio buttons de pagamento
    const metodoPagamentoRadios = document.querySelectorAll('input[name="metodoPagamento"]');
    metodoPagamentoRadios.forEach(radio => {
      radio.addEventListener("change", function() {
        // Atualiza o estado do botão de finalizar compra quando o tipo de pagamento for alterado
        atualizarEstadoBotaoFinalizar();
      });
    });

    // Adicionar o evento de alteração para o checkbox "Usar dados do usuário"
    const checkboxDadosUsuario = document.getElementById("usarDadosUsuario");
    if (checkboxDadosUsuario) {
      checkboxDadosUsuario.addEventListener("change", function () {
        atualizarEstadoBotaoFinalizar();
      });
    }

  }, 100); // 100ms de delay para garantir que o DOM foi completamente renderizado
});

let timeoutCalculoFrete = null;
let ultimoCepCalculado = "";

function atualizarEstadoBotaoFinalizar() {
  const metodoPagamentoSelecionado = document.querySelector('input[name="metodoPagamento"]:checked');
  const usarDadosUsuario = document.getElementById("usarDadosUsuario").checked;
  const nomeCliente = document.getElementById("inputNome").value.trim();
  const enderecoCliente = document.getElementById("inputEndereco").value.trim();
  const cpfCliente = document.getElementById("cpf").value.trim();
  const inputCep = document.getElementById("inputCep");
  const botaoFinalizar = document.getElementById("btnFinalizarCompra");
  const freteInfo = document.getElementById("freteInfo");

  const pagamentoValido = metodoPagamentoSelecionado !== null;
  const dadosClientePreenchidos = nomeCliente !== "" && enderecoCliente !== "" && cpfCliente !== "";
  const dadosDoUsuarioLogado = usarDadosUsuario || dadosClientePreenchidos;

  const freteCalculado = freteInfo &&
  !freteInfo.classList.contains("hidden") &&
  freteInfo.textContent.includes("R$") &&
  !freteInfo.textContent.includes("R$ 0,00");

botaoFinalizar.disabled = !(pagamentoValido && dadosDoUsuarioLogado && freteCalculado);


  // Debounce do cálculo do frete
  if (!usarDadosUsuario && inputCep) {
    const cepNumerico = inputCep.value.replace(/\D/g, "");

    clearTimeout(timeoutCalculoFrete);

    timeoutCalculoFrete = setTimeout(() => {
      if (cepNumerico.length === 8 && cepNumerico !== ultimoCepCalculado) {
        ultimoCepCalculado = cepNumerico;
        calcularFreteComBaseNoCEP(false);
      } else if (cepNumerico.length < 8) {
        freteInfo.classList.add("hidden");
        ultimoCepCalculado = "";
        atualizarEstadoBotaoFinalizar(); // Atualiza o botão imediatamente
      }
    }, 500);
  }
}

function finalizarPagamento() {
  const metodoPagamentoSelecionado = document.querySelector('input[name="metodoPagamento"]:checked')?.value || null;

  const dadosPagamento = capturarDadosPagamento();
  cupomAplicado = null;
  // Criar objeto global com os dados preenchidos
  window.dadosResumoPagamentoFinal = {
    metodoPagamento: metodoPagamentoSelecionado,
    dadosUsuario: dadosPagamento.dadosEnvio,
    dadosPagamento: dadosPagamento.dadosPagamento,
    cupom: dadosPagamento.cupom,
    produtos: dadosPagamento.produtos,
    timestamp: new Date().toISOString()  // útil para rastrear momento do clique
  };
  window.dadosPagamentoFinal = capturarDadosPagamento();
  navigateTo('finalizar-compra');
}

async function calcularFreteComBaseNoCEP(usarDadosUsuario) {
  const freteInfo = document.getElementById("freteInfo");
  freteInfo.classList.add("hidden");

  try {
    let headers = {
      "Content-Type": "application/json"
    };

    const produtosCarrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const produtosParaEnvio = produtosCarrinho.map(p => ({
      idProduto: p.idProduto,
      quantidade: p.quantidade,
      tamanho: p.tamanho || "-"
    }));

    let body = {};

    if (usarDadosUsuario) {
      headers["Authorization"] = `Bearer ${getTokenDosCookies()}`;
      body = { produtos: produtosParaEnvio };
    } else {
      const cep = document.getElementById("inputCep")?.value?.replace(/\D/g, "") || "";
      if (cep.length !== 8) return;
      body = {
        cep: cep,
        produtos: produtosParaEnvio
      };
    }

    const resposta = await fetch(`${window.apiBaseUrl}/pagamento/calcular-frete`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
      // Se a mensagem do back-end for personalizada, exibe na tela
      freteInfo.textContent = texto;
      freteInfo.classList.remove("hidden");
      atualizarEstadoBotaoFinalizar();
      return;
    }

    const freteArray = JSON.parse(texto);

    if (!Array.isArray(freteArray) || freteArray.length === 0) {
      throw new Error("Nenhuma opção de frete disponível");
    }

    const frete = freteArray[0];

    if (!frete || frete.valor === undefined || frete.prazoEntrega === undefined) {
      throw new Error("Resposta de frete inválida.");
    }

    if (frete.valor === 0) {
      freteInfo.textContent = "Infelizmente ainda não realizamos entregas para esse CEP.";
      freteInfo.dataset.valorFrete = "0.00";
      freteInfo.classList.remove("hidden");
      window.valorFreteAtual = 0;
      atualizarEstadoBotaoFinalizar();
      return;
    }

    freteInfo.textContent = `Frete: R$ ${frete.valor.toFixed(2).replace(".", ",")} — Entrega em ${frete.prazoEntrega} dia(s) úteis`;
    freteInfo.dataset.valorFrete = frete.valor.toFixed(2);
    freteInfo.classList.remove("hidden");
    window.valorFreteAtual = frete.valor;

    atualizarEstadoBotaoFinalizar();

  } catch (erro) {
    console.error("Erro ao calcular frete:", erro);
    freteInfo.textContent = "Erro ao calcular o frete. Tente novamente.";
    freteInfo.classList.remove("hidden");
  }
}


