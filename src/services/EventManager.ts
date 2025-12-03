type Listener = (...args: any[]) => void;

class EventManager {
  private listeners: { [event: string]: Listener[] } = {};

  on(event: string, listener: Listener): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);

    return () => {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    };
  }

  emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach(listener => listener(...args));
  }
}

export const eventManager = new EventManager();
