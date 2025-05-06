window.usuarioAutenticado = false;

async function loadHTML(id, file) {
  let filePath = '';

  if (file === 'header.html') {
    filePath = './components/header.html';
  } else if (file === 'footer.html') {
    filePath = './components/footer.html';
  } else if (file && !file.includes('header') && !file.includes('footer')) {
    filePath = `./pages/${file}.html`;
  } else {
    return;
  }

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Erro ao carregar o arquivo: ${filePath}`);
    const html = await response.text();
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = html;
      if (id === "header") {
        attachDropdown();
        attachNavEvents();
        atualizarContadorCarrinho();
        inicializarMenuMobile();
      }
    }
  } catch (error) {
    console.error("Erro:", error);
  }
}

function inicializarMenuMobile() {
  const toggleBtn = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  if (!toggleBtn || !mobileMenu) {
    console.warn("[MENU] menu-toggle ou mobile-menu não encontrado.");
    return;
  }

  toggleBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    mobileMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", function (event) {
    if (!mobileMenu.contains(event.target) && !toggleBtn.contains(event.target)) {
      mobileMenu.classList.add("hidden");
    }
  });

  ajustarMenuMobile();
}

function ajustarMenuMobile() {
  const mobileMenu = document.getElementById("mobile-menu");
  if (!mobileMenu) return;

  mobileMenu.innerHTML = '';
  mobileMenu.classList.add("flex", "flex-col", "items-center");

  const criarLink = (texto, page) => {
    const link = document.createElement('a');
    link.href = "#";
    link.textContent = texto;
    link.className = "hover:text-yellow-400 nav-link text-center";
    link.setAttribute("data-page", page);
    return link;
  };

  // Sempre visíveis
  mobileMenu.appendChild(criarLink("Início", "home"));
  mobileMenu.appendChild(criarLink("Fale conosco", "fale-conosco"));

  // Carrinho (sempre visível)
  const carrinhoDiv = document.createElement("div");
  carrinhoDiv.className = "cursor-pointer my-1";
  carrinhoDiv.onclick = () => navigateTo("carrinho");
  carrinhoDiv.innerHTML = `
    <div class="relative inline-block">
      <i class="fas fa-shopping-cart text-white hover:text-yellow-400 text-xl"></i>
      <span id="cart-count-mobile" class="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold rounded-full px-1.5 py-0.5">0</span>
    </div>
  `;
  mobileMenu.appendChild(carrinhoDiv);

  if (window.usuarioAutenticado) {
    // Itens para usuário logado
    mobileMenu.appendChild(criarLink("Pedidos", "pedidos"));
    mobileMenu.appendChild(criarLink("Editar Conta", "editar-conta"));

    const btnLogout = document.createElement("button");
    btnLogout.textContent = "Sair";
    btnLogout.className = "text-red-600 hover:text-yellow-300 font-semibold mt-2";
    btnLogout.onclick = logout;
    mobileMenu.appendChild(btnLogout);
  } else {
    // Itens para usuário não autenticado
    mobileMenu.appendChild(criarLink("Cadastrar", "cadastro"));

    const contaBtn = document.createElement("button");
    contaBtn.innerHTML = `<i class="fas fa-user text-yellow-400 hover:text-yellow-300 text-xl"></i>`;
    contaBtn.className = "hover:text-yellow-300 mt-2";
    contaBtn.onclick = () => navigateTo("login");
    mobileMenu.appendChild(contaBtn);
  }

  atualizarContadorCarrinho();
}



function obterCookie(nome) {
  const cookies = document.cookie.split("; ");
  for (let c of cookies) {
    const [key, value] = c.split("=");
    if (key === nome) return value;
  }
  return null;
}


function navigateTo(page, query = "") {
  const queryString = query ? `?${query}` : "";
  window.history.pushState({}, "", `#${page}${queryString}`);

  loadHTML("main-content", `${page}/${page}`).then(() => {
    attachNavEvents();

    if (page === "home") {
      carregarProdutos();
      carregarProdutosDestaqueCarrossel();
      setupSidebarToggle();
    }

    if (page === "editar-conta") {
      const script = document.createElement("script");
      script.src = "pages/editar-conta/editar-conta.js";
      script.onload = () => {
        if (typeof iniciarFormularioEdicao === "function") iniciarFormularioEdicao();
      };
      document.body.appendChild(script);
    }

    if (page === "carrinho") {
      console.log('teste')
      const script = document.createElement("script");
      script.src = "pages/carrinho/carrinho.js";
      script.onload = () => {
        if (typeof carregarCarrinho === "function") carregarCarrinho();
      };
      document.body.appendChild(script);
    }

    if (page === "pagamento") {
      const script = document.createElement("script");
      script.src = "pages/pagamento/pagamento.js";
      script.onload = async () => {
        await validarTokenSilenciosamente(); // nova função sem redirecionar
        if (typeof carregarTelaPagamento === "function") await carregarTelaPagamento();
        if (typeof validarCheckboxUsuarioLogado === "function") await validarCheckboxUsuarioLogado();
      };
      document.body.appendChild(script);
    }

    if (page === "cadastro") {
      const script = document.createElement("script");
      script.src = "pages/cadastro/cadastro.js";
      script.onload = () => {
        if (typeof CADIniciarFormulario === "function") CADIniciarFormulario();
      };
      document.body.appendChild(script);
    }

    if (page === "login") {
      const token = obterCookie("token");
      inicializarLogin();
      if (token) {
        navigateTo('home')
        return;
      }
    }


    
    
    
    if (page === "produto-detalhes") {
      const params = new URLSearchParams(query);
      const id = params.get("id");
      const script = document.createElement("script");
      script.src = "pages/produto-detalhes/produto-detalhes.js";
      script.onload = () => {
        if (typeof carregarDetalhesProduto === "function" && typeof carregarImagensProduto === "function") {
          carregarDetalhesProduto(id);
          carregarImagensProduto(id);
        }
      };
      document.body.appendChild(script);
    }
  });
}

