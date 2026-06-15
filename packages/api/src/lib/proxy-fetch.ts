import { ProxyAgent } from 'undici';

/**
 * fetch с опциональным прокси. Если proxyUrl не задан — обычный прямой fetch
 * (на сервере с прямым доступом в интернет поле оставляют пустым).
 */
export function proxiedFetch(
  url: string,
  init: RequestInit,
  proxyUrl?: string | null,
): Promise<Response> {
  if (proxyUrl && proxyUrl.trim()) {
    const dispatcher = new ProxyAgent(proxyUrl.trim());
    // dispatcher — расширение undici к стандартному fetch
    return fetch(url, { ...init, dispatcher } as RequestInit & { dispatcher: unknown });
  }
  return fetch(url, init);
}
