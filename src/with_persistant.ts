import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import StorageManager from './storage_manager';

type WithPersistanceInput<TLogic extends AnyActorLogic> = {
  id: string;
  persistanceLayer: StorageManager;
  actorCreator: (id: string, snapshot?: Snapshot<unknown>) => Actor<TLogic>;
};

/**
 * Enhances an actor with persistence capabilities.
 * @param {WithPersistanceInput - The input parameters for the function.
 * @returns An object containing the enhanced actor and methods for persistence and deletion.
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
