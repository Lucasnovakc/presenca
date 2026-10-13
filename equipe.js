// Tela "Equipe": cadastrar, editar, desligar, reativar e excluir funcionários.
(function () {
  const R = window.Regras;
  const val = id => document.getElementById(id).value;

  function item(f) {
    const detalhes = [f.funcao, 'desde ' + R.formatarData(f.inicio), f.fim ? 'saiu em ' + R.formatarData(f.fim) : ''].filter(Boolean);
    return `<li class="pessoa" data-id="${App.esc(f.id)}">
      <span class="avatar" style="--cor:${App.esc(f.cor)}">${App.esc(R.iniciais(f.nome))}</span>
      <div class="pessoa-texto"><b class="pessoa-nome">${App.esc(f.nome)}</b><small>${detalhes.map(App.esc).join(' · ')}</small></div>
      <div class="pessoa-acoes">
        <button type="button" class="btn mini" data-acao="editar">Editar</button>
        ${f.fim ? '<button type="button" class="btn mini" data-acao="reativar">Reativar</button>' : '<button type="button" class="btn mini" data-acao="desligar">Desligar</button>'}
        <button type="button" class="btn mini perigo" data-acao="excluir">Excluir</button>
      </div>
    </li>`;
  }

  async function desenhar(tela) {
    const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    const todos = [...App.estado.funcionarios].sort(porNome);
    const ativos = todos.filter(f => !f.fim), desligados = todos.filter(f => f.fim);
    tela.innerHTML = `<section class="tela-equipe">
      <div class="secao-cabeca"><h1>Equipe</h1><button type="button" class="btn primario" data-acao="novo">+ Adicionar funcionário</button></div>
      ${ativos.length ? `<ul class="pessoas">${ativos.map(item).join('')}</ul>` : '<div class="vazio-grande"><p>Nenhum funcionário ativo. Comece adicionando a equipe.</p></div>'}
      ${desligados.length ? `<details class="desligados"><summary>Desligados (${desligados.length})</summary><ul class="pessoas">${desligados.map(item).join('')}</ul></details>` : ''}
    </section>`;
  }

  function abrirFormulario(f) {
    const atual = f || { id: '', nome: '', funcao: '', cor: R.sugerirCor(App.estado.funcionarios), inicio: App.hoje(), fim: null };
    const d = document.getElementById('formulario');
    d.innerHTML = `<form id="form-funcionario" class="form">
      <h2>${f ? 'Editar funcionário' : 'Novo funcionário'}</h2>
      <label class="campo"><span>Nome</span><input id="f-nome" maxlength="60" value="${App.esc(atual.nome)}"></label>
      <label class="campo"><span>Função <small>(opcional)</small></span><input id="f-funcao" maxlength="40" value="${App.esc(atual.funcao || '')}"></label>
      <label class="campo"><span>Começou em</span><input id="f-inicio" type="date" value="${App.esc(atual.inicio)}"></label>
      ${atual.fim ? `<label class="campo"><span>Saiu em</span><input id="f-fim" type="date" value="${App.esc(atual.fim)}"></label>` : ''}
      <fieldset class="cores"><legend>Cor</legend>${R.CORES.map(c => `<label class="cor" style="--cor:${c}" title="Cor"><input type="radio" name="f-cor" value="${c}" ${c === atual.cor ? 'checked' : ''}><span></span></label>`).join('')}</fieldset>
      <p class="form-erro" id="f-erro" role="alert"></p>
      <div class="dialogo-botoes"><button type="button" class="btn" data-acao="cancelar">Cancelar</button><button type="submit" class="btn primario" id="f-salvar">Salvar</button></div>
    </form>`;
    d.dataset.id = atual.id;
    d.showModal();
    document.getElementById('f-nome').focus();
  }

  async function gravar(f, erroEl, botao, msgOk) {
    const problema = R.validarFuncionario(f);
    if (problema) { erroEl.textContent = problema; return; }
    botao.disabled = true;
    botao.textContent = 'Salvando…';
    try {
      await Nuvem.salvarFuncionario(f);
      document.getElementById('formulario').close();
      await App.recarregar();
      App.toast(msgOk);
    } catch (err) {
      if (err.sessao) { document.getElementById('formulario').close(); return; }
      erroEl.textContent = err.message;
      botao.disabled = false;
      botao.textContent = 'Salvar';
    }
  }

  function salvarFormulario() {
    const d = document.getElementById('formulario');
    const antigo = App.estado.funcionarios.find(x => x.id === d.dataset.id);
    const campoFim = document.getElementById('f-fim');
    const cor = document.querySelector('[name=f-cor]:checked');
    const f = {
      id: d.dataset.id || App.novoId(),
      nome: val('f-nome').trim().replace(/\s+/g, ' '),
      funcao: val('f-funcao').trim() || null,
      inicio: val('f-inicio'),
      fim: campoFim ? (campoFim.value || null) : (antigo ? antigo.fim : null),
      cor: cor ? cor.value : '',
    };
    return gravar(f, document.getElementById('f-erro'), document.getElementById('f-salvar'), antigo ? 'Alterações salvas.' : `${f.nome} cadastrado(a).`);
  }

  function abrirDesligar(f) {
    const d = document.getElementById('formulario');
    d.innerHTML = `<form id="form-desligar" class="form">
      <h2>Desligar ${App.esc(f.nome)}</h2>
      <p>O histórico fica guardado. Depois da data de saída não conta mais falta.</p>
      <label class="campo"><span>Último dia de trabalho</span><input id="d-fim" type="date" value="${App.esc(App.hoje())}"></label>
      <p class="form-erro" id="d-erro" role="alert"></p>
      <div class="dialogo-botoes"><button type="button" class="btn" data-acao="cancelar">Cancelar</button><button type="submit" class="btn primario" id="d-salvar">Desligar</button></div>
    </form>`;
    d.dataset.id = f.id;
    d.showModal();
  }

  function salvarDesligar() {
    const f = App.estado.funcionarios.find(x => x.id === document.getElementById('formulario').dataset.id);
    return gravar({ ...f, fim: val('d-fim') || null }, document.getElementById('d-erro'), document.getElementById('d-salvar'), `${f.nome} desligado(a).`);
  }

  async function reativar(f) {
    await Nuvem.salvarFuncionario({ ...f, fim: null });
    await App.recarregar();
    App.toast(`${f.nome} reativado(a).`);
  }

  async function excluir(f) {
    if (await Nuvem.temMarcas(f.id)) {
      App.toast(`${f.nome} já tem presenças marcadas. Use "Desligar" para manter o histórico.`, 'erro');
      return;
    }
    const r = await App.escolher(`Excluir ${f.nome}? Isso não pode ser desfeito.`, [['sim', 'Excluir', 'primario'], ['', 'Cancelar']]);
    if (r !== 'sim') return;
    await Nuvem.excluirFuncionario(f.id);
    await App.recarregar();
    App.toast(`${f.nome} excluído(a).`);
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('.tela-equipe [data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'novo') { abrirFormulario(null); return; }
    const li = b.closest('.pessoa');
    const f = li && App.estado.funcionarios.find(x => x.id === li.dataset.id);
    if (!f) return;
    const acoes = { editar: () => abrirFormulario(f), desligar: () => abrirDesligar(f), reativar: () => reativar(f), excluir: () => excluir(f) };
    Promise.resolve(acoes[b.dataset.acao] && acoes[b.dataset.acao]()).catch(App.erro);
  });
  document.addEventListener('submit', ev => {
    if (ev.target.id === 'form-funcionario') salvarFormulario().catch(App.erro);
    if (ev.target.id === 'form-desligar') salvarDesligar().catch(App.erro);
  });

  App.registrarTela('equipe', desenhar);
})();
