import { BatchManager } from '../../src/batch-manager';

describe('BatchManager', () => {
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('add and queue', () => {
    it('should add items to queue', () => {
      const onFlush = jest.fn();
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'payload1' });
      manager.add({ test: 'payload2' });

      expect(manager.size()).toBe(2);
      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should add items with webhook names', () => {
      const onFlush = jest.fn();
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'payload' }, 'errors');
      expect(manager.size()).toBe(1);
    });
  });

  describe('flush by size', () => {
    it('should auto-flush when batch size reached', async () => {
      jest.useRealTimers(); // Use real timers for setImmediate
      
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 3,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' });
      manager.add({ test: 'msg2' });
      manager.add({ test: 'msg3' });

      // Wait for setImmediate
      await new Promise(setImmediate);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        { payload: { test: 'msg1' }, webhookName: undefined },
        { payload: { test: 'msg2' }, webhookName: undefined },
        { payload: { test: 'msg3' }, webhookName: undefined },
      ]);
      expect(manager.size()).toBe(0);
      
      await manager.destroy();
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should continue queuing after auto-flush', async () => {
      jest.useRealTimers(); // Use real timers for setImmediate
      
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 2,
        intervalMs: 5000,
        onFlush,
      });

      // First batch
      manager.add({ test: 'msg1' });
      manager.add({ test: 'msg2' });
      await new Promise(setImmediate);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(manager.size()).toBe(0);

      // Second batch
      manager.add({ test: 'msg3' });
      expect(manager.size()).toBe(1);

      manager.add({ test: 'msg4' });
      await new Promise(setImmediate);

      expect(onFlush).toHaveBeenCalledTimes(2);
      expect(manager.size()).toBe(0);
      
      await manager.destroy();
      jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('flush by interval', () => {
    it('should auto-flush after interval', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' });
      manager.add({ test: 'msg2' });

      expect(onFlush).not.toHaveBeenCalled();
      expect(manager.size()).toBe(2);

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // Wait for async flush

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(manager.size()).toBe(0);
    });

    it('should not flush empty queue on interval', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      // Advance time without adding items
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should flush multiple times on intervals', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 3000,
        onFlush,
      });

      // First interval
      manager.add({ test: 'msg1' });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(onFlush).toHaveBeenCalledTimes(1);

      // Second interval
      manager.add({ test: 'msg2' });
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      expect(onFlush).toHaveBeenCalledTimes(2);
    });
  });

  describe('manual flush', () => {
    it('should flush on demand', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' });
      manager.add({ test: 'msg2' });

      await manager.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(manager.size()).toBe(0);
    });

    it('should not flush empty queue', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      await manager.flush();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it('should prevent concurrent flushes', async () => {
      jest.useRealTimers(); // Use real timers for setTimeout
      
      let flushCount = 0;
      const onFlush = jest.fn().mockImplementation(async () => {
        flushCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' });

      // Trigger multiple flushes simultaneously
      const flush1 = manager.flush();
      const flush2 = manager.flush();
      const flush3 = manager.flush();

      await Promise.all([flush1, flush2, flush3]);

      // Only one flush should have executed
      expect(flushCount).toBe(1);
      
      await manager.destroy();
      jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('destroy', () => {
    it('should flush pending items on destroy by default', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' });
      manager.add({ test: 'msg2' });

      await manager.destroy();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(manager.size()).toBe(0);
    });

    it('should not flush if flushOnDestroy is false', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
        flushOnDestroy: false,
      });

      manager.add({ test: 'msg1' });

      await manager.destroy();

      expect(onFlush).not.toHaveBeenCalled();
      expect(manager.size()).toBe(0); // Queue cleared
    });

    it('should stop timer on destroy', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      await manager.destroy();

      // Advance time after destroy
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe('isFlushing', () => {
    it('should return false when not flushing', () => {
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush: jest.fn(),
      });

      expect(manager.isFlushing()).toBe(false);
    });

    it('should return true during flush', async () => {
      jest.useRealTimers(); // Use real timers for setTimeout
      
      let isFlushingDuringCallback = false;
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush: async () => {
          isFlushingDuringCallback = manager.isFlushing();
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      });

      manager.add({ test: 'msg' });
      await manager.flush();

      expect(isFlushingDuringCallback).toBe(true);
      expect(manager.isFlushing()).toBe(false);
      
      await manager.destroy();
      jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('webhook names', () => {
    it('should preserve webhook names in batch', async () => {
      const onFlush = jest.fn().mockResolvedValue(undefined);
      const manager = new BatchManager({
        size: 10,
        intervalMs: 5000,
        onFlush,
      });

      manager.add({ test: 'msg1' }, 'errors');
      manager.add({ test: 'msg2' }, 'reports');
      manager.add({ test: 'msg3' }); // no webhook name

      await manager.flush();

      expect(onFlush).toHaveBeenCalledWith([
        { payload: { test: 'msg1' }, webhookName: 'errors' },
        { payload: { test: 'msg2' }, webhookName: 'reports' },
        { payload: { test: 'msg3' }, webhookName: undefined },
      ]);
    });
  });
});
