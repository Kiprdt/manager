import { WsEvent, WsEventSchema } from '@life-app/shared';

type EventHandler = (event: WsEvent) => void;

/**
 * WebSocket-клиент с автоматическим переподключением (exponential backoff).
 * Максимальная задержка — 30 секунд, чтобы не зависать навсегда при недоступном сервере.
 */
class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxDelay = 30_000;
  private destroyed = false;

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.destroyed || this.socket?.readyState === WebSocket.OPEN) return;

    this.socket = new WebSocket(this.url);

    this.socket.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string);
        // Игнорируем служебные сообщения (connected, ping)
        if (!('type' in raw) || raw.type === 'connected') return;
        const parsed = WsEventSchema.safeParse(raw);
        if (parsed.success) {
          this.handlers.forEach((h) => h(parsed.data));
        }
      } catch {
        // Невалидное сообщение — молча игнорируем
      }
    };

    this.socket.onclose = () => {
      if (this.destroyed) return;
      // Экспоненциальный backoff при переподключении
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
        this.connect();
      }, this.reconnectDelay);
    };

    this.socket.onopen = () => {
      this.reconnectDelay = 1000; // сбрасываем задержку после успешного подключения
    };
  }

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }
}

// База WS: явный VITE_WS_URL, иначе — тот же origin (для деплоя за nginx),
// в dev по умолчанию локальный бэкенд.
function wsBase(): string {
  const env = import.meta.env.VITE_WS_URL;
  if (env) return env;
  if (typeof window !== 'undefined' && window.location.origin) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:3001';
}
export const wsClient = new WsClient(`${wsBase()}/ws`);