window.onpopstate = () => {
  const [page, query] = location.hash.replace("#", "").split("?");
  navigateTo(page, query || "");
};

document.addEventListener("DOMContentLoaded", () => {
  loadHTML("header", "header.html").then(() => {
    verificarAutenticacao().then(() => {
      if (window.usuarioAutenticado) {
        esconderBotaoCadastrar();
      }
    });
  });

  loadHTML("footer", "footer.html");

  const [page, query] = location.hash.replace("#", "").split("?");
  navigateTo(page || "home", query || "");
});



function attachNavEvents() {
  const navLinks = document.querySelectorAll("[data-page]");
  navLinks.forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      navigateTo(page);
    };
  });
}

function attachDropdown() {
  const icon = document.getElementById("userIcon");
  const menu = document.getElementById("userMenu");

  if (!icon || !menu) return;

  icon.addEventListener("click", function (event) {
    event.stopPropagation();
    const isVisible = menu.style.display === "block";
    menu.style.display = isVisible ? "none" : "block";
  });

  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target) && !icon.contains(event.target)) {
      menu.style.display = "none";
    }
  });
  document.addEventListener("click", function (event) {
    if (!menu.contains(event.target) && !icon.contains(event.target)) {
      menu.style.display = "none";
    }
  });
}

function setupSenhaValidation() {
  const form = document.querySelector("form");
  if (!form) return;

  const inputs = form.querySelectorAll("input, select");
  const senha = document.getElementById("senha");
  const confirmar = document.getElementById("confirmarSenha");
  const button = form.querySelector("button[type='submit']");

  if (!senha || !confirmar || !button) return;

  let aviso = senha.parentNode.querySelector(".senha-aviso");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.className = "text-sm text-red-600 mt-1 senha-aviso";
    senha.parentNode.appendChild(aviso);
  }

  const senhaSegura = (value) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{8,}$/;
    return regex.test(value);
  };

  const validarFormulario = () => {
    const s1 = senha.value.trim();
    const s2 = confirmar.value.trim();
    const todosPreenchidos = Array.from(inputs).every(input => input.value.trim() !== "");

    if (!senhaSegura(s1)) {
      aviso.textContent = "A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.";
      aviso.style.display = "block";
      button.disabled = true;
      return;
    }

    if (s1 !== s2) {
      aviso.textContent = "As senhas não coincidem.";
      aviso.style.display = "block";
      button.disabled = true;
      return;
    }

    aviso.style.display = "none";
    button.disabled = !todosPreenchidos;
  };

  senha.addEventListener("input", validarFormulario);
  confirmar.addEventListener("input", validarFormulario);
  inputs.forEach(input => input.addEventListener("input", validarFormulario));

  button.disabled = true;
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");

  if (!toggleBtn || !sidebar) return;

  toggleBtn.onclick = () => {
    sidebar.classList.toggle("hidden");
  };

  const buttons = sidebar.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.onclick = () => {
      if (window.innerWidth < 1024) {
        sidebar.classList.add("hidden");
      }
    };
  });
}

function atualizarContadorCarrinho() {
  const carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
  const total = carrinho.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  window.carrinhoQuantidade = total;

  const contadorDesktop = document.getElementById("cart-count");
  const contadorMobile = document.getElementById("cart-count-mobile");

  if (contadorDesktop) {
    contadorDesktop.textContent = total;
    contadorDesktop.style.display = "inline-block";
  }

  if (contadorMobile) {
    contadorMobile.textContent = total;
    contadorMobile.style.display = "inline-block";
  }
}


