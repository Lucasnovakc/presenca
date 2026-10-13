// Tela de login (e-mail e senha do restaurante). Em cada computador só precisa entrar uma vez.
(function () {
  function abrir(tela) {
    tela.innerHTML = `<div class="tela-login">
      <form id="form-login" class="login" autocomplete="on">
        <h2>Entrar</h2>
        <p>Use o e-mail e a senha do restaurante. As presenças ficam na nuvem e aparecem em qualquer computador.</p>
        <label class="campo"><span>E-mail</span><input id="login-email" type="email" autocomplete="username"></label>
        <label class="campo"><span>Senha</span><input id="login-senha" type="password" autocomplete="current-password"></label>
        <p id="login-erro" class="login-erro" role="alert"></p>
        <button type="submit" id="login-entrar" class="btn primario">Entrar</button>
      </form>
    </div>`;
    document.getElementById('login-email').focus();
  }

  async function entrar() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const erro = document.getElementById('login-erro');
    const botao = document.getElementById('login-entrar');
    if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    erro.textContent = '';
    const r = await Nuvem.entrar(email, senha);
    if (!r.ok) {
      erro.textContent = r.erro;
      botao.disabled = false;
      botao.textContent = 'Entrar';
      return;
    }
    await App.aposLogin();
  }

  document.addEventListener('submit', e => {
    if (e.target.id === 'form-login') entrar().catch(App.erro);
  });

  App.registrarTela('login', async tela => abrir(tela));
})();
