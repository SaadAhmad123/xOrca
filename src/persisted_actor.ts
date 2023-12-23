import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import { WithPersistanceInput } from './types';
import { acquireLock } from './utils';

/**
 * Actor with persistence and locking capabilities
 * 
 * Wraps an underlying actor and handles saving/restoring state 
 * using a lock-enabled StorageManager.
 *
 * Allows specifying a locking mode:
 * - "write" - only lock during write operations
 * - "read-write" - lock during reads and writes
 *
 * Usage:
 * 
 * 1. Construct with params  
 * 2. Call init() to initialize actor 
 * 3. Access actor instance from getter  
 * 4. Call save() periodically to persist state
 * 5. Call close() to cleanup resources
 */
export default class PersistedActor<TLogic extends AnyActorLogic> {
  private params: WithPersistanceInput<TLogic> & {
    persistancePath: string;
  };
  private _actor: undefined | Actor<TLogic>;
  private initiated: Boolean = false
  /**
   * Create new persisted actor instance
   *
   * @param {WithPersistanceInput} params - Inputs for initialization
   *
   * Parameters for initializing the persisted actor
   * @property {string} params.id - Unique actor ID
   * @property {StorageManager} params.storageManager - Storage manager interface
   * @property {function} params.actorCreator - Factory for creating actor instances
   * @property {string} [params.locking] - Optional locking mode
   */
  constructor(params: WithPersistanceInput<TLogic>) {
    this.params = {
      ...params,
      persistancePath: `${params.id}.json`,
    };
  }

  /**
   * Getter for the underlying actor instance.
   * @throws {Error} If actor not yet initialized
   */
  public get actor(): Actor<TLogic> {
    if (!this._actor) {
      throw new Error(
        "No actor available. Use 'open' before fetching the actor",
      );
    }
    return this._actor;
  }

  /**
   * Initializes actor state from storage
   * 
   * 1. Acquires lock if locking=read-write
   * 2. Loads snapshot from storage 
   * 3. Initializes actor via creator fn
   *
   * @throws {Error} If already initiated
   */
  async init() {
    if (this.initiated) {
      throw new Error("Actor already initiated, close it to re-initiate")
    }
    const { locking, persistancePath, storageManager, id, actorCreator } =
      this.params;
    if (locking === 'read-write') {
      await acquireLock(persistancePath, storageManager);
    }
    const snapshotJson = await storageManager.read(persistancePath, '');
    const snapshot: Snapshot<unknown> | undefined = snapshotJson
      ? JSON.parse(snapshotJson)
      : undefined;
    this._actor = actorCreator(id, snapshot);
    this.initiated = true
  }

  /**
   * Save current actor state to storage
   *
   * 1. Acquires lock if locking=write
   * 2. Serializes actor snapshot data
   * 3. Writes state to storage
   * 4. Releases lock if locking=write
   */
  async save() {
    const { locking, persistancePath, storageManager } = this.params;
    if (locking === 'write') {
      await acquireLock(persistancePath, storageManager);
    }
    await storageManager.write(
      JSON.stringify(this.actor.getPersistedSnapshot()),
      persistancePath,
    );
    if (locking === 'write') {
      await storageManager.unlock(persistancePath);
    }
  }

  /**
   * If initiated, Cleanup resources and unlock
   *
   * Releases lock if locking=read-write
   */
  async close() {
    if (!this.initiated) return 
    const { persistancePath, storageManager } = this.params;
    if (this.params.locking === 'read-write') {
      await storageManager.unlock(persistancePath);
    }
    this.initiated = false
    this._actor = undefined    
  }
}

/**
 * Helper to initialize and manage a PersistedActor instance.
 * 
 * Handles setting up and tearing down the actor around a usage callback.
 *
 * @param params - Inputs for creating the PersistedActor
 * @param callback - Async callback to use the actor instance 
 */
export async function withPersistedActor<TLogic extends AnyActorLogic>(
  params: WithPersistanceInput<TLogic>,
  callback: (actor: Actor<TLogic>) => Promise<void>
) {
  const _persistedActor = new PersistedActor(params)
  try {
    await _persistedActor.init()
    await callback(_persistedActor.actor)
    await _persistedActor.save()
  } catch (error) {
    throw error
  } finally {
    await _persistedActor.close()
  }
}