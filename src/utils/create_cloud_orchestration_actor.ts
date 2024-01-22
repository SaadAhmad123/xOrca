import CloudOrchestrationActor from '../cloud_orchestration_actor';

import { AnyActorLogic } from 'xstate';
import { CloudOrchestrationActorOptions } from '../cloud_orchestration_actor/types';
import { OrchestrationMachine } from '../create_orchestration_machine/types';

/**
 * Factory function for creating instances of CloudOrchestrationActor. This function simplifies the instantiation
 * process, providing a convenient way to create new actors with custom logic and orchestration capabilities.
 *
 * @param logic - The logic instance that dictates the behavior of the actor. Use `createOrchestrationMachine` to create machine.
 * @param options - Optional. Configuration options for the actor, including middleware and snapshot handling.
 * @returns A new instance of CloudOrchestrationActor configured with the provided logic and options.
 */

export function createCloudOrchestrationActor<TLogic extends AnyActorLogic>(
  orchestrationMachine: OrchestrationMachine<TLogic>,
  options: Omit<CloudOrchestrationActorOptions<TLogic>, 'middleware'>,
): CloudOrchestrationActor<TLogic> {
  return new CloudOrchestrationActor(orchestrationMachine.machine, {
    ...options,
    middleware: {
      onOrchestrationEvent: orchestrationMachine.onOrchestrationEvent,
      onOrchestrationState: orchestrationMachine.onOrchestrationState,
    },
  });
}
