import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import StorageManager from './storage_manager';

/**
 * Input interface for withPersistance function
 */
type WithPersistanceInput<TLogic extends AnyActorLogic> = {
  /** 
   * Unique ID for the actor
   */
  id: string;
  /** 
   * Persistance layer for reading/writing actor state
   */
  persistanceLayer: StorageManager;  
  /**
   * Function that creates the actor
   * @param id - Actor ID
   * @param snapshot - Optional persisted actor snapshot  
   */
  actorCreator: (id: string, snapshot?: Snapshot<unknown>) => Actor<TLogic>;  
};

/**
 * Creates an actor with persistence enabled
 * 
 * This wraps an actor creator function to add the ability 
 * to persist and restore actor state.
 * 
 * It initializes the actor by checking for any previously persisted state.
 * If a snapshot is found, it is used to recreate the actor, 
 * otherwise an empty initial actor is created.
 *
 * Persisting works by using the underlying StorageManager interface
 * to save and load JSON serialized actor snapshots.
 * 
 * The returned object contains the initialized actor instance,
 * along with persist() and delete() methods to manage persistence.
 *
 * @returns Object with keys:
 * - actor: The initialized actor instance  
 * - persist: Method to persist current actor state
 * - delete: Method to delete persisted actor state
 */
export default async function withPersistance<TLogic extends AnyActorLogic>({
  id,
  persistanceLayer,
  actorCreator,
}: WithPersistanceInput<TLogic>) {
  const persistancePath = `${id}.json`;
  const snapshotJson = await persistanceLayer.read(persistancePath, '');
  const snapshot: Snapshot<unknown> | undefined = snapshotJson
    ? JSON.parse(snapshotJson)
    : undefined;
  const _actor = actorCreator(id, snapshot);
  return {
    actor: _actor,
    persist: async () => {
      console.log({ data: _actor.getPersistedSnapshot() });
      await persistanceLayer.write(
        JSON.stringify(_actor.getPersistedSnapshot()),
        persistancePath,
      );
    },
    delete: async () => {
      await persistanceLayer.delete(persistancePath);
    },
  };
}

// : Actor<TLogic extends AnyActorLogic>
