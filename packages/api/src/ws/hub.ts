import type { WebSocket } from 'ws';
import { WsEvent } from '@life-app/shared';

/**
 * Простой in-process broadcast hub.
 * При горизонтальном масштабировании заменить на Redis pub/sub,
 * не меняя интерфейс broadcast().
 */
type Listener = (event: WsEvent) => void;

class WsHub {
  private clients = new Set<WebSocket>();
  private listeners = new Set<Listener>();

  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
  }

  // Серверная подписка на события (для интеграций, напр. Telegram-синхронизации)
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  broadcast(event: WsEvent): void {
    // Клиентам шлём только тип (для инвалидации кэша) — без payload,
    // чтобы не утекали данные между пользователями по общему сокету.
    const message = JSON.stringify({ type: event.type });
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* подписчик не должен ломать вещание */
      }
    }
  }

  get size(): number {
    return this.clients.size;
  }
}

// Singleton — один хаб на весь процесс
export const hub = new WsHub();
