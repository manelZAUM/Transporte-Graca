'use strict';

const DIAS_CONSULTA = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta'];
const DIAS_CURTOS = { Segunda: 'Seg', Terca: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex' };
const PONTOS_DEMANDA = [
  { nome: 'Lapa', aliases: ['LAPA'], coords: [-4.0851580772, -40.8238902393] },
  { nome: 'Sede de Graça', aliases: ['SEDE', 'CENTRO', 'MATRIZ'], coords: [-4.0443798472, -40.7521781914] },
  { nome: 'Vila', aliases: ['VILA'], coords: [-4.0463572604, -40.7565734780] },
  { nome: 'Barro Vermelho', aliases: ['BARRO'], coords: [-4.0063119488, -40.7493451338] }
];
const SOBRAL = { nome: 'Instituições em Sobral', coords: [-3.6906, -40.3482] };
let cadastros = [];
let mapaDemanda;
let observadorMapa;

const $ = (id) => document.getElementById(id);
const statusNormalizado = (aluno) => PortalAPI.normalizar(aluno.status || 'Pendente');
const demandaAtiva = (aluno) => statusNormalizado(aluno) === 'APROVADO';

function mostrarMensagem(texto, tipo = 'info') {
  const box = $('msgBox');
  box.textContent = texto;
  box.className = `message show ${tipo}`;
}

function contarPor(lista, campo, fallback) {
  const contagem = new Map();
  lista.forEach((item) => {
    const valor = String(item[campo] || fallback).trim() || fallback;
    contagem.set(valor, (contagem.get(valor) || 0) + 1);
  });
  return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

function renderizarBarras(id, itens) {
  const container = $(id);
  container.replaceChildren();
  if (!itens.length) {
    const vazio = document.createElement('p'); vazio.className = 'empty'; vazio.textContent = 'Nenhum dado disponível.';
    container.appendChild(vazio); return;
  }
  const maior = Math.max(...itens.map((item) => item[1]), 1);
  itens.forEach(([rotulo, quantidade]) => {
    const linha = document.createElement('div'); linha.className = 'chart-row';
    const nome = document.createElement('span'); nome.title = rotulo; nome.textContent = rotulo;
    const barra = document.createElement('div'); barra.className = 'bar';
    const preenchimento = document.createElement('span'); preenchimento.style.width = `${(quantidade / maior) * 100}%`; barra.appendChild(preenchimento);
    const valor = document.createElement('strong'); valor.textContent = quantidade;
    linha.append(nome, barra, valor); container.appendChild(linha);
  });
}

function matrizDaRota(rota) {
  const passageiros = cadastros.filter((aluno) => demandaAtiva(aluno) && PortalAPI.normalizar(aluno.onibus) === rota);
  const matriz = { MANHA: {}, NOITE: {} };
  ['MANHA', 'NOITE'].forEach((turno) => DIAS_CONSULTA.forEach((dia) => {
    matriz[turno][dia] = passageiros.filter((aluno) => PortalAPI.diasDoAluno(aluno, turno).includes(dia)).length;
  }));
  return { passageiros, matriz };
}

function renderizarFrota() {
  const container = $('cards-frota'); container.replaceChildren();
  ['AZUL', 'AMARELO'].forEach((rota) => {
    const dados = matrizDaRota(rota);
    const card = document.createElement('article'); card.className = 'fleet-card';
    card.style.setProperty('--bus-color', rota === 'AZUL' ? '#1565c0' : '#e0a800');
    const titulo = document.createElement('h3'); titulo.textContent = `Ônibus ${rota.toLowerCase()}`;
    const resumo = document.createElement('p'); resumo.textContent = `${dados.passageiros.length} cadastros na demanda potencial`;
    const tabela = document.createElement('table'); tabela.className = 'mini-matrix';
    const thead = document.createElement('thead'); const trh = document.createElement('tr');
    ['Turno', ...DIAS_CONSULTA.map((dia) => DIAS_CURTOS[dia])].forEach((texto) => { const th = document.createElement('th'); th.textContent = texto; trh.appendChild(th); });
    thead.appendChild(trh); const tbody = document.createElement('tbody');
    ['MANHA', 'NOITE'].forEach((turno) => {
      const tr = document.createElement('tr'); const nome = document.createElement('td'); nome.textContent = turno === 'MANHA' ? 'Manhã' : 'Noite'; tr.appendChild(nome);
      DIAS_CONSULTA.forEach((dia) => { const td = document.createElement('td'); td.textContent = dados.matriz[turno][dia]; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tabela.append(thead, tbody); card.append(titulo, resumo, tabela); container.appendChild(card);
  });
}

function pontoDoAluno(aluno) {
  const embarque = PortalAPI.normalizar(aluno.embarque);
  return PONTOS_DEMANDA.find((ponto) => ponto.aliases.some((alias) => embarque.includes(alias)));
}

function carregarMapa() {
  if (mapaDemanda) mapaDemanda.remove();
  if (observadorMapa) observadorMapa.disconnect();
  mapaDemanda = L.map('mapa-demanda', { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 18 }).addTo(mapaDemanda);
  const passageiros = cadastros.filter(demandaAtiva);
  const pontosComDemanda = PONTOS_DEMANDA.map((ponto) => ({
    ...ponto,
    quantidade: passageiros.filter((aluno) => pontoDoAluno(aluno) === ponto).length
  }));
  pontosComDemanda.forEach((ponto) => {
    const raio = Math.max(9, Math.min(25, 8 + ponto.quantidade * .7));
    L.circleMarker(ponto.coords, { radius: raio, color: '#fff', weight: 3, fillColor: '#0a7b69', fillOpacity: .9 })
      .addTo(mapaDemanda).bindPopup(`<strong>${ponto.nome}</strong><br>${ponto.quantidade} cadastro(s) na demanda`);
    L.polyline([ponto.coords, SOBRAL.coords], { color: '#0a7b69', weight: 2, opacity: .38, dashArray: '7 8' }).addTo(mapaDemanda);
  });
  L.circleMarker(SOBRAL.coords, { radius: 12, color: '#fff', weight: 3, fillColor: '#6d4c9f', fillOpacity: .95 })
    .addTo(mapaDemanda).bindPopup(`<strong>${SOBRAL.nome}</strong><br>Destino universitário`);
  const limites = [...PONTOS_DEMANDA.map((ponto) => ponto.coords), SOBRAL.coords];
  mapaDemanda.fitBounds(L.latLngBounds(limites), { padding: [26, 26] });
  const container = $('mapa-demanda');
  observadorMapa = new ResizeObserver(() => mapaDemanda && mapaDemanda.invalidateSize({ pan: false }));
  observadorMapa.observe(container);
  requestAnimationFrame(() => mapaDemanda.invalidateSize({ pan: false }));
}

function popularSelect(id, valores) {
  const select = $(id); const atual = select.value;
  while (select.options.length > 1) select.remove(1);
  valores.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach((valor) => {
    const option = document.createElement('option'); option.value = valor; option.textContent = valor; select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === atual)) select.value = atual;
}

function classeStatus(status) {
  const valor = PortalAPI.normalizar(status);
  if (valor.includes('APROV')) return 'aprovado';
  if (valor.includes('PRIOR')) return 'prioridade';
  if (valor.includes('REPROV')) return 'reprovado';
  if (valor.includes('ANAL')) return 'analise';
  return 'pendente';
}

function renderizarTabela() {
  const busca = PortalAPI.normalizar($('filtroBusca').value);
  const instituicao = $('filtroInstituicao').value;
  const onibus = $('filtroOnibus').value;
  const embarque = $('filtroEmbarque').value;
  const turno = $('filtroTurno').value;
  const status = $('filtroStatus').value;
  const filtrados = cadastros.filter((aluno) => {
    const correspondeBusca = !busca || PortalAPI.normalizar(aluno.instituicao).includes(busca);
    return correspondeBusca && (!instituicao || aluno.instituicao === instituicao) &&
      (!onibus || PortalAPI.normalizar(aluno.onibus) === onibus) && (!embarque || aluno.embarque === embarque) &&
      (!turno || PortalAPI.normalizar(aluno.turno).includes(turno)) && (!status || aluno.status === status);
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  $('resultado-contagem').textContent = `${filtrados.length} resultado${filtrados.length === 1 ? '' : 's'}`;
  const tbody = $('lista-geral'); tbody.replaceChildren();
  if (!filtrados.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 6; td.className = 'empty'; td.textContent = 'Nenhum cadastro corresponde aos filtros.'; tr.appendChild(td); tbody.appendChild(tr); return;
  }
  filtrados.forEach((aluno, indiceRegistro) => {
    const tr = document.createElement('tr');
  [aluno.nome || 'Nome não informado', aluno.instituicao || 'Não informada', aluno.embarque || 'Não informado'].forEach((texto, indice) => {
      const td = document.createElement('td'); td.textContent = texto; if (indice === 0) td.style.fontWeight = '750'; tr.appendChild(td);
    });
    const rotaTd = document.createElement('td'); const rota = document.createElement('span'); rota.className = 'route-chip';
    const nomeRota = PortalAPI.normalizar(aluno.onibus) || 'NÃO INFORMADO'; rota.style.setProperty('--chip', nomeRota === 'AMARELO' ? '#e0a800' : '#1565c0'); rota.textContent = nomeRota; rotaTd.appendChild(rota);
    const turnoTd = document.createElement('td'); turnoTd.textContent = aluno.turno || 'Não informado';
    const statusTd = document.createElement('td'); const badge = document.createElement('span'); badge.className = `status ${classeStatus(aluno.status)}`; badge.textContent = aluno.status || 'Pendente'; statusTd.appendChild(badge);
    tr.append(rotaTd, turnoTd, statusTd); tbody.appendChild(tr);
  });
}

function renderizarDashboard(resumo = {}) {
  const demanda = cadastros.filter(demandaAtiva);
  $('kpi-total').textContent = Number(resumo.total ?? cadastros.length);
  $('kpi-aprovados').textContent = Number(resumo.aprovados ?? cadastros.filter((aluno) => statusNormalizado(aluno) === 'APROVADO').length);
  $('kpi-analise').textContent = Number(resumo.em_analise ?? cadastros.filter((aluno) => statusNormalizado(aluno) === 'EM ANALISE').length);
  if ($('kpi-pendentes')) {
    $('kpi-pendentes').textContent = Number(resumo.pendentes ?? cadastros.filter((aluno) => statusNormalizado(aluno) === 'PENDENTE').length);
  }
  $('kpi-prioridade').textContent = Number(resumo.prioridade ?? cadastros.filter((aluno) => statusNormalizado(aluno) === 'PRIORIDADE').length);
  $('kpi-novatos').textContent = Number(resumo.novatos ?? 0);
  $('kpi-sobral').textContent = Number(resumo.sobral ?? 0);
  renderizarFrota();
  renderizarBarras('grafico-embarque', contarPor(demanda, 'embarque', 'Não informado'));
  renderizarBarras('grafico-instituicoes', contarPor(demanda, 'instituicao', 'Não informada'));
  popularSelect('filtroInstituicao', [...new Set(cadastros.map((aluno) => aluno.instituicao))]);
  popularSelect('filtroEmbarque', [...new Set(cadastros.map((aluno) => aluno.embarque))]);
  popularSelect('filtroStatus', [...new Set(cadastros.map((aluno) => aluno.status || 'Pendente'))]);
  renderizarTabela(); carregarMapa();
}

async function verificarAcesso(cpf) {
  mostrarMensagem('Validando seu cadastro e reunindo a demanda...', 'info');
  try {
    const resposta = await PortalAPI.requisicao({ acao: 'consulta_demanda', cpf });
    cadastros = Array.isArray(resposta.dadosGerais) ? resposta.dadosGerais : [];
    $('nomeAlunoLogado').textContent = resposta.acesso && resposta.acesso.nome ? resposta.acesso.nome : 'Aluno cadastrado';
    $('login-section').classList.add('hidden'); $('main-section').classList.remove('hidden'); renderizarDashboard(resposta.resumo);
  } catch (erro) {
    mostrarMensagem(erro.name === 'AbortError' ? 'O servidor demorou para responder. Tente novamente.' : erro.message, 'error');
  }
}

$('cpf-acesso').addEventListener('input', (evento) => {
  evento.target.value = PortalAPI.formatarCpf(evento.target.value);
});
$('form-acesso-demanda').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cpf = PortalAPI.somenteDigitos($('cpf-acesso').value);
  if (cpf.length !== 11) { mostrarMensagem('Informe um CPF com 11 dígitos.', 'error'); return; }
  const botao = $('btn-acessar'); const textoOriginal = botao.textContent;
  botao.disabled = true; botao.textContent = 'Consultando...';
  try { await verificarAcesso(cpf); } finally { botao.disabled = false; botao.textContent = textoOriginal; }
});
$('btnSair').addEventListener('click', () => location.reload());
['filtroBusca', 'filtroInstituicao', 'filtroOnibus', 'filtroEmbarque', 'filtroTurno', 'filtroStatus'].forEach((id) => $(id).addEventListener(id === 'filtroBusca' ? 'input' : 'change', renderizarTabela));