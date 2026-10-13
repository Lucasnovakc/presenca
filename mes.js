// Tela "Mês": grade funcionários × dias com presença, falta e total de faltas; clicar numa célula corrige.
(function () {
  const R = window.Regras;
  const SIMBOLO = { presente: '✓', falta: '✕', sem_registro: '?', fechado: '', pendente: '', futuro: '', fora: '' };
  const TITULO = { presente: 'Presente', falta: 'Falta', sem_registro: 'Dia sem registro (ninguém marcado) — não conta falta', fechado: 'Restaurante fechado', pendente: 'Ainda não marcado', futuro: 'Ainda não chegou', fora: 'Fora do período do funcionário' };

  function celula(f, d, hoje, ctx) {
    const s = R.statusCelula(f, d, hoje, ctx);
    const clicavel = R.podeMarcar(f, d, hoje, ctx);
    const acao = clicavel ? ` data-acao="alternar" data-id="${App.esc(f.id)}" data-dia="${d}"` : '';
    return `<td class="cel ${s}${clicavel ? ' clicavel' : ''}" data-d="${d}"${acao} title="${App.esc(R.formatarDiaLongo(d) + ' — ' + TITULO[s])}">${SIMBOLO[s]}</td>`;
  }

  async function desenhar(tela) {
    const e = App.estado, { ano, mes } = e.mes, hoje = App.hoje();
    await App.garantirMes(ano, mes);
    const ctx = App.ctx(), dias = R.diasDoMes(ano, mes), funcs = R.funcionariosDoMes(e.funcionarios, ano, mes);
    const atual = R.mesDoDia(hoje);
    const ultimo = ano > atual.ano || (ano === atual.ano && mes >= atual.mes);
    let total = 0;
    const linhas = funcs.map(f => {
      const faltas = R.faltasNoMes(f, ano, mes, hoje, ctx);
      total += faltas;
      return `<tr data-id="${App.esc(f.id)}">
        <th class="col-nome" scope="row"><span class="avatar mini" style="--cor:${App.esc(f.cor)}">${App.esc(R.iniciais(f.nome))}</span>${App.esc(f.nome)}</th>
        ${dias.map(d => celula(f, d, hoje, ctx)).join('')}
        <td class="col-faltas${faltas ? ' tem' : ''}">${faltas}</td>
      </tr>`;
    }).join('');
    const cabecalho = dias.map(d => `<th class="${R.diaAberto(d, ctx) ? '' : 'fechado'}${d === hoje ? ' hoje' : ''}"><span>${R.SEMANA_CURTA[R.diaDaSemana(d)]}</span>${Number(d.slice(8))}</th>`).join('');
    tela.innerHTML = `<section class="tela-mes">
      <div class="mes-cabeca">
        <button type="button" class="seta" data-acao="mes-anterior" aria-label="Mês anterior">‹</button>
        <h1>${App.esc(R.nomeDoMes(ano, mes))}</h1>
        <button type="button" class="seta" data-acao="mes-seguinte" aria-label="Próximo mês" ${ultimo ? 'disabled' : ''}>›</button>
      </div>
      ${funcs.length ? `
        <div class="legenda">
          <span><i class="cel presente"></i>Presente</span><span><i class="cel falta"></i>Falta</span>
          <span><i class="cel sem_registro"></i>Dia sem registro</span><span><i class="cel fechado"></i>Fechado</span>
        </div>
        <div class="grade-rolagem"><table class="grade">
          <thead><tr><th class="col-nome">Funcionário</th>${cabecalho}<th class="col-faltas">Faltas</th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr><th class="col-nome" colspan="${dias.length + 1}">Total de faltas no mês</th><td class="col-faltas" id="total-faltas">${total}</td></tr></tfoot>
        </table></div>`
      : '<div class="vazio-grande"><p>Ninguém da equipe trabalhava neste mês.</p></div>'}
    </section>`;
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('.tela-mes [data-acao]');
    if (!b || b.disabled || ev.detail > 1) return; // 2º clique de um duplo-clique não desfaz
    const e = App.estado;
    switch (b.dataset.acao) {
      case 'mes-anterior': e.mes = R.somarMeses(e.mes.ano, e.mes.mes, -1); App.redesenhar().catch(App.erro); break;
      case 'mes-seguinte': e.mes = R.somarMeses(e.mes.ano, e.mes.mes, 1); App.redesenhar().catch(App.erro); break;
      case 'alternar': App.alternar(b.dataset.id, b.dataset.dia).catch(App.erro); break;
    }
  });

  App.registrarTela('mes', desenhar);
})();
