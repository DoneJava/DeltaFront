// ✅ NÃO use DOMContentLoaded aqui — a página é carregada dinamicamente, então o HTML ainda não existe nesse momento

function inicializarLogin() {
  setupForm();
  verificarToken();

  const linkCadastro = document.getElementById("registerLink");
  if (linkCadastro) {
    linkCadastro.addEventListener("click", function (e) {
      e.preventDefault();
      navigateToCadastro();
    });
  }
}

// Função que verifica se o token existe e redireciona o usuário
function verificarToken() {
  const token = obterCookie("token");
  console.log("[Auth] Token atual:", token);

  if (token) {
    console.log("[Auth] Token encontrado. Redirecionando para a home...");
    navigateTo("home");
  }
}

// Função para obter cookies
function obterCookie(nome) {
  const cookies = document.cookie.split("; ");
  for (let c of cookies) {
    const [key, value] = c.split("=");
    if (key === nome) return value;
  }
  return null;
}

// Função para configurar o envio do formulário de login
function setupForm() {
  const form = document.getElementById("loginForm");
  if (!form) {
    console.warn("[Login] Formulário #loginForm não encontrado no DOM.");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const dados = {
      email: document.getElementById("email").value.trim(),
      senha: document.getElementById("senha").value.trim(),
    };

    await login(dados);
  });
}

// Função de login
async function login(dados) {
  console.log("[DEBUG] login() foi chamado com:", dados);
  try {
    const resposta = await fetch(`${window.apiBaseUrl}/cliente/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    if (resposta.ok) {
      const retorno = await resposta.json();
      const token = retorno.token;
      const validade = new Date(retorno.validade).toUTCString();
    
      document.cookie = `token=${token}; expires=${validade}; path=/`;
    
      window.usuarioAutenticado = true;
      esconderBotaoCadastrar();
    
      // ⚠️ Atualiza o header com base no novo estado de autenticação
      await loadHTML("header", "header.html");
      await verificarAutenticacao();
      esconderBotaoCadastrar();
      navigateTo("home");
    
      console.log("[Auth] Login bem-sucedido.");
    }
     else {
      const texto = await resposta.text();
      let mensagem = "Erro ao tentar fazer login. Por favor, tente novamente.";

      if (resposta.status === 401) {
        mensagem = "E-mail ou senha incorretos.";
      }

      CADExibirPopup(mensagem, "error");
    }
  } catch (erro) {
      navigateTo('erro-servidor-505');
  }
}

// Função para exibir popups de mensagem
function CADExibirPopup(mensagem, tipo = "success") {
  const popup = document.createElement("div");
  popup.textContent = mensagem;
  popup.className = `fixed top-5 left-1/2 transform -translate-x-1/2 z-50 text-white px-6 py-3 rounded-lg shadow-lg text-center
    ${tipo === "success" ? "bg-green-500" : "bg-red-500"}`;
  
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 3000);
}

// Função para esconder o botão de cadastro após login
function esconderBotaoCadastrar() {
  const botaoCadastrar = document.getElementById("registerLink");
  if (window.usuarioAutenticado && botaoCadastrar) {
    botaoCadastrar.style.display = "none";
  }
}
