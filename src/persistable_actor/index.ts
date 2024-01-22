import { Actor, AnyActorLogic, Snapshot, TagsFrom } from 'xstate';
import { PersistableActorInput } from './types';
import { utils } from 'unified-serverless-storage';

/**
 * A class that extends the functionality of a standard actor with persistence and locking capabilities.
 * It integrates with a storage manager that supports lock-enabled storage, allowing for controlled
 * read/write access to the actor's state.
 *
 * The class offers methods to initialize, save, and close the actor, managing its lifecycle
 * and ensuring data integrity through optional locking during state persistence.
 *
 * Use `withPersistableActor` to use this.
 */
export default class PersistableActor<
  TLogic extends AnyActorLogic,
  TActor extends Actor<TLogic>,
> {
  private params: PersistableActorInput<TLogic, TActor> & {
    persistancePath: string;
  };
  private _actor: undefined | TActor;
  private initiated: Boolean = false;

  /**
   * Constructs a new PersistedActor instance.
   *
   * @param params - The parameters for initializing the persisted actor, including the actor's ID,
   *                 the storage manager to use, and the actor creation logic.
   *                 The optional locking mode determines the lock acquisition strategy.
   */
  constructor(params: PersistableActorInput<TLogic, TActor>) {
    this.params = {
      ...params,
      acquireLockMaxTimeout: params.acquireLockMaxTimeout || 5000,
      persistancePath: `${params.id}.json`,
    };
  }

  /**
   * Provides access to the underlying actor instance, ensuring it has been properly initialized.
   *
   * @throws {Error} Throws an error if the actor has not been initialized yet.
   */
  public get actor(): TActor {
    if (!this._actor) {
      throw new Error(
        "No actor available. Use 'open' before fetching the actor",
      );
    }
    return this._actor;
  }

  /**
   * Initializes the actor by loading its state from the storage and setting it up with the provided actor creator.
   *
   * @param checkForAlreadyInitiated - A flag to prevent re-initialization if the actor has already been initiated.
   * @throws {Error} Throws an error if the actor is already initiated and re-initialization is attempted.
   */
  async init(checkForAlreadyInitiated = true) {
    if (checkForAlreadyInitiated && this.initiated) {
      throw new Error('Actor already initiated, close it to re-initiate');
    }
    const { locking, persistancePath, storageManager, id, actorCreator } =
      this.params;
    if (locking === 'read-write') {
      const timeout = this.params.acquireLockMaxTimeout || 5000;
      const retryDelay = 200;
      await utils.acquireLock(
        persistancePath,
        storageManager,
        timeout / retryDelay,
        retryDelay,
      );
    }
    const snapshotJson = await storageManager.read(persistancePath, '');
    const snapshot: Snapshot<unknown> | undefined = snapshotJson
      ? JSON.parse(snapshotJson)
      : undefined;
    this._actor = actorCreator(id, snapshot);
    this.initiated = true;
  }

  /**
   * Persists the current state of the actor to the storage.
   *
   * The method ensures data integrity by optionally acquiring a lock before writing the actor's state.
   */
  async save() {
    const { locking, persistancePath, storageManager } = this.params;
    if (locking === 'write') {
      const timeout = this.params.acquireLockMaxTimeout || 5000;
      const retryDelay = 200;
      await utils.acquireLock(
        persistancePath,
        storageManager,
        timeout / retryDelay,
        retryDelay,
      );
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
   * Cleans up resources associated with the actor and releases any locks if they were acquired.
   *
   * This method should be called to ensure graceful shutdown of the actor.
   */
  async close() {
    if (!this.initiated) return;
    const { persistancePath, storageManager } = this.params;
    if (this.params.locking === 'read-write') {
      await storageManager.unlock(persistancePath);
    }
    this.initiated = false;
    this._actor = undefined;
  }
}
