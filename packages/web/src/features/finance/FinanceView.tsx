import { useEffect, useMemo, useState } from 'react';
import {
  FinAccount,
  accountCurrentDebt,
  accountUtilization,
  isCreditAccount,
  creditMinPayment,
  creditMonthlyInterest,
} from '@life-app/shared';
import {
  useInstruments,
  useCreateInstrument,
  useDeleteInstrument,
} from '../../api/finance';
import {
  useFinAccounts,
  useCreateFinAccount,
  useUpdateFinAccount,
  useDeleteFinAccount,
} from '../../api/fin-accounts';
import {
  useFinCategories,
  useCreateFinCategory,
  useUpdateFinCategory,
  useDeleteFinCategory,
} from '../../api/fin-categories';
import {
  useFinTransactions,
  useCreateFinTransaction,
  useDeleteFinTransaction,
} from '../../api/fin-transactions';
import {
  useFinBudgets,
  useCreateFinBudget,
  useDeleteFinBudget,
} from '../../api/fin-budgets';
import {
  useFinGoals,
  useCreateFinGoal,
  useUpdateFinGoal,
  useDeleteFinGoal,
} from '../../api/fin-goals';
import {
  useFinRecurrent,
  useCreateFinRecurrent,
  useUpdateFinRecurrent,
  useDeleteFinRecurrent,
  useProcessFinRecurrent,
} from '../../api/fin-recurrent';
import {
  useFinShopping,
  useCreateFinShopping,
  useUpdateFinShopping,
  useDeleteFinShopping,
} from '../../api/fin-shopping';
import { useFinDashboard } from '../../api/fin-dashboard';
import {
  FinCategory,
  FinTransaction,
  FinBudget,
  FinGoal,
  FinRecurrentPayment,
  FinShoppingItem,
  budgetRemaining,
  budgetOverLimit,
  budgetOverThreshold,
  currentMonthYear,
  finGoalProgress,
  shoppingItemTotal,
} from '@life-app/shared';
import { useAnalyze } from '../../api/insights';
import { depositForecast, loanForecast, fmtMoney } from '../../lib/finance';
import { Modal } from '../../components/Modal';
import styles from './FinanceView.module.css';

