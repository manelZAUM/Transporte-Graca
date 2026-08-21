'use strict';

const tokenAdmin=sessionStorage.getItem('admin_token');
const API_URL=window.APP_CONFIG&&window.APP_CONFIG.API_URL;
const DIAS=['Segunda','Terca','Quarta','Quinta','Sexta'];
let listaAlunosGlobais=[];
const elemento=(id)=>document.getElementById(id);
const normalizar=(v)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

async function apiAdmin(payload,tempoLimite=90000){if(!API_URL||API_URL.includes('COLE_AQUI'))throw new Error('Configure a URL no arquivo config.js.');if(!window.PortalAPI)throw new Error('O modulo de comunicacao nao foi carregado.');try{return await PortalAPI.requisicao({...payload,token:tokenAdmin},{tempoLimite})}catch(erro){if(erro.codigo==='TOKEN_GOOGLE_INVALIDO'||erro.codigo==='ADMIN_NAO_AUTORIZADO')fazerLogout();throw erro}}
function mostrarCarregamento(mensagem,erro=false){elemento('conteudo-painel').style.display='none';const el=elemento('mensagem-carregamento');el.style.display='block';el.style.color=erro?'#c82333':'#0056b3';el.textContent=mensagem}
function classeStatus(status){const s=normalizar(status).replace(/\s+/g,'-');return 'status-badge status-'+s}

// CORREÇÃO: Garante que o zero perdido seja reposto antes de formatar
function cpfFormatado(v){
  const puro = PortalAPI.normalizarCpf(v);
  const formatado = PortalAPI.formatarCpf(puro);
  return formatado ? formatado : (v || '-');
}

function botao(texto,classe,acao){const b=document.createElement('button');b.type='button';b.className='btn-acao '+classe;b.textContent=texto;b.addEventListener('click',acao);return b}
function textoTd(valor){const td=document.createElement('td');td.textContent=valor||'-';return td}
function valorSim(valor){return valor===true||['sim','s','true','1'].includes(normalizar(valor))}
function rotasResumo(aluno){const partes=[];if(valorSim(aluno.micro_segunda_manha))partes.push('Micro: seg. manha');const manha=String(aluno.onibus_manha||'').trim(),noite=String(aluno.onibus_noite||'').trim();if(manha)partes.push('Manha: '+manha);if(noite)partes.push('Noite: '+noite);return partes.join(' / ')||aluno.onibus||'-'}

