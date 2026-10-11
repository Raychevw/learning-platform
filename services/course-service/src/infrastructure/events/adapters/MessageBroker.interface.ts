export const MESSAGE_BROKER_TOKEN = Symbol('MESSAGE_BROKER_TOKEN');

export interface IMessageBroker {
  publish(topic: string, message: string): Promise<void>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}
