'use strict';

(function criarPortalAPI() {
  const API_URL = window.APP_CONFIG && window.APP_CONFIG.API_URL;

  function normalizar(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function normalizarCpf(valor) {
    const d = somenteDigitos(valor);
    if (d.length === 9 || d.length === 10) return d.padStart(11, '0');
    return d;
  }

  function validarCpf(valor) {
    const d = normalizarCpf(valor);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(d.charAt(i), 10) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(d.charAt(9), 10)) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(d.charAt(i), 10) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(d.charAt(10), 10)) return false;

    return true;
  }

  function formatarCpf(valor) {
    const d = normalizarCpf(valor);
    if (d.length !== 11) return '';
    return d.slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  function listaDias(valor) {
    const texto = normalizar(valor);
    const mapa = [
      ['Segunda', ['SEGUNDA', 'SEG']],
      ['Terca', ['TERCA', 'TER']],
      ['Quarta', ['QUARTA', 'QUA']],
      ['Quinta', ['QUINTA', 'QUI']],
      ['Sexta', ['SEXTA', 'SEX']]
    ];
    if (!texto || texto.includes('TODOS') || texto.includes('DIARIA') || texto.includes('SEG A SEX')) {
      return mapa.map((item) => item[0]);
    }
    return mapa.filter((item) => item[1].some((chave) => texto.includes(chave))).map((item) => item[0]);
  }

  function diasDoAluno(aluno, turno) {
    const campo = turno === 'MANHA' ? aluno.dias_manha : aluno.dias_noite;
    if (String(campo || '').trim()) return listaDias(campo);

    const turnoAluno = normalizar(aluno.turno);
    const aceitaTurno = turnoAluno.includes('INTEGRAL') ||
      (turno === 'MANHA' && (turnoAluno.includes('MANHA') || turnoAluno.includes('MATUT'))) ||
      (turno === 'NOITE' && (turnoAluno.includes('NOITE') || turnoAluno.includes('NOTUR')));
    return aceitaTurno ? listaDias(aluno.dias) : [];
  }

  function novoRequestId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function erroTimeout() {
    const erro = new Error('O servidor demorou para responder. Tente novamente.');
    erro.name = 'AbortError';
    return erro;
  }

  let ponteFrame;
  let ponteNonce = '';
  let ponteOrigem = '';
  let ponteJanela;
  let promessaPonte;
  let resolverPonte;
  let rejeitarPonte;
  const pendentes = new Map();

  function origemGoogleConfiavel(origem) {
    try {
      const url = new URL(origem);
      return url.protocol === 'https:' && (
        url.hostname === 'script.google.com' ||
        url.hostname === 'script.googleusercontent.com' ||
        url.hostname.endsWith('.googleusercontent.com')
      );
    } catch (_) {
      return false;
    }
  }

  function limparPonte() {
    if (ponteFrame) ponteFrame.remove();
    ponteFrame = undefined;
    ponteNonce = '';
    ponteOrigem = '';
    ponteJanela = undefined;
    promessaPonte = undefined;
    resolverPonte = undefined;
    rejeitarPonte = undefined;
  }

  window.addEventListener('message', (evento) => {
    const dados = evento.data || {};
    if (!origemGoogleConfiavel(evento.origin) || dados.nonce !== ponteNonce) return;

    if (dados.tipo === 'TRANSPORTE_PONTE_PRONTA' && promessaPonte) {
      ponteOrigem = evento.origin;
      ponteJanela = evento.source;
      if (resolverPonte) resolverPonte();
      return;
    }

    if (dados.tipo !== 'TRANSPORTE_RESPOSTA' || evento.source !== ponteJanela || evento.origin !== ponteOrigem) return;
    const pendente = pendentes.get(String(dados.requestId || ''));
    if (!pendente) return;
    clearTimeout(pendente.timer);
    pendentes.delete(String(dados.requestId));
    pendente.resolve(dados.resposta);
  });

  function garantirPonte(tempoLimite) {
    if (ponteJanela && ponteOrigem) return Promise.resolve();
    if (promessaPonte) return promessaPonte;
    ponteNonce = novoRequestId();
    promessaPonte = new Promise((resolve, reject) => {
      resolverPonte = resolve;
      rejeitarPonte = reject;
      const timer = setTimeout(() => {
        limparPonte();
        reject(new Error('Nao foi possivel abrir a comunicacao segura com o servidor.'));
      }, tempoLimite);
      resolverPonte = () => { clearTimeout(timer); resolve(); };
      rejeitarPonte = (erro) => { clearTimeout(timer); limparPonte(); reject(erro); };
    });

    const url = new URL(API_URL);
    url.searchParams.set('bridge', '1');
    url.searchParams.set('nonce', ponteNonce);
    ponteFrame = document.createElement('iframe');
    ponteFrame.title = 'Comunicacao segura com o servidor';
    ponteFrame.setAttribute('aria-hidden', 'true');
    ponteFrame.referrerPolicy = 'origin';
    ponteFrame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:-10px;border:0;opacity:0;pointer-events:none';
    ponteFrame.src = url.toString();
    ponteFrame.addEventListener('error', () => {
      if (rejeitarPonte) rejeitarPonte(new Error('Nao foi possivel carregar a comunicacao segura.'));
    }, { once: true });
    document.body.appendChild(ponteFrame);
    return promessaPonte;
  }

  async function requisicao(payload, opcoes = {}) {
    if (!API_URL || API_URL.includes('COLE_AQUI')) throw new Error('A URL da API nao foi configurada.');
    const tempoLimite = Math.max(15000, opcoes.tempoLimite || 90000);
    const inicio = Date.now();
    await garantirPonte(Math.min(30000, tempoLimite));
    const restante = Math.max(1000, tempoLimite - (Date.now() - inicio));
    const requestId = novoRequestId();
    const dados = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendentes.delete(requestId);
        reject(erroTimeout());
      }, restante);
      pendentes.set(requestId, { resolve, reject, timer });
      ponteJanela.postMessage({
        tipo: 'TRANSPORTE_REQUISICAO',
        nonce: ponteNonce,
        requestId,
        payload
      }, ponteOrigem);
    });
    if (!dados.sucesso) {
      const erro = new Error(dados.erro || 'Nao foi possivel concluir a consulta.');
      erro.codigo = dados.codigo;
      throw erro;
    }
    return dados;
  }

  window.PortalAPI = Object.freeze({
    requisicao,
    normalizar,
    somenteDigitos,
    normalizarCpf,
    validarCpf,
    formatarCpf,
    listaDias,
    diasDoAluno
  });
})();