async function toggleUserMenu(event) {
  event.stopPropagation();

  // Verifique se a autenticação já foi validada
  if (!window.usuarioAutenticado) {
    console.log("[Auth] Verificando autenticação...");
    await verificarAutenticacao(); // Chama a função que valida o token

    if (!window.usuarioAutenticado) {
      // Se estiver autenticado, abre o menu
      const menu = document.getElementById("userMenu");
      const isVisible = menu.style.display === "block";
      menu.style.display = isVisible ? "none" : "block";
      console.warn("[Auth] Usuário não autenticado. Redirecionando...");
      navigateTo("login");
      return;
    }
  }
}


async function verificarAutenticacao() {
  const token = obterCookie("token");

  if (!token) {
    console.warn("[Auth] Token não encontrado.");
    window.usuarioAutenticado = false;
    return;
  }

  try {
    const resposta = await fetch(`${window.apiBaseUrl}/cliente/validar-token`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!resposta.ok) {
      console.warn("[Auth] Token inválido ou expirado.");
      window.usuarioAutenticado = false;
      return;
    }

    window.usuarioAutenticado = true;
    console.log("[Auth] Usuário autenticado com sucesso.");
    esconderBotaoCadastrar();

    // 🔁 Atualiza o header inteiro após login
    await loadHTML("header", "header.html");

    navigateTo('home');
  } catch (erro) {
    console.error("[Auth] Erro ao validar token:", erro);
    window.usuarioAutenticado = false;
  }
}


function esconderBotaoCadastrar() {
  const botaoCadastrar = document.getElementById("registerLink");  // Obtém o botão "Cadastrar"

  botaoCadastrar.style.display = "none";  // Esconde o botão de cadastro

}


async function CADEnviarFormulario(dados, form) {
  try {
    const resposta = await fetch(`${window.apiBaseUrl}/cliente/inserir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });

    if (resposta.ok) {
      const retorno = await resposta.json();
      const token = retorno.token;
      const validade = new Date(retorno.validade).toUTCString();

      // Salva o token no cookie
      document.cookie = `token=${token}; expires=${validade}; path=/`;

      // Limpa o formulário e exibe o popup de sucesso
      form.reset();
      CADValidarFormulario();
      CADExibirPopup("Conta criada com sucesso!", "success");

      // ✅ Valida o token recém-salvo
      await verificarAutenticacao();

      // ✅ Atualiza o header com base na autenticação válida
      await loadHTML("header", "header.html");

      esconderBotaoCadastrar();

      // ✅ Redireciona para a home
      navigateTo("home");
    } else {
      const texto = await resposta.text();
      let mensagem = "Erro ao tentar cadastrar. Por favor, tente novamente.";

      if (resposta.status === 409 || resposta.status === 500) {
        if (texto.includes("CPF") || texto.includes("CPF_CNPJ")) {
          mensagem = "Já existe um cliente com este CPF.";
        } else if (texto.includes("e-mail")) {
          mensagem = "Já existe um cliente com este e-mail.";
        } else if (texto.includes("chave duplicada")) {
          mensagem = "Já existe um cliente com os dados informados.";
        }
      }

      CADExibirPopup(mensagem, "error");
    }
  } catch (erro) {
    CADExibirPopup("Erro ao tentar cadastrar. Por favor, tente novamente.", "error");
  }
}


function logout() {
  // Limpa o cookie do token
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";

  // Fecha o menu de usuário
  const menu = document.getElementById("userMenu");
  if (menu) menu.style.display = "none";

  // Redireciona para a página inicial
  navigateTo("home");

  // Usamos setTimeout para garantir que o redirecionamento seja feito primeiro
  setTimeout(() => {
    // Atualiza a página para garantir que a validação de autenticação será realizada
    location.reload();
  }, 100); // Espera 500ms antes de recarregar a página
}


async function validarTokenSilenciosamente() {
  const token = obterCookie("token");
  if (!token) {
    window.usuarioAutenticado = false;
    return;
  }

  try {
    const resposta = await fetch(`${window.apiBaseUrl}/cliente/validar-token`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    window.usuarioAutenticado = resposta.ok;
  } catch (erro) {
    console.error("[Auth] Erro ao validar token silenciosamente:", erro);
    window.usuarioAutenticado = false;
  }
}


window.pageSize = 10;
window.currentPage = 0;
window.totalItems = 100;
window.totalPages = Math.ceil(window.totalItems / window.pageSize);
window.apiBaseUrl = "https://localhost:7059/api";
