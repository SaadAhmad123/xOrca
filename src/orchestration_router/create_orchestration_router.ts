import { AnyActorLogic } from 'xstate';
import { IOrchestrationRouter } from './types';
import OrchectrationRouter from '.';
import { createOrchestrationInitHandler } from './init_handler';
import { createOrchestrationHandler } from './orchestration_handler';
import PersistableActor from '../persistable_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { createOrchestrationSystemErrorHandler } from './orchestration_system_error_handler';

/**
 * Creates an orchestration router for managing the initialization and handling of orchestrations in xOrca.
 *
 * @returns {OrchestratorRouter} - Orchestrator router instance for managing orchestrations.
 */
export function createOrchestrationRouter<TLogic extends AnyActorLogic>(
  params: Omit<IOrchestrationRouter<TLogic>, 'actionMap'>,
) {
  return new OrchectrationRouter({
    name: params.name,
    description: params.description,
    handlers: [
      createOrchestrationInitHandler(params),
      createOrchestrationHandler(params),
      createOrchestrationSystemErrorHandler(params),
    ],
  });
}
