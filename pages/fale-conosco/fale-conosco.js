// =======================
// Util: toast de sucesso/erro (mantive os seus)
// =======================
function mostrarPopupSucesso(mensagem) {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `
    fixed top-8 left-1/2 transform -translate-x-1/2 
    bg-yellow-400 text-black font-semibold 
    px-6 py-3 rounded-lg shadow-lg 
    border border-yellow-600 z-50 
  `;
  document.body.appendChild(popup);
  setTimeout(() => { popup.classList.add("opacity-0","transition-opacity","duration-500"); setTimeout(()=>popup.remove(),500); }, 2500);
}
function mostrarPopupErro(mensagem) {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `
    fixed top-8 left-1/2 transform -translate-x-1/2 
    bg-yellow-300 text-black font-semibold 
    px-6 py-3 rounded-lg shadow-lg 
    border border-yellow-600 z-50 
  `;
  document.body.appendChild(popup);
  setTimeout(() => { popup.classList.add("opacity-0","transition-opacity","duration-500"); setTimeout(()=>popup.remove(),8000); }, 2500);
}
function obterCookie(nome) {
  const valor = `; ${document.cookie}`;
  const partes = valor.split(`; ${nome}=`);
  if (partes.length === 2) return partes.pop().split(";").shift();
  return null;
}

// =======================
// Fale Conosco
// =======================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-contato");
  if (!form) return;

  // contador de caracteres da mensagem
  const txtMsg = document.getElementById("contatoMensagem");
  const counter = document.getElementById("contatoMensagemCount");
  const updateCount = () => { counter.textContent = `${txtMsg.value.length}/2000`; };
  txtMsg.addEventListener("input", updateCount);
  updateCount();

  // normalizar nº do pedido (só dígitos)
  const pedido = document.getElementById("contatoPedidoId");
  pedido.addEventListener("input", (e) => { e.target.value = String(e.target.value || "").replace(/\D/g,"").slice(0,12); });

  // se logado, pré-preencher nome e e-mail
  prefillContatoFromUsuario();

  // submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(form);

    const dto = buildContatoDTO(form);
    const erros = validateContato(dto);
    if (erros.length) {
      renderErrors(form, erros);
      mostrarPopupErro("Verifique os campos destacados.");
      return;
    }

    // injeta [pedido] no assunto, se informado
    if (dto.pedidoId) {
      dto.assunto = `[${dto.pedidoId}] ${dto.assunto}`.trim();
    }

    // envia
    const btn = document.getElementById("btnContatoEnviar");
    const live = document.getElementById("contatoLive");
    const token = obterCookie("token");

    try {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Enviando…";
      live.textContent = "Enviando mensagem…";

      const resposta = await fetch(`${window.apiBaseUrl}/pedido/registrar-contato`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({ nome: dto.nome, email: dto.email, assunto: dto.assunto, mensagem: dto.mensagem })
      });

      if (resposta.ok) {
        mostrarPopupSucesso("Mensagem enviada com sucesso!");
        form.reset();
        updateCount();
      } else {
        const erroTexto = await resposta.text();
        mostrarPopupErro(erroTexto || "Erro ao enviar a mensagem.");
      }
      btn.textContent = original;
      btn.disabled = false;
      live.textContent = "";
    } catch (err) {
      console.error("[ERRO] ao enviar contato:", err);
      mostrarPopupErro("Erro na comunicação com o servidor.");
      btn.disabled = false;
      live.textContent = "";
      btn.textContent = "Enviar";
    }
  });
});

function buildContatoDTO(form) {
  return {
    nome: (document.getElementById("contatoNome").value || "").trim(),
    email: (document.getElementById("contatoEmail").value || "").trim(),
    pedidoId: (document.getElementById("contatoPedidoId").value || "").trim(),
    assunto: (document.getElementById("contatoAssunto").value || "").trim(),
    mensagem: (document.getElementById("contatoMensagem").value || "").trim(),
  };
}

function validateContato(dto) {
  const erros = [];
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ ]{2,80}$/.test(dto.nome)) {
    erros.push({ field: "contatoNome", msg: "Informe um nome válido (apenas letras e espaços, 2–80)." });
  }
  // e-mail simples e robusto
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dto.email)) {
    erros.push({ field: "contatoEmail", msg: "E-mail inválido." });
  }
  if (dto.pedidoId && !/^\d{1,12}$/.test(dto.pedidoId)) {
    erros.push({ field: "contatoPedidoId", msg: "Use apenas números no nº do pedido." });
  }
  if (dto.assunto.length < 5 || dto.assunto.length > 120) {
    erros.push({ field: "contatoAssunto", msg: "Assunto deve ter entre 5 e 120 caracteres." });
  }
  if (dto.mensagem.length < 10 || dto.mensagem.length > 2000) {
    erros.push({ field: "contatoMensagem", msg: "Mensagem deve ter entre 10 e 2000 caracteres." });
  }
  return erros;
}

function renderErrors(form, erros) {
  erros.forEach(e => {
    const span = form.querySelector(`[data-error-for="${e.field}"]`);
    if (span) {
      span.textContent = e.msg;
      span.classList.remove("hidden");
    }
    const input = document.getElementById(e.field);
    input?.classList?.add("border-rose-400","ring-1","ring-rose-200");
    input?.addEventListener?.("input", () => {
      input.classList.remove("border-rose-400","ring-1","ring-rose-200");
      span?.classList?.add("hidden");
    }, { once: true });
  });
}
function clearErrors(form) {
  form.querySelectorAll("[data-error-for]").forEach(s => { s.textContent = ""; s.classList.add("hidden"); });
  form.querySelectorAll(".border-rose-400").forEach(el => el.classList.remove("border-rose-400","ring-1","ring-rose-200"));
}

// Pré-preencher usando o endpoint já existente da sua app
async function prefillContatoFromUsuario() {
  try {
    const token = obterCookie("token");
    if (!token) return;
    const resp = await fetch(`${window.apiBaseUrl}/cliente/obter-dados`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!resp.ok) return;
    const dados = await resp.json();
    const nome = dados.nome || "";
    const email = dados.email || "";
    if (nome) document.getElementById("contatoNome").value = nome;
    if (email) document.getElementById("contatoEmail").value = email;
  } catch { /* silencioso */ }
}

// Expor (se quiser chamar manualmente em outro lugar)
window.enviarFormularioContato = () => document.getElementById("form-contato")?.dispatchEvent(new Event("submit",{cancelable:true}));
