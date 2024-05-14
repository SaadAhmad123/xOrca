import Emit from "../Emit";
import Transition from "../Transition";
import { OrchestrationStateConfigV3 } from "../types";
import * as zod from 'zod'

/**
 * Creates an internal echo state to clear the event cache in an orchestrator's memory.
 * This is particularly useful for handling loop-like structures in the state machine.
 *
 * @template TContext - The context type that extends a record of string keys to any type.
 * @param target - The target state to transition to upon successful completion of the event.
 * @returns An object describing the state configuration.
 */
const internalEchoEventState = <TContext extends Record<string, any>>(
  target: string
) => ({
  description: `
    An internal echo state, to flush out the old events
    cache from the orchestrators memory. This is required
    to when there is a loop like structure in the state
    machine.

    This event assumes that the ${'`'}InternalEchoCloudEventHandler${'`'}
    is implement at the orchestration level.
  `,
  emit: new Emit({
    event: "cmd.xorca_internal.echo",
    schema: zod.object({}),
    handler: () => ({})
  }),
  on: [
    new Transition('evt.xorca_internal.echo.success', {
      target
    })
  ]
} as OrchestrationStateConfigV3<TContext>)

export default internalEchoEventState