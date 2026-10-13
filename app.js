// Núcleo do app de presença: estado vindo da nuvem, navegação entre telas, marcar/desmarcar e avisos.
(function () {
  const R = window.Regras;
  const estado = { diasFechados: [0, 1], excecoes: [], funcionarios: [], marcas: [], mesCarregado: null, dia: null, mes: null, ultimoHoje: null };
  const telas = {};
  let telaAtual = null;
  const salvando = new Set(); // chaves 'id|dia' com gravação em andamento
  let recarregarDepois = false;
  let ultimoMarcado = null;
  const pendentes = new Map(); // 'id|dia' → {id, dia, marcado}: gravações ainda sem resposta
  let geracao = 0;             // leitura de marcas mais recente
  let versaoLocal = 0;         // sobe a cada gravação confirmada

  const hoje = () => window.__HOJE || R.hojeLocal();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const novoId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  function toast(msg, tipo) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast visivel' + (tipo ? ' ' + tipo : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = 'toast'; }, 4000);
  }

  // Caixa de escolha com botões. opcoes: [[valor, rótulo, classe?], ...]; Esc ou valor '' devolve null.
  function escolher(msg, opcoes) {
    const d = document.getElementById('dialogo');
    d.innerHTML = `<p>${esc(msg)}</p><div class="dialogo-botoes">${opcoes.map(([v, r, c]) => `<button type="button" class="btn ${c || ''}" value="${esc(v)}">${esc(r)}</button>`).join('')}</div>`;
    return new Promise(ok => {
      d.onclick = e => { const b = e.target.closest('button'); if (b) { d.close(); ok(b.value || null); } };
      d.oncancel = () => ok(null);
      d.showModal();
    });
  }

  function erro(err) {
    console.error(err);
    if (err && err.sessao) return; // o login já foi mostrado
    toast('Algo deu errado: ' + ((err && err.message) || err), 'erro');
  }

  function ctx() {
    const excecoes = Object.fromEntries(estado.excecoes.map(e => [e.dia, e.tipo]));
    return R.montarCtx({ diasFechados: estado.diasFechados, excecoes, marcas: estado.marcas });
  }

  async function garantirMes(ano, mes) {
    const k = `${ano}-${String(mes).padStart(2, '0')}`;
    if (estado.mesCarregado === k) return;
    const dias = R.diasDoMes(ano, mes);
    for (;;) {
      const ger = ++geracao, versao = versaoLocal;
      const marcas = await Nuvem.marcasEntre(dias[0], dias[dias.length - 1]);
      if (ger !== geracao) return;          // uma leitura mais nova já está cuidando disso
      if (versao !== versaoLocal) continue; // alguém gravou durante a leitura: lê de novo
      estado.marcas = marcas;
      pendentes.forEach(p => aplicarMarca(p.id, p.dia, p.marcado)); // o que ainda está salvando vale mais
      estado.mesCarregado = k;
      return;
    }
  }

  async function carregarTudo() {
    const base = await Nuvem.carregarBase();
    estado.diasFechados = base.diasFechados;
    estado.excecoes = base.excecoes;
    estado.funcionarios = base.funcionarios;
    estado.mesCarregado = null; // marcas são relidas pela tela
  }

  function registrarTela(nome, desenhar) { telas[nome] = desenhar; }
  async function ir(nome) {
    if (!telas[nome]) return;
    telaAtual = nome;
    document.body.classList.toggle('sem-login', nome === 'login');
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('ativo', b.dataset.nav === nome));
    await telas[nome](document.getElementById('tela'));
  }
  const redesenhar = () => (telaAtual ? ir(telaAtual) : Promise.resolve());

  function mostrarFalha(err) {
    telaAtual = null;
    document.getElementById('tela').innerHTML = `<div class="vazio-grande"><p>${esc(err.message || err)}</p>
      <button class="btn primario" data-acao="tentar-de-novo">Tentar de novo</button></div>`;
  }

  async function recarregar() {
    if (!telaAtual || telaAtual === 'login') return;
    if (salvando.size) { recarregarDepois = true; return; }
    // App aberto de um dia para o outro: quem estava no "hoje" antigo passa para o novo.
    const h = hoje();
    if (estado.ultimoHoje && estado.ultimoHoje !== h) {
      if (estado.dia === estado.ultimoHoje) { estado.dia = h; estado.mes = R.mesDoDia(h); }
      estado.ultimoHoje = h;
    }
    try { await carregarTudo(); await redesenhar(); }
    catch (err) { erro(err); }
  }


  const temMarca = (id, dia) => estado.marcas.some(m => m.funcionario_id === id && m.dia === dia);
  function aplicarMarca(id, dia, marcado) {
    estado.marcas = estado.marcas.filter(m => !(m.funcionario_id === id && m.dia === dia));
    if (marcado) estado.marcas.push({ funcionario_id: id, dia });
  }

  // Marca/desmarca na hora; se a nuvem recusar, desfaz e avisa. Toque repetido enquanto salva é ignorado.
  async function alternar(id, dia) {
    const k = R.chave(id, dia);
    if (salvando.has(k)) return;
    salvando.add(k);
    const tinha = temMarca(id, dia);
    aplicarMarca(id, dia, !tinha);
    pendentes.set(k, { id, dia, marcado: !tinha });
    ultimoMarcado = tinha ? null : k;
    try {
      await redesenhar();
      await (tinha ? Nuvem.desmarcar(id, dia) : Nuvem.marcar(id, dia));
      versaoLocal++;
    } catch (err) {
      pendentes.delete(k);
      aplicarMarca(id, dia, tinha);
      ultimoMarcado = null;
      if (!err.sessao) {
        await redesenhar();
        toast(err.message || 'Não foi salvo.', 'erro');
      }
    } finally {
      pendentes.delete(k);
      salvando.delete(k);
      if (!salvando.size && recarregarDepois) { recarregarDepois = false; recarregar(); }
    }
  }
  function acabouDeMarcar(k) {
    if (ultimoMarcado !== k) return false;
    ultimoMarcado = null;
    return true;
  }

  async function aposLogin() {
    try { await carregarTudo(); }
    catch (err) { if (!err.sessao) mostrarFalha(err); return; }
    estado.dia = hoje();
    estado.ultimoHoje = estado.dia;
    estado.mes = R.mesDoDia(estado.dia);
    Nuvem.escutar();
    await ir('hoje');
  }

  async function iniciar() {
    atualizarFaixaOffline();
    if (!Nuvem.ativa) { mostrarFalha(new Error('Não foi possível carregar o app. Recarregue a página.')); return; }
    Nuvem.aoMudar(() => recarregar());
    Nuvem.aoSairDaConta(() => { if (telaAtual !== 'login') ir('login').catch(erro); });
    if (!(await Nuvem.sessao())) { await ir('login'); return; }
    await aposLogin();
  }

  async function sair() {
    const r = await escolher('Sair desta conta neste computador?', [['sim', 'Sair', 'primario'], ['', 'Cancelar']]);
    if (r !== 'sim') return;
    await Nuvem.sair();
    await ir('login');
  }

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { ir(nav.dataset.nav).catch(erro); return; }
    if (e.target.closest('[data-sair]')) { sair().catch(erro); return; }
    if (e.target.closest('[data-acao=tentar-de-novo]')) { aposLogin().catch(erro); return; }
    if (e.target.closest('#formulario [data-acao=cancelar]')) document.getElementById('formulario').close();
  });
  function atualizarFaixaOffline() {
    document.getElementById('faixa-offline').hidden = navigator.onLine;
  }
  // Voltar para a aba ou a internet voltar: relê tudo (cobre aviso do realtime perdido).
  // PC que fica sempre com a aba aberta: confere a virada do dia de tempos em tempos e ao ganhar foco.
  const conferirDia = () => { if (estado.ultimoHoje && hoje() !== estado.ultimoHoje) recarregar(); };
  setInterval(conferirDia, window.__INTERVALO_DIA || 60000);
  window.addEventListener('focus', conferirDia);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recarregar(); });
  window.addEventListener('online', () => { atualizarFaixaOffline(); recarregar(); });
  window.addEventListener('offline', atualizarFaixaOffline);
  document.addEventListener('submit', e => e.preventDefault());
  window.addEventListener('unhandledrejection', e => erro(e.reason));
  document.addEventListener('DOMContentLoaded', () => iniciar().catch(erro));

  window.App = {
    estado, hoje, esc, novoId, toast, escolher, erro, ctx, garantirMes, registrarTela, ir, redesenhar, recarregar,
    alternar, acabouDeMarcar, aposLogin, telaAtual: () => telaAtual,
  };
})();
