import { Version } from '../cloud_orchestration_actor/types';
import { parseSubject } from '../utils';
import { VersionedOrchestrationMachine } from './types';
import { AnyActorLogic } from 'xstate';

export const getStateMachine = <TLogic extends AnyActorLogic>(
  subject: string,
  orchestratorNames: string[],
  statemachine: VersionedOrchestrationMachine<TLogic>[],
  raiseError?: {
    onInvalidOrchestratorName: boolean;
  },
) => {
  const orchestrationRouterName: string = orchestratorNames.join(',');
  const parsedSubject = parseSubject(subject);
  if (!orchestrationRouterName.includes(parsedSubject.name)) {
    if (!raiseError?.onInvalidOrchestratorName) return undefined;
    throw new Error(
      `[orchestrationRouter][getStateMachine][Invalid orchestrator name] The provided subject orchestrator name(=${parseSubject.name}) is not the same as the orchestrators name(=${orchestrationRouterName}).`,
    );
  }
  if (!parsedSubject.version) {
    if (!statemachine.length) {
      throw new Error(
        `[orchestrationRouter][getStateMachine] No state machines(name=${orchestrationRouterName}) versions provided`,
      );
    }
    return statemachine[statemachine.length - 1];
  }
  const machines = statemachine.filter(
    (item) => item.version === parsedSubject.version,
  );
  if (!machines.length) {
    throw new Error(
      `[orchestrationRouter][getStateMachine] The state machine name=${orchestrationRouterName} version=${parsedSubject.version} not found. Provided versions are ${statemachine
        .map((item) => item.version)
        .join(',')}`,
    );
  }
  return machines[0];
};
