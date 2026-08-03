'use strict';

const API_URL = window.APP_CONFIG && window.APP_CONFIG.API_URL;
const tokenAdmin = sessionStorage.getItem('admin_token');
let listaAlunosGlobais = [];

function elemento(id) { return document.getElementById(id); }

async function apiAdmin(payload) {
  if (!API_URL || API_URL.includes('COLE_AQUI')) {
    throw new Error('Configure a URL da implantacao no arquivo config.js.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token: tokenAdmin }),
      signal: controller.signal
    });
    const texto = await resposta.text();
    let dados;
    try { dados = JSON.parse(texto); }
    catch (_) { throw new Error('Resposta invalida. Confira a URL e a nova implantacao.'); }

    if (!dados.sucesso) {
      const erro = new Error(dados.erro || 'Nao foi possivel concluir a operacao.');
      erro.codigo = dados.codigo;
      throw erro;
    }
    return dados;
  } finally {
    clearTimeout(timer);
  }
}

function mostrarCarregamento(texto, erro = false) {
  const aviso = elemento('mensagem-carregamento');
  aviso.textContent = texto;
  aviso.style.display = 'block';
  aviso.style.color = erro ? '#c82333' : '#0056b3';
  elemento('conteudo-painel').style.display = 'none';
}

function mostrarPainel() {
  elemento('mensagem-carregamento').style.display = 'none';
  elemento('conteudo-painel').style.display = 'block';
}

async function carregarDadosDaPlanilha() {
  mostrarCarregamento('Carregando a base de dados...');
  try {
    const dados = await apiAdmin({ acao: 'painel_admin' });
    listaAlunosGlobais = Array.isArray(dados.dadosGerais) ? dados.dadosGerais : [];
    renderizarTabela(listaAlunosGlobais);
    mostrarPainel();
  } catch (erro) {
    if (erro.codigo === 'TOKEN_GOOGLE_INVALIDO' || erro.codigo === 'ADMIN_NAO_AUTORIZADO') {
      fazerLogout();
      return;
    }
    mostrarCarregamento(erro.name === 'AbortError' ? 'O servidor demorou para responder.' : erro.message, true);
  }
}

function criarCelula(texto) {
  const td = document.createElement('td');
  td.textContent = texto || '-';
  return td;
}

function criarBotao(texto, classe, acao, titulo) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn-acao ' + classe;
  botao.textContent = texto;
  botao.title = titulo || texto;
  botao.addEventListener('click', acao);
  return botao;
}

function renderizarTabela(alunos) {
  const corpo = elemento('corpo-tabela');
  corpo.replaceChildren();

  alunos.forEach((aluno, index) => {
    const tr = document.createElement('tr');
    const nome = criarCelula(aluno.nome);
    nome.style.fontWeight = '600';
    tr.appendChild(nome);
    tr.appendChild(criarCelula(aluno.cpf));
    tr.appendChild(criarCelula(aluno.instituicao));
    tr.appendChild(criarCelula(aluno.turno));
    tr.appendChild(criarCelula(aluno.onibus));

    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    const status = aluno.status || 'Pendente';
    const statusNormalizado = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    badge.className = 'status-badge ' + (
      statusNormalizado.includes('aprovado') || statusNormalizado.includes('prioridade')
        ? 'status-aprovado'
        : statusNormalizado.includes('pendente') || statusNormalizado.includes('analise')
          ? 'status-pendente'
          : 'status-reprovado'
    );
    badge.textContent = status;
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    const tdAcoes = document.createElement('td');
    tdAcoes.style.whiteSpace = 'nowrap';
    tdAcoes.style.textAlign = 'center';
    tdAcoes.appendChild(criarBotao('Editar', 'btn-editar', () => abrirModal(index)));
    tdAcoes.appendChild(criarBotao('Gerar codigo', 'btn-editar', () => gerarCodigo(aluno)));
    if (String(aluno.status_atualizacao || '').toLowerCase() === 'sim') {
      tdAcoes.appendChild(criarBotao('Reabrir', 'btn-editar', () => reabrirAtualizacao(aluno)));
    }
    tdAcoes.appendChild(criarBotao('Excluir', 'btn-excluir', () => excluirAluno(aluno.cpf)));
    tr.appendChild(tdAcoes);
    corpo.appendChild(tr);
  });
}

