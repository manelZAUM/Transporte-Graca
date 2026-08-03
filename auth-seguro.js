'use strict';

async function validarCredencialNoServidor(API_URL, credential) {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const resposta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ acao: 'validar_admin', token: credential }),
        signal: controller.signal
      });

      const texto = await resposta.text();
      try {
        return JSON.parse(texto);
      } catch (_) {
        throw new Error('O servidor devolveu uma resposta incompleta.');
      }
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa === 2) throw erro;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      clearTimeout(timer);
    }
  }

  throw ultimoErro;
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
      ? 'O servidor permaneceu indisponivel apos duas tentativas. Tente novamente em alguns instantes.'
      : erro.message;
  }
};
