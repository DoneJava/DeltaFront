let cardPaymentBrickController = null;

function inicializarFinalizarCompra() {
  const dados = window.dadosPagamentoFinal;
  if (!dados) {
    mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    return;
  }

  const tipo = dados.metodoPagamento?.toString();
  const produtos = dados.produtos || [];
  const cupom = dados.cupom || "";
  const cep = dados.dadosEnvio?.cep?.replace(/\D/g, "") || ""; // Ajustado aqui para garantir envio

  const dadosPagamento = {
    produtos: produtos,
    cupom: cupom,
    cep: cep // Incluído explicitamente
  };

  fetch(`${window.apiBaseUrl}/pagamento/calcular_valor_total`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getTokenDosCookies()}`
    },
    body: JSON.stringify(dadosPagamento),
  })
    .then(res => res.json())
    .then(data => {
      const valorTotal = data.valorTotal;

      if (!valorTotal) {
        mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
        return;
      }

      switch (tipo) {
        case "1": // Pix
          document.getElementById("containerPagamentoPix").classList.remove("hidden");

          const produtosDto = produtos.map(p => ({
            idProduto: p.idProduto,
            quantidade: p.quantidade,
            tamanho: p.tamanho || "-"
          }));

          const dtoPix = {
            produtos: produtosDto,
            cupom: cupom,
            cep: cep
          };

          fetch(`${window.apiBaseUrl}/pagamento/gerar-pix`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dtoPix)
          })
            .then(res => res.json())
            .then(pix => {
              if (!pix.qrCodeBase64 || !pix.idPagamento) {
                mostrarPopup("Erro ao gerar QR Code do Pix.");
                return;
              }

              document.getElementById("qrcodePix").src = pix.qrCodeBase64;

              let tentativas = 0;
              const maxTentativas = 48;

              const intervalo = setInterval(() => {
                fetch(`${window.apiBaseUrl}/pagamento/status-pix?id=${pix.idPagamento}`)
                  .then(res => res.json())
                  .then(status => {
                    if (status.status === "approved") {
                      clearInterval(intervalo);

                      const dtoFinal = {
                        produtos: produtosDto,
                        metodoPagamento: 1,
                        dadosPagamento: "", // Agora vazio como decidido
                        dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
                        cupom: cupom,
                        cep: cep
                      };

                      fetch(`${window.apiBaseUrl}/pagamento/processar_pagamento`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${getTokenDosCookies()}`
                        },
                        body: JSON.stringify(dtoFinal)
                      })
                        .then(response => response.json())
                        .then(result => {
                          mostrarPopup("✅ Pagamento confirmado com sucesso!");

                          if (result.pedidoId) {
                            // Usuário não está logado, exibe código
                            const labelCodigo = document.createElement("div");
                            labelCodigo.className = `
                              mt-10 text-center text-2xl font-bold text-green-800 bg-green-100 p-6 rounded-xl border-2 border-green-300 shadow-lg
                            `;
                            labelCodigo.innerHTML = `
                              <p class="mb-2">Seu pedido foi realizado com sucesso!</p>
                              <p><strong>Código do pedido:</strong> <span class="text-3xl text-black tracking-wide">${result.pedidoId}</span></p>
                              <p class="mt-4 text-lg text-gray-800">
                                Guarde esse código para acompanhar o pedido na tela 
                                <button onclick="navigateTo('procurar-pedido')" 
                                        class="text-yellow-400 hover:text-yellow-500 underline font-bold transition-colors duration-300">
                                  "Procurar Pedido"
                                </button>.
                              </p>
                            `;
                            document.querySelector(".lg\\:col-span-7").appendChild(labelCodigo);
                          } else {
                            // Está logado → redireciona para pedidos
                            setTimeout(() => navigateTo("pedidos"), 2000);
                          }
                        })
                        .catch(() => {
                          mostrarPopup("Pagamento confirmado, mas houve erro ao registrar o pedido.");
                        });
                    } else {
                      tentativas++;
                      if (tentativas >= maxTentativas) {
                        clearInterval(intervalo);
                        mostrarPopup("Tempo limite atingido. Não foi possível confirmar o pagamento.");
                      }
                    }
                  })
                  .catch(() => clearInterval(intervalo));
              }, 5000);
            })
            .catch(error => {
              console.error(error);
              mostrarPopup("Erro ao gerar QR Code do Pix. Verifique sua conexão.");
            });
          break;

        case "2": // Cartão de crédito
          document.getElementById("containerPagamentoCartao").classList.remove("hidden");

          if (window.mp && window.mp.bricks) {
            const bricksBuilder = window.mp.bricks();

            if (cardPaymentBrickController) {
              cardPaymentBrickController.unmount();
              cardPaymentBrickController = null;
            }

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
                  style: { theme: "default" }
                }
              },
              callbacks: {
                onReady: () => {},
                onSubmit: (cardFormData) => {
                  const dto = {
                    produtos: produtos.map(p => ({
                      idProduto: p.idProduto,
                      quantidade: p.quantidade,
                      tamanho: p.tamanho || "-"
                    })),
                    metodoPagamento: 2,
                    dadosPagamento: "", // Vazio também para cartão
                    dadosEnvio: JSON.stringify(dados.dadosEnvio || {}),
                    cupom: cupom,
                    cep: cep
                  };

                  fetch(`${window.apiBaseUrl}/pagamento/processar_pagamento`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${getTokenDosCookies()}`
                    },
                    body: JSON.stringify(dto)
                  })
                    .then(response => response.json())
                    .then(result => {
                      mostrarPopup("✅ Pagamento confirmado com sucesso!");

                      if (result.pedidoId) {
                        // Usuário não está logado, exibe código
                        const labelCodigo = document.createElement("div");
                        labelCodigo.className = `
                          mt-10 text-center text-2xl font-bold text-green-800 bg-green-100 p-6 rounded-xl border-2 border-green-300 shadow-lg
                        `;
                        labelCodigo.innerHTML = `
                          <p class="mb-2">Seu pedido foi realizado com sucesso!</p>
                          <p><strong>Código do pedido:</strong> <span class="text-3xl text-black tracking-wide">${result.pedidoId}</span></p>
                          <p class="mt-4 text-lg text-gray-700">Guarde esse código para acompanhar o pedido na tela <strong>"Procurar Pedido"</strong>.</p>
                        `;
                        document.querySelector(".lg\\:col-span-7").appendChild(labelCodigo);
                      } else {
                        // Está logado → redireciona para pedidos
                        setTimeout(() => navigateTo("pedidos"), 2000);
                      }
                    })
                    .catch(() => {
                      mostrarPopup("Pagamento processado, mas houve erro ao registrar o pedido.");
                    });
                },
                onError: () => {
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

        default:
          mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
          break;
      }
    })
    .catch(() => {
      mostrarPopup("Houve um erro com o servidor, por favor, atualize a página e tente novamente.<br>Se persistir o erro, entre em contato conosco!");
    });
}

function mostrarPopup(mensagem) {
  const popup = document.createElement("div");
  popup.innerHTML = mensagem;
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
  }, 5000);
}
