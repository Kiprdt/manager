import { useAnalyze } from '../../api/insights';
import { API_BASE } from '../../lib/api-client';
import styles from './InsightsPanel.module.css';

export function InsightsPanel() {
  const analyze = useAnalyze();
  const res = analyze.data;

  return (
    <section className={styles.root}>
      <div className={styles.head}>
        <h3 className={styles.title}>🔮 Анализ и прогноз (LLM)</h3>
        <button className={styles.btn} onClick={() => analyze.mutate(undefined)} disabled={analyze.isPending}>
          {analyze.isPending ? 'Анализ…' : 'Проанализировать'}
        </button>
      </div>

      {res && !res.configured && (
        <p className={styles.hint}>
          LLM не настроен. Задайте переменные <code>LLM_API_KEY</code> (и при необходимости{' '}
          <code>LLM_API_URL</code>, <code>LLM_MODEL</code>) в окружении API. Снимок данных уже доступен по{' '}
          <a href={`${API_BASE}/api/insights/snapshot`} target="_blank" rel="noreferrer">/api/insights/snapshot</a>{' '}
          — его можно отправить в свой LLM.
        </p>
      )}
      {res?.error && (
        <p className={styles.err}>
          Ошибка: {res.error}. Если «fetch failed» — сервер не смог подключиться к LLM (проверьте
          ключ/URL и доступ к сети; для Google в РФ часто нужен VPN/прокси).
        </p>
      )}
      {res?.text && <div className={styles.result}>{res.text}</div>}
      {!res && (
        <p className={styles.hint}>
          Соберёт компактный снимок ваших данных (задачи, привычки, здоровье, время по зонам) и попросит
          LLM дать краткий анализ и прогноз на неделю.
        </p>
      )}
    </section>
  );
}
