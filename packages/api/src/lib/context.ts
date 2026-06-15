import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  userId: string;
}

const als = new AsyncLocalStorage<RequestContext>();

// Устанавливает пользователя для текущей асинхронной цепочки (вызов из preHandler)
export function setUserContext(userId: string): void {
  als.enterWith({ userId });
}

// Выполнить функцию в контексте пользователя (для фоновых задач: Telegram и пр.)
export function runWithUser<T>(userId: string, fn: () => T): T {
  return als.run({ userId }, fn);
}

// Текущий пользователь; бросает, если контекста нет (защита от утечки данных)
export function currentUserId(): string {
  const id = als.getStore()?.userId;
  if (!id) throw new Error('Нет пользователя в контексте запроса');
  return id;
}

export function maybeUserId(): string | undefined {
  return als.getStore()?.userId;
}
