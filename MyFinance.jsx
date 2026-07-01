import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Settings,
  Wallet,
  LayoutList,
  PiggyBank,
  Plus,
  Trash2,
  Moon,
  Sun,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Repeat,
  Calendar,
  X,
} from "lucide-react";

/* =========================================================================
   MyFinance — app de finanças pessoais para fluxo quinzenal + Caixinha CDI
   Tudo é guardado no localStorage do navegador (chave "myfinance-data-v1")
   ========================================================================= */

const STORAGE_KEY = "myfinance-data-v1";
const CDI_ANUAL = 0.105; // 10,5% a.a. — referência aproximada, ajustável na aba Configurações

const CATEGORIAS_RECEITA = ["Salário", "Investimentos", "Freelancer"];
const CATEGORIAS_DESPESA = ["Fixa", "Única", "Parcelada"];

const CATEGORIAS_LIVRES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Assinaturas",
  "Outros",
];

/* ---------------------------- utilidades --------------------------------- */

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now();
}

function formatBRL(value) {
  const v = Number(value) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateLocal(dateStr) {
  // dateStr no formato "YYYY-MM-DD" — evita bug de fuso horário do new Date(string)
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthKeyFromDateStr(dateStr) {
  const [y, m] = dateStr.split("-");
  return `${y}-${m}`;
}

function addMonthsToDateStr(dateStr, monthsToAdd) {
  const d = parseDateLocal(dateStr);
  const day = d.getDate();
  d.setDate(1); // evita "estouro" de mês (ex: 31 de fevereiro)
  d.setMonth(d.getMonth() + monthsToAdd);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTargetMonth));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysToDateStr(dateStr, days) {
  const d = parseDateLocal(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[m - 1]} de ${y}`;
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Taxa mensal aproximada a partir do CDI anual e do % do CDI configurado pelo usuário. */
function taxaMensal(cdiPercentUsuario) {
  const taxaAnualEfetiva = CDI_ANUAL * (cdiPercentUsuario / 100);
  return Math.pow(1 + taxaAnualEfetiva, 1 / 12) - 1;
}

/* ------------------------------ dados iniciais ---------------------------- */

const initialState = {
  config: { userName: "", cdiPercent: 110, theme: "light" },
  transactions: [], // {id, type, subtype, description, value, date, category, groupId?, installmentLabel?}
  caixinha: { balance: 0, history: [] }, // history: {id, type: 'deposito'|'resgate'|'rendimento', value, date, monthKey}
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      config: { ...initialState.config, ...(parsed.config || {}) },
      transactions: parsed.transactions || [],
      caixinha: { ...initialState.caixinha, ...(parsed.caixinha || {}) },
    };
  } catch (e) {
    console.error("Erro ao ler dados salvos:", e);
    return initialState;
  }
}

/* ================================ APP ==================================== */

export default function MyFinanceApp() {
  const [state, setState] = useState(loadState);
  const [activeTab, setActiveTab] = useState("lancamentos");

  const { config, transactions, caixinha } = state;

  // Persiste qualquer mudança de estado no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Erro ao salvar dados:", e);
    }
  }, [state]);

  const isDark = config.theme === "dark";

  const updateConfig = useCallback((patch) => {
    setState((prev) => ({ ...prev, config: { ...prev.config, ...patch } }));
  }, []);

  const addTransactions = useCallback((newOnes) => {
    setState((prev) => ({ ...prev, transactions: [...prev.transactions, ...newOnes] }));
  }, []);

  const removeTransaction = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const removeGroup = useCallback((groupId) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.groupId !== groupId),
    }));
  }, []);

  // Saldo geral disponível = tudo que entrou - tudo que saiu - o que foi pra caixinha + o que voltou da caixinha
  const saldoDisponivel = useMemo(() => {
    let total = 0;
    for (const t of transactions) {
      total += t.type === "receita" ? t.value : -t.value;
    }
    for (const h of caixinha.history) {
      if (h.type === "deposito") total -= h.value;
      if (h.type === "resgate") total += h.value;
    }
    return total;
  }, [transactions, caixinha.history]);

  const depositarNaCaixinha = useCallback(
    (valor) => {
      setState((prev) => {
        const entry = { id: uid(), type: "deposito", value: valor, date: todayStr(), monthKey: monthKeyFromDateStr(todayStr()) };
        return {
          ...prev,
          caixinha: {
            balance: prev.caixinha.balance + valor,
            history: [...prev.caixinha.history, entry],
          },
        };
      });
    },
    []
  );

  const resgatarDaCaixinha = useCallback(
    (valor) => {
      setState((prev) => {
        const entry = { id: uid(), type: "resgate", value: valor, date: todayStr(), monthKey: monthKeyFromDateStr(todayStr()) };
        return {
          ...prev,
          caixinha: {
            balance: Math.max(0, prev.caixinha.balance - valor),
            history: [...prev.caixinha.history, entry],
          },
        };
      });
    },
    []
  );

  const aplicarRendimento = useCallback(() => {
    setState((prev) => {
      const mk = monthKeyFromDateStr(todayStr());
      const jaAplicado = prev.caixinha.history.some((h) => h.type === "rendimento" && h.monthKey === mk);
      if (jaAplicado) return prev;
      const rate = taxaMensal(prev.config.cdiPercent);
      const rendimento = prev.caixinha.balance * rate;
      if (rendimento <= 0) return prev;
      const entry = { id: uid(), type: "rendimento", value: rendimento, date: todayStr(), monthKey: mk };
      return {
        ...prev,
        caixinha: {
          balance: prev.caixinha.balance + rendimento,
          history: [...prev.caixinha.history, entry],
        },
      };
    });
  }, []);

  const tabs = [
    { id: "lancamentos", label: "Lançamentos", icon: LayoutList },
    { id: "visao-geral", label: "Visão Geral", icon: Calendar },
    { id: "caixinha", label: "Caixinha", icon: PiggyBank },
    { id: "config", label: "Configurações", icon: Settings },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .font-display { font-family: 'Sora', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono-fin { font-family: 'IBM Plex Mono', monospace; }
      `}</style>
      <div className="min-h-screen bg-stone-50 dark:bg-slate-950 font-body text-stone-800 dark:text-stone-200 transition-colors">
        <div className="max-w-3xl mx-auto pb-24 md:pb-8">
          <Header
            userName={config.userName}
            saldoDisponivel={saldoDisponivel}
            isDark={isDark}
            onToggleTheme={() => updateConfig({ theme: isDark ? "light" : "dark" })}
          />

          {/* navegação desktop */}
          <nav className="hidden md:flex gap-1 px-6 pt-4">
            {tabs.map((tab) => (
              <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
            ))}
          </nav>

          <main className="px-4 md:px-6 pt-4">
            {activeTab === "lancamentos" && (
              <LancamentosTab transactions={transactions} onAdd={addTransactions} onRemove={removeTransaction} onRemoveGroup={removeGroup} />
            )}
            {activeTab === "visao-geral" && (
              <VisaoGeralTab transactions={transactions} caixinhaHistory={caixinha.history} onRemove={removeTransaction} />
            )}
            {activeTab === "caixinha" && (
              <CaixinhaTab
                caixinha={caixinha}
                config={config}
                saldoDisponivel={saldoDisponivel}
                onDepositar={depositarNaCaixinha}
                onResgatar={resgatarDaCaixinha}
                onAplicarRendimento={aplicarRendimento}
              />
            )}
            {activeTab === "config" && <ConfigTab config={config} onUpdate={updateConfig} />}
          </main>
        </div>

        {/* navegação mobile (barra inferior) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-stone-200 dark:border-slate-800 flex justify-around py-2 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                activeTab === tab.id
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-stone-400 dark:text-stone-500"
              }`}
            >
              <tab.icon size={20} strokeWidth={2} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ============================== HEADER =================================== */

function Header({ userName, saldoDisponivel, isDark, onToggleTheme }) {
  const negativo = saldoDisponivel < 0;
  return (
    <header className="px-6 pt-6 pb-2 flex items-start justify-between">
      <div>
        <p className="text-sm text-stone-500 dark:text-stone-400 font-body">
          {userName ? `Olá, ${userName}` : "Olá!"}
        </p>
        <h1 className="font-display text-2xl font-700 text-stone-900 dark:text-white mt-0.5">MyFinance</h1>
        <p className="font-mono-fin text-sm mt-1.5">
          <span className="text-stone-400 dark:text-stone-500 font-body mr-1.5">Saldo disponível</span>
          <span className={negativo ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
            {formatBRL(saldoDisponivel)}
          </span>
        </p>
      </div>
      <button
        onClick={onToggleTheme}
        className="p-2 rounded-full bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-500 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Alternar tema"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}

function TabButton({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-600 text-white"
          : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
      }`}
    >
      <tab.icon size={16} />
      {tab.label}
    </button>
  );
}

/* ============================ CONFIGURAÇÕES ================================ */

function ConfigTab({ config, onUpdate }) {
  return (
    <div className="space-y-4 max-w-md">
      <Card>
        <SectionTitle>Perfil</SectionTitle>
        <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5 mt-3">Nome</label>
        <input
          type="text"
          value={config.userName}
          onChange={(e) => onUpdate({ userName: e.target.value })}
          placeholder="Como você quer ser chamado?"
          className={inputClass}
        />
      </Card>

      <Card>
        <SectionTitle>Caixinha</SectionTitle>
        <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5 mt-3">Percentual do CDI (ex: 110)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="1"
            value={config.cdiPercent}
            onChange={(e) => onUpdate({ cdiPercent: Number(e.target.value) || 0 })}
            className={inputClass}
          />
          <span className="text-stone-400 dark:text-stone-500 font-mono-fin">% do CDI</span>
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
          Considerando um CDI de referência de {(CDI_ANUAL * 100).toFixed(1)}% a.a., isso equivale a uma taxa mensal aproximada de{" "}
          <span className="font-mono-fin text-stone-600 dark:text-stone-300">{(taxaMensal(config.cdiPercent) * 100).toFixed(3)}%</span>.
        </p>
      </Card>

      <Card>
        <SectionTitle>Aparência</SectionTitle>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-stone-600 dark:text-stone-300">Tema escuro</span>
          <button
            onClick={() => onUpdate({ theme: config.theme === "dark" ? "light" : "dark" })}
            className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
              config.theme === "dark" ? "bg-emerald-600 justify-end" : "bg-stone-300 justify-start"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ============================= LANÇAMENTOS ================================= */

function LancamentosTab({ transactions, onAdd, onRemove, onRemoveGroup }) {
  const [showForm, setShowForm] = useState(false);
  const recentes = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    [transactions]
  );

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors"
      >
        <Plus size={18} /> Novo lançamento
      </button>

      {showForm && <LancamentoForm onAdd={onAdd} onClose={() => setShowForm(false)} />}

      <div>
        <SectionTitle>Últimos lançamentos</SectionTitle>
        {recentes.length === 0 && (
          <EmptyState text="Nenhum lançamento ainda. Toque em “Novo lançamento” para começar." />
        )}
        <div className="space-y-2 mt-3">
          {recentes.map((t) => (
            <TransactionRow key={t.id} t={t} onRemove={onRemove} onRemoveGroup={onRemoveGroup} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ t, onRemove, onRemoveGroup }) {
  const isReceita = t.type === "receita";
  return (
    <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
            isReceita ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
          }`}
        >
          {isReceita ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
            {t.description}
            {t.installmentLabel ? <span className="text-stone-400 dark:text-stone-500 font-mono-fin"> {t.installmentLabel}</span> : null}
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {t.subtype} · {t.category} · {parseDateLocal(t.date).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono-fin text-sm font-semibold ${isReceita ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {isReceita ? "+" : "-"}
          {formatBRL(t.value)}
        </span>
        <button
          onClick={() => (t.groupId ? onRemoveGroup(t.groupId) : onRemove(t.id))}
          className="text-stone-300 dark:text-stone-600 hover:text-rose-500 transition-colors"
          aria-label="Remover"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function LancamentoForm({ onAdd, onClose }) {
  const [type, setType] = useState("receita");
  const [subtype, setSubtype] = useState(CATEGORIAS_RECEITA[0]);
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(CATEGORIAS_LIVRES[0]);
  const [segundaQuinzena, setSegundaQuinzena] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState(2);

  useEffect(() => {
    setSubtype(type === "receita" ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0]);
  }, [type]);

  const isParcelada = type === "despesa" && subtype === "Parcelada";
  const valorNumerico = Number(String(value).replace(",", "."));

  function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || !valorNumerico || valorNumerico <= 0) return;

    if (isParcelada) {
      const n = Math.max(2, Math.round(totalParcelas));
      const parcelaBase = Math.round((valorNumerico / n) * 100) / 100;
      const diferenca = Math.round((valorNumerico - parcelaBase * n) * 100) / 100;
      const groupId = uid();
      const novas = Array.from({ length: n }, (_, i) => ({
        id: uid(),
        type: "despesa",
        subtype: "Parcelada",
        description,
        value: i === n - 1 ? parcelaBase + diferenca : parcelaBase,
        date: addMonthsToDateStr(date, i),
        category,
        groupId,
        installmentLabel: `(${i + 1}/${n})`,
      }));
      onAdd(novas);
    } else {
      const principal = {
        id: uid(),
        type,
        subtype,
        description,
        value: valorNumerico,
        date,
        category: type === "receita" ? subtype : category,
      };
      const lista = [principal];
      if (type === "receita" && subtype === "Salário" && segundaQuinzena) {
        lista.push({
          ...principal,
          id: uid(),
          date: addDaysToDateStr(date, 15),
          description: description + " (2ª quinzena)",
        });
      }
      onAdd(lista);
    }
    onClose();
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-600 text-stone-800 dark:text-stone-100">Novo lançamento</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <PillOption label="Receita" active={type === "receita"} onClick={() => setType("receita")} colorClass="emerald" />
          <PillOption label="Despesa" active={type === "despesa"} onClick={() => setType("despesa")} colorClass="rose" />
        </div>

        <div>
          <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">
            {type === "receita" ? "Tipo de receita" : "Tipo de despesa"}
          </label>
          <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className={inputClass}>
            {(type === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isParcelada ? "Ex: Notebook novo" : "Ex: Supermercado"}
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">
              {isParcelada ? "Valor total (R$)" : "Valor (R$)"}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className={inputClass + " font-mono-fin"}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">
              {isParcelada ? "1ª parcela em" : "Data"}
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
          </div>
        </div>

        {isParcelada && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
            <label className="block text-sm text-amber-700 dark:text-amber-400 mb-1.5">Número de parcelas</label>
            <input
              type="number"
              min={2}
              value={totalParcelas}
              onChange={(e) => setTotalParcelas(e.target.value)}
              className={inputClass}
            />
            {valorNumerico > 0 && totalParcelas >= 2 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-mono-fin">
                {Math.round(totalParcelas)}x de {formatBRL(valorNumerico / Math.round(totalParcelas))}
              </p>
            )}
          </div>
        )}

        {type === "despesa" && !isParcelada && (
          <div>
            <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIAS_LIVRES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {type === "receita" && subtype === "Salário" && (
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={segundaQuinzena}
              onChange={(e) => setSegundaQuinzena(e.target.checked)}
              className="rounded"
            />
            Lançar também a 2ª quinzena (mesmo valor, 15 dias depois)
          </label>
        )}

        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
          Salvar lançamento
        </button>
      </form>
    </div>
  );
}

function PillOption({ label, active, onClick, colorClass }) {
  const activeClasses =
    colorClass === "emerald"
      ? "bg-emerald-600 text-white"
      : "bg-rose-600 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? activeClasses : "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400"
      }`}
    >
      {label}
    </button>
  );
}

/* ============================= VISÃO GERAL ================================= */

function VisaoGeralTab({ transactions, caixinhaHistory, onRemove }) {
  const monthOptions = useMemo(() => {
    const keys = new Set(transactions.map((t) => monthKeyFromDateStr(t.date)));
    keys.add(monthKeyFromDateStr(todayStr()));
    return Array.from(keys).sort().reverse();
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState(monthKeyFromDateStr(todayStr()));

  const doMes = useMemo(
    () => transactions.filter((t) => monthKeyFromDateStr(t.date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const totalReceitas = useMemo(() => doMes.filter((t) => t.type === "receita").reduce((s, t) => s + t.value, 0), [doMes]);
  const totalDespesas = useMemo(() => doMes.filter((t) => t.type === "despesa").reduce((s, t) => s + t.value, 0), [doMes]);
  const rendimentoMes = useMemo(
    () => caixinhaHistory.filter((h) => h.type === "rendimento" && h.monthKey === selectedMonth).reduce((s, h) => s + h.value, 0),
    [caixinhaHistory, selectedMonth]
  );

  const receitasPorCategoria = groupByCategory(doMes.filter((t) => t.type === "receita"));
  const despesasPorCategoria = groupByCategory(doMes.filter((t) => t.type === "despesa"));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-stone-500 dark:text-stone-400 mb-1.5">Mês</label>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={inputClass}>
          {monthOptions.map((mk) => (
            <option key={mk} value={mk}>{formatMonthLabel(mk)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Receitas" value={formatBRL(totalReceitas)} tone="emerald" />
        <StatCard label="Despesas" value={formatBRL(totalDespesas)} tone="rose" />
        <StatCard label="Saldo líquido" value={formatBRL(totalReceitas - totalDespesas)} tone={totalReceitas - totalDespesas >= 0 ? "emerald" : "rose"} />
        <StatCard label="Rendimento Caixinha" value={formatBRL(rendimentoMes)} tone="indigo" />
      </div>

      <div>
        <SectionTitle>Receitas por categoria</SectionTitle>
        <CategoryTable groups={receitasPorCategoria} tone="emerald" onRemove={onRemove} />
      </div>

      <div>
        <SectionTitle>Despesas por categoria</SectionTitle>
        <CategoryTable groups={despesasPorCategoria} tone="rose" onRemove={onRemove} />
      </div>
    </div>
  );
}

function groupByCategory(list) {
  const map = new Map();
  for (const t of list) {
    const key = t.category || t.subtype;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => (a.date < b.date ? -1 : 1)),
      total: items.reduce((s, t) => s + t.value, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

function CategoryTable({ groups, tone, onRemove }) {
  if (groups.length === 0) return <EmptyState text="Sem lançamentos neste mês." />;
  const toneText = tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  return (
    <div className="space-y-3 mt-2">
      {groups.map((g) => (
        <div key={g.category} className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-2 bg-stone-50 dark:bg-slate-800/50">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{g.category}</span>
            <span className={`font-mono-fin text-sm font-semibold ${toneText}`}>{formatBRL(g.total)}</span>
          </div>
          <div>
            {g.items.map((t) => (
              <div key={t.id} className="flex justify-between items-center px-4 py-2 border-t border-stone-100 dark:border-slate-800/60 text-sm">
                <span className="text-stone-600 dark:text-stone-300 truncate">
                  {t.description} {t.installmentLabel ? <span className="text-stone-400 dark:text-stone-500 font-mono-fin">{t.installmentLabel}</span> : null}
                  <span className="text-stone-400 dark:text-stone-500 ml-2">{parseDateLocal(t.date).toLocaleDateString("pt-BR")}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-fin text-stone-500 dark:text-stone-400">{formatBRL(t.value)}</span>
                  <button onClick={() => onRemove(t.id)} className="text-stone-300 dark:text-stone-600 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClasses = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
  }[tone];
  return (
    <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl p-3">
      <p className="text-xs text-stone-400 dark:text-stone-500">{label}</p>
      <p className={`font-mono-fin text-lg font-semibold mt-1 ${toneClasses}`}>{value}</p>
    </div>
  );
}

/* =============================== CAIXINHA =================================== */

function CaixinhaTab({ caixinha, config, saldoDisponivel, onDepositar, onResgatar, onAplicarRendimento }) {
  const [valor, setValor] = useState("");
  const rate = taxaMensal(config.cdiPercent);
  const rendimentoProjetado = caixinha.balance * rate;
  const mkAtual = monthKeyFromDateStr(todayStr());
  const jaAplicadoEsseMes = caixinha.history.some((h) => h.type === "rendimento" && h.monthKey === mkAtual);

  const historico = useMemo(
    () => [...caixinha.history].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10),
    [caixinha.history]
  );

  function handleDepositar() {
    const v = Number(String(valor).replace(",", "."));
    if (!v || v <= 0) return;
    if (v > saldoDisponivel) return;
    onDepositar(v);
    setValor("");
  }

  function handleResgatar() {
    const v = Number(String(valor).replace(",", "."));
    if (!v || v <= 0) return;
    if (v > caixinha.balance) return;
    onResgatar(v);
    setValor("");
  }

  return (
    <div className="space-y-4">
      {/* passbook / caderneta — elemento de assinatura visual da aba */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 dark:from-emerald-900 dark:to-slate-950 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="flex items-center gap-2 text-emerald-100">
          <PiggyBank size={18} />
          <span className="text-sm font-medium">Caixinha · {config.cdiPercent}% do CDI</span>
        </div>
        <p className="font-mono-fin text-3xl font-semibold mt-2">{formatBRL(caixinha.balance)}</p>
        <div className="flex items-center gap-1.5 text-emerald-200 text-xs mt-2">
          <TrendingUp size={14} />
          <span>Rendimento projetado este mês: {formatBRL(rendimentoProjetado)}</span>
        </div>
      </div>

      <Card>
        <SectionTitle>Movimentar</SectionTitle>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Saldo disponível fora da caixinha: {formatBRL(saldoDisponivel)}</p>
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className={inputClass + " font-mono-fin mt-3"}
        />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={handleDepositar} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors">
            Depositar
          </button>
          <button onClick={handleResgatar} className="bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 font-medium py-2.5 rounded-lg transition-colors">
            Resgatar
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>Rendimento mensal</SectionTitle>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
          Taxa mensal aproximada: <span className="font-mono-fin text-stone-700 dark:text-stone-200">{(rate * 100).toFixed(3)}%</span>
        </p>
        <button
          onClick={onAplicarRendimento}
          disabled={jaAplicadoEsseMes || caixinha.balance <= 0}
          className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-slate-800 dark:disabled:text-stone-600 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {jaAplicadoEsseMes ? "Rendimento já aplicado neste mês" : `Aplicar rendimento (${formatBRL(rendimentoProjetado)})`}
        </button>
      </Card>

      <div>
        <SectionTitle>Histórico</SectionTitle>
        {historico.length === 0 && <EmptyState text="Nenhuma movimentação na caixinha ainda." />}
        <div className="space-y-2 mt-2">
          {historico.map((h) => (
            <div key={h.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                {h.type === "rendimento" ? <TrendingUp size={15} className="text-indigo-500" /> : h.type === "deposito" ? <ArrowDownCircle size={15} className="text-emerald-600" /> : <Repeat size={15} className="text-stone-400" />}
                <span className="text-stone-600 dark:text-stone-300">
                  {h.type === "rendimento" ? "Rendimento" : h.type === "deposito" ? "Depósito" : "Resgate"}
                </span>
                <span className="text-stone-400 dark:text-stone-500 text-xs">{parseDateLocal(h.date).toLocaleDateString("pt-BR")}</span>
              </div>
              <span className="font-mono-fin text-sm text-stone-700 dark:text-stone-200">{formatBRL(h.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ pequenos helpers de UI ============================ */

const inputClass =
  "w-full bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";

function Card({ children }) {
  return <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-xl p-4">{children}</div>;
}

function SectionTitle({ children }) {
  return <h3 className="font-display font-600 text-sm uppercase tracking-wide text-stone-400 dark:text-stone-500">{children}</h3>;
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8 text-sm text-stone-400 dark:text-stone-500 border border-dashed border-stone-200 dark:border-slate-800 rounded-xl mt-2">
      {text}
    </div>
  );
}