async function carregarDadosDaPlanilha(){mostrarCarregamento('Carregando a base de dados...');try{const dados=await apiAdmin({acao:'painel_admin'});listaAlunosGlobais=(dados.dadosGerais||[]).sort((a,b)=>{const prioridade=normalizar(a.status)==='em analise'?0:1;const prioridadeB=normalizar(b.status)==='em analise'?0:1;return prioridade-prioridadeB||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')});renderizarTabela()}catch(erro){mostrarCarregamento(erro.name==='AbortError'?'O servidor demorou para responder.':erro.message,true)}}

function renderizarTabela(){const corpo=elemento('corpo-tabela');corpo.replaceChildren();const busca=normalizar(elemento('busca').value);const status=normalizar(elemento('filtro-status').value);const filtrados=listaAlunosGlobais.filter(a=>(!busca||normalizar(a.nome).includes(busca)||PortalAPI.somenteDigitos(a.cpf).includes(busca.replace(/\D/g,''))||String(a.cpf).toLowerCase().includes(busca))&&(!status||normalizar(a.status)===status));filtrados.forEach(aluno=>{const tr=document.createElement('tr');if(normalizar(aluno.status)==='em analise')tr.className='em-analise';tr.append(textoTd(aluno.nome),textoTd(cpfFormatado(aluno.cpf)),textoTd(aluno.instituicao),textoTd(aluno.turno),textoTd(rotasResumo(aluno)));const tdStatus=document.createElement('td'),badge=document.createElement('span');badge.className=classeStatus(aluno.status);badge.textContent=aluno.status||'Pendente';tdStatus.appendChild(badge);tr.appendChild(tdStatus);tr.appendChild(textoTd(normalizar(aluno.status_atualizacao)==='sim'?'Enviada':'Liberada'));const acoes=document.createElement('td');acoes.appendChild(botao(normalizar(aluno.status)==='em analise'?'Revisar':'Editar','btn-editar',()=>abrirModalPorCpf(aluno.cpf)));if(normalizar(aluno.status_atualizacao)==='sim')acoes.appendChild(botao('Reabrir','btn-reabrir',()=>reabrirAtualizacao(aluno)));acoes.appendChild(botao('Excluir','btn-excluir',()=>excluirAluno(aluno.cpf)));tr.appendChild(acoes);corpo.appendChild(tr)});if(!filtrados.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Nenhum cadastro encontrado.';td.style.textAlign='center';tr.appendChild(td);corpo.appendChild(tr)}elemento('mensagem-carregamento').style.display='none';elemento('conteudo-painel').style.display='block'}

function criarCheckboxes(){['manha','noite'].forEach(turno=>{const box=elemento('dias-'+turno+'-admin');box.replaceChildren();DIAS.forEach(dia=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='admin-dias-'+turno;input.value=dia;input.addEventListener('change',()=>turno==='manha'?ajustarMicroSegunda('dias'):sincronizarVeiculosTurno());label.append(input,document.createTextNode(dia.slice(0,3)));box.appendChild(label)})})}
function marcarDias(nome,valor){const itens=normalizar(valor).split(/[,;|]/).map(i=>i.trim()).filter(Boolean);document.querySelectorAll('input[name="'+nome+'"]').forEach(cb=>{const d=normalizar(cb.value);cb.checked=itens.some(i=>i.includes(d.slice(0,3))||d.includes(i.slice(0,3)))})}
function diasMarcados(nome){return Array.from(document.querySelectorAll('input[name="'+nome+'"]:checked')).map(i=>i.value)}
function selecionar(id,valor,fallback=''){const el=elemento(id),alvo=normalizar(valor),opcao=Array.from(el.options).find(o=>normalizar(o.value)===alvo);el.value=opcao?opcao.value:fallback}
function sincronizarVeiculosTurno(){['manha','noite'].forEach(turno=>{const temDias=diasMarcados('admin-dias-'+turno).length>0,select=elemento('aluno-onibus-'+turno);select.disabled=!temDias;select.required=temDias;if(!temDias)select.value=''})}
function ajustarMicroSegunda(origem){const micro=elemento('aluno-micro-segunda-manha'),segunda=document.querySelector('input[name="admin-dias-manha"][value="Segunda"]');if(!segunda)return;if(origem==='micro'&&micro.checked)segunda.checked=false;if(origem==='dias'&&segunda.checked)micro.checked=false;sincronizarVeiculosTurno()}

function abrirModalPorCpf(cpf){
  const index = listaAlunosGlobais.findIndex(a => String(a.cpf).trim() === String(cpf).trim());
  abrirModal(index);
}

function abrirModal(index=-1){
  const form=elemento('form-aluno');
  form.reset();
  elemento('aluno-id').value='';
  criarCheckboxes();
  if(index>=0){
    const a=listaAlunosGlobais[index];
    elemento('modal-titulo').textContent=normalizar(a.status)==='em analise'?'Revisar atualizacao':'Editar aluno';
    elemento('aluno-id').value=PortalAPI.normalizarCpf(a.cpf||'');
    elemento('aluno-nome').value=a.nome||'';
    elemento('aluno-nascimento').value=a.nascimento||'';
    elemento('aluno-rg').value=a.rg||'';
    // CORREÇÃO: Repõe o zero à esquerda e formata ao abrir o modal
    elemento('aluno-cpf').value=PortalAPI.formatarCpf(PortalAPI.normalizarCpf(a.cpf));
    elemento('aluno-telefone').value=a.telefone||'';
    elemento('aluno-endereco').value=a.endereco||'';
    elemento('aluno-instituicao').value=a.instituicao||'';
    selecionar('aluno-embarque',a.embarque);
    selecionar('aluno-sobral',a.sobral);
    selecionar('aluno-novato',a.novato);
    selecionar('aluno-comorbidade',a.comorbidade);
    selecionar('aluno-retorno',a.apenas_retorno,'Nao');
    selecionar('aluno-status',a.status,'Pendente');
    marcarDias('admin-dias-manha',a.dias_manha);
    marcarDias('admin-dias-noite',a.dias_noite);
    const microLegado=normalizar(a.onibus_manha)==='micro'&&normalizar(a.dias_manha).includes('seg');
    elemento('aluno-micro-segunda-manha').checked=valorSim(a.micro_segunda_manha)||microLegado;
    if(microLegado){const segunda=document.querySelector('input[name="admin-dias-manha"][value="Segunda"]');if(segunda)segunda.checked=false}
    selecionar('aluno-onibus-manha',normalizar(a.onibus_manha)==='micro'?'':(a.onibus_manha||(a.dias_manha?a.onibus:'')));
    selecionar('aluno-onibus-noite',a.onibus_noite||(a.dias_noite?a.onibus:''));
  } else {
    elemento('modal-titulo').textContent='Adicionar novo aluno';
    selecionar('aluno-retorno','Nao','Nao');
    selecionar('aluno-status','Pendente','Pendente');
  }
  sincronizarVeiculosTurno();
  elemento('modal-aluno').style.display='block';
}
function fecharModal(){elemento('modal-aluno').style.display='none'}

async function salvarAluno(evento) {
  evento.preventDefault();
  
  const cpfAntigo = elemento('aluno-id').value;
  const cpfPuro = PortalAPI.normalizarCpf(elemento('aluno-cpf').value);
  
  const cpfOriginal = PortalAPI.normalizarCpf(cpfAntigo);
  if (cpfPuro.length !== 11 || (cpfPuro !== cpfOriginal && !PortalAPI.validarCpf(cpfPuro))) {
    alert('Informe um CPF válido com 11 dígitos.');
    return;
  }

  const cpfFormatadoComMascara = PortalAPI.formatarCpf(cpfPuro);

  const botao = document.querySelector('.btn-salvar');
  const original = botao.textContent;
  const manha = diasMarcados('admin-dias-manha');
  const noite = diasMarcados('admin-dias-noite');
  const microSegundaManha = elemento('aluno-micro-segunda-manha').checked;

  if (!manha.length && !noite.length && !microSegundaManha) {
    alert('Selecione pelo menos um dia de viagem.');
    return;
  }
  const onibusManha = elemento('aluno-onibus-manha').value;
  const onibusNoite = elemento('aluno-onibus-noite').value;
  if (manha.length && !onibusManha) {
    alert('Selecione o veiculo usado pela manha.');
    return;
  }
  if (noite.length && !onibusNoite) {
    alert('Selecione o veiculo usado pela noite.');
    return;
  }

  botao.disabled = true;
  botao.textContent = 'Salvando e registrando auditoria...';

  try {
    await apiAdmin({
      acao: cpfAntigo ? 'editar_aluno' : 'adicionar_aluno',
      cpfAntigo: cpfAntigo,
      cpf: cpfFormatadoComMascara,
      nome: elemento('aluno-nome').value,
      nascimento: elemento('aluno-nascimento').value,
      rg: elemento('aluno-rg').value,
      telefone: elemento('aluno-telefone').value,
      endereco: elemento('aluno-endereco').value,
      instituicao: elemento('aluno-instituicao').value,
      embarque: elemento('aluno-embarque').value,
      sobral: elemento('aluno-sobral').value,
      novato: elemento('aluno-novato').value,
      comorbidade: elemento('aluno-comorbidade').value,
      apenas_retorno: elemento('aluno-retorno').value,
      dias_manha: manha,
      dias_noite: noite,
      onibus_manha: onibusManha,
      onibus_noite: onibusNoite,
      micro_segunda_manha: microSegundaManha,
      onibus: onibusNoite || onibusManha || (microSegundaManha ? 'MICRO' : ''),
      status: elemento('aluno-status').value
    }, 90000);
    fecharModal();
    await carregarDadosDaPlanilha();
  } catch (erro) {
    alert(erro.name === 'AbortError' ? 'O salvamento ultrapassou 90 segundos. Recarregue o painel e confira se a alteracao foi aplicada.' : erro.message);
  } finally {
    botao.disabled = false;
    botao.textContent = original;
  }
}

async function reabrirAtualizacao(aluno){if(!confirm('Reabrir a atualizacao de '+(aluno.nome||'este aluno')+'? O aluno podera entrar novamente usando o CPF.'))return;try{await apiAdmin({acao:'reabrir_atualizacao',cpf:aluno.cpf});await carregarDadosDaPlanilha();alert('Atualizacao reaberta. O aluno ja pode consultar pelo CPF.')}catch(erro){alert(erro.message)}}
async function excluirAluno(cpf){if(!confirm('Excluir definitivamente este aluno? Essa acao nao pode ser desfeita.'))return;try{await apiAdmin({acao:'excluir_aluno',cpf:cpf});await carregarDadosDaPlanilha()}catch(erro){alert(erro.message)}}
function fazerLogout(){sessionStorage.removeItem('admin_token');location.replace('admin.html')}
window.abrirModal=abrirModal;window.fecharModal=fecharModal;window.salvarAluno=salvarAluno;window.excluirAluno=excluirAluno;window.fazerLogout=fazerLogout;
elemento('busca').addEventListener('input',renderizarTabela);elemento('filtro-status').addEventListener('change',renderizarTabela);elemento('aluno-micro-segunda-manha').addEventListener('change',()=>ajustarMicroSegunda('micro'));if(!tokenAdmin)fazerLogout();else carregarDadosDaPlanilha();
