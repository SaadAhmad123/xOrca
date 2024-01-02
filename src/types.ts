import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import { ILockableStorageManager } from 'unified-serverless-storage';

/**
 * Defines the structure for the input parameters required by the withPersistance function.
 * This interface is crucial for setting up a persistent actor in an XState context,
 * providing necessary details like identification, storage management, and actor creation logic.
 */
export type PersistableActorInput<TLogic extends AnyActorLogic> = {
  /**
   * The unique identifier for the actor. This ID is used to differentiate between
   * multiple instances and is crucial for tracking and managing the state of each actor.
   */
  id: string;

  /**
   * The storage manager responsible for persisting the actor's state.
   * It should implement the ILockableStorageManager interface, which allows for reading and writing
   * data to a storage medium, with optional locking mechanisms for concurrent access control.
   */
  storageManager: ILockableStorageManager;

  /**
   * A factory function that creates an instance of the actor.
   * @param id - The unique identifier of the actor.
   * @param snapshot - An optional parameter that provides a previously persisted snapshot
   *                   of the actor's state, allowing for state restoration.
   */
  actorCreator: (id: string, snapshot?: Snapshot<unknown>) => Actor<TLogic>;

  /**
   * Specifies the locking mode for the actor's persistence operations.
   * - "write": Locks are only acquired during write operations.
   * - "read-write": Locks are acquired during both read and write operations.
   * This parameter is optional. If omitted, no locking mechanism is applied to the operations.
   */
  locking?: 'write' | 'read-write';

  /**
   * The maximum timeout in milliseconds for acquiring a lock.
   * This is an optional parameter that sets a limit on how long the system should wait
   * to acquire a lock before timing out. It's used in conjunction with the locking mechanism.
   */
  acquireLockMaxTimeout?: number;
};
