// Tela "Hoje": cartões dos funcionários do dia; um toque marca ou desmarca a presença.
(function () {
  const R = window.Regras;

  function cartao(f, dia, ctx, aberto) {
    const k = R.chave(f.id, dia);
    const presente = ctx.marcas.has(k);
    const classes = ['cartao', presente ? 'presente' : '', App.acabouDeMarcar(k) ? 'pulou' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-acao="alternar" data-id="${App.esc(f.id)}" aria-pressed="${presente}" style="--cor:${App.esc(f.cor)}" ${aberto ? '' : 'disabled'}>
      <span class="avatar">${App.esc(R.iniciais(f.nome))}</span>
      <span class="cartao-texto"><span class="cartao-nome">${App.esc(f.nome)}</span>${f.funcao ? `<span class="cartao-funcao">${App.esc(f.funcao)}</span>` : ''}</span>
      <span class="check" aria-hidden="true">✓</span>
    </button>`;
  }

  async function desenhar(tela) {
    const e = App.estado, hoje = App.hoje(), dia = e.dia;
    const { ano, mes } = R.mesDoDia(dia);
    await App.garantirMes(ano, mes);
    const ctx = App.ctx();
    const aberto = R.diaAberto(dia, ctx);
    const funcs = R.ativosNoDia(e.funcionarios, dia);
    const presentes = funcs.filter(f => ctx.marcas.has(R.chave(f.id, dia))).length;
    const excecao = e.excecoes.find(x => x.dia === dia);
    tela.innerHTML = `<section class="tela-hoje">
      <div class="dia-cabeca">
        <button type="button" class="seta" data-acao="dia-anterior" aria-label="Dia anterior">‹</button>
        <div class="dia-titulo">
          <h1>${App.esc(R.formatarDiaLongo(dia))}</h1>
          <p>${dia === hoje ? 'Hoje' : '<button type="button" class="link" data-acao="dia-hoje">Voltar para hoje</button>'}</p>
        </div>
        <button type="button" class="seta" data-acao="dia-seguinte" aria-label="Próximo dia" ${dia >= hoje ? 'disabled' : ''}>›</button>
      </div>
      ${aberto ? '' : `<div class="faixa-fechado"><b>Restaurante fechado${excecao && excecao.motivo ? ' · ' + App.esc(excecao.motivo) : ''}</b>
        <button type="button" class="btn" data-acao="abrir-dia">Abrir este dia mesmo assim</button></div>`}
      ${funcs.length ? `
        ${aberto ? `<p class="contador"><b id="contador">${presentes} de ${funcs.length}</b> presentes</p>` : ''}
        <div class="cartoes">${funcs.map(f => cartao(f, dia, ctx, aberto)).join('')}</div>`
      : `<div class="vazio-grande"><p>Nenhum funcionário ativo neste dia.</p><button type="button" class="btn primario" data-nav="equipe">Cadastrar equipe</button></div>`}
    </section>`;
  }

  async function abrirDia(dia) {
    await Nuvem.salvarExcecao({ dia, tipo: 'aberto', motivo: null });
    await App.recarregar();
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('.tela-hoje [data-acao]');
    if (!b || b.disabled || ev.detail > 1) return; // 2º clique de um duplo-clique não desfaz
    const e = App.estado, hoje = App.hoje();
    const mudarDia = novo => { e.dia = novo > hoje ? hoje : novo; App.redesenhar().catch(App.erro); };
    switch (b.dataset.acao) {
      case 'dia-anterior': mudarDia(R.somarDias(e.dia, -1)); break;
      case 'dia-seguinte': mudarDia(R.somarDias(e.dia, 1)); break;
      case 'dia-hoje': mudarDia(hoje); break;
      case 'alternar': App.alternar(b.dataset.id, e.dia).catch(App.erro); break;
      case 'abrir-dia': abrirDia(e.dia).catch(App.erro); break;
    }
  });

  App.registrarTela('hoje', desenhar);
})();
