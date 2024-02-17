import { Version } from '../cloud_orchestration_actor/types';
import { OrchestrationMachineWithVersion } from '../orchestrate_cloud_events/types';
import { AnyActorLogic } from 'xstate';

export const getStateMachine = <TLogic extends AnyActorLogic>(
  orchestrationRouterName: string,
  statemachine: OrchestrationMachineWithVersion<TLogic>[],
  version?: Version,
) => {
  if (!version) {
    if (!statemachine.length) {
      throw new Error(
        `[orchestrateCloudEvents][getStateMachine] No state machines(name=${orchestrationRouterName}) versions provided`,
      );
    }
    return statemachine[statemachine.length - 1];
  }
  const machines = statemachine.filter((item) => item.version === version);
  if (!machines.length) {
    throw new Error(
      `[orchestrateCloudEvents][getStateMachine] The state machine name=${orchestrationRouterName} version=${version} not found. Provided versions are ${statemachine
        .map((item) => item.version)
        .join(',')}`,
    );
  }
  return machines[0];
};
