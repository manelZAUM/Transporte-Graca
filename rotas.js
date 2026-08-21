'use strict';

const ROTA = document.body.dataset.rota;
const CORES_ROTAS = { AMARELO: '#e0a800', AZUL: '#1565c0', MICRO: '#0f8b78' };
const COR_ROTA = CORES_ROTAS[ROTA] || '#1565c0';
const DIAS = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta'];
const NOMES_DIAS = { Segunda: 'Seg', Terca: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex' };
let passageirosRota = [];
let diaSelecionado = DIAS[Math.min(Math.max(new Date().getDay() - 1, 0), 4)];
let turnoSelecionado = ROTA === 'MICRO' && diaSelecionado !== 'Segunda' ? 'NOITE' : 'MANHA';
let mapa;

const PONTOS_ORIGEM = [
  { nome: 'Lapa', coords: [-4.0851580772, -40.8238902393] },
  { nome: 'Sede de Graca', coords: [-4.0443798472, -40.7521781914] },
  { nome: 'Vila', coords: [-4.0463572604, -40.7565734780] },
  { nome: 'Barro Vermelho', coords: [-4.0063119488, -40.7493451338] }
];

const DESTINOS = {
  AZUL: [
    { nome: 'UFC - Mucambinho', coords: [-3.6930838878, -40.3549683921] },
    { nome: 'IFCE Sobral', coords: [-3.6829839627, -40.3413684626] },
    { nome: 'UVA - Betania', coords: [-3.6769517815, -40.3399221761] },
    { nome: 'UVA - CCH', coords: [-3.6721931767, -40.3705323697] },
    { nome: 'UVA - CIDAO', coords: [-3.6834589487, -40.3422487685] }
  ],
  AMARELO: [
    { nome: 'UNINTA', coords: [-3.6942643851, -40.3443842203] },
    { nome: 'Faculdade Luciano Feijao', coords: [-3.7005444510, -40.3484365319] }
  ],
  MICRO: {
    MANHA: [
      { nome: 'UFC - Mucambinho', coords: [-3.6930838878, -40.3549683921] }
    ],
    NOITE: [
      { nome: 'Faculdade Luciano Feijao', coords: [-3.7005444510, -40.3484365319] }
    ]
  }
};

const $ = (id) => document.getElementById(id);
const positivo = (valor) => ['SIM', 'S', 'TRUE', '1'].includes(PortalAPI.normalizar(valor));
const rotaNoTurno = (aluno, turno) => { const campo = turno === 'MANHA' ? 'onibus_manha' : 'onibus_noite'; return Object.prototype.hasOwnProperty.call(aluno, campo) ? PortalAPI.normalizar(aluno[campo]) : PortalAPI.normalizar(aluno.onibus); };

function periodoDisponivel(turno, dia) {
  return ROTA !== 'MICRO' || turno === 'NOITE' || dia === 'Segunda';
}

function destinosDaSelecao() {
  const configuracao = DESTINOS[ROTA] || [];
  return Array.isArray(configuracao) ? configuracao : (configuracao[turnoSelecionado] || []);
}

function mostrarMensagem(texto, tipo = 'info') {
  const box = $('msgBox');
  box.textContent = texto;
  box.className = `message show ${tipo}`;
}

function nomeDoVeiculo(onibus) {
  const rota = PortalAPI.normalizar(onibus);
  if (rota === 'MICRO') return 'Micro-onibus';
  if (rota === 'AMARELO') return 'Onibus amarelo';
  if (rota === 'AZUL') return 'Onibus azul';
  return onibus || 'Veiculo nao informado';
}

function renderizarAvisoTransportes(agenda) {
  const anterior = $('aviso-transportes');
  if (anterior) anterior.remove();
  if (!agenda || !agenda.multiplos || !Array.isArray(agenda.itens)) return;

  const aviso = document.createElement('section'); aviso.id = 'aviso-transportes'; aviso.className = 'transport-notice';
  const titulo = document.createElement('h2'); titulo.textContent = 'Atencao: voce utiliza mais de um veiculo';
  const explicacao = document.createElement('p'); explicacao.textContent = 'Confira em qual transporte voce esta cadastrado em cada dia e turno:';
  const lista = document.createElement('ul');
  agenda.itens.forEach((item) => {
    const li = document.createElement('li');
    const periodo = item.turno === 'MANHA' ? 'pela manha' : 'a noite';
    const retorno = item.sentido === 'RETORNO' ? ' — apenas retorno' : '';
    li.textContent = `${item.dia}-feira ${periodo}: ${nomeDoVeiculo(item.onibus)}${retorno}`;
    lista.appendChild(li);
  });
  aviso.append(titulo, explicacao, lista);
  document.querySelector('.dashboard-header').after(aviso);
}

function criarIcone(destino) {
  return L.divIcon({
    className: 'leaflet-div-icon',
    html: `<div class="route-marker${destino ? ' destination' : ''}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

function carregarMapa() {
  if (mapa) return;
  mapa = L.map('mapa-rota', { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 18
  }).addTo(mapa);

  const destinos = destinosDaSelecao();
  const todos = [...PONTOS_ORIGEM, ...destinos];
  PONTOS_ORIGEM.forEach((ponto) => {
    L.marker(ponto.coords, { icon: criarIcone(false) }).addTo(mapa).bindPopup(`<strong>Embarque</strong><br>${ponto.nome}`);
  });
  destinos.forEach((ponto) => {
    L.marker(ponto.coords, { icon: criarIcone(true) }).addTo(mapa).bindPopup(`<strong>Destino</strong><br>${ponto.nome}`);
  });
  L.polyline(todos.map((ponto) => ponto.coords), {
    color: COR_ROTA,
    weight: 5,
    opacity: .78,
    dashArray: '10 8'
  }).addTo(mapa);
  mapa.fitBounds(L.latLngBounds(todos.map((ponto) => ponto.coords)), { padding: [28, 28] });
}

function recarregarMapa() {
  if (mapa) {
    mapa.remove();
    mapa = null;
  }
  carregarMapa();
  setTimeout(() => mapa && mapa.invalidateSize(), 50);
}

function alunoNoFiltro(aluno, turno, dia) {
  if (ROTA === 'MICRO' && turno === 'MANHA' && dia === 'Segunda' && positivo(aluno.micro_segunda_manha)) return true;
  return periodoDisponivel(turno, dia) && rotaNoTurno(aluno, turno) === ROTA && PortalAPI.diasDoAluno(aluno, turno).includes(dia);
}

function calcularMatriz() {
  const matriz = {};
  ['MANHA', 'NOITE'].forEach((turno) => {
    matriz[turno] = {};
    DIAS.forEach((dia) => {
      matriz[turno][dia] = passageirosRota.filter((aluno) => alunoNoFiltro(aluno, turno, dia)).length;
    });
  });
  return matriz;
}

function maiorPico(matriz) {
  let pico = { quantidade: 0, turno: 'Manha', dia: 'Segunda' };
  ['MANHA', 'NOITE'].forEach((turno) => DIAS.forEach((dia) => {
    if (!periodoDisponivel(turno, dia)) return;
    const quantidade = matriz[turno][dia];
    if (quantidade > pico.quantidade) pico = { quantidade, turno: turno === 'MANHA' ? 'Manha' : 'Noite', dia };
  }));
  return pico;
}

function renderizarMatriz(matriz) {
  const tabela = document.createElement('table');
  const thead = document.createElement('thead');
  const linhaCabecalho = document.createElement('tr');
  ['Turno', ...DIAS.map((dia) => NOMES_DIAS[dia])].forEach((texto) => {
    const th = document.createElement('th'); th.textContent = texto; linhaCabecalho.appendChild(th);
  });
  thead.appendChild(linhaCabecalho);
  const tbody = document.createElement('tbody');
  ['MANHA', 'NOITE'].forEach((turno) => {
    const tr = document.createElement('tr');
    const nome = document.createElement('td'); nome.textContent = turno === 'MANHA' ? 'Manha' : 'Noite'; nome.style.fontWeight = '800'; tr.appendChild(nome);
    DIAS.forEach((dia) => {
      const td = document.createElement('td');
      if (periodoDisponivel(turno, dia)) {
        td.textContent = matriz[turno][dia];
      } else {
        td.textContent = '—';
        td.className = 'unavailable';
        td.setAttribute('aria-label', 'Sem rota neste periodo');
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tabela.append(thead, tbody);
  $('matriz-demanda').replaceChildren(tabela);
}

function renderizarBarras(alunos) {
  const contagem = new Map();
  alunos.forEach((aluno) => {
    const nome = String(aluno.embarque || 'Nao informado').trim() || 'Nao informado';
    contagem.set(nome, (contagem.get(nome) || 0) + 1);
  });
  const itens = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const maximo = Math.max(...itens.map((item) => item[1]), 1);
  const fragmento = document.createDocumentFragment();
  itens.forEach(([nome, quantidade]) => {
    const linha = document.createElement('div'); linha.className = 'demand-row';
    const rotulo = document.createElement('div'); rotulo.className = 'demand-label';
    const nomeEl = document.createElement('span'); nomeEl.textContent = nome;
    const qtdEl = document.createElement('strong'); qtdEl.textContent = quantidade;
    rotulo.append(nomeEl, qtdEl);
    const barra = document.createElement('div'); barra.className = 'bar';
    const preenchimento = document.createElement('span'); preenchimento.style.width = `${(quantidade / maximo) * 100}%`;
    barra.appendChild(preenchimento); linha.append(rotulo, barra); fragmento.appendChild(linha);
  });
  $('demanda-embarque').replaceChildren(fragmento);
}

function renderizarTabela(alunos) {
  const tbody = $('lista-passageiros');
  tbody.replaceChildren();
  if (!alunos.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 4; td.className = 'empty'; td.textContent = 'Nenhum passageiro para o dia e turno selecionados.';
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  
  // Lista ordenada alfabeticamente
  [...alunos].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')).forEach((aluno, index) => {
    const tr = document.createElement('tr');
    
    const numero = document.createElement('td'); 
    numero.className = 'number'; 
    numero.textContent = index + 1;
    
    const nome = document.createElement('td'); 
    // CORREÇÃO: Mostra o nome real vindo da planilha ao invés de passageiro anônimo
    nome.textContent = aluno.nome || `Passageiro ${index + 1}`; 
    nome.style.fontWeight = '750';
    
    const instituicao = document.createElement('td'); 
    instituicao.textContent = aluno.instituicao || 'Nao informada';
    
    const embarque = document.createElement('td'); 
    const badge = document.createElement('span'); 
    badge.className = 'badge'; 
    badge.textContent = aluno.embarque || 'Nao informado'; 
    embarque.appendChild(badge);
    
    tr.append(numero, nome, instituicao, embarque); 
    tbody.appendChild(tr);
  });
}

function atualizarPainel() {
  const filtrados = passageirosRota.filter((aluno) => alunoNoFiltro(aluno, turnoSelecionado, diaSelecionado));
  const matriz = calcularMatriz();
  const pico = maiorPico(matriz);
  const instituicoes = new Set(passageirosRota.map((aluno) => PortalAPI.normalizar(aluno.instituicao)).filter(Boolean));
  $('kpi-total').textContent = passageirosRota.length;
  $('kpi-selecao').textContent = filtrados.length;
  $('kpi-instituicoes').textContent = instituicoes.size;
  $('kpi-retorno').textContent = passageirosRota.filter((aluno) => positivo(aluno.apenas_retorno)).length;
  const destino = ROTA === 'MICRO' ? (turnoSelecionado === 'MANHA' ? 'UFC' : 'FLF') : '';
  $('texto-selecao').textContent = `${turnoSelecionado === 'MANHA' ? 'Manha' : 'Noite'} · ${diaSelecionado}${destino ? ` · ${destino}` : ''}`;
  $('texto-pico').textContent = pico.quantidade ? `${pico.dia}, ${pico.turno.toLowerCase()} (${pico.quantidade})` : 'Sem demanda registrada';
  renderizarMatriz(matriz);
  renderizarBarras(filtrados);
  renderizarTabela(filtrados);
}

function sincronizarFiltros() {
  const botaoManha = document.querySelector('[data-turno="MANHA"]');
  if (ROTA === 'MICRO' && botaoManha) {
    const disponivel = diaSelecionado === 'Segunda';
    botaoManha.disabled = !disponivel;
    botaoManha.title = disponivel ? 'Rota da UFC na segunda pela manha' : 'O micro-onibus nao opera pela manha neste dia';
    if (!disponivel && turnoSelecionado === 'MANHA') turnoSelecionado = 'NOITE';
  }

  document.querySelectorAll('[data-turno]').forEach((item) => item.classList.toggle('active', item.dataset.turno === turnoSelecionado));
  document.querySelectorAll('[data-dia]').forEach((item) => item.classList.toggle('active', item.dataset.dia === diaSelecionado));
}

function selecionarSegmento(botao) {
  const turnoAnterior = turnoSelecionado;
  if (botao.dataset.turno) turnoSelecionado = botao.dataset.turno;
  if (botao.dataset.dia) diaSelecionado = botao.dataset.dia;
  sincronizarFiltros();
  if (ROTA === 'MICRO' && turnoAnterior !== turnoSelecionado) recarregarMapa();
  atualizarPainel();
}

async function verificarAcesso() {
  const cpf = PortalAPI.somenteDigitos($('cpfInput').value);
  const botao = $('btnEntrar');
  if (cpf.length !== 11) { mostrarMensagem('Informe o CPF completo.', 'error'); return; }
  botao.disabled = true; botao.textContent = 'Consultando a nova base...'; mostrarMensagem('Validando seu cadastro e calculando a demanda...', 'info');
  try {
    const resposta = await PortalAPI.requisicao({ acao: 'painel_rota', rota: ROTA, cpf });
    passageirosRota = Array.isArray(resposta.passageiros) ? resposta.passageiros : [];
    const dadosPassageiro = resposta.dados || resposta.aluno || {};
    $('nomeAlunoLogado').textContent = String(dadosPassageiro.nome || resposta.nome || 'Passageiro cadastrado').trim();
    $('login-section').classList.add('hidden'); $('main-section').classList.remove('hidden');
    renderizarAvisoTransportes(resposta.agenda_transportes);
    sincronizarFiltros();
    carregarMapa(); atualizarPainel();
    setTimeout(() => mapa && mapa.invalidateSize(), 100);
  } catch (erro) {
    mostrarMensagem(erro.name === 'AbortError' ? 'O servidor demorou para responder. Tente novamente.' : erro.message, 'error');
  } finally {
    botao.disabled = false; botao.textContent = 'Acessar rota e demanda';
  }
}

document.querySelectorAll('.segment').forEach((botao) => botao.addEventListener('click', () => selecionarSegmento(botao)));
$('cpfInput').addEventListener('input', (evento) => { evento.target.value = PortalAPI.formatarCpf(evento.target.value); });
$('cpfInput').addEventListener('keydown', (evento) => { if (evento.key === 'Enter') verificarAcesso(); });
$('btnEntrar').addEventListener('click', verificarAcesso);
$('btnSair').addEventListener('click', () => location.reload());
