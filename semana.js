// Impressão da lista de presença da semana (segunda a domingo) do dia aberto no Hoje.
(function () {
  const R = window.Regras;
  const SIMBOLO = { presente: '✓', falta: '✕', sem_registro: '?', fechado: 'Fechado', pendente: '', futuro: '', fora: '—' };

  async function imprimir(dia) {
    const e = App.estado, hoje = App.hoje(), dias = R.semanaDoDia(dia);
    // A semana pode cruzar dois meses: lê as marcas dela direto, sem mexer no mês carregado na tela.
    const marcas = await Nuvem.marcasEntre(dias[0], dias[6]);
    const excecoes = Object.fromEntries(e.excecoes.map(x => [x.dia, x.tipo]));
    const ctx = R.montarCtx({ diasFechados: e.diasFechados, excecoes, marcas });
    const funcs = e.funcionarios.filter(f => dias.some(d => R.ativoNoDia(f, d))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    const curto = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

    const cabecalho = dias.map(d => `<th class="${R.diaAberto(d, ctx) ? '' : 'fechado'}">${App.esc(R.SEMANA[R.diaDaSemana(d)])}<span>${curto(d)}</span></th>`).join('');
    const linhas = funcs.map(f => {
      // No papel, dia fechado aparece como fechado mesmo se ainda não chegou.
      const status = dias.map(d => { const s = R.statusCelula(f, d, hoje, ctx); return s === 'futuro' && !R.diaAberto(d, ctx) ? 'fechado' : s; });
      const faltas = status.filter(s => s === 'falta').length;
      return `<tr><th class="imp-nome">${App.esc(f.nome)}${f.funcao ? `<small>${App.esc(f.funcao)}</small>` : ''}</th>
        ${status.map(s => `<td class="${s}">${SIMBOLO[s]}</td>`).join('')}
        <td class="imp-faltas">${faltas}</td></tr>`;
    }).join('');

    document.getElementById('impressao').innerHTML = `
      <h1>Lista de presença — Barão</h1>
      <p class="imp-sub">Semana de ${R.formatarData(dias[0])} a ${R.formatarData(dias[6])} · impresso em ${R.formatarData(hoje)}</p>
      ${funcs.length ? `<table class="imp-grade">
        <thead><tr><th class="imp-nome">Funcionário</th>${cabecalho}<th>Faltas</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p class="imp-legenda">✓ presente · ✕ falta · ? dia sem registro (não conta falta) · — fora do período do funcionário · em branco: dia ainda não marcado</p>
      <div class="imp-assinatura"><span>Responsável</span><span>Data</span></div>`
      : '<p>Ninguém da equipe trabalhava nesta semana.</p>'}`;
    window.print();
  }

  window.Semana = { imprimir };
})();
