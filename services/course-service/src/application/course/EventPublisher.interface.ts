export const EVENT_PUBLISHER_TOKEN = Symbol('EVENT_PUBLISHER_TOKEN');

export interface IEventPublisher {
  publish(channel: string, message: any): Promise<void>;
}
