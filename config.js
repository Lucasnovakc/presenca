// Tela "Configurações": dias da semana em que o restaurante fecha e exceções por data (feriado, dia extra).
(function () {
  const R = window.Regras;

  async function desenhar(tela) {
    const e = App.estado;
    const excecoes = [...e.excecoes].sort((a, b) => (a.dia < b.dia ? 1 : -1));
    tela.innerHTML = `<section class="tela-config">
      <div class="secao-cabeca"><h1>Configurações</h1></div>
      <div class="painel">
        <h2>Dias em que o restaurante fecha</h2>
        <p>Marque os dias fechados. Neles ninguém leva falta.</p>
        <div class="semana">${R.SEMANA.map((nome, i) => `<label class="dia-semana"><input type="checkbox" name="dia-fechado" value="${i}" ${e.diasFechados.includes(i) ? 'checked' : ''}><span>${nome}</span></label>`).join('')}</div>
      </div>
      <div class="painel">
        <h2>Exceções</h2>
        <p>Feriado em que fechou, ou dia normalmente fechado em que abriu.</p>
        ${excecoes.length ? `<ul class="excecoes">${excecoes.map(x => `<li class="excecao" data-dia="${App.esc(x.dia)}">
          <span class="etiqueta ${x.tipo}">${x.tipo === 'fechado' ? 'Fechado' : 'Aberto'}</span>
          <b>${App.esc(R.formatarData(x.dia))} · ${App.esc(R.formatarDiaLongo(x.dia).split(',')[0])}${x.motivo ? ' — ' + App.esc(x.motivo) : ''}</b>
          <button type="button" class="btn mini perigo" data-acao="remover-excecao">Remover</button>
        </li>`).join('')}</ul>` : '<p class="vazio">Nenhuma exceção.</p>'}
        <button type="button" class="btn primario" data-acao="nova-excecao">+ Adicionar exceção</button>
      </div>
    </section>`;
  }

  async function salvarDias() {
    const e = App.estado, antes = e.diasFechados;
    const dias = [...document.querySelectorAll('[name=dia-fechado]:checked')].map(c => Number(c.value));
    e.diasFechados = dias;
    try {
      await Nuvem.salvarDiasFechados(dias);
      App.toast('Dias de funcionamento salvos.');
    } catch (err) {
      e.diasFechados = antes;
      await App.redesenhar();
      throw err;
    }
  }

  function abrirExcecao() {
    const d = document.getElementById('formulario');
    d.innerHTML = `<form id="form-excecao" class="form">
      <h2>Nova exceção</h2>
      <label class="campo"><span>Data</span><input id="e-dia" type="date"></label>
      <div class="tipo-escolha">
        <label class="dia-semana"><input type="radio" name="e-tipo" value="fechado" checked><span>Fechou</span></label>
        <label class="dia-semana"><input type="radio" name="e-tipo" value="aberto"><span>Abriu</span></label>
      </div>
      <label class="campo"><span>Motivo <small>(opcional)</small></span><input id="e-motivo" maxlength="60" placeholder="Ex.: Natal"></label>
      <p class="vazio">Se já existe exceção nessa data, ela é substituída.</p>
      <p class="form-erro" id="e-erro" role="alert"></p>
      <div class="dialogo-botoes"><button type="button" class="btn" data-acao="cancelar">Cancelar</button><button type="submit" class="btn primario" id="e-salvar">Salvar</button></div>
    </form>`;
    d.showModal();
  }

  async function salvarExcecao() {
    const tipo = document.querySelector('[name=e-tipo]:checked');
    const x = { dia: document.getElementById('e-dia').value, tipo: tipo ? tipo.value : '', motivo: document.getElementById('e-motivo').value.trim() || null };
    const erroEl = document.getElementById('e-erro');
    const problema = R.validarExcecao(x);
    if (problema) { erroEl.textContent = problema; return; }
    try {
      await Nuvem.salvarExcecao(x);
      document.getElementById('formulario').close();
      await App.recarregar();
      App.toast('Exceção salva.');
    } catch (err) {
      if (err.sessao) { document.getElementById('formulario').close(); return; }
      erroEl.textContent = err.message;
    }
  }

  async function removerExcecao(dia) {
    await Nuvem.removerExcecao(dia);
    await App.recarregar();
    App.toast('Exceção removida.');
  }

  document.addEventListener('change', ev => {
    if (ev.target.matches('.tela-config [name=dia-fechado]')) salvarDias().catch(App.erro);
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('.tela-config [data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'nova-excecao') abrirExcecao();
    if (b.dataset.acao === 'remover-excecao') removerExcecao(b.closest('.excecao').dataset.dia).catch(App.erro);
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id === 'form-excecao') salvarExcecao().catch(App.erro);
  });

  App.registrarTela('config', desenhar);
})();
