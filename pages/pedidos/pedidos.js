async function carregarPedidosDoCliente() {
  const container = document.getElementById("containerPedidos");
  container.innerHTML = `<p class="text-gray-600">Carregando seus pedidos...</p>`;

  try {
    // Valida o token usando método global
    await validarTokenSilenciosamente();

    if (!window.usuarioAutenticado || !window.clienteId) {
      throw new Error("Usuário não autenticado ou clienteId não disponível.");
    }

    const token = obterCookie("token");

    // Buscar pedidos com clienteId já disponível
    const resposta = await fetch(`${window.apiBaseUrl}/pedido/do-cliente/${window.clienteId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!resposta.ok) throw new Error("Erro ao buscar pedidos.");

    const pedidos = await resposta.json();

    if (!pedidos || pedidos.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-500">Você ainda não fez nenhum pedido.</p>`;
      return;
    }

    container.innerHTML = "";

    pedidos.forEach(pedido => {
      const pedidoDiv = document.createElement("div");
      pedidoDiv.className = "border p-4 rounded-xl bg-gray-50 shadow";

      let itensHtml = pedido.itens.map(item => `
        <div class="flex items-center gap-4 border-b py-4 last:border-b-0">
          <img src="${item.imagemUrl}" alt="${item.nome}" class="w-20 h-20 object-cover rounded-lg shadow" />
          <div class="flex-1">
            <h3 class="text-lg font-bold text-gray-800">${item.nome}</h3>
            <p class="text-sm text-gray-600 mt-1">Tamanho: <span class="text-gray-800 font-medium">${item.tamanho}</span></p>
            <p class="text-sm text-gray-600">Quantidade: <span class="text-gray-800 font-medium">${item.quantidade}</span></p>
            <p class="text-sm text-gray-600">Preço unitário: <span class="text-yellow-600 font-bold">R$ ${item.preco.toFixed(2)}</span></p>
          </div>
        </div>
      `).join("");

      pedidoDiv.innerHTML = `
        <div class="mb-4">
          <p class="text-sm text-gray-600">Data da compra: <span class="text-gray-800 font-semibold">${new Date(pedido.data).toLocaleDateString()}</span></p>
          <p class="text-sm text-gray-600">Pedido Nº <span class="text-gray-800 font-semibold">${pedido.numero}</span></p>
        </div>
        ${itensHtml}
        <div class="mt-4 text-right">
          <p class="text-sm text-gray-600">Frete: <span class="text-yellow-600 font-bold">R$ ${pedido.valorFrete.toFixed(2)}</span></p>
          <p class="text-lg font-bold text-gray-800 mt-1">Total do pedido: <span class="text-yellow-600">R$ ${pedido.valorTotal.toFixed(2)}</span></p>
        </div>
      `;

      container.appendChild(pedidoDiv);
    });

  } catch (erro) {
    console.error(erro);
    navigateTo("erro-servidor-505");
  }
}
