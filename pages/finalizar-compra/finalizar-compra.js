let cardPaymentBrickController = null;

function inicializarFinalizarCompra() {
  
    const dados = window.dadosPagamentoFinal;
    if (!dados) {
      mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente."<br>"Se persistir o erro, entre em contato conosco!");
      return;
    }

    const tipo = dados.metodoPagamento?.toString();

    const produtos = dados.produtos || [];
    const cupom = dados.cupom || "";

    // Cria o objeto com os dados a serem enviados para o backend
    const dadosPagamento = {
      produtos: produtos,
      cupom: cupom
    };

    // Requisição para obter o valor total do backend
    fetch(`${window.apiBaseUrl}/pagamento/calcular_valor_total`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dadosPagamento), // Envia o objeto com produtos e cupom
    })
    .then(res => res.json()) // Recebe os dados do backend
    .then(data => {
      const valorTotal = data.valorTotal;

      if (!valorTotal) {
        mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente."<br>"Se persistir o erro, entre em contato conosco!");
        return;
      }

      switch (tipo) {
        case "1": // Pix
          document.getElementById("containerPagamentoPix").classList.remove("hidden");
          document.getElementById("qrcodePix").src = "https://via.placeholder.com/250x250.png?text=PIX";
          break;

          case "2": // Cartão de crédito
          document.getElementById("containerPagamentoCartao").classList.remove("hidden");
        
          if (window.mp && window.mp.bricks) {
            const bricksBuilder = window.mp.bricks();
        
            // Desmonta o Brick anterior se existir
            if (cardPaymentBrickController) {
              cardPaymentBrickController.unmount();
              cardPaymentBrickController = null;
            }
        
            // Cria novo card
            bricksBuilder.create("cardPayment", "cardPaymentBrick_container", {
              initialization: {
                amount: valorTotal
              },
              customization: {
                paymentMethods: {
                  creditCard: "all",
                  debitCard: "all",
                  ticket: "all",
                  bankTransfer: "all"
                },
                visual: {
                  style: {
                    theme: "default"
                  }
                }
              },
              callbacks: {
                onReady: () => {},
                onSubmit: (cardFormData) => {
                  const token = cardFormData.token;
        
                  fetch(`${window.apiBaseUrl}/pagamento/processar_pagamento`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      token: token,
                      valorTotal: valorTotal,
                      ...cardFormData
                    })
                  })
                  .then(response => response.json())
                  .then(data => {
                    mostrarPopup("Pagamento processado com sucesso!");
                  })
                  .catch(error => {
                    mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
                  });
                },
                onError: (error) => {
                  mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
                  navigateTo("pagamento");
                }
              }
            }).then(controller => {
              cardPaymentBrickController = controller;
            });
          } else {
            mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
            navigateTo("pagamento");
          }
          break;
        
        case "3": // Débito
          document.getElementById("containerPagamentoDebito").classList.remove("hidden");
          break;

        case "4": // Boleto
          document.getElementById("containerPagamentoBoleto").classList.remove("hidden");
          break;

        default:
          mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente."<br>"Se persistir o erro, entre em contato conosco!");
          break;
      }
    })
    .catch(error => {
      mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente."<br>"Se persistir o erro, entre em contato conosco!");
    });
}

function gerarBoleto() {
  alert("Boleto gerado com sucesso!");
}

function pagarDebito() {
  alert("Redirecionando para o banco...");
}


function mostrarPopup(mensagem) {
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
    setTimeout(() => popup.remove(), 5000);
  }, 20000);
}