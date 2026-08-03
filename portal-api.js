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

  function formatarCpf(valor) {
    return somenteDigitos(valor).slice(0, 11)
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

  async function requisicao(payload, opcoes = {}) {
    if (!API_URL || API_URL.includes('COLE_AQUI')) throw new Error('A URL da API nao foi configurada.');
    const tentativas = opcoes.tentativas || 2;
    const tempoLimite = opcoes.tempoLimite || 60000;
    let ultimoErro;

    for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), tempoLimite);
      try {
        const resposta = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        const texto = await resposta.text();
        let dados;
        try {
          dados = JSON.parse(texto);
        } catch (_) {
          throw new Error('O servidor devolveu uma resposta incompleta.');
        }
        if (!dados.sucesso) {
          const erro = new Error(dados.erro || 'Nao foi possivel concluir a consulta.');
          erro.codigo = dados.codigo;
          erro.naoRepetir = true;
          throw erro;
        }
        return dados;
      } catch (erro) {
        ultimoErro = erro;
        if (erro.naoRepetir || tentativa === tentativas) throw erro;
        await new Promise((resolve) => setTimeout(resolve, 900));
      } finally {
        clearTimeout(timer);
      }
    }
    throw ultimoErro;
  }

  window.PortalAPI = Object.freeze({
    requisicao,
    normalizar,
    somenteDigitos,
    formatarCpf,
    listaDias,
    diasDoAluno
  });
})();
