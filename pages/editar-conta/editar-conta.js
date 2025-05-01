async function obterDadosUsuario() {
    const token = obterCookie("token");
    if (!token) return;

    try {
        const resposta = await fetch(`${window.apiBaseUrl}/cliente/obter-dados`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (resposta.ok) {
            const dados = await resposta.json();

            document.getElementById("nome").value = dados.nome || "";
            document.getElementById("email").value = dados.email || "";
            document.getElementById("cpf").value = dados.cpF_CNPJ || dados.cpf_CNPJ || "";
            document.getElementById("telefone").value = dados.telefone || "";
            document.getElementById("endereco").value = dados.endereco || "";
            document.getElementById("complemento").value = dados.complemento || "";
            document.getElementById("cep").value = dados.cep || "";
            document.getElementById("portaria24h").checked = dados.portaria24Horas || false;

            validarFormularioEditarConta(); // Verifica se o botão pode ser ativado
        }
    } catch (erro) {
        console.error("[ERRO] ao buscar dados do cliente:", erro);
    }
}

function validarFormularioEditarConta() {
    const campos = [
        "nome", "email", "cpf", "telefone",
        "endereco", "complemento", "cep"
    ];

    const senhaAtual = document.getElementById("senhaAtual").value.trim();
    const novaSenha = document.getElementById("senha").value.trim();
    const aviso = document.getElementById("senhaAviso");
    const botao = document.querySelector("button[type='submit']");

    // Limpa aviso e oculta
    aviso.textContent = "";
    aviso.style.display = "none";

    // Se qualquer campo de senha foi preenchido
    if (senhaAtual || novaSenha) {
        if (!senhaAtual || !novaSenha) {
            aviso.textContent = "Preencha ambos os campos de senha.";
            aviso.style.display = "block";
            return desativarBotao(botao);
        }

        if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(novaSenha)) {
            aviso.textContent = "A nova senha deve conter ao menos 6 caracteres, incluindo letra e número.";
            aviso.style.display = "block";
            return desativarBotao(botao);
        }
    }

    // Verifica campos comuns
    const camposPreenchidos = campos.every(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== "";
    });

    if (camposPreenchidos) {
        ativarBotao(botao);
    } else {
        desativarBotao(botao);
    }
}

function ativarBotao(botao) {
    botao.disabled = false;
    botao.classList.remove("opacity-50", "cursor-not-allowed");
}

function desativarBotao(botao) {
    botao.disabled = true;
    botao.classList.add("opacity-50", "cursor-not-allowed");
}

function iniciarFormularioEdicao() {
    const form = document.querySelector("form");
    if (!form) return;

    const inputs = form.querySelectorAll("input");
    inputs.forEach(input => input.addEventListener("input", validarFormularioEditarConta));
    document.getElementById("portaria24h").addEventListener("change", validarFormularioEditarConta);

    form.addEventListener("submit", async function (e) {
        e.preventDefault();
    
        const dados = {
            nome: document.getElementById("nome").value.trim(),
            email: document.getElementById("email").value.trim(),
            cpf_CNPJ: document.getElementById("cpf").value.trim(),
            telefone: document.getElementById("telefone").value.trim(),
            endereco: document.getElementById("endereco").value.trim(),
            complemento: document.getElementById("complemento").value.trim(),
            cep: document.getElementById("cep").value.trim(),
            senhaAtual: document.getElementById("senhaAtual").value.trim(),
            senhaEmTexto: document.getElementById("senha").value.trim(),
            portaria24Horas: document.getElementById("portaria24h").checked
        };
    
        try {
            const resposta = await fetch(`${window.apiBaseUrl}/cliente/atualizar`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${obterCookie("token")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dados)
            });
    
            if (resposta.ok) {
                CADExibirPopup("Dados atualizados com sucesso!", "success");
            } else {
                const conteudo = await resposta.text();
                CADExibirPopup(conteudo || "Erro ao atualizar os dados.", "error");
            }
        } catch (erro) {
            console.error("[ERRO] Atualização falhou:", erro);
            CADExibirPopup("Erro na comunicação com o servidor.", "error");
        }
    });
    
    obterDadosUsuario();
}

window.addEventListener("DOMContentLoaded", iniciarFormularioEdicao);
