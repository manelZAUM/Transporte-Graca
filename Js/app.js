// js/app.js

// URL da sua nova API segura no Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyWhX3Cb2CzqzjTWDcZDqwiZrO8OYAWt0s3pMTEA1UOeBZcVsbQv5B0jnmwQHnb_Q4/exec";
let dadosAluno = null;

/**
 * Função principal para validar o CPF e buscar os dados na nuvem
 */
async function tentarAcesso() {
    const input = document.getElementById('cpf-input');
    const feedback = document.getElementById('feedback-login');
    const btn = document.getElementById('btn-entrar');
    const spinner = document.getElementById('spinner');

    const cpf = input.value.trim().replace(/\D/g, '');

    // Validação básica de tamanho de CPF
    if (cpf.length !== 11) {
        exibirFeedback("❌ Por favor, digite um CPF válido com 11 números.", "red");
        return;
    }

    // Inicia interface de carregamento (UI/UX)
    btn.disabled = true;
    spinner.style.display = "block";
    exibirFeedback("A validar acesso com o servidor...", "var(--verde-escuro)");

    try {
        // Consulta segura: o servidor só devolve os dados deste CPF
        const response = await fetch(`${API_URL}?cpf=${cpf}`);
        const data = await response.json();

        if (data.erro) {
            exibirFeedback("❌ " + data.erro, "red");
        } else {
            // Sucesso: armazena os dados e limpa a interface de login
            dadosAluno = data[0]; 
            entrarNoSistema();
        }
    } catch (e) {
        console.error("Erro na requisição:", e);
        exibirFeedback("❌ Erro ao ligar ao servidor. Verifique a sua internet.", "red");
    } finally {
        // Restaura o botão
        btn.disabled = false;
        spinner.style.display = "none";
    }
}

/**
 * Funções Auxiliares de Interface (UI)
 */
function exibirFeedback(mensagem, cor) {
    const feedback = document.getElementById('feedback-login');
    feedback.innerText = mensagem;
    feedback.style.color = cor;
}

function entrarNoSistema() {
    document.getElementById('login-wrapper').style.display = 'none';
    document.getElementById('sistema-container').style.display = 'block';
    document.body.classList.remove('login-ativo');
    
    // Inicia a renderização do Dashboard
    renderizarDadosUnicos();
}

function renderizarDadosUnicos() {
    // Aqui você pode preencher os campos do seu dashboard 
    // usando o objeto 'dadosAluno'
    console.log("Sistema carregado para:", dadosAluno.nome);
}

// Suporte para a tecla "Enter" no campo de input
document.getElementById('cpf-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') tentarAcesso();
});