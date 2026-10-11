import { IMessageBroker } from './MessageBroker.interface.js';

export class InMemoryBrokerAdapter implements IMessageBroker {
  private readonly publishedMessages: Map<string, string[]> = new Map();
  private connected = true;

  async publish(topic: string, message: string): Promise<void> {
    if (!this.connected) {
      throw new Error(`Cannot publish: broker disconnected`);
    }
    const list = this.publishedMessages.get(topic) || [];
    list.push(message);
    this.publishedMessages.set(topic, list);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getMessages(topic: string): string[] {
    return this.publishedMessages.get(topic) || [];
  }

  clear(): void {
    this.publishedMessages.clear();
  }
}
