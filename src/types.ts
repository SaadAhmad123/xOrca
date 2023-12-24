import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import { StorageManagerWithLocking } from './storage_manager';

/**
 * Input interface for withPersistance function
 */
export type WithPersistanceInput<TLogic extends AnyActorLogic> = {
  /**
   * Unique ID for the actor
   */
  id: string;
  /**
   * Persistance layer for reading/writing actor state
   */
  storageManager: StorageManagerWithLocking;
  /**
   * Function that creates the actor
   * @param id - Actor ID
   * @param snapshot - Optional persisted actor snapshot
   */
  actorCreator: (id: string, snapshot?: Snapshot<unknown>) => Actor<TLogic>;
  /**
   * Locking mode
   *
   * - "write" - only acquire lock on writes
   * - "read-write" - acquire lock on reads and writes
   *
   * This is optional. If not provided, no locking will be done
   */
  locking?: 'write' | 'read-write';
  acquireLockMaxTimeout?: number
};
