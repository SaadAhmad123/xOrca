import { createOrchestrationMachineV2 } from '../v2';
import { BasicContext, OrchestrationMachineConfigV3 } from './types';
import { compileMachine } from './utils';
import * as zod from 'zod';

export function createOrchestrationMachineV3<
  TContext extends Record<string, any>,
  TInput extends Record<string, any> = Record<string, any>,
>(config: OrchestrationMachineConfigV3<TContext, TInput>) {
  const compiledMachine = compileMachine(config);
  return createOrchestrationMachineV2(
    compiledMachine.config,
    {
      emits: compiledMachine.emits,
      guards: compiledMachine.guards,
      actions: compiledMachine.actions,
    },
    true,
  );
}
