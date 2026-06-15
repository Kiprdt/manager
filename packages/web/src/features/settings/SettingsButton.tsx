import { useEffect, useState } from 'react';
import {
  useSettings,
  useUpdateSettings,
  useTelegramTest,
  useTelegramDigest,
} from '../../api/settings';
import { Modal } from '../../components/Modal';
import styles from './SettingsButton.module.css';

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const test = useTelegramTest();
  const digest = useTelegramDigest();

  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [llmKey, setLlmKey] = useState('');
  const [llmUrl, setLlmUrl] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');

  useEffect(() => {
    if (settings && open) {
      setToken(settings.telegramBotToken ?? '');
      setChatId(settings.telegramChatId ?? '');
      setEnabled(settings.telegramEnabled);
      setLlmKey(settings.llmApiKey ?? '');
      setLlmUrl(settings.llmBaseUrl ?? '');
      setLlmModel(settings.llmModel ?? '');
      setProxyUrl(settings.proxyUrl ?? '');
    }
  }, [settings, open]);

  const save = () =>
    update.mutate({
      telegramBotToken: token.trim() || null,
      telegramChatId: chatId.trim() || null,
      telegramEnabled: enabled,
      llmApiKey: llmKey.trim() || null,
      llmBaseUrl: llmUrl.trim() || null,
      llmModel: llmModel.trim() || null,
      proxyUrl: proxyUrl.trim() || null,
    });

  const useGemini = () => {
    setLlmUrl('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    setLlmModel('gemini-2.0-flash');
  };

  const result = test.data ?? digest.data;
  const testErr =
    (test.error as Error | null)?.message ?? (digest.error as Error | null)?.message ?? null;

  return (
    <>
      <button className={styles.gear} onClick={() => setOpen(true)} title="Настройки">
        ⚙
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className={styles.box}>
          <h3 className={styles.title}>Настройки · Telegram</h3>
          <p className={styles.hint}>
            Создайте бота через <b>@BotFather</b>, вставьте токен. <b>Chat ID</b> можно узнать у{' '}
            <b>@userinfobot</b>. После сохранения — «Тест».
          </p>

          <label className={styles.field}>
            <span>Bot Token</span>
            <input className={styles.input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-..." />
          </label>
          <label className={styles.field}>
            <span>Chat ID</span>
            <input className={styles.input} value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="напр. 123456789" />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Интеграция включена
          </label>

          {(result || testErr) && (
            <p className={result?.ok ? styles.ok : styles.err}>
              {result?.ok
                ? '✅ Отправлено в Telegram'
                : `Ошибка: ${result?.error ?? testErr}. Проверьте токен/Chat ID и доступ к api.telegram.org (часто нужен VPN/прокси).`}
            </p>
          )}

          <h3 className={styles.title} style={{ marginTop: 8 }}>LLM · анализ и прогноз</h3>
          <p className={styles.hint}>
            Подойдёт любой OpenAI-совместимый API. Для <b>Google AI Studio (Gemini)</b> нажмите «Gemini»
            и вставьте ключ из aistudio.google.com.
            <button type="button" className={styles.linkBtn} onClick={useGemini}>Gemini</button>
          </p>
          <label className={styles.field}>
            <span>API Key</span>
            <input className={styles.input} value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder="ключ LLM" />
          </label>
          <label className={styles.field}>
            <span>Base URL (chat/completions)</span>
            <input className={styles.input} value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)} placeholder="https://.../v1/chat/completions" />
          </label>
          <label className={styles.field}>
            <span>Модель</span>
            <input className={styles.input} value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="gemini-2.0-flash / gpt-4o-mini" />
          </label>

          <h3 className={styles.title} style={{ marginTop: 8 }}>Прокси (для Telegram/LLM)</h3>
          <p className={styles.hint}>
            Нужен, если сервер не может напрямую достучаться до Telegram/Google (блокировки).
            Оставьте пустым при прямом доступе в интернет (например, на сервере).
          </p>
          <label className={styles.field}>
            <span>Proxy URL</span>
            <input className={styles.input} value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="http://127.0.0.1:1080 (пусто = без прокси)" />
          </label>

          {update.isSuccess && <p className={styles.ok}>✅ Настройки сохранены</p>}
          {update.isError && <p className={styles.err}>Не удалось сохранить настройки</p>}

          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? 'Отправка…' : 'Тест'}
            </button>
            <button className={styles.ghost} onClick={() => digest.mutate()} disabled={digest.isPending}>
              {digest.isPending ? 'Отправка…' : 'Отправить дайджест'}
            </button>
            <button className={styles.primary} onClick={save} disabled={update.isPending}>
              {update.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
