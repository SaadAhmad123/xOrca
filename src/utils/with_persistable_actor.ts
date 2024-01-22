import PersistableActor from '../persistable_actor';

import { AnyActorLogic, Actor } from 'xstate';
import { PersistableActorInput } from '../persistable_actor/types';

/**
 * Helper function for managing the lifecycle of a PersistableActor.
 * Facilitates the use of PersistableActor by handling initialization, action execution,
 * state persistence, and cleanup in an organized way.
 *
 * @param params - Parameters for creating the PersistableActor.
 * @param callback - An asynchronous callback function for performing actions with the actor instance.
 * @throws {Error} - Propagates any errors that occur during the actor's lifecycle.
 */
export async function withPersistableActor<
  TLogic extends AnyActorLogic,
  TActor extends Actor<TLogic>,
>(
  params: PersistableActorInput<TLogic, TActor>,
  callback: (actor: TActor) => Promise<void>,
) {
  const _persistedActor = new PersistableActor<TLogic, TActor>(params);
  try {
    await _persistedActor.init();
    await callback(_persistedActor.actor);
    await _persistedActor.save();
  } catch (error) {
    throw error;
  } finally {
    await _persistedActor.close();
  }
}