// Модалка ввода суммы — замена window.prompt (пополнение цели, погашение долга).
function AmountModal({
  open,
  title,
  initial,
  confirmLabel = 'OK',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  initial?: string;
  confirmLabel?: string;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  useEffect(() => {
    if (open) setValue(initial ?? '');
  }, [open, initial]);
  const submit = () => {
    const a = num(value);
    if (a > 0) onConfirm(a);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose}>
      <h3 className={styles.modalTitle}>{title}</h3>
      <input
        className={styles.input}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Сумма"
        inputMode="decimal"
      />
      <div className={styles.modalActions}>
        <button className={styles.modalCancel} onClick={onClose}>Отмена</button>
        <button className={styles.addBtn} onClick={submit}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

type Tab =
  | 'dashboard'
  | 'charts'
  | 'accounts'
  | 'cards'
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'recurrent'
  | 'shopping'
  | 'calc'
  | 'analysis';

export function FinanceView() {
  const [tab, setTab] = useState<Tab>('dashboard');
  return (
    <div className={styles.root}>
      <div className={styles.sheet}>
        <div className={styles.tabs}>
          {([
            ['dashboard', '📊 Сводка'],
            ['charts', '📉 Графики'],
            ['accounts', '🏦 Счета'],
            ['cards', '💳 Кредитки'],
            ['transactions', '🧾 Транзакции'],
            ['categories', '📁 Категории'],
            ['budgets', '💰 Бюджеты'],
            ['goals', '🎯 Цели'],
            ['recurrent', '🔁 Подписки'],
            ['shopping', '🛒 Покупки'],
            ['calc', '📈 Калькулятор'],
            ['analysis', '🔮 Анализ LLM'],
          ] as [Tab, string][]).map(([k, l]) => (
            <button key={k} className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'charts' && <ChartsTab />}
        {tab === 'accounts' && <AccountsTab />}
        {tab === 'cards' && <CreditCardsTab />}
        {tab === 'transactions' && <TransactionsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'budgets' && <BudgetsTab />}
        {tab === 'goals' && <GoalsTab />}
        {tab === 'recurrent' && <RecurrentTab />}
        {tab === 'shopping' && <ShoppingTab />}
        {tab === 'calc' && <CalcTab />}
        {tab === 'analysis' && <AnalysisTab />}
      </div>
    </div>
  );
}

function num(s: string): number {
  return Number(s.replace(/\s/g, '').replace(',', '.')) || 0;
}

function DashboardTab() {
  const { data: d, isLoading } = useFinDashboard();

  if (isLoading || !d) return <div className={styles.body}><span className={styles.empty}>Загрузка…</span></div>;

  const maxExp = Math.max(1, ...d.topExpenses.map((e) => e.amount));
  const budgetPct = d.budgetPlanned > 0 ? Math.min((d.budgetSpent / d.budgetPlanned) * 100, 100) : 0;
  const goalsPct = d.goalsTarget > 0 ? Math.round((d.goalsSaved / d.goalsTarget) * 100) : 0;

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <b style={{ color: d.netWorth >= 0 ? 'var(--text)' : 'var(--accent)' }}>{fmtMoney(d.netWorth)}</b>
          <span>чистые активы{d.byCurrency.length > 1 ? ` (${d.baseCurrency})` : ''} · {d.accountsCount} счетов</span>
        </div>
        <div className={styles.card}>
          <b>{fmtMoney(d.monthIncome)}</b><span>доход за месяц</span>
        </div>
        <div className={styles.card}>
          <b style={{ color: 'var(--accent)' }}>{fmtMoney(d.monthExpense)}</b><span>расход за месяц</span>
        </div>
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <b style={{ color: d.monthNet >= 0 ? 'var(--text)' : 'var(--accent)' }}>{fmtMoney(d.monthNet)}</b>
          <span>баланс месяца</span>
        </div>
        <div className={styles.card}>
          <b style={{ color: d.totalDebt > 0 ? 'var(--accent)' : 'inherit' }}>{fmtMoney(d.totalDebt)}</b>
          <span>долг по кредиткам</span>
        </div>
        <div className={styles.card}>
          <b style={{ color: d.dueRecurrentCount ? 'var(--accent-gold)' : 'inherit' }}>{d.dueRecurrentCount}</b>
          <span>платежей к оплате</span>
        </div>
      </div>

      {d.byCurrency.length > 1 && (
        <div>
          <h4 className={styles.subTitle}>По валютам</h4>
          <div className={styles.list}>
            {d.byCurrency.map((c) => (
              <div key={c.currency} className={styles.row}>
                <span className={styles.rowMain}>{c.currency}</span>
                {c.totalDebt > 0 && (
                  <span style={{ color: 'var(--accent)', fontSize: '0.85em', opacity: 0.8 }}>
                    долг {Math.round(c.totalDebt).toLocaleString('ru-RU')}
                  </span>
                )}
                <span className={styles.amount} style={{ color: c.netWorth >= 0 ? 'var(--text)' : 'var(--accent)' }}>
                  {Math.round(c.netWorth).toLocaleString('ru-RU')} {c.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.budgetPlanned > 0 && (
        <div>
          <h4 className={styles.subTitle}>Бюджеты месяца{d.budgetOverCount > 0 ? ` · превышено: ${d.budgetOverCount}` : ''}</h4>
          <div className={styles.hbarRow}>
            <span className={styles.hbarLabel}>{fmtMoney(d.budgetSpent)} / {fmtMoney(d.budgetPlanned)}</span>
            <div className={styles.hbarTrack}>
              <div className={styles.hbarFill} style={{ width: `${budgetPct}%`, background: d.budgetOverCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }} />
            </div>
            <span className={styles.hbarNum}>{Math.round(budgetPct)}%</span>
          </div>
        </div>
      )}

      {d.topExpenses.length > 0 && (
        <div>
          <h4 className={styles.subTitle}>Расходы по категориям</h4>
          {d.topExpenses.map((e) => (
            <div key={e.category} className={styles.hbarRow}>
              <span className={styles.hbarLabel}>{e.category}</span>
              <div className={styles.hbarTrack}>
                <div className={styles.hbarFill} style={{ width: `${(e.amount / maxExp) * 100}%` }} />
              </div>
              <span className={styles.hbarNum}>{fmtMoney(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {d.goalsCount > 0 && (
        <div>
          <h4 className={styles.subTitle}>Цели · {goalsPct}%</h4>
          <div className={styles.hbarRow}>
            <span className={styles.hbarLabel}>{fmtMoney(d.goalsSaved)} / {fmtMoney(d.goalsTarget)}</span>
            <div className={styles.hbarTrack}>
              <div className={styles.hbarFill} style={{ width: `${goalsPct}%` }} />
            </div>
            <span className={styles.hbarNum}>{d.goalsCount} шт</span>
          </div>
        </div>
      )}

      {d.upcoming.length > 0 && (
        <div>
          <h4 className={styles.subTitle}>Ближайшие платежи</h4>
          <div className={styles.list}>
            {d.upcoming.map((u, idx) => (
              <div key={idx} className={styles.row}>
                <span className={styles.dot} />
                <span className={styles.rowMain}>
                  🔁 {u.name}
                  <span style={{ opacity: 0.6, fontSize: '0.85em' }}> · {new Date(u.nextDate).toLocaleDateString('ru-RU')}</span>
                </span>
                <span className={styles.amount} style={{ color: 'var(--accent)' }}>−{fmtMoney(u.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ACCOUNT_TYPES = ['Наличные', 'Дебетовая', 'Кредитная', 'Вклад', 'Накопительный'];

function AccountsTab() {
  const { data: accounts = [] } = useFinAccounts();
  const create = useCreateFinAccount();
  const update = useUpdateFinAccount();
  const del = useDeleteFinAccount();

  const [name, setName] = useState('');
  const [type, setType] = useState('Дебетовая');
  const [currency, setCurrency] = useState('RUB');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  // Инлайн-редактирование счёта.
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eBalance, setEBalance] = useState('');
  const [eCurrency, setECurrency] = useState('');

  const isCredit = type === 'Кредитная';

  const startEdit = (a: FinAccount) => {
    setEditId(a.id);
    setEName(a.name);
    setEBalance(String(a.balance));
    setECurrency(a.currency);
  };
  const saveEdit = () => {
    if (!editId || !eName.trim()) return;
    update.mutate({
      id: editId,
      dto: { name: eName.trim(), balance: num(eBalance), currency: eCurrency.trim() || 'RUB' },
    });
    setEditId(null);
  };

  const add = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      type,
      currency: currency.trim() || 'RUB',
      balance: num(balance),
      creditLimit: isCredit ? num(creditLimit) : 0,
    });
    setName('');
    setBalance('');
    setCreditLimit('');
  };

  // Итоги: чистые активы = сумма балансов некредитных счетов − долг по кредитным.
  const netWorth = accounts.reduce(
    (s, a) => s + (isCreditAccount(a) ? -accountCurrentDebt(a) : a.balance),
    0,
  );
  const totalDebt = accounts.reduce((s, a) => s + accountCurrentDebt(a), 0);

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <b style={{ color: netWorth >= 0 ? 'var(--text)' : 'var(--accent)' }}>{fmtMoney(netWorth)}</b>
          <span>чистые активы</span>
        </div>
        <div className={styles.card}>
          <b>{accounts.length}</b><span>счетов</span>
        </div>
        <div className={styles.card}>
          <b style={{ color: totalDebt > 0 ? 'var(--accent)' : 'inherit' }}>{fmtMoney(totalDebt)}</b>
          <span>долг по кредиткам</span>
        </div>
      </div>

      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название счёта" />
        <select className={styles.input} style={{ maxWidth: 140 }} value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={styles.input} style={{ maxWidth: 80 }} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="RUB" />
        <input className={styles.input} style={{ maxWidth: 130 }} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder={isCredit ? 'Доступно' : 'Баланс'} inputMode="decimal" />
        {isCredit && (
          <input className={styles.input} style={{ maxWidth: 130 }} value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="Лимит" inputMode="decimal" />
        )}
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {accounts.length === 0 && <span className={styles.empty}>— нет счетов</span>}
        {accounts.map((a: FinAccount) => {
          const credit = isCreditAccount(a);
          const debt = accountCurrentDebt(a);
          const util = accountUtilization(a);
          if (editId === a.id) {
            return (
              <div key={a.id} className={styles.row}>
                <input className={styles.input} autoFocus value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Название" />
                <input className={styles.input} style={{ maxWidth: 130 }} value={eBalance} onChange={(e) => setEBalance(e.target.value)} placeholder={credit ? 'Доступно' : 'Баланс'} inputMode="decimal" onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                <input className={styles.input} style={{ maxWidth: 80 }} value={eCurrency} onChange={(e) => setECurrency(e.target.value)} placeholder="RUB" />
                <button className={styles.addBtn} onClick={saveEdit}>OK</button>
                <button className={styles.del} onClick={() => setEditId(null)}>×</button>
              </div>
            );
          }
          return (
            <div key={a.id} className={styles.row}>
              <span className={styles.dot} style={{ background: a.color || (credit ? 'var(--accent)' : 'var(--text)') }} />
              <span className={styles.rowMain}>
                {credit ? '💳' : '🏦'} {a.name}
                <span style={{ opacity: 0.6, fontSize: '0.85em' }}> · {a.type}</span>
                {credit && (
                  <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                    {' '}· долг {fmtMoney(debt)} / {fmtMoney(a.creditLimit)} ({Math.round(util * 100)}%)
                  </span>
                )}
              </span>
              <span className={styles.amount} style={{ color: credit ? 'var(--accent)' : 'var(--text)' }}>
                {fmtMoney(a.balance)} {a.currency}
              </span>
              <button className={styles.editBtn} title="Изменить" onClick={() => startEdit(a)}>✎</button>
              <button className={styles.del} onClick={() => del.mutate(a.id)}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreditCardsTab() {
  const { data: accounts = [] } = useFinAccounts();
  const create = useCreateFinAccount();
  const update = useUpdateFinAccount();
  const del = useDeleteFinAccount();

  const cards = accounts.filter(isCreditAccount);

  // Создание новой кредитки со всеми параметрами.
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [available, setAvailable] = useState('');
  const [rate, setRate] = useState('');
  const [minPct, setMinPct] = useState('5');
  const [day, setDay] = useState('1');
  // Модалка погашения долга по карте.
  const [payCard, setPayCard] = useState<FinAccount | null>(null);
  // Инлайн-редактирование параметров карты.
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eLimit, setELimit] = useState('');
  const [eRate, setERate] = useState('');
  const [eMin, setEMin] = useState('');
  const [eDay, setEDay] = useState('');

  const startEdit = (c: FinAccount) => {
    setEditId(c.id);
    setEName(c.name);
    setELimit(String(c.creditLimit));
    setERate(String(c.interestRate));
    setEMin(String(c.minPaymentPct));
    setEDay(String(c.paymentDay));
  };
  const saveEdit = () => {
    if (!editId || !eName.trim()) return;
    update.mutate({
      id: editId,
      dto: {
        name: eName.trim(),
        creditLimit: num(eLimit),
        interestRate: num(eRate),
        minPaymentPct: num(eMin) || 5,
        paymentDay: Math.min(31, Math.max(1, Math.round(num(eDay)) || 1)),
      },
    });
    setEditId(null);
  };

  const add = () => {
    const lim = num(limit);
    if (!name.trim() || lim <= 0) return;
    create.mutate({
      name: name.trim(),
      type: 'Кредитная',
      currency: 'RUB',
      balance: available === '' ? lim : num(available),
      creditLimit: lim,
      interestRate: num(rate),
      minPaymentPct: num(minPct) || 5,
      paymentDay: Math.min(31, Math.max(1, Math.round(num(day)) || 1)),
    });
    setName(''); setLimit(''); setAvailable(''); setRate('');
  };

  const totalDebt = cards.reduce((s, c) => s + accountCurrentDebt(c), 0);
  const totalLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalMin = cards.reduce((s, c) => s + creditMinPayment(c), 0);

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}><b style={{ color: 'var(--accent)' }}>{fmtMoney(totalDebt)}</b><span>общий долг</span></div>
        <div className={styles.card}><b>{fmtMoney(totalLimit)}</b><span>суммарный лимит</span></div>
        <div className={styles.card}><b>{fmtMoney(totalMin)}</b><span>мин. платёж/мес</span></div>
      </div>

      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название карты" />
        <input className={styles.input} style={{ maxWidth: 120 }} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Лимит" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 120 }} value={available} onChange={(e) => setAvailable(e.target.value)} placeholder="Доступно" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 90 }} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ставка %" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 90 }} value={minPct} onChange={(e) => setMinPct(e.target.value)} placeholder="Мин. %" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 80 }} value={day} onChange={(e) => setDay(e.target.value)} placeholder="День" inputMode="numeric" />
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {cards.length === 0 && <span className={styles.empty}>— нет кредитных карт</span>}
        {cards.map((c) => {
          const debt = accountCurrentDebt(c);
          const util = accountUtilization(c);
          const utilColor = util >= 0.7 ? 'var(--accent)' : util >= 0.3 ? 'var(--accent-gold)' : 'var(--text)';
          if (editId === c.id) {
            return (
              <div key={c.id} className={styles.row} style={{ flexWrap: 'wrap' }}>
                <input className={styles.input} autoFocus value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Название" />
                <input className={styles.input} style={{ maxWidth: 120 }} value={eLimit} onChange={(e) => setELimit(e.target.value)} placeholder="Лимит" inputMode="decimal" />
                <input className={styles.input} style={{ maxWidth: 90 }} value={eRate} onChange={(e) => setERate(e.target.value)} placeholder="Ставка %" inputMode="decimal" />
                <input className={styles.input} style={{ maxWidth: 90 }} value={eMin} onChange={(e) => setEMin(e.target.value)} placeholder="Мин. %" inputMode="decimal" />
                <input className={styles.input} style={{ maxWidth: 80 }} value={eDay} onChange={(e) => setEDay(e.target.value)} placeholder="День" inputMode="numeric" />
                <button className={styles.addBtn} onClick={saveEdit}>OK</button>
                <button className={styles.del} onClick={() => setEditId(null)}>×</button>
              </div>
            );
          }
          return (
            <div key={c.id} className={styles.row} style={{ flexWrap: 'wrap' }}>
              <span className={styles.rowMain} style={{ flex: '1 1 240px' }}>
                💳 {c.name}
                <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                  {' '}· долг {fmtMoney(debt)} / {fmtMoney(c.creditLimit)} ({Math.round(util * 100)}%)
                  {' '}· ставка {c.interestRate}% · мин. {fmtMoney(creditMinPayment(c))}
                  {' '}· %/мес {fmtMoney(creditMonthlyInterest(c))} · платёж {c.paymentDay}-го
                </span>
              </span>
              <button className={styles.editBtn} title="Изменить" onClick={() => startEdit(c)}>✎</button>
              <button className={styles.editBtn} title="Погасить долг" onClick={() => setPayCard(c)}>₽</button>
              <button className={styles.del} onClick={() => del.mutate(c.id)}>×</button>
              <div className={styles.hbarTrack} style={{ flexBasis: '100%', marginTop: 4 }}>
                <div className={styles.hbarFill} style={{ width: `${util * 100}%`, background: utilColor }} />
              </div>
            </div>
          );
        })}
      </div>

      <AmountModal
        open={payCard !== null}
        title={payCard ? `Погасить долг по «${payCard.name}»` : ''}
        initial={payCard ? String(Math.round(creditMinPayment(payCard))) : ''}
        confirmLabel="Погасить"
        onConfirm={(pay) => {
          if (!payCard) return;
          update.mutate({ id: payCard.id, dto: { balance: Math.min(payCard.creditLimit, payCard.balance + pay) } });
        }}
        onClose={() => setPayCard(null)}
      />
    </div>
  );
}

const CATEGORY_ICONS = ['🛒', '🚗', '🏠', '🎬', '💊', '💼', '🎁', '📈', '✈️', '👕', '📚', '🍔', '☕', '🎮', '💸'];

function CategoriesTab() {
  const { data: categories = [] } = useFinCategories();
  const create = useCreateFinCategory();
  const update = useUpdateFinCategory();
  const del = useDeleteFinCategory();

  const [name, setName] = useState('');
  const [type, setType] = useState('Расход');
  const [icon, setIcon] = useState('💸');
  // Инлайн-редактирование категории.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('💸');
  // Добавление подкатегории к конкретной категории.
  const [subParent, setSubParent] = useState<string | null>(null);
  const [subName, setSubName] = useState('');

  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), type, icon });
    setName('');
    setIcon('💸');
  };

  const addSub = (parent: FinCategory) => {
    if (!subName.trim()) return;
    create.mutate({ name: subName.trim(), type: parent.type, icon: '•', parentId: parent.id });
    setSubName('');
    setSubParent(null);
  };

  const startEdit = (c: FinCategory) => {
    setEditId(c.id);
    setEditName(c.name);
    setEditIcon(c.icon);
  };
  const saveEdit = () => {
    if (!editId || !editName.trim()) return;
    update.mutate({ id: editId, dto: { name: editName.trim(), icon: editIcon } });
    setEditId(null);
  };

  // Только верхнеуровневые (без родителя), сгруппированы по типу.
  const top = categories.filter((c) => !c.parentId);
  const income = top.filter((c) => c.type === 'Доход');
  const expense = top.filter((c) => c.type === 'Расход');

  // Строка категории/подкатегории с инлайн-редактированием.
  const renderRow = (c: FinCategory, isChild: boolean) =>
    editId === c.id ? (
      <div key={c.id} className={styles.row} style={isChild ? { marginLeft: 22 } : undefined}>
        {!isChild && (
          <select className={styles.input} style={{ maxWidth: 70 }} value={editIcon} onChange={(e) => setEditIcon(e.target.value)}>
            {[editIcon, ...CATEGORY_ICONS.filter((i) => i !== editIcon)].map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        <input className={styles.input} autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
        <button className={styles.addBtn} onClick={saveEdit}>OK</button>
        <button className={styles.del} onClick={() => setEditId(null)}>×</button>
      </div>
    ) : (
      <div key={c.id} className={styles.row} style={isChild ? { marginLeft: 22 } : undefined}>
        <span className={styles.rowMain} style={isChild ? { opacity: 0.85 } : undefined}>
          {isChild ? '↳' : c.icon} {c.name}
        </span>
        {!isChild && (
          <button className={styles.editBtn} title="Добавить подкатегорию" onClick={() => { setSubParent(c.id); setSubName(''); }}>＋</button>
        )}
        <button className={styles.editBtn} title="Изменить" onClick={() => startEdit(c)}>✎</button>
        <button className={styles.del} onClick={() => del.mutate(c.id)}>×</button>
      </div>
    );

  const renderGroup = (title: string, items: FinCategory[], color: string) => (
    <div>
      <h4 className={styles.subTitle} style={{ color }}>{title}</h4>
      {items.length === 0 && <span className={styles.empty}>— нет категорий</span>}
      <div className={styles.list}>
        {items.flatMap((c) => {
          const rows = [renderRow(c, false), ...childrenOf(c.id).map((ch) => renderRow(ch, true))];
          if (subParent === c.id) {
            rows.push(
              <div key={`${c.id}-sub`} className={styles.row} style={{ marginLeft: 22 }}>
                <input className={styles.input} autoFocus value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Подкатегория" onKeyDown={(e) => e.key === 'Enter' && addSub(c)} />
                <button className={styles.addBtn} onClick={() => addSub(c)}>OK</button>
                <button className={styles.del} onClick={() => setSubParent(null)}>×</button>
              </div>,
            );
          }
          return rows;
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.body}>
      <div className={styles.addRow}>
        <select className={styles.input} style={{ maxWidth: 70 }} value={icon} onChange={(e) => setIcon(e.target.value)}>
          {CATEGORY_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название категории" />
        <select className={styles.input} style={{ maxWidth: 120 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Расход">Расход</option>
          <option value="Доход">Доход</option>
        </select>
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      {renderGroup('Расходы', expense, 'var(--accent)')}
      {renderGroup('Доходы', income, 'var(--text)')}
    </div>
  );
}

function TransactionsTab() {
  const { data: accounts = [] } = useFinAccounts();
  const { data: categories = [] } = useFinCategories();
  const { data: transactions = [] } = useFinTransactions();
  const create = useCreateFinTransaction();
  const del = useDeleteFinTransaction();

  const [type, setType] = useState<'Доход' | 'Расход' | 'Перевод'>('Расход');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visible, setVisible] = useState(50); // пагинация списка

  const isTransfer = type === 'Перевод';
  const accName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
  const catsForType = categories.filter((c) => !c.parentId && c.type === type);
  // Подкатегории выбранной категории.
  const selectedCat = categories.find((c) => !c.parentId && c.name === category);
  const subcats = selectedCat ? categories.filter((c) => c.parentId === selectedCat.id) : [];

  const add = () => {
    const a = num(amount);
    const acc = accountId || accounts[0]?.id;
    if (a <= 0 || !acc) return;
    if (isTransfer && (!toAccountId || toAccountId === acc)) return;
    create.mutate({
      type,
      amount: a,
      accountId: acc,
      toAccountId: isTransfer ? toAccountId : null,
      category: isTransfer ? null : category || null,
      subcategory: isTransfer ? null : subcategory || null,
      // Выбранная дата в середине дня (стабильно к часовым поясам).
      date: new Date(`${date}T12:00:00`),
      description: description.trim() || null,
    });
    setAmount('');
    setDescription('');
  };

  const sign = (t: string) => (t === 'Доход' ? '+' : t === 'Расход' ? '−' : '→');
  const color = (t: string) => (t === 'Доход' ? 'var(--text)' : t === 'Расход' ? 'var(--accent)' : 'var(--text)');

  return (
    <div className={styles.body}>
      <div className={styles.addRow}>
        <select className={styles.input} style={{ maxWidth: 120 }} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="Расход">Расход</option>
          <option value="Доход">Доход</option>
          <option value="Перевод">Перевод</option>
        </select>
        <input className={styles.input} style={{ maxWidth: 120 }} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" inputMode="decimal" />
        <select className={styles.input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{isTransfer ? 'Со счёта…' : 'Счёт…'}</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {isTransfer ? (
          <select className={styles.input} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">На счёт…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : (
          <select className={styles.input} value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}>
            <option value="">Категория…</option>
            {catsForType.map((c) => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        )}
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>
      <div className={styles.addRow}>
        {!isTransfer && subcats.length > 0 && (
          <select className={styles.input} style={{ maxWidth: 180 }} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">Подкатегория…</option>
            {subcats.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <input className={styles.input} type="date" style={{ maxWidth: 160 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание (необязательно)" />
      </div>

      <div className={styles.list}>
        {accounts.length === 0 && <span className={styles.empty}>— сначала создайте счёт на вкладке «Счета»</span>}
        {accounts.length > 0 && transactions.length === 0 && <span className={styles.empty}>— нет операций</span>}
        {transactions.slice(0, visible).map((t: FinTransaction) => (
          <div key={t.id} className={styles.row}>
            <span className={styles.dot} style={{ background: color(t.type) }} />
            <span className={styles.rowMain}>
              {t.type === 'Перевод'
                ? `${accName(t.accountId)} → ${accName(t.toAccountId)}`
                : `${t.category || t.type}${t.subcategory ? ` / ${t.subcategory}` : ''}`}
              <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                {' '}· {new Date(t.date).toLocaleDateString('ru-RU')} · {accName(t.accountId)}{t.description ? ` · ${t.description}` : ''}
              </span>
            </span>
            <span className={styles.amount} style={{ color: color(t.type) }}>
              {sign(t.type)}{fmtMoney(t.amount)}
            </span>
            <button className={styles.del} onClick={() => del.mutate(t.id)}>×</button>
          </div>
        ))}
        {transactions.length > visible && (
          <button className={styles.moreBtn} onClick={() => setVisible((v) => v + 50)}>
            Показать ещё ({transactions.length - visible})
          </button>
        )}
      </div>
    </div>
  );
}

function BudgetsTab() {
  const monthYear = currentMonthYear();
  const { data: budgets = [] } = useFinBudgets(monthYear);
  const { data: categories = [] } = useFinCategories();
  const create = useCreateFinBudget();
  const del = useDeleteFinBudget();

  const [category, setCategory] = useState('');
  const [planned, setPlanned] = useState('');
  const [threshold, setThreshold] = useState('80');

  const expenseCats = categories.filter((c) => !c.parentId && c.type === 'Расход');

  const add = () => {
    const p = num(planned);
    if (!category || p <= 0) return;
    create.mutate({ category, plannedAmount: p, monthYear, alertThreshold: num(threshold) || 80 });
    setPlanned('');
  };

  const catIcon = (name: string) => categories.find((c) => c.name === name)?.icon ?? '💸';
  const totalPlanned = budgets.reduce((s, b) => s + b.plannedAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spentAmount, 0);

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}><b>{fmtMoney(totalPlanned)}</b><span>план на месяц</span></div>
        <div className={styles.card}><b style={{ color: 'var(--accent)' }}>{fmtMoney(totalSpent)}</b><span>потрачено</span></div>
        <div className={styles.card}>
          <b style={{ color: totalPlanned - totalSpent >= 0 ? 'var(--text)' : 'var(--accent)' }}>{fmtMoney(totalPlanned - totalSpent)}</b>
          <span>остаток</span>
        </div>
      </div>

      <div className={styles.addRow}>
        <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Категория…</option>
          {expenseCats.map((c) => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
        <input className={styles.input} style={{ maxWidth: 130 }} value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="Лимит" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 90 }} value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Порог %" inputMode="numeric" />
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {budgets.length === 0 && <span className={styles.empty}>— нет бюджетов на этот месяц</span>}
        {budgets.map((b: FinBudget) => {
          const pct = b.plannedAmount > 0 ? Math.min((b.spentAmount / b.plannedAmount) * 100, 100) : 0;
          const over = budgetOverLimit(b);
          const warn = budgetOverThreshold(b);
          const barColor = over ? 'var(--accent)' : warn ? 'var(--accent-gold)' : 'var(--text)';
          return (
            <div key={b.id} className={styles.row} style={{ flexWrap: 'wrap' }}>
              <span className={styles.rowMain} style={{ flex: '1 1 200px' }}>
                {catIcon(b.category)} {b.category}
                <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                  {' '}· {fmtMoney(b.spentAmount)} / {fmtMoney(b.plannedAmount)}
                  {' '}· прогноз {fmtMoney(b.forecast)}
                  {warn && !over ? ' ⚠️' : ''}{over ? ' 🔴' : ''}
                </span>
              </span>
              <span className={styles.amount} style={{ color: budgetRemaining(b) >= 0 ? 'var(--text)' : 'var(--accent)' }}>
                {fmtMoney(budgetRemaining(b))}
              </span>
              <button className={styles.del} onClick={() => del.mutate(b.id)}>×</button>
              <div className={styles.hbarTrack} style={{ flexBasis: '100%', marginTop: 4 }}>
                <div className={styles.hbarFill} style={{ width: `${pct}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab() {
  const { data: goals = [] } = useFinGoals();
  const create = useCreateFinGoal();
  const update = useUpdateFinGoal();
  const del = useDeleteFinGoal();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [deadline, setDeadline] = useState('');
  // Модалка пополнения цели.
  const [topUpGoal, setTopUpGoal] = useState<FinGoal | null>(null);

  const add = () => {
    const t = num(target);
    if (!name.trim() || t <= 0) return;
    create.mutate({
      name: name.trim(),
      targetAmount: t,
      currentAmount: num(current),
      deadline: deadline ? new Date(deadline) : null,
    });
    setName('');
    setTarget('');
    setCurrent('');
    setDeadline('');
  };

  return (
    <div className={styles.body}>
      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название цели" />
        <input className={styles.input} style={{ maxWidth: 130 }} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Цель, ₽" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 130 }} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Уже накоплено" inputMode="decimal" />
        <input className={styles.input} style={{ maxWidth: 150 }} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {goals.length === 0 && <span className={styles.empty}>— нет целей</span>}
        {goals.map((g: FinGoal) => {
          const pct = Math.round(finGoalProgress(g) * 100);
          const done = g.currentAmount >= g.targetAmount;
          return (
            <div key={g.id} className={styles.row} style={{ flexWrap: 'wrap' }}>
              <span className={styles.rowMain} style={{ flex: '1 1 200px' }}>
                {done ? '🏆' : '🎯'} {g.name}
                <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                  {' '}· {fmtMoney(g.currentAmount)} / {fmtMoney(g.targetAmount)} ({pct}%)
                  {g.deadline ? ` · до ${new Date(g.deadline).toLocaleDateString('ru-RU')}` : ''}
                </span>
              </span>
              <button className={styles.editBtn} onClick={() => setTopUpGoal(g)} title="Пополнить">＋</button>
              <button className={styles.del} onClick={() => del.mutate(g.id)}>×</button>
              <div className={styles.hbarTrack} style={{ flexBasis: '100%', marginTop: 4 }}>
                <div className={styles.hbarFill} style={{ width: `${pct}%`, background: done ? 'var(--text)' : 'var(--accent)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <AmountModal
        open={topUpGoal !== null}
        title={topUpGoal ? `Пополнить «${topUpGoal.name}»` : ''}
        initial="1000"
        confirmLabel="Пополнить"
        onConfirm={(v) => {
          if (!topUpGoal) return;
          update.mutate({ id: topUpGoal.id, dto: { currentAmount: topUpGoal.currentAmount + v } });
        }}
        onClose={() => setTopUpGoal(null)}
      />
    </div>
  );
}

const FREQUENCIES = ['Ежемесячно', 'Еженедельно', 'Ежедневно', 'Ежегодно'];
// Нормировочный коэффициент к месяцу для оценки месячной нагрузки.
const PER_MONTH: Record<string, number> = {
  Ежедневно: 30,
  Еженедельно: 4.345,
  Ежемесячно: 1,
  Ежегодно: 1 / 12,
};

function RecurrentTab() {
  const { data: accounts = [] } = useFinAccounts();
  const { data: items = [] } = useFinRecurrent();
  const { data: categories = [] } = useFinCategories();
  const create = useCreateFinRecurrent();
  const update = useUpdateFinRecurrent();
  const del = useDeleteFinRecurrent();
  const process = useProcessFinRecurrent();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [frequency, setFrequency] = useState('Ежемесячно');
  const [category, setCategory] = useState('');
  const [nextDate, setNextDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Инлайн-редактирование подписки.
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eFreq, setEFreq] = useState('Ежемесячно');
  const [eDate, setEDate] = useState('');

  const expenseCats = categories.filter((c) => !c.parentId && c.type === 'Расход');

  const startEdit = (p: FinRecurrentPayment) => {
    setEditId(p.id);
    setEName(p.name);
    setEAmount(String(p.amount));
    setEFreq(p.frequency);
    setEDate(new Date(p.nextDate).toISOString().slice(0, 10));
  };
  const saveEdit = () => {
    if (!editId || !eName.trim()) return;
    const a = num(eAmount);
    update.mutate({
      id: editId,
      dto: {
        name: eName.trim(),
        ...(a > 0 ? { amount: a } : {}),
        frequency: eFreq as never,
        nextDate: new Date(eDate),
      },
    });
    setEditId(null);
  };

  const add = () => {
    const a = num(amount);
    const acc = accountId || accounts[0]?.id;
    if (!name.trim() || a <= 0 || !acc) return;
    create.mutate({
      name: name.trim(),
      amount: a,
      accountId: acc,
      frequency: frequency as never,
      category: category || null,
      nextDate: new Date(nextDate),
    });
    setName('');
    setAmount('');
  };

  const accName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const monthlyLoad = items.reduce((s, p) => s + p.amount * (PER_MONTH[p.frequency] ?? 1), 0);
  const dueCount = items.filter((p) => new Date(p.nextDate) <= new Date()).length;

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}><b>{items.length}</b><span>подписок</span></div>
        <div className={styles.card}><b style={{ color: 'var(--accent)' }}>{fmtMoney(monthlyLoad)}</b><span>≈ в месяц</span></div>
        <div className={styles.card}><b style={{ color: dueCount ? 'var(--accent-gold)' : 'inherit' }}>{dueCount}</b><span>к оплате</span></div>
      </div>

      {dueCount > 0 && (
        <button className={styles.addBtn} style={{ alignSelf: 'flex-start' }} disabled={process.isPending} onClick={() => process.mutate()}>
          {process.isPending ? 'Проведение…' : `Провести наступившие (${dueCount})`}
        </button>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (напр. Netflix)" />
        <input className={styles.input} style={{ maxWidth: 110 }} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" inputMode="decimal" />
        <select className={styles.input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Счёт…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className={styles.input} style={{ maxWidth: 130 }} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Категория…</option>
          {expenseCats.map((c) => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
        <input className={styles.input} style={{ maxWidth: 150 }} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {accounts.length === 0 && <span className={styles.empty}>— сначала создайте счёт на вкладке «Счета»</span>}
        {accounts.length > 0 && items.length === 0 && <span className={styles.empty}>— нет подписок</span>}
        {items.map((p: FinRecurrentPayment) => {
          const due = new Date(p.nextDate) <= new Date();
          if (editId === p.id) {
            return (
              <div key={p.id} className={styles.row} style={{ flexWrap: 'wrap' }}>
                <input className={styles.input} autoFocus value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Название" />
                <input className={styles.input} style={{ maxWidth: 110 }} value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="Сумма" inputMode="decimal" />
                <select className={styles.input} style={{ maxWidth: 130 }} value={eFreq} onChange={(e) => setEFreq(e.target.value)}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <input className={styles.input} style={{ maxWidth: 150 }} type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                <button className={styles.addBtn} onClick={saveEdit}>OK</button>
                <button className={styles.del} onClick={() => setEditId(null)}>×</button>
              </div>
            );
          }
          return (
            <div key={p.id} className={styles.row}>
              <span className={styles.dot} style={{ background: due ? 'var(--accent-gold)' : 'var(--accent)' }} />
              <span className={styles.rowMain}>
                🔁 {p.name}
                <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                  {' '}· {p.frequency} · {accName(p.accountId)}{p.category ? ` · ${p.category}` : ''}
                  {' '}· след. {new Date(p.nextDate).toLocaleDateString('ru-RU')}{due ? ' ⏰' : ''}
                </span>
              </span>
              <span className={styles.amount} style={{ color: 'var(--accent)' }}>−{fmtMoney(p.amount)}</span>
              <button className={styles.editBtn} title="Изменить" onClick={() => startEdit(p)}>✎</button>
              <button className={styles.del} onClick={() => del.mutate(p.id)}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SHOPPING_UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'упак'];

function ShoppingTab() {
  const { data: items = [] } = useFinShopping();
  const create = useCreateFinShopping();
  const update = useUpdateFinShopping();
  const del = useDeleteFinShopping();

  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('шт');
  const [price, setPrice] = useState('');

  const add = () => {
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      quantity: num(qty) || 1,
      unit,
      price: num(price),
    });
    setName('');
    setQty('1');
    setPrice('');
  };

  const total = items.reduce((s, i) => s + shoppingItemTotal(i), 0);
  const boughtTotal = items.filter((i) => i.checked).reduce((s, i) => s + shoppingItemTotal(i), 0);
  const left = items.filter((i) => !i.checked).length;

  return (
    <div className={styles.body}>
      <div className={styles.cards}>
        <div className={styles.card}><b>{items.length}</b><span>позиций</span></div>
        <div className={styles.card}><b>{left}</b><span>осталось купить</span></div>
        <div className={styles.card}><b>{fmtMoney(total)}</b><span>сумма · куплено {fmtMoney(boughtTotal)}</span></div>
      </div>

      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Что купить" />
        <input className={styles.input} style={{ maxWidth: 80 }} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Кол-во" inputMode="decimal" />
        <select className={styles.input} style={{ maxWidth: 90 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {SHOPPING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input className={styles.input} style={{ maxWidth: 110 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена" inputMode="decimal" />
        <button className={styles.addBtn} onClick={add}>+</button>
      </div>

      <div className={styles.list}>
        {items.length === 0 && <span className={styles.empty}>— список пуст</span>}
        {items.map((i: FinShoppingItem) => (
          <div key={i.id} className={styles.shopItem}>
            <input
              type="checkbox"
              checked={i.checked}
              onChange={(e) => update.mutate({ id: i.id, dto: { checked: e.target.checked } })}
            />
            <span className={`${styles.shopName} ${i.checked ? styles.shopChecked : ''}`}>
              {i.name}
              <span style={{ opacity: 0.6, fontSize: '0.85em' }}>
                {' '}· {i.quantity} {i.unit}{i.price > 0 ? ` × ${fmtMoney(i.price)}` : ''}
              </span>
            </span>
            {i.price > 0 && (
              <span className={styles.amount} style={{ color: 'var(--text-muted)' }}>{fmtMoney(shoppingItemTotal(i))}</span>
            )}
            <button className={styles.del} onClick={() => del.mutate(i.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Графики ──────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const PIE_COLORS = ['#4ea1ff', '#e5484d', '#c9a44c', '#34c759', '#a855f7', '#14b8a6', '#f97316', '#8a93a3', '#ec4899'];

function aggByCategory(txs: FinTransaction[], type: string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const key = t.category || 'Без категории';
    m.set(key, (m.get(key) ?? 0) + t.amount);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function TrendChart({ months }: { months: { income: number; expense: number }[] }) {
  const W = 520, H = 200, pad = 28;
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const xs = (i: number) => pad + (i * (W - 2 * pad)) / 11;
  const ys = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = (key: 'income' | 'expense', color: string) => (
    <polyline
      points={months.map((m, i) => `${xs(i).toFixed(1)},${ys(m[key]).toFixed(1)}`).join(' ')}
      fill="none"
      stroke={color}
      strokeWidth="2"
    />
  );
  const dots = (key: 'income' | 'expense', color: string) =>
    months.map((m, i) => <circle key={`${key}${i}`} cx={xs(i)} cy={ys(m[key])} r="2.5" fill={color} />);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" />
      {line('income', '#4ea1ff')}
      {line('expense', 'var(--accent)')}
      {dots('income', '#4ea1ff')}
      {dots('expense', 'var(--accent)')}
      {months.map((_, i) => (
        <text key={i} x={xs(i)} y={H - pad + 14} fontSize="9" fill="var(--text-muted)" textAnchor="middle">{MONTHS_SHORT[i]}</text>
      ))}
    </svg>
  );
}

function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <span className={styles.empty}>— нет данных за период</span>;
  let slices = data;
  if (data.length > 8) {
    const rest = data.slice(7).reduce((s, d) => s + d.value, 0);
    slices = [...data.slice(0, 7), { label: 'Прочее', value: rest }];
  }
  const cx = 70, cy = 70, r = 64;
  let angle = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const a0 = angle;
    const a1 = angle + (s.value / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    // Полный круг одной категорией — рисуем окружность.
    if (slices.length === 1) return <circle key={i} cx={cx} cy={cy} r={r} fill={PIE_COLORS[0]} />;
    const d = `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
    return <path key={i} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} />;
  });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" width="140" height="140" role="img">{paths}</svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{s.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>{Math.round((s.value / total) * 100)}% · {fmtMoney(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartsTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { data: yearTx = [] } = useFinTransactions(new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59));

  const [from, setFrom] = useState(() => `${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const { data: periodTx = [] } = useFinTransactions(new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`));

  const months = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    for (const t of yearTx) {
      const m = new Date(t.date).getMonth();
      if (t.type === 'Доход') arr[m].income += t.amount;
      else if (t.type === 'Расход') arr[m].expense += t.amount;
    }
    return arr;
  }, [yearTx]);

  const expensePie = useMemo(() => aggByCategory(periodTx, 'Расход'), [periodTx]);
  const incomePie = useMemo(() => aggByCategory(periodTx, 'Доход'), [periodTx]);

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y);

  const yearTotal = months.reduce((s, m) => ({ income: s.income + m.income, expense: s.expense + m.expense }), { income: 0, expense: 0 });

  return (
    <div className={styles.body}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className={styles.subTitle}>Доходы и расходы по месяцам</h4>
          <select className={styles.input} style={{ maxWidth: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, margin: '2px 0 8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ea1ff' }} />Доходы · {fmtMoney(yearTotal.income)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} />Расходы · {fmtMoney(yearTotal.expense)}</span>
        </div>
        <TrendChart months={months} />
      </div>

      <div className={styles.addRow}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Период:</span>
        <input className={styles.input} type="date" style={{ maxWidth: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className={styles.input} type="date" style={{ maxWidth: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div>
        <h4 className={styles.subTitle}>Расходы по категориям</h4>
        <PieChart data={expensePie} />
      </div>
      <div>
        <h4 className={styles.subTitle}>Доходы по категориям</h4>
        <PieChart data={incomePie} />
      </div>
    </div>
  );
}

function CalcTab() {
  const { data: instruments = [] } = useInstruments();
  const create = useCreateInstrument();
  const del = useDeleteInstrument();

  const [kind, setKind] = useState<'deposit' | 'investment' | 'loan'>('deposit');
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('12');
  const [term, setTerm] = useState('12');
  const [monthly, setMonthly] = useState('0');

  const isLoan = kind === 'loan';
  const calc = useMemo(() => {
    const p = num(principal), r = num(rate), n = Math.max(1, Math.round(num(term))), m = num(monthly);
    return isLoan ? loanForecast(p, r, n) : depositForecast(p, r, n, m);
  }, [principal, rate, term, monthly, isLoan]);

  const maxVal = Math.max(1, ...calc.points.map((p) => p.value));
  const step = Math.max(1, Math.ceil(calc.points.length / 16));

  const save = () => {
    create.mutate({
      kind,
      name: name.trim() || (isLoan ? 'Кредит' : 'Вклад'),
      principal: num(principal),
      annualRate: num(rate),
      termMonths: Math.max(1, Math.round(num(term))),
      monthlyContribution: isLoan ? 0 : num(monthly),
    });
    setName('');
  };

  return (
    <div className={styles.body}>
      <div className={styles.calcForm}>
        <label className={styles.f}><span>Тип</span>
          <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="deposit">Вклад</option>
            <option value="investment">Инвестиция</option>
            <option value="loan">Кредит</option>
          </select>
        </label>
        <label className={styles.f}><span>{isLoan ? 'Сумма кредита' : 'Начальная сумма'}</span>
          <input className={styles.input} value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" />
        </label>
        <label className={styles.f}><span>Ставка, % год.</span>
          <input className={styles.input} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
        </label>
        <label className={styles.f}><span>Срок, мес.</span>
          <input className={styles.input} value={term} onChange={(e) => setTerm(e.target.value)} inputMode="numeric" />
        </label>
        {!isLoan && (
          <label className={styles.f}><span>Пополнение/мес.</span>
            <input className={styles.input} value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" />
          </label>
        )}
      </div>

      <div className={styles.cards}>
        {isLoan ? (
          <>
            <div className={styles.card}><b>{fmtMoney('monthlyPayment' in calc ? calc.monthlyPayment : 0)}</b><span>платёж/мес</span></div>
            <div className={styles.card}><b>{fmtMoney('totalPaid' in calc ? calc.totalPaid : 0)}</b><span>выплатите всего</span></div>
            <div className={styles.card}><b style={{ color: 'var(--accent)' }}>{fmtMoney(calc.totalInterest)}</b><span>переплата</span></div>
          </>
        ) : (
          <>
            <div className={styles.card}><b style={{ color: 'var(--text)' }}>{fmtMoney('finalValue' in calc ? calc.finalValue : 0)}</b><span>через {term} мес.</span></div>
            <div className={styles.card}><b>{fmtMoney('totalContributed' in calc ? calc.totalContributed : 0)}</b><span>вложено</span></div>
            <div className={styles.card}>
              <b style={{ color: 'var(--text)' }}>{fmtMoney(calc.totalInterest)}</b>
              <span>доход{'effectiveYieldPct' in calc ? ` · ${calc.effectiveYieldPct.toFixed(1)}%` : ''}</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.chart}>
        {calc.points.filter((_, i) => i % step === 0).map((p) => (
          <div key={p.month} className={styles.barWrap} title={`мес ${p.month}: ${fmtMoney(p.value)}`}>
            <div className={styles.bar} style={{ height: `${(p.value / maxVal) * 100}%`, background: isLoan ? 'var(--accent)' : 'var(--text)' }} />
            <span className={styles.barLabel}>{p.month}</span>
          </div>
        ))}
      </div>

      <div className={styles.addRow}>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название (сохранить расчёт)" />
        <button className={styles.addBtn} onClick={save}>Сохранить</button>
      </div>

      <div className={styles.list}>
        {instruments.map((i) => (
          <div key={i.id} className={styles.row}>
            <span className={styles.rowMain}>
              {i.kind === 'loan' ? '🏦' : '💎'} {i.name} — {fmtMoney(i.principal)} · {i.annualRate}% · {i.termMonths} мес.
            </span>
            <button className={styles.del} onClick={() => del.mutate(i.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisTab() {
  const analyze = useAnalyze();
  const res = analyze.data;
  return (
    <div className={styles.body}>
      <p className={styles.empty}>
        LLM проанализирует ваши доходы/расходы и инструменты, предложит оптимизацию трат и прогноз бюджета.
      </p>
      <button
        className={styles.addBtn}
        style={{ alignSelf: 'flex-start' }}
        onClick={() => analyze.mutate('Проанализируй мои финансы: структуру доходов и расходов, предложи конкретную оптимизацию трат и дай прогноз бюджета на 3 месяца. Оцени вклады/кредиты, если они есть.')}
        disabled={analyze.isPending}
      >
        {analyze.isPending ? 'Анализ…' : 'Проанализировать финансы'}
      </button>
      {res && !res.configured && (
        <p className={styles.empty}>LLM не настроен — задайте ключ в ⚙ Настройки (раздел LLM).</p>
      )}
      {res?.error && <p className={styles.errText}>Ошибка: {res.error}</p>}
      {res?.text && <div className={styles.result}>{res.text}</div>}
    </div>
  );
}
