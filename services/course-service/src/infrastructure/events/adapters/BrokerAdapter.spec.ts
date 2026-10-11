import { describe, it, expect } from 'vitest';
import { InMemoryBrokerAdapter } from './InMemoryBrokerAdapter.js';

describe('Message Broker Adapters (Adapter Pattern)', () => {
  it('should publish message through adapted interface', async () => {
    const adapter = new InMemoryBrokerAdapter();
    expect(adapter.isConnected()).toBe(true);

    await adapter.publish('course.published', JSON.stringify({ courseId: 'c1' }));

    const messages = adapter.getMessages('course.published');
    expect(messages.length).toBe(1);
    expect(JSON.parse(messages[0]).courseId).toBe('c1');
  });

  it('should throw error when publishing to disconnected broker', async () => {
    const adapter = new InMemoryBrokerAdapter();
    await adapter.disconnect();

    await expect(adapter.publish('course.published', 'msg')).rejects.toThrow('Cannot publish: broker disconnected');
  });
});
