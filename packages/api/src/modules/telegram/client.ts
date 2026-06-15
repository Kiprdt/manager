import { proxiedFetch } from '../../lib/proxy-fetch';

// Низкоуровневая обёртка над Telegram Bot API.
// Чистые функции: принимают токен/прокси, не зависят от БД.

const API = 'https://api.telegram.org';

export interface TgResult<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export async function callTelegram<T = unknown>(
  token: string,
  method: string,
  params: Record<string, unknown>,
  proxyUrl?: string | null,
): Promise<TgResult<T>> {
  try {
    const res = await proxiedFetch(
      `${API}/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      },
      proxyUrl ?? undefined,
    );
    return (await res.json()) as TgResult<T>;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : 'network error' };
  }
}

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
}

export function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  opts: { proxyUrl?: string | null; replyMarkup?: unknown; parseMode?: string } = {},
) {
  return callTelegram<TgMessage>(
    token,
    'sendMessage',
    {
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'HTML',
      ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    },
    opts.proxyUrl,
  );
}

export function editMessageText(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  opts: { proxyUrl?: string | null; replyMarkup?: unknown; parseMode?: string } = {},
) {
  return callTelegram<TgMessage>(
    token,
    'editMessageText',
    {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: opts.parseMode ?? 'HTML',
      ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    },
    opts.proxyUrl,
  );
}

export function deleteMessage(
  token: string,
  chatId: string | number,
  messageId: number,
  proxyUrl?: string | null,
) {
  return callTelegram(token, 'deleteMessage', { chat_id: chatId, message_id: messageId }, proxyUrl);
}

export function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  proxyUrl?: string | null,
) {
  return callTelegram(
    token,
    'answerCallbackQuery',
    { callback_query_id: callbackQueryId, ...(text ? { text } : {}) },
    proxyUrl,
  );
}

export function getUpdates(
  token: string,
  offset: number,
  opts: { timeout?: number; proxyUrl?: string | null } = {},
) {
  return callTelegram<unknown[]>(
    token,
    'getUpdates',
    {
      offset,
      timeout: opts.timeout ?? 25,
      allowed_updates: ['message', 'callback_query'],
    },
    opts.proxyUrl,
  );
}
