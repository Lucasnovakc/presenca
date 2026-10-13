// Nuvem (Supabase): login e leitura/gravação das tabelas presenca_* direto no banco (sem cópia offline).
(function () {
  const PROJETO = { url: 'https://rvetsaajmegaxxiekiru.supabase.co', chave: 'sb_publishable_qba_ByIc1k4NYBQgYENbkA_AEVdeCHB' };
  const conf = window.__NUVEM_TESTE || PROJETO; // os testes apontam para um Supabase falso
  const ativa = !!window.supabase;
  const cliente = ativa ? window.supabase.createClient(conf.url, conf.chave, { auth: { storageKey: 'presenca:sessao' } }) : null;
  const TABELAS = ['presenca_funcionarios', 'presenca_marcas', 'presenca_config', 'presenca_excecoes'];
  const ouvintes = { mudou: [], saiu: [] };
  const SEM_INTERNET = 'Sem internet — não foi salvo.';
  let canal = null;
  let timer = null;

  const ehRede = err => navigator.onLine === false || /fetch|network/i.test(String((err && (err.message || err.details)) || err));

  // Vários pedidos podem voltar 401 juntos: avisa só uma vez por sessão, e todos esperam o aviso.
  let saida = null;
  function avisarSaida() {
    if (!saida) saida = (async () => {
      pararDeEscutar();
      try { await cliente.auth.signOut({ scope: 'local' }); } catch {}
      ouvintes.saiu.forEach(fn => fn());
    })();
    return saida;
  }

  // Espera a resposta do supabase-js e transforma erro em mensagem para o usuário.
  async function exigir(pedido) {
    let r;
    try { r = await pedido; } catch (err) { throw new Error(ehRede(err) ? SEM_INTERNET : String((err && err.message) || err)); }
    if (!r.error) return r.data;
    if (r.status === 401 || r.error.code === 'PGRST301' || r.error.code === 'PGRST303') {
      await avisarSaida();
      const e = new Error('Sua sessão expirou. Entre de novo.');
      e.sessao = true;
      throw e;
    }
    if (!r.status || ehRede(r.error)) throw new Error(SEM_INTERNET);
    const e = new Error(r.error.message);
    e.code = r.error.code;
    throw e;
  }

  // Sessão derrubada pelo servidor (senha trocada, refresh recusado): volta para o login.
  let saindoPorVontade = false;
  if (cliente) cliente.auth.onAuthStateChange(ev => {
    if (ev === 'SIGNED_OUT' && !saindoPorVontade) setTimeout(() => avisarSaida(), 0); // fora do callback, como pede o supabase-js
  });

  async function sessao() {
    if (!ativa) return null;
    const { data } = await cliente.auth.getSession();
    return data.session;
  }

  async function entrar(email, senha) {
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (!error) { saida = null; return { ok: true }; }
    if (error.status === 400) return { ok: false, erro: 'E-mail ou senha incorretos.' };
    if (ehRede(error) || !error.status) return { ok: false, erro: 'Sem internet ou servidor fora do ar. Tente de novo.' };
    return { ok: false, erro: 'Não foi possível entrar: ' + error.message };
  }

  async function sair() {
    pararDeEscutar();
    saindoPorVontade = true;
    try { await cliente.auth.signOut({ scope: 'local' }); }
    finally { saindoPorVontade = false; }
  }

  async function carregarBase() {
    const [config, excecoes, funcionarios] = await Promise.all([
      exigir(cliente.from('presenca_config').select('dias_fechados').eq('id', 1)),
      exigir(cliente.from('presenca_excecoes').select('dia,tipo,motivo')),
      exigir(cliente.from('presenca_funcionarios').select('id,nome,funcao,cor,inicio,fim')),
    ]);
    return { diasFechados: config[0] ? config[0].dias_fechados : [0, 1], excecoes, funcionarios };
  }

  const marcasEntre = (ini, fim) =>
    exigir(cliente.from('presenca_marcas').select('funcionario_id,dia').gte('dia', ini).lte('dia', fim));

  // Marca repetida (dois PCs ao mesmo tempo) é ignorada pelo banco, sem erro.
  async function marcar(id, dia) {
    await exigir(cliente.from('presenca_marcas').upsert({ funcionario_id: id, dia }, { onConflict: 'funcionario_id,dia', ignoreDuplicates: true }));
  }
  async function desmarcar(id, dia) {
    await exigir(cliente.from('presenca_marcas').delete().eq('funcionario_id', id).eq('dia', dia));
  }

  async function salvarFuncionario(f) {
    const { id, nome, funcao, cor, inicio, fim } = f;
    await exigir(cliente.from('presenca_funcionarios').upsert({ id, nome, funcao: funcao || null, cor, inicio, fim: fim || null }));
  }
  async function temMarcas(id) {
    const linhas = await exigir(cliente.from('presenca_marcas').select('dia').eq('funcionario_id', id).limit(1));
    return linhas.length > 0;
  }
  async function excluirFuncionario(id) {
    try { await exigir(cliente.from('presenca_funcionarios').delete().eq('id', id)); }
    catch (err) {
      if (err.code === '23503') throw new Error('Esse funcionário já tem presenças marcadas. Use "Desligar" para manter o histórico.');
      throw err;
    }
  }

  async function salvarDiasFechados(dias) {
    await exigir(cliente.from('presenca_config').upsert({ id: 1, dias_fechados: dias }));
  }
  async function salvarExcecao({ dia, tipo, motivo }) {
    await exigir(cliente.from('presenca_excecoes').upsert({ dia, tipo, motivo: motivo || null }, { onConflict: 'dia' }));
  }
  async function removerExcecao(dia) {
    await exigir(cliente.from('presenca_excecoes').delete().eq('dia', dia));
  }

  // Realtime: qualquer mudança feita em outro PC avisa o app (agrupado em 400 ms).
  function escutar() {
    if (!ativa || conf.realtime === false || canal) return;
    canal = cliente.channel('presenca');
    const avisar = () => { clearTimeout(timer); timer = setTimeout(() => ouvintes.mudou.forEach(fn => fn()), 400); };
    for (const t of TABELAS) canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, avisar);
    canal.subscribe();
  }
  function pararDeEscutar() {
    if (canal) { cliente.removeChannel(canal); canal = null; }
  }

  window.Nuvem = {
    ativa, sessao, entrar, sair, carregarBase, marcasEntre, marcar, desmarcar,
    salvarFuncionario, temMarcas, excluirFuncionario, salvarDiasFechados, salvarExcecao, removerExcecao,
    escutar, pararDeEscutar,
    _cliente: cliente, // só para os testes
    aoMudar: fn => ouvintes.mudou.push(fn),
    aoSairDaConta: fn => ouvintes.saiu.push(fn),
  };
})();
