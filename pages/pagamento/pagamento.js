let cupomAplicado = null;

async function carregarTelaPagamento() {

  resetCupomPagamento(); // 👈 limpa estado/UI sempre que entrar na tela
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

function resetCupomPagamento() {
  // estado
  cupomAplicado = null;
  window.resultadoCupom = null;
  window.freteGratisOK = false;
  localStorage.removeItem("resultadoCupom");
  localStorage.removeItem("freteGratisOK");

  // UI cupom
  const input = document.getElementById("cupomInput");
  const botao = input?.nextElementSibling;
  const feedback = document.getElementById("cupomFeedback");
  if (input) { input.classList.remove("hidden"); input.value = ""; }
  if (botao)  { botao.classList.remove("hidden"); }
  if (feedback) { feedback.classList.add("hidden"); feedback.textContent = ""; }

  // UI frete
  const freteInfo = document.getElementById("freteInfo");
  if (freteInfo) {
    freteInfo.classList.add("hidden");
    freteInfo.textContent = "";
    delete freteInfo.dataset.valorFrete;
  }
}

window.addEventListener("hashchange", async () => {
  const [page] = location.hash.replace("#", "").split("?");
  if (page === "pagamento") {
    resetCupomPagamento();
    await carregarTelaPagamento();
    await validarCheckboxUsuarioLogado();
  }
});

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

    <p class="text-sm text-gray-600">
      Tamanho: <span class="font-semibold text-gray-800">${item.tamanho || '-'}</span>
    </p>

    <!-- Preço unitário -->
    <p class="text-sm text-gray-600 mt-1">
      Preço unitário: <span class="text-yellow-600 font-bold">
        R$ ${produto.preco.toFixed(2).replace(".", ",")}
      </span>
    </p>

    <!-- Subtotal (só se quantidade > 1) -->
    ${item.quantidade > 1 ? `
      <p class="text-sm text-gray-600 mt-1">
        Subtotal: <span class="text-yellow-600 font-bold">
          R$ ${(produto.preco * item.quantidade).toFixed(2).replace(".", ",")}
        </span>
      </p>
    ` : ""}

    <div class="flex items-center justify-center gap-2 mt-2 flex-row">
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

        // 👇 NOVO: detectar cupom de FRETE GRÁTIS no objeto já retornado pelo backend
        const eFreteGratis = !!(
          window.resultadoCupom?.freteGratis ??
          window.resultadoCupom?.FreteGratis ??
          window.resultadoCupom?.isFreteGratis
        );

        if (cupomAplicado && window.resultadoCupom && !eFreteGratis) {
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

          // Se for FRETE GRÁTIS, apenas garante que input/botão seguem ocultos
          if (eFreteGratis) {
            const input = document.getElementById("cupomInput");
            const botao = input?.nextElementSibling;
            const feedback = document.getElementById("cupomFeedback");
            if (input && botao) {
              input.classList.add("hidden");
              botao.classList.add("hidden");
            }
          }
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

                <!-- 👇 NOVO: preço unitário -->
                    <p class="text-sm text-gray-600">
                      Preço unitário: <span class="font-semibold text-gray-800">
                        R$ ${produto.preco.toFixed(2).replace(".", ",")}
                      </span>
                    </p>

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
  const freteInfo = document.getElementById("freteInfo");

  const codigoCupom = input.value.trim();
  if (!codigoCupom || !valorTotalSpan) return;

  const valorOriginal = parseFloat(
    valorTotalSpan.dataset.valorOriginal || valorTotalSpan.textContent.replace("R$", "").replace(",", ".")
  );

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

    // armazena
    cupomAplicado = codigoCupom;
    window.resultadoCupom = resultado;
    localStorage.setItem("resultadoCupom", JSON.stringify(resultado));

    // 🔎 NOVO: detectar cupom de frete grátis (aceita várias capitalizações)
    const freteGratis = !!(resultado.freteGratis ?? resultado.FreteGratis ?? resultado.isFreteGratis);

    // Se for FRETE GRÁTIS: não altera o total dos produtos; atualiza bloco do frete e habilita finalizar
    if (freteGratis) {
      // persiste a informação até sair da tela
      window.freteGratisOK = true;
      localStorage.setItem("freteGratisOK", "1");

      if (freteInfo) {
        freteInfo.textContent = "Cupom de frete grátis aplicado.";
        freteInfo.dataset.valorFrete = "0.00";
        freteInfo.classList.remove("hidden");
      }
      window.valorFreteAtual = 0;

      // UI do cupom
      input.classList.add("hidden");
      botao.classList.add("hidden");
      feedback.textContent = "🎉 Cupom de frete grátis aplicado.";
      feedback.classList.remove("hidden", "text-red-500");
      feedback.classList.add("text-green-600", "font-semibold");

      // revalida botão
      atualizarEstadoBotaoFinalizar();
      return; // ⬅️ sai aqui para não cair no fluxo de desconto em produto
    }

    // ===== Fluxo original de DESCONTO em produto =====
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
        : "R$ " + (resultado.descontoValor || 0).toFixed(2).replace(".", ",") + " de desconto"
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
  // guarda o método escolhido também em memória (caso o UI seja custom)
  window.metodoPagamentoSelecionado = tipo;

  // se houver radio real na tela, marca e dispara change
  const radio = document.querySelector(`input[name="metodoPagamento"][value="${tipo}"]`);
  if (radio) {
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    }
  }

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

      // 👇 NOVO: limpa flag de frete grátis ao entrar na tela
      window.freteGratisOK = false;
      localStorage.removeItem("freteGratisOK");
    
      await carregarTelaPagamento();
      await validarCheckboxUsuarioLogado();
      const cepInput = document.getElementById("inputCep");
      if (cepInput) {
        cepInput.addEventListener("input", function () {
          // mantém só números e limita a 8
          const somenteNumeros = this.value.replace(/\D/g, "").slice(0, 8);
          if (this.value !== somenteNumeros) this.value = somenteNumeros;

          const freteInfo = document.getElementById("freteInfo");
          const usarDadosUsuario = document.getElementById("usarDadosUsuario")?.checked;

          if (!usarDadosUsuario) {
            if (somenteNumeros.length === 0) {
              // nada digitado: esconde
              freteInfo.classList.add("hidden");
              freteInfo.textContent = "";
            } else if (somenteNumeros.length < 8) {
              // CEP incompleto: avisa
              freteInfo.textContent = `Digite um CEP válido com 8 números (${somenteNumeros.length}/8).`;
              freteInfo.classList.remove("hidden");
              window.valorFreteAtual = 0;
              window.freteGratisOK = false;
            } else {
              // 8 dígitos: calcula
              calcularFreteComBaseNoCEP(false);
            }
          }

          atualizarEstadoBotaoFinalizar();
        });

        // (opcional) tratar colar
        cepInput.addEventListener("paste", (e) => {
          e.preventDefault();
          const txt = (e.clipboardData || window.clipboardData).getData("text") || "";
          cepInput.value = txt.replace(/\D/g, "").slice(0, 8);
          cepInput.dispatchEvent(new Event("input"));
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
+     atualizarEstadoBotaoFinalizar(); // 👈 adicione esta linha
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

function validarNome(nome) {
  const soLetras = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/; // letras com acento e espaço
  return nome.length >= 3 && soLetras.test(nome) && !/^\d+$/.test(nome);
}

function validarEndereco(endereco) {
  return endereco.length >= 5 && !/^\d+$/.test(endereco);
}

function validarCPF(cpf) {
  // Aceita CPF no formato "000.000.000-00" ou apenas números
  const cpfLimpo = cpf.replace(/\D/g, "");
  return cpfLimpo.length === 11;
}

function atualizarEstadoBotaoFinalizar() {
  const metodoRadio = document.querySelector('input[name="metodoPagamento"]:checked');
  const metodoPagamentoVal = metodoRadio?.value ?? window.metodoPagamentoSelecionado ?? null;
  const pagamentoValido = !!metodoPagamentoVal;

  const usarDadosUsuarioEl = document.getElementById("usarDadosUsuario");
  const usarDadosUsuario = !!usarDadosUsuarioEl && !!usarDadosUsuarioEl.checked;

  const nomeValido = validarNome(document.getElementById("inputNome")?.value?.trim() || "");
  const enderecoValido = validarEndereco(document.getElementById("inputEndereco")?.value?.trim() || "");
  const cpfValido = validarCPF(document.getElementById("cpf")?.value?.trim() || "");
  const dadosClientePreenchidos = nomeValido && enderecoValido && cpfValido;

  const freteInfo = document.getElementById("freteInfo");
  const freteGratisOk = window.freteGratisOK === true || localStorage.getItem("freteGratisOK") === "1";

  // frete calculado válido se:
  // - houver frete grátis ativo OU
  // - o bloco estiver visível e dataset.valorFrete numérico
  let freteCalculado = false;
  if (freteGratisOk) {
    freteCalculado = true;
  } else if (freteInfo && !freteInfo.classList.contains("hidden")) {
    const valStr = freteInfo.dataset?.valorFrete;
    if (typeof valStr === "string" && valStr.length > 0 && !Number.isNaN(Number(valStr))) {
      freteCalculado = Number(valStr) >= 0;
    } else {
      // fallback (caso dataset não esteja setado): tenta ler do texto "R$ 12,34"
      const match = freteInfo.textContent?.match(/R\$\s*([\d.,]+)/);
      if (match) {
        const n = Number(match[1].replace(/\./g, "").replace(",", "."));
        freteCalculado = Number.isFinite(n);
      }
    }
  }

  const podeFinalizar = pagamentoValido && (usarDadosUsuario || dadosClientePreenchidos) && freteCalculado;

  const botao = document.getElementById("btnFinalizarCompra");
  if (botao) botao.disabled = !podeFinalizar;

  // --- Debounce do cálculo de frete via CEP digitado ---
  const inputCep = document.getElementById("inputCep");
  if (!usarDadosUsuario && inputCep) {
    const cepNumerico = (inputCep.value || "").replace(/\D/g, "");

    clearTimeout(timeoutCalculoFrete);
    timeoutCalculoFrete = setTimeout(() => {
      if (cepNumerico.length === 8 && cepNumerico !== ultimoCepCalculado) {
        ultimoCepCalculado = cepNumerico;
        calcularFreteComBaseNoCEP(false);
      } else if (cepNumerico.length > 0 && cepNumerico.length < 8) {
        if (freteInfo) {
          freteInfo.textContent = `Digite um CEP válido com 8 números (${cepNumerico.length}/8). Use apenas números.`;
          freteInfo.classList.remove("hidden");
          delete freteInfo.dataset.valorFrete; // evita herdar valor antigo
        }
        window.valorFreteAtual = 0;
        window.freteGratisOK = false;
        ultimoCepCalculado = "";
      } else if (cepNumerico.length === 0) {
        if (freteInfo) {
          freteInfo.classList.add("hidden");
          freteInfo.textContent = "";
          delete freteInfo.dataset.valorFrete;
        }
        ultimoCepCalculado = "";
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

  // Se frete grátis já foi aplicado nesta tela, não chama a API e mantém visível
  const freteGratisPersistido = window.freteGratisOK === true || localStorage.getItem("freteGratisOK") === "1";
  if (freteGratisPersistido) {
    window.freteGratisOK = true;
    localStorage.setItem("freteGratisOK", "1");

    if (freteInfo) {
      freteInfo.textContent = "Cupom de frete grátis aplicado.";
      freteInfo.dataset.valorFrete = "0.00";
      freteInfo.classList.remove("hidden");
    }
    window.valorFreteAtual = 0;
    atualizarEstadoBotaoFinalizar();
    return;
  }

  try {
    const headers = { "Content-Type": "application/json" };

    // Monta produtos no formato aceito pela API (ProdutoFreteDto)
    const produtosCarrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
    const produtosParaEnvio = produtosCarrinho.map(p => ({
      idProduto: p.idProduto,
      quantidade: p.quantidade,
      tamanho: p.tamanho || "-"
    }));

    // Cupom (se houver) — não é frete grátis porque já teríamos retornado acima
    const cupom = (typeof cupomAplicado === "string" && cupomAplicado.trim().length > 0)
      ? cupomAplicado.trim()
      : null;

    // Corpo no padrão FreteCalculoDto
    /** @type {{ cep?: string, cupom?: string|null, produtos: any[], token?: string }} */
    let body = { produtos: produtosParaEnvio };

    if (usarDadosUsuario) {
      // ✅ Pega o GUID do mesmo jeito que sua outra página (cookie "token")
      const tokenRaw = (typeof obterCookie === "function") ? obterCookie("token") : null;

      if (!isGuid(tokenRaw || "")) {
        // Sem GUID válido (expirado/deslogado): informa o usuário
        if (freteInfo) {
          freteInfo.textContent = "Faça login novamente para calcular o frete com seus dados.";
          freteInfo.classList.remove("hidden");
          delete freteInfo.dataset.valorFrete;
        }
        atualizarEstadoBotaoFinalizar();
        return;
      }

      // Envia o GUID no body (FreteCalculoDto.Token)
      body.token = tokenRaw.trim();
      if (cupom) body.cupom = cupom;

    } else {
      // Fluxo por CEP digitado
      const cep = document.getElementById("inputCep")?.value?.replace(/\D/g, "") || "";
      if (cep.length !== 8) return; // CEP inválido; handlers de input cuidam da mensagem
      body.cep = cep;
      if (cupom) body.cupom = cupom;
    }

    const resposta = await fetch(`${window.apiBaseUrl}/pagamento/calcular-frete`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
      let mensagem = texto;
      try {
        const json = JSON.parse(texto);
        if (json.mensagem) mensagem = json.mensagem;
      } catch {}
      if (freteInfo) {
        freteInfo.textContent = mensagem || "Não foi possível calcular o frete.";
        freteInfo.classList.remove("hidden");
        delete freteInfo.dataset.valorFrete;
      }
      atualizarEstadoBotaoFinalizar();
      return;
    }

    // Tenta interpretar payload
    let payload;
    try { payload = JSON.parse(texto); } catch { payload = null; }

    const normalizarStatus = (s) => {
      if (s == null) return "DESCONHECIDO";
      if (typeof s === "number") return (s === 200 || s === 1) ? "OK" : "ERRO";
      const str = String(s).toUpperCase();
      if (str.includes("OK") || str.includes("SUCESSO") || str.includes("SUCCESS")) return "OK";
      return str;
    };

    // ---- Formato (B): RetornoDTO (Status/Sucesso + Objeto) ----
    if (payload && (payload.Status !== undefined || payload.Sucesso !== undefined)) {
      const status = normalizarStatus(payload.Status ?? (payload.Sucesso ? "OK" : "ERRO"));
      const lista = Array.isArray(payload.Objeto) ? payload.Objeto : [];
      const msgApi = payload.Mensagem || "";

      if (status !== "OK") {
        if (freteInfo) {
          freteInfo.textContent = msgApi || "Não foi possível calcular o frete.";
          freteInfo.classList.remove("hidden");
          delete freteInfo.dataset.valorFrete;
        }
        atualizarEstadoBotaoFinalizar();
        return;
      }

      if (!lista.length) {
        if (freteInfo) {
          freteInfo.textContent = "Nenhuma opção de frete disponível.";
          freteInfo.classList.remove("hidden");
          delete freteInfo.dataset.valorFrete;
        }
        atualizarEstadoBotaoFinalizar();
        return;
      }

      const frete = lista[0]; // esperado: { Transportadora, Valor, PrazoEntrega }
      const valor = Number(frete?.Valor);
      const prazo = frete?.PrazoEntrega;

      if (!Number.isFinite(valor) || prazo === undefined) {
        if (freteInfo) {
          freteInfo.textContent = "Resposta de frete inválida.";
          freteInfo.classList.remove("hidden");
          delete freteInfo.dataset.valorFrete;
        }
        atualizarEstadoBotaoFinalizar();
        return;
      }

      if (valor === 0) {
        if (freteInfo) {
          freteInfo.textContent = "Cupom de frete grátis aplicado.";
          freteInfo.dataset.valorFrete = "0.00";
          freteInfo.classList.remove("hidden");
        }
        window.valorFreteAtual = 0;
        window.freteGratisOK = true;
        atualizarEstadoBotaoFinalizar();
        return;
      }

      if (freteInfo) {
        freteInfo.textContent = `Frete: R$ ${valor.toFixed(2).replace(".", ",")} — Entrega em ${prazo} dia(s) úteis`;
        freteInfo.dataset.valorFrete = valor.toFixed(2);
        freteInfo.classList.remove("hidden");
      }
      window.valorFreteAtual = valor;
      atualizarEstadoBotaoFinalizar();
      return;
    }

    // ---- Formato (A): array simples [{ valor, prazoEntrega, ... }] ----
    const freteArray = payload;
    if (!Array.isArray(freteArray) || freteArray.length === 0) {
      throw new Error("Nenhuma opção de frete disponível");
    }

    const frete = freteArray[0];
    if (!frete || frete.valor === undefined || frete.prazoEntrega === undefined) {
      throw new Error("Resposta de frete inválida.");
    }

    if (frete.prazoEntrega === 0) {
      if (freteInfo) {
        freteInfo.textContent = frete.mensagem || "Erro interno ao calcular o frete.";
        freteInfo.dataset.valorFrete = "0.00";
        freteInfo.classList.remove("hidden");
      }
      window.valorFreteAtual = 0;
      atualizarEstadoBotaoFinalizar();
      return;
    }

    if (freteInfo) {
      freteInfo.textContent = `Frete: R$ ${frete.valor.toFixed(2).replace(".", ",")} — Entrega em ${frete.prazoEntrega} dia(s) úteis`;
      freteInfo.dataset.valorFrete = frete.valor.toFixed(2);
      freteInfo.classList.remove("hidden");
    }
    window.valorFreteAtual = frete.valor;
    atualizarEstadoBotaoFinalizar();

  } catch (erro) {
    console.error("Erro ao calcular frete:", erro);
    if (freteInfo) {
      freteInfo.textContent = "Erro ao calcular o frete. Tente novamente.";
      freteInfo.classList.remove("hidden");
      delete freteInfo.dataset.valorFrete;
    }
    atualizarEstadoBotaoFinalizar();
  }
}

function isGuid(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  // formato XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (case-insensitive)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}





