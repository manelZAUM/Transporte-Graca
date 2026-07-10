// Substitua pela URL gerada ao "Implantar" o seu Google Apps Script
const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbwHIWArRnGMvDskFS20ovXrO60f1EnJyNRUYE6Ap_QYalm1MZV_U3kvKAkDlZaCey4/exec";

// Função acionada pelo Google assim que o login é feito com sucesso na janela pop-up
function handleCredentialResponse(response) {
    const tokenGerado = response.credential;
    const divMensagem = document.getElementById('mensagem-sistema');

    // Mostra um aviso de carregamento enquanto consulta o servidor
    divMensagem.style.color = '#0056b3';
    divMensagem.innerText = "Consultando permissões de acesso na base de dados...";
    divMensagem.style.display = 'block';

    // Faz a requisição para a nossa rota de validação no Google Apps Script
    fetch(`${URL_APPS_SCRIPT}?acao=validar_admin&token=${tokenGerado}`)
        .then(resposta => resposta.json())
        .then(dadosDoServidor => {
            
            if (dadosDoServidor.autorizado === true) {
                // Sucesso! O servidor validou que é um @gmail.com autorizado.
                divMensagem.style.color = 'green';
                divMensagem.innerText = "Acesso Liberado! Redirecionando...";
                
                // Salva o token no navegador para usarmos na próxima página
                sessionStorage.setItem("admin_token", tokenGerado);
                
                // Redireciona para o painel de gestão real
                setTimeout(() => {
                    window.location.href = "dashboard-secretaria.html"; 
                }, 1000);
                
            } else {
                // Erro: E-mail não está na lista ou não é @gmail.com
                divMensagem.style.color = '#d9534f';
                divMensagem.innerText = dadosDoServidor.erro;
            }
            
        })
        .catch(erro => {
            console.error("Erro na comunicação:", erro);
            divMensagem.style.color = '#d9534f';
            divMensagem.innerText = "Erro ao conectar com o servidor. Tente novamente.";
        });
}