function garantirOpcaoEmAnalise() {
  const select = elemento('aluno-status');
  const existe = Array.from(select.options).some((opcao) => opcao.value === 'Em Analise');
  if (!existe) {
    const opcao = document.createElement('option');
    opcao.value = 'Em Analise';
    opcao.textContent = 'Em Analise';
    select.insertBefore(opcao, select.options[1] || null);
  }
}

function selecionarNormalizado(id, valor, fallback = '') {
  const select = elemento(id);
  const alvo = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const opcao = Array.from(select.options).find((item) =>
    String(item.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === alvo
  );
  select.value = opcao ? opcao.value : fallback;
}

function abrirModal(index = -1) {
  const form = elemento('form-aluno');
  form.reset();
  elemento('aluno-id').value = '';

  if (index >= 0) {
    const aluno = listaAlunosGlobais[index];
    elemento('modal-titulo').textContent = 'Editar aluno';
    elemento('aluno-id').value = aluno.cpf || '';
    elemento('aluno-nome').value = aluno.nome || '';
    elemento('aluno-cpf').value = aluno.cpf || '';
    elemento('aluno-instituicao').value = aluno.instituicao || '';
    selecionarNormalizado('aluno-turno', aluno.turno, '');
    elemento('aluno-onibus').value = aluno.onibus || '';
    selecionarNormalizado('aluno-status', aluno.status, 'Pendente');
  } else {
    elemento('modal-titulo').textContent = 'Adicionar novo aluno';
  }
  elemento('modal-aluno').style.display = 'block';
}

function fecharModal() {
  elemento('modal-aluno').style.display = 'none';
}

async function salvarAluno(evento) {
  evento.preventDefault();
  const cpfAntigo = elemento('aluno-id').value;
  const botao = document.querySelector('.btn-salvar');
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Salvando...';

  try {
    await apiAdmin({
      acao: cpfAntigo ? 'editar_aluno' : 'adicionar_aluno',
      cpfAntigo,
      nome: elemento('aluno-nome').value,
      cpf: elemento('aluno-cpf').value,
      instituicao: elemento('aluno-instituicao').value,
      turno: elemento('aluno-turno').value,
      onibus: elemento('aluno-onibus').value,
      status: elemento('aluno-status').value
    });
    fecharModal();
    await carregarDadosDaPlanilha();
  } catch (erro) {
    alert(erro.name === 'AbortError' ? 'O servidor demorou para responder.' : erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function gerarCodigo(aluno) {
  try {
    const dados = await apiAdmin({ acao: 'gerar_codigo_atualizacao', cpf: aluno.cpf });
    const validade = new Date(dados.expira_em).toLocaleString('pt-BR');
    window.prompt(
      'Codigo temporario de ' + (aluno.nome || 'aluno') + '\nValido ate ' + validade + '\n\nCopie o codigo:',
      dados.codigo
    );
  } catch (erro) {
    alert(erro.name === 'AbortError' ? 'O servidor demorou para responder.' : erro.message);
  }
}

async function reabrirAtualizacao(aluno) {
  if (!confirm('Reabrir a atualizacao de ' + (aluno.nome || 'este aluno') + '? O status voltara para Pendente.')) return;
  try {
    await apiAdmin({ acao: 'reabrir_atualizacao', cpf: aluno.cpf });
    await carregarDadosDaPlanilha();
    alert('Atualizacao reaberta. Agora gere um novo codigo para o aluno.');
  } catch (erro) {
    alert(erro.name === 'AbortError' ? 'O servidor demorou para responder.' : erro.message);
  }
}

async function excluirAluno(cpf) {
  if (!confirm('Excluir definitivamente este aluno? Essa acao nao pode ser desfeita.')) return;
  mostrarCarregamento('Excluindo aluno...');
  try {
    await apiAdmin({ acao: 'excluir_aluno', cpf });
    await carregarDadosDaPlanilha();
  } catch (erro) {
    mostrarCarregamento(erro.name === 'AbortError' ? 'O servidor demorou para responder.' : erro.message, true);
  }
}

function fazerLogout() {
  sessionStorage.removeItem('admin_token');
  window.location.replace('admin.html');
}

// Mantem compatibilidade com os atributos onclick/onsubmit do HTML existente.
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;
window.salvarAluno = salvarAluno;
window.excluirAluno = excluirAluno;
window.fazerLogout = fazerLogout;

garantirOpcaoEmAnalise();
if (!tokenAdmin) fazerLogout();
else carregarDadosDaPlanilha();
