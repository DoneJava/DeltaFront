async function enviarFormularioContato() {
  const form = document.getElementById("form-contato");
  if (!form) return;

  const nome = form.querySelector("input[placeholder='Seu nome']").value.trim();
  const email = form.querySelector("input[placeholder='Seu e-mail']").value.trim();
  const assunto = form.querySelector("input[placeholder='Motivo do contato']").value.trim();
  const mensagem = form.querySelector("textarea[placeholder='Escreva sua mensagem']").value.trim();

  if (!nome || !email || !assunto || !mensagem) {
    mostrarPopupErro("Preencha todos os campos antes de enviar.");
    return;
  }

  const dto = { nome, email, assunto, mensagem };

  try {
    const token = obterCookie("token");

    const resposta = await fetch(`${window.apiBaseUrl}/pedido/registrar-contato`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
      },
      body: JSON.stringify(dto)
    });

    if (resposta.ok) {
      mostrarPopupSucesso("Mensagem enviada com sucesso!");
      form.reset();
    } else {
      const erroTexto = await resposta.text();
      mostrarPopupErro(erroTexto || "Erro ao enviar a mensagem.");
    }
  } catch (erro) {
    console.error("[ERRO] ao enviar contato:", erro);
    mostrarPopupErro("Erro na comunicação com o servidor.");
  }
}

function mostrarPopupSucesso(mensagem) {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `
    fixed top-8 left-1/2 transform -translate-x-1/2 
    bg-yellow-400 text-black font-semibold 
    px-6 py-3 rounded-lg shadow-lg 
    border border-yellow-600 z-50 
    animate-slide-down
  `;

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.classList.add("opacity-0", "transition-opacity", "duration-500");
    setTimeout(() => popup.remove(), 500);
  }, 2500);
}

function mostrarPopupErro(mensagem) {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `
    fixed top-8 left-1/2 transform -translate-x-1/2 
    bg-yellow-300 text-black font-semibold 
    px-6 py-3 rounded-lg shadow-lg 
    border border-yellow-600 z-50 
    animate-slide-down
  `;

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.classList.add("opacity-0", "transition-opacity", "duration-500");
    setTimeout(() => popup.remove(), 8000);
  }, 2500);
}


function obterCookie(nome) {
  const valor = `; ${document.cookie}`;
  const partes = valor.split(`; ${nome}=`);
  if (partes.length === 2) return partes.pop().split(';').shift();
  return null;
}

// Expor função
window.enviarFormularioContato = enviarFormularioContato;
