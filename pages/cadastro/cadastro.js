function CADObterCookie(nome) {
  const cookies = document.cookie.split("; ");
  for (let c of cookies) {
    const [key, value] = c.split("=");
    if (key === nome) return value;
  }
  return null;
}

function CADValidarCamposObrigatorios() {
  const campos = [
    "nome", "email", "cpf", "telefone",
    "endereco", "complemento", "cep", "senha", "confirmarSenha"
  ];

  return campos.every(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== "";
  });
}

function CADSenhaSegura(valor) {
  const regex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  return regex.test(valor);
}

function CADValidarFormulario() {
  const senha = document.getElementById("senha");
  const confirmar = document.getElementById("confirmarSenha");
  const aviso = document.getElementById("senhaAviso");
  const button = document.querySelector("button[type='submit']");

  if (!senha || !confirmar || !aviso || !button) return;

  const s1 = senha.value.trim();
  const s2 = confirmar.value.trim();

  aviso.textContent = "";
  aviso.classList.remove("visivel");

  if (!CADSenhaSegura(s1)) {
    aviso.textContent = "A senha deve conter no mínimo uma letra, um número e pelo menos 6 caracteres.";
    aviso.classList.add("visivel");
    CADDesativarBotao(button);
    return;
  }

  if (s1 !== s2) {
    aviso.textContent = "As senhas não coincidem.";
    aviso.classList.add("visivel");
    CADDesativarBotao(button);
    return;
  }

  if (CADValidarCamposObrigatorios()) {
    CADAtivarBotao(button);
  } else {
    CADDesativarBotao(button);
  }
}

function CADAtivarBotao(button) {
  button.disabled = false;
  button.classList.remove("opacity-50", "cursor-not-allowed");
}

function CADDesativarBotao(button) {
  button.disabled = true;
  button.classList.add("opacity-50", "cursor-not-allowed");
}

function CADExibirPopup(mensagem, tipo = "success") {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `fixed top-5 left-1/2 transform -translate-x-1/2 z-50 text-white px-6 py-3 rounded-lg shadow-lg text-center
    ${tipo === "success" ? "bg-green-500" : "bg-red-500"}`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 2000);
}

function CADIniciarFormulario() {
  const token = CADObterCookie("token");
  if (token) {
    navigateTo("home");
    return;
  }

  const form = document.querySelector("form");
  if (!form) return;

  const inputs = form.querySelectorAll("input, select");
  inputs.forEach(input => input.addEventListener("input", CADValidarFormulario));

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const checkbox = document.getElementById("portaria24h");

    const dados = {
      nome: document.getElementById("nome")?.value.trim(),
      email: document.getElementById("email")?.value.trim(),
      cpf_CNPJ: document.getElementById("cpf")?.value.trim(),
      telefone: document.getElementById("telefone")?.value.trim() || null,
      endereco: document.getElementById("endereco")?.value.trim() || null,
      complemento: document.getElementById("complemento")?.value.trim() || null,
      cep: document.getElementById("cep")?.value.trim() || null,
      Portaria24Horas: checkbox?.checked || false,
      senhaEmTexto: document.getElementById("senha")?.value
    };

    await CADEnviarFormulario(dados, form);
  });

  CADValidarFormulario();
}

window.addEventListener("DOMContentLoaded", CADIniciarFormulario);
