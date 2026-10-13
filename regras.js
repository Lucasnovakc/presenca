// Regras do app de presença: datas, calendário do restaurante e cálculo de faltas. Funções puras.
// Datas são texto 'AAAA-MM-DD' no fuso local; domingo = 0 … sábado = 6.
(function () {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const SEMANA_CURTA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  // Cores dos avatares: todas escuras o bastante para letra branca.
  const CORES = ['#E4572E', '#1B998B', '#C2185B', '#3D7DD8', '#7B4FD0', '#2E9E5B', '#D97706', '#0E7490', '#B4442B', '#DB2777'];

  const doisDig = n => String(n).padStart(2, '0');
  const paraTexto = d => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
  function paraData(dia) {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  const hojeLocal = (agora = new Date()) => paraTexto(agora);
  function somarDias(dia, n) {
    const d = paraData(dia);
    d.setDate(d.getDate() + n);
    return paraTexto(d);
  }
  const diaDaSemana = dia => paraData(dia).getDay();
  function diasDoMes(ano, mes) {
    const total = new Date(ano, mes, 0).getDate();
    return Array.from({ length: total }, (_, i) => `${ano}-${doisDig(mes)}-${doisDig(i + 1)}`);
  }
  function somarMeses(ano, mes, n) {
    const d = new Date(ano, mes - 1 + n, 1);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }
  const mesDoDia = dia => ({ ano: Number(dia.slice(0, 4)), mes: Number(dia.slice(5, 7)) });
  const nomeDoMes = (ano, mes) => `${MESES[mes - 1]} de ${ano}`;
  function formatarDiaLongo(dia) {
    const d = paraData(dia);
    return `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }
  const formatarData = dia => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (partes[0][0] + ultima).toUpperCase();
  }
  function sugerirCor(funcionarios) {
    const usadas = funcionarios.map(f => f.cor);
    return CORES.find(c => !usadas.includes(c)) || CORES[funcionarios.length % CORES.length];
  }

  function validarFuncionario(f) {
    if (!String(f.nome || '').trim()) return 'Informe o nome.';
    if (!f.inicio) return 'Informe a data de início.';
    if (f.fim && f.fim < f.inicio) return 'A saída não pode ser antes do início.';
    if (!CORES.includes(f.cor)) return 'Escolha uma cor.';
    return null;
  }
  function validarExcecao(e) {
    if (!e.dia) return 'Escolha a data.';
    if (e.tipo !== 'fechado' && e.tipo !== 'aberto') return 'Escolha se o restaurante fecha ou abre.';
    return null;
  }

  // ---- calendário e faltas ----
  const chave = (id, dia) => id + '|' + dia;
  function montarCtx({ diasFechados = [], excecoes = {}, marcas = [] }) {
    const set = new Set(), dias = new Set();
    for (const m of marcas) { set.add(chave(m.funcionario_id, m.dia)); dias.add(m.dia); }
    return { diasFechados, excecoes, marcas: set, diasComMarca: dias };
  }
  // Exceção da data vale mais que o dia da semana.
  function diaAberto(dia, ctx) {
    const e = ctx.excecoes[dia];
    if (e) return e === 'aberto';
    return !ctx.diasFechados.includes(diaDaSemana(dia));
  }
  const ativoNoDia = (f, dia) => f.inicio <= dia && (!f.fim || dia <= f.fim);
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const ativosNoDia = (funcs, dia) => funcs.filter(f => ativoNoDia(f, dia)).sort(porNome);
  function funcionariosDoMes(funcs, ano, mes) {
    const dias = diasDoMes(ano, mes);
    const ini = dias[0], fim = dias[dias.length - 1];
    return funcs.filter(f => f.inicio <= fim && (!f.fim || f.fim >= ini)).sort(porNome);
  }
  // Dia aberto e passado sem marca de ninguém = "sem registro" (esqueceram de marcar), não falta.
  function statusCelula(f, dia, hoje, ctx) {
    if (!ativoNoDia(f, dia)) return 'fora';
    if (dia > hoje) return 'futuro';
    if (!diaAberto(dia, ctx)) return 'fechado';
    if (ctx.marcas.has(chave(f.id, dia))) return 'presente';
    if (dia === hoje) return 'pendente';
    if (!ctx.diasComMarca.has(dia)) return 'sem_registro';
    return 'falta';
  }
  const podeMarcar = (f, dia, hoje, ctx) => ativoNoDia(f, dia) && dia <= hoje && diaAberto(dia, ctx);
  const faltasNoMes = (f, ano, mes, hoje, ctx) => diasDoMes(ano, mes).filter(d => statusCelula(f, d, hoje, ctx) === 'falta').length;


  const api = {
    CORES, SEMANA, SEMANA_CURTA,
    hojeLocal, somarDias, diaDaSemana, diasDoMes, somarMeses, mesDoDia, nomeDoMes, formatarDiaLongo, formatarData,
    iniciais, sugerirCor, validarFuncionario, validarExcecao,
    chave, montarCtx, diaAberto, ativoNoDia, ativosNoDia, funcionariosDoMes, statusCelula, podeMarcar, faltasNoMes,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Regras = api;
})();
