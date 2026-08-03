'use strict';

async function validarCredencialNoServidor(API_URL, credential) {
  if (!window.PortalAPI) throw new Error('O modulo de comunicacao nao foi carregado.');
  return PortalAPI.requisicao(
    { acao: 'validar_admin', token: credential },
    { tempoLimite: 90000 }
  );
}

// Esta funcao precisa permanecer global porque e chamada pelo Google Identity Services.
window.handleCredentialResponse = async function handleCredentialResponse(response) {
  const mensagem = document.getElementById('mensagem-sistema');
  const API_URL = window.APP_CONFIG && window.APP_CONFIG.API_URL;

  mensagem.style.display = 'block';
  mensagem.style.color = '#0056b3';
  mensagem.textContent = 'Validando a sessao com seguranca...';

  try {
    if (!API_URL || API_URL.includes('COLE_AQUI')) {
      throw new Error('Configure a URL no arquivo config.js.');
    }
    if (!response || !response.credential) {
      throw new Error('O Google nao retornou uma credencial valida.');
    }

    const dados = await validarCredencialNoServidor(API_URL, response.credential);

    if (!dados.sucesso || !dados.autorizado) {
      throw new Error(dados.erro || 'Este e-mail nao possui permissao.');
    }

    // O ID Token expira rapidamente e fica somente nesta aba do navegador.
    sessionStorage.setItem('admin_token', response.credential);
    mensagem.style.color = '#218838';
    mensagem.textContent = 'Acesso autorizado. Abrindo o painel...';
    window.location.replace('dashboard-secretaria.html');
  } catch (erro) {
    sessionStorage.removeItem('admin_token');
    mensagem.style.color = '#c82333';
    mensagem.textContent = erro.name === 'AbortError'
      ? 'O servidor demorou para responder. Tente novamente em alguns instantes.'
      : erro.message;
  }
};
