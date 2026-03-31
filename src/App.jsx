import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const categoriasPadrao = [
  "Alimentação",
  "Saúde",
  "Transporte",
  "Lazer",
  "Moradia",
  "Contas",
  "Educação",
  "Compras",
  "Assinaturas",
  "Outros",
];

const tiposDespesa = ["Fixa", "Temporária", "Única", "Parcela"];

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function formatarData(data) {
  if (!data) return "-";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function ordenarPorData(lista) {
  return [...lista].sort((a, b) => {
    if (a.data === b.data) return a.movimento === "Receita" ? -1 : 1;
    return new Date(a.data) - new Date(b.data);
  });
}

function AuthCard({ authMode, setAuthMode, authForm, setAuthForm, authLoading, handleAuth }) {
  return (
    <div className="auth-shell">
      <div className="brand-panel">
        <div className="brand-badge">App Financeiro</div>
        <h1>Seu dinheiro organizado de forma clara.</h1>
        <p>
          Controle receitas, despesas, saldo, categorias e períodos com login individual para cada usuário.
        </p>
        <div className="brand-grid">
          <div className="mini-card">
            <strong>Modo mensal</strong>
            <span>Ideal para salário em uma data única.</span>
          </div>
          <div className="mini-card">
            <strong>Modo quinzena</strong>
            <span>Ideal para duas entradas no mês.</span>
          </div>
          <div className="mini-card">
            <strong>Banco de dados</strong>
            <span>Cada conta enxerga apenas os próprios dados.</span>
          </div>
          <div className="mini-card">
            <strong>Saldo automático</strong>
            <span>Veja o saldo após cada movimentação.</span>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="tabs-auth">
          <button
            className={authMode === "login" ? "tab active" : "tab"}
            onClick={() => setAuthMode("login")}
            type="button"
          >
            Entrar
          </button>
          <button
            className={authMode === "signup" ? "tab active" : "tab"}
            onClick={() => setAuthMode("signup")}
            type="button"
          >
            Criar conta
          </button>
        </div>

        <div className="form-block">
          <label>Email</label>
          <input
            type="email"
            value={authForm.email}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="seuemail@exemplo.com"
          />
        </div>

        <div className="form-block">
          <label>Senha</label>
          <input
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Digite sua senha"
          />
        </div>

        <button className="primary-button big" onClick={handleAuth} disabled={authLoading || !supabase}>
          {authLoading ? "Carregando..." : authMode === "login" ? "Entrar" : "Criar conta"}
        </button>

        {!supabase && (
          <div className="warning-box">
            Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu projeto para ativar login e banco de dados.
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const hoje = new Date().toISOString().slice(0, 10);

  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [mensagem, setMensagem] = useState("");
  const [carregandoDados, setCarregandoDados] = useState(false);

  const [modo, setModo] = useState("mensal");
  const [receitaMensal, setReceitaMensal] = useState("");
  const [quinzena1Data, setQuinzena1Data] = useState("");
  const [quinzena1Valor, setQuinzena1Valor] = useState("");
  const [quinzena2Data, setQuinzena2Data] = useState("");
  const [quinzena2Valor, setQuinzena2Valor] = useState("");

  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Alimentação");
  const [tipo, setTipo] = useState("Fixa");
  const [dataDespesa, setDataDespesa] = useState(hoje);
  const [valorDespesa, setValorDespesa] = useState("");
  const [infoParcela, setInfoParcela] = useState("");
  const [despesas, setDespesas] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    carregarDadosUsuario();
  }, [session?.user?.id]);

  async function handleAuth() {
    if (!supabase) {
      setMensagem("Configure o Supabase antes de continuar.");
      return;
    }

    setAuthLoading(true);
    setMensagem("");

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
        });

        if (error) throw error;
        setMensagem("Conta criada com sucesso. Verifique seu email se a confirmação estiver ativada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });

        if (error) throw error;
        setMensagem("Login realizado com sucesso.");
      }
    } catch (error) {
      setMensagem(error.message || "Não foi possível autenticar.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setDespesas([]);
    setReceitaMensal("");
    setQuinzena1Data("");
    setQuinzena1Valor("");
    setQuinzena2Data("");
    setQuinzena2Valor("");
    setModo("mensal");
    setMensagem("Sessão encerrada.");
  }

  async function carregarDadosUsuario() {
    if (!session?.user || !supabase) return;

    setCarregandoDados(true);
    setMensagem("");

    try {
      const { data: perfil, error: erroPerfil } = await supabase
        .from("financial_profiles")
        .select("mode, monthly_income, fortnight_1_date, fortnight_1_amount, fortnight_2_date, fortnight_2_amount")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (erroPerfil) throw erroPerfil;

      if (perfil) {
        setModo(perfil.mode || "mensal");
        setReceitaMensal(perfil.monthly_income ?? "");
        setQuinzena1Data(perfil.fortnight_1_date ?? "");
        setQuinzena1Valor(perfil.fortnight_1_amount ?? "");
        setQuinzena2Data(perfil.fortnight_2_date ?? "");
        setQuinzena2Valor(perfil.fortnight_2_amount ?? "");
      }

      const { data: listaDespesas, error: erroDespesas } = await supabase
        .from("financial_expenses")
        .select("id, description, category, type, date, amount, installment_info")
        .eq("user_id", session.user.id)
        .order("date", { ascending: true });

      if (erroDespesas) throw erroDespesas;

      setDespesas(
        (listaDespesas || []).map((item) => ({
          id: item.id,
          descricao: item.description,
          categoria: item.category,
          tipo: item.type,
          data: item.date,
          valor: item.amount,
          infoParcela: item.installment_info || "",
        }))
      );
    } catch (error) {
      setMensagem(error.message || "Erro ao carregar dados.");
    } finally {
      setCarregandoDados(false);
    }
  }

  async function salvarPerfil() {
    if (!session?.user || !supabase) return;

    try {
      const payload = {
        user_id: session.user.id,
        mode: modo,
        monthly_income: modo === "mensal" && receitaMensal !== "" ? Number(receitaMensal) : null,
        fortnight_1_date: modo === "quinzena" ? quinzena1Data || null : null,
        fortnight_1_amount: modo === "quinzena" && quinzena1Valor !== "" ? Number(quinzena1Valor) : null,
        fortnight_2_date: modo === "quinzena" ? quinzena2Data || null : null,
        fortnight_2_amount: modo === "quinzena" && quinzena2Valor !== "" ? Number(quinzena2Valor) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("financial_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      setMensagem("Perfil financeiro salvo com sucesso.");
    } catch (error) {
      setMensagem(error.message || "Erro ao salvar perfil.");
    }
  }

  async function adicionarDespesa(event) {
    event.preventDefault();
    if (!session?.user || !supabase) return;
    if (!descricao || !dataDespesa || !valorDespesa) return;

    try {
      const payload = {
        user_id: session.user.id,
        description: descricao,
        category: categoria,
        type: tipo,
        date: dataDespesa,
        amount: Number(valorDespesa),
        installment_info: tipo === "Parcela" ? infoParcela : null,
      };

      const { data, error } = await supabase.from("financial_expenses").insert(payload).select().single();
      if (error) throw error;

      setDespesas((anterior) => [
        ...anterior,
        {
          id: data.id,
          descricao: data.description,
          categoria: data.category,
          tipo: data.type,
          data: data.date,
          valor: data.amount,
          infoParcela: data.installment_info || "",
        },
      ]);

      setDescricao("");
      setCategoria("Alimentação");
      setTipo("Fixa");
      setDataDespesa(hoje);
      setValorDespesa("");
      setInfoParcela("");
      setMensagem("Despesa adicionada com sucesso.");
    } catch (error) {
      setMensagem(error.message || "Erro ao adicionar despesa.");
    }
  }

  async function removerDespesa(id) {
    if (!supabase) return;

    try {
      const { error } = await supabase.from("financial_expenses").delete().eq("id", id);
      if (error) throw error;
      setDespesas((anterior) => anterior.filter((item) => item.id !== id));
      setMensagem("Despesa removida com sucesso.");
    } catch (error) {
      setMensagem(error.message || "Erro ao remover despesa.");
    }
  }

  const receitas = useMemo(() => {
    if (modo === "mensal") {
      if (!receitaMensal) return [];
      return [
        {
          id: "receita-mensal",
          descricao: "Receita mensal",
          data: hoje,
          valor: Number(receitaMensal),
        },
      ];
    }

    const lista = [];

    if (quinzena1Data && quinzena1Valor) {
      lista.push({
        id: "q1",
        descricao: "Quinzena 1",
        data: quinzena1Data,
        valor: Number(quinzena1Valor),
      });
    }

    if (quinzena2Data && quinzena2Valor) {
      lista.push({
        id: "q2",
        descricao: "Quinzena 2",
        data: quinzena2Data,
        valor: Number(quinzena2Valor),
      });
    }

    return lista;
  }, [modo, receitaMensal, quinzena1Data, quinzena1Valor, quinzena2Data, quinzena2Valor, hoje]);

  const totalReceitas = receitas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const totalDespesas = despesas.reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const saldoFinal = totalReceitas - totalDespesas;

  const lancamentos = useMemo(() => {
    const entradas = receitas.map((item) => ({
      id: item.id,
      data: item.data,
      movimento: "Receita",
      descricao: item.descricao,
      categoria: "Receita",
      tipo: "Receita",
      valor: item.valor,
      valorAssinado: item.valor,
    }));

    const saidas = despesas.map((item) => ({
      id: item.id,
      data: item.data,
      movimento: "Despesa",
      descricao: item.infoParcela ? `${item.descricao} (${item.infoParcela})` : item.descricao,
      categoria: item.categoria,
      tipo: item.tipo,
      valor: item.valor,
      valorAssinado: -item.valor,
    }));

    const tudo = ordenarPorData([...entradas, ...saidas]);

    return tudo.reduce(
      (acc, item) => {
        const novoSaldo = acc.saldoAtual + item.valorAssinado;
        acc.lista.push({ ...item, saldoApos: novoSaldo });
        return { saldoAtual: novoSaldo, lista: acc.lista };
      },
      { saldoAtual: 0, lista: [] }
    ).lista;
  }, [receitas, despesas]);

  const resumoCategorias = useMemo(() => {
    const mapa = new Map();
    despesas.forEach((item) => {
      mapa.set(item.categoria, (mapa.get(item.categoria) || 0) + Number(item.valor || 0));
    });

    return Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [despesas]);

  if (!session) {
    return (
      <>
        <style>{styles}</style>
        <div className="page">
          <AuthCard
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            setAuthForm={setAuthForm}
            authLoading={authLoading}
            handleAuth={handleAuth}
          />
          {mensagem && <div className="floating-message">{mensagem}</div>}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="page">
        <div className="dashboard-shell">
          <header className="hero-card">
            <div>
              <div className="brand-badge">Painel financeiro</div>
              <h1>Olá, {session.user.email}</h1>
              <p>
                Cadastre suas receitas, organize suas despesas e acompanhe seu saldo restante em tempo real.
              </p>
            </div>
            <div className="hero-actions">
              <button className="soft-button" onClick={salvarPerfil}>
                Salvar perfil financeiro
              </button>
              <button className="danger-ghost" onClick={sair}>
                Sair
              </button>
            </div>
          </header>

          {mensagem && <div className="message-box">{mensagem}</div>}
          {carregandoDados && <div className="message-box">Carregando seus dados...</div>}

          <section className="stats-grid">
            <div className="stat-card income">
              <span>Receitas</span>
              <strong>{formatarMoeda(totalReceitas)}</strong>
              <small>Total de entradas do período</small>
            </div>
            <div className="stat-card expense">
              <span>Despesas</span>
              <strong>{formatarMoeda(totalDespesas)}</strong>
              <small>Total de saídas cadastradas</small>
            </div>
            <div className="stat-card balance">
              <span>Saldo restante</span>
              <strong>{formatarMoeda(saldoFinal)}</strong>
              <small>{saldoFinal >= 0 ? "Você está no positivo" : "Atenção ao orçamento"}</small>
            </div>
          </section>

          <section className="content-grid">
            <div className="left-column">
              <div className="glass-card">
                <div className="section-title-row">
                  <div>
                    <h2>Modo de controle</h2>
                    <p>Escolha a forma que combina com seu salário.</p>
                  </div>
                </div>

                <div className="mode-switch">
                  <button
                    className={modo === "mensal" ? "mode-btn active" : "mode-btn"}
                    onClick={() => setModo("mensal")}
                    type="button"
                  >
                    Mensal
                  </button>
                  <button
                    className={modo === "quinzena" ? "mode-btn active" : "mode-btn"}
                    onClick={() => setModo("quinzena")}
                    type="button"
                  >
                    Quinzena
                  </button>
                </div>

                {modo === "mensal" ? (
                  <div className="form-grid single">
                    <div className="form-block">
                      <label>Receita mensal</label>
                      <input
                        type="number"
                        value={receitaMensal}
                        onChange={(e) => setReceitaMensal(e.target.value)}
                        placeholder="Ex: 2500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="duo-cards">
                    <div className="sub-card">
                      <h3>Quinzena 1</h3>
                      <div className="form-block">
                        <label>Data</label>
                        <input type="date" value={quinzena1Data} onChange={(e) => setQuinzena1Data(e.target.value)} />
                      </div>
                      <div className="form-block">
                        <label>Valor</label>
                        <input
                          type="number"
                          value={quinzena1Valor}
                          onChange={(e) => setQuinzena1Valor(e.target.value)}
                          placeholder="Ex: 810.50"
                        />
                      </div>
                    </div>

                    <div className="sub-card">
                      <h3>Quinzena 2</h3>
                      <div className="form-block">
                        <label>Data</label>
                        <input type="date" value={quinzena2Data} onChange={(e) => setQuinzena2Data(e.target.value)} />
                      </div>
                      <div className="form-block">
                        <label>Valor</label>
                        <input
                          type="number"
                          value={quinzena2Valor}
                          onChange={(e) => setQuinzena2Valor(e.target.value)}
                          placeholder="Ex: 810.50"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="glass-card">
                <div className="section-title-row">
                  <div>
                    <h2>Adicionar despesa</h2>
                    <p>Cadastre cada saída com categoria, tipo, data e valor.</p>
                  </div>
                </div>

                <form className="form-grid" onSubmit={adicionarDespesa}>
                  <div className="form-block wide">
                    <label>Descrição</label>
                    <input
                      type="text"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: Mercado, internet, ônibus..."
                    />
                  </div>

                  <div className="form-block">
                    <label>Categoria</label>
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                      {categoriasPadrao.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-block">
                    <label>Tipo</label>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                      {tiposDespesa.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-block">
                    <label>Data</label>
                    <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} />
                  </div>

                  <div className="form-block">
                    <label>Valor</label>
                    <input
                      type="number"
                      value={valorDespesa}
                      onChange={(e) => setValorDespesa(e.target.value)}
                      placeholder="Ex: 149.90"
                    />
                  </div>

                  {tipo === "Parcela" && (
                    <div className="form-block">
                      <label>Informação da parcela</label>
                      <input
                        type="text"
                        value={infoParcela}
                        onChange={(e) => setInfoParcela(e.target.value)}
                        placeholder="Ex: 3/12"
                      />
                    </div>
                  )}

                  <div className="form-actions wide">
                    <button className="primary-button" type="submit">
                      Adicionar despesa
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="right-column">
              <div className="glass-card">
                <div className="section-title-row">
                  <div>
                    <h2>Resumo por categoria</h2>
                    <p>Veja rapidamente onde seu dinheiro está indo.</p>
                  </div>
                </div>

                <div className="category-list">
                  {resumoCategorias.length === 0 ? (
                    <div className="empty-box">Nenhuma despesa cadastrada ainda.</div>
                  ) : (
                    resumoCategorias.map((item) => {
                      const percentual = totalDespesas > 0 ? (item.valor / totalDespesas) * 100 : 0;
                      return (
                        <div key={item.nome} className="category-item">
                          <div className="category-head">
                            <div>
                              <strong>{item.nome}</strong>
                              <span>{percentual.toFixed(1)}% das despesas</span>
                            </div>
                            <b>{formatarMoeda(item.valor)}</b>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${percentual}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card table-card">
            <div className="section-title-row">
              <div>
                <h2>Planilha do período</h2>
                <p>Lançamentos organizados por data com saldo após cada movimentação.</p>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Movimento</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Saldo após</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-table">Nenhum lançamento ainda.</td>
                    </tr>
                  ) : (
                    lancamentos.map((item) => (
                      <tr key={item.id}>
                        <td>{formatarData(item.data)}</td>
                        <td>
                          <span className={item.movimento === "Receita" ? "pill income" : "pill expense"}>
                            {item.movimento}
                          </span>
                        </td>
                        <td>{item.descricao}</td>
                        <td>{item.categoria}</td>
                        <td>{item.tipo}</td>
                        <td className={item.movimento === "Receita" ? "money income" : "money expense"}>
                          {item.movimento === "Receita" ? "+ " : "- "}
                          {formatarMoeda(item.valor)}
                        </td>
                        <td className="money balance">{formatarMoeda(item.saldoApos)}</td>
                        <td>
                          {item.movimento === "Despesa" && (
                            <button className="danger-ghost" onClick={() => removerDespesa(item.id)}>
                              Remover
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

const styles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background:
      radial-gradient(circle at top left, rgba(84, 104, 255, 0.28), transparent 28%),
      radial-gradient(circle at top right, rgba(20, 184, 166, 0.22), transparent 26%),
      linear-gradient(180deg, #081120 0%, #0d1528 100%);
    color: #e5eefc;
  }
  button, input, select { font: inherit; }
  .page {
    min-height: 100vh;
    padding: 24px;
  }
  .dashboard-shell, .auth-shell {
    max-width: 1280px;
    margin: 0 auto;
  }
  .auth-shell {
    display: grid;
    grid-template-columns: 1.2fr 0.85fr;
    gap: 24px;
    align-items: stretch;
  }
  .brand-panel, .auth-card, .glass-card, .hero-card, .stat-card {
    background: rgba(11, 18, 32, 0.74);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 18px 60px rgba(0,0,0,0.28);
    backdrop-filter: blur(14px);
  }
  .brand-panel, .auth-card, .glass-card, .hero-card { border-radius: 28px; }
  .brand-panel {
    padding: 36px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 560px;
  }
  .brand-panel h1 {
    font-size: clamp(2.2rem, 4vw, 4rem);
    line-height: 1.05;
    margin: 18px 0 14px;
  }
  .brand-panel p {
    color: #b2c3e0;
    font-size: 1.04rem;
    max-width: 600px;
    line-height: 1.7;
  }
  .brand-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 28px;
  }
  .mini-card {
    border-radius: 20px;
    padding: 18px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
    display: grid;
    gap: 8px;
  }
  .mini-card span { color: #a8b7d4; font-size: 0.95rem; }
  .auth-card {
    padding: 28px;
    align-self: center;
  }
  .tabs-auth, .mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .tab, .mode-btn {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: #dce7fb;
    padding: 12px 16px;
    border-radius: 16px;
    cursor: pointer;
    transition: 0.2s ease;
  }
  .tab.active, .mode-btn.active {
    background: linear-gradient(135deg, #6478ff 0%, #31c8b7 100%);
    color: white;
    border-color: transparent;
  }
  .form-block {
    display: grid;
    gap: 8px;
  }
  .form-block label {
    color: #b7c6e2;
    font-size: 0.92rem;
  }
  .form-block input, .form-block select {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.05);
    color: #eef4ff;
    padding: 14px 14px;
    outline: none;
  }
  .form-block input::placeholder { color: #8ea1c5; }
  .form-block input:focus, .form-block select:focus {
    border-color: rgba(100,120,255,0.8);
    box-shadow: 0 0 0 4px rgba(100,120,255,0.15);
  }
  .primary-button, .soft-button, .danger-ghost {
    border: none;
    cursor: pointer;
    border-radius: 16px;
    padding: 12px 16px;
    transition: 0.2s ease;
  }
  .primary-button {
    background: linear-gradient(135deg, #6478ff 0%, #31c8b7 100%);
    color: white;
    font-weight: 700;
  }
  .primary-button.big { margin-top: 18px; width: 100%; padding: 14px 18px; }
  .soft-button {
    background: rgba(255,255,255,0.08);
    color: #eef4ff;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .danger-ghost {
    background: rgba(255,255,255,0.04);
    color: #ffb7b7;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .hero-card {
    padding: 28px;
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: center;
    margin-bottom: 20px;
  }
  .hero-card h1 { margin: 12px 0 8px; font-size: clamp(1.9rem, 3vw, 3rem); }
  .hero-card p { margin: 0; color: #afc0dc; max-width: 760px; line-height: 1.7; }
  .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .brand-badge {
    display: inline-flex;
    width: fit-content;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(100,120,255,0.16);
    color: #d8e1ff;
    border: 1px solid rgba(100,120,255,0.35);
    font-size: 0.9rem;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin-bottom: 20px;
  }
  .stat-card {
    border-radius: 26px;
    padding: 22px;
    display: grid;
    gap: 8px;
  }
  .stat-card span { color: #b8c8e5; }
  .stat-card strong { font-size: clamp(1.6rem, 3vw, 2.3rem); }
  .stat-card small { color: #96a8c8; }
  .stat-card.income { background: linear-gradient(135deg, rgba(33, 150, 83, 0.24), rgba(11,18,32,0.84)); }
  .stat-card.expense { background: linear-gradient(135deg, rgba(220, 38, 38, 0.24), rgba(11,18,32,0.84)); }
  .stat-card.balance { background: linear-gradient(135deg, rgba(100, 120, 255, 0.32), rgba(11,18,32,0.88)); }
  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
    gap: 20px;
    margin-bottom: 20px;
  }
  .left-column, .right-column { display: grid; gap: 20px; }
  .glass-card {
    padding: 24px;
  }
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }
  .section-title-row h2 {
    margin: 0 0 8px;
    font-size: 1.35rem;
  }
  .section-title-row p {
    margin: 0;
    color: #9eb1d2;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .form-grid.single { grid-template-columns: 1fr; }
  .wide { grid-column: 1 / -1; }
  .form-actions { display: flex; justify-content: flex-end; }
  .duo-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .sub-card {
    border-radius: 22px;
    padding: 18px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    display: grid;
    gap: 14px;
  }
  .sub-card h3 { margin: 0; }
  .category-list { display: grid; gap: 14px; }
  .category-item {
    display: grid;
    gap: 10px;
    padding: 14px;
    border-radius: 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.05);
  }
  .category-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .category-head span {
    display: block;
    color: #9eb1d2;
    margin-top: 4px;
    font-size: 0.92rem;
  }
  .bar-track {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.07);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(135deg, #6478ff 0%, #31c8b7 100%);
  }
  .table-card { overflow: hidden; }
  .table-wrapper {
    overflow-x: auto;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
  }
  table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
  }
  thead {
    background: rgba(255,255,255,0.04);
  }
  th, td {
    padding: 14px 16px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  th { color: #b6c6e3; font-weight: 600; }
  td { color: #edf3ff; }
  .pill {
    display: inline-flex;
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 0.86rem;
    font-weight: 700;
  }
  .pill.income { background: rgba(16, 185, 129, 0.16); color: #8df1cb; }
  .pill.expense { background: rgba(239, 68, 68, 0.16); color: #ffb6b6; }
  .money.income { color: #93f0cb; font-weight: 700; }
  .money.expense { color: #ffb6b6; font-weight: 700; }
  .money.balance { color: #e7f0ff; font-weight: 700; }
  .message-box, .floating-message, .warning-box, .empty-box {
    border-radius: 18px;
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.05);
    color: #dce8fd;
  }
  .floating-message {
    max-width: 1280px;
    margin: 20px auto 0;
  }
  .warning-box {
    margin-top: 16px;
    color: #ffe2a6;
  }
  .empty-box, .empty-table { color: #9eb1d2; }
  @media (max-width: 1080px) {
    .auth-shell, .content-grid, .stats-grid, .duo-cards {
      grid-template-columns: 1fr;
    }
    .hero-card {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  @media (max-width: 760px) {
    .page { padding: 16px; }
    .brand-panel, .auth-card, .glass-card, .hero-card { padding: 20px; border-radius: 22px; }
    .form-grid { grid-template-columns: 1fr; }
    .brand-grid { grid-template-columns: 1fr; }
  }
`;
