import { createMachine } from 'xstate';
import {
  CreateOrchestrationMachineOptions,
  OrchestrationMachineConfig,
} from './types';
import { makeOnOrchestrationEvent, makeOnOrchestrationState } from './utils';
import { assignEventDataToContext, assignLogsToContext } from '../utils';

/**
 * Creates an orchestration state machine designed to run in a short-lived serverless environment.
 * The machine returned by this function can be used by the `CloudOrchestrationActor` for execution.
 * This machine adheres to the State Machine defined in XState [XState Documentation](https://stately.ai/docs/machines),
 * with limitations on `invoke` and `delay` functionality, which can be achieved through a microservice in a serverless fleet.
 *
 * @param config - The orchestration machine definition, specifying its structure and behavior.
 * @param options - The options for the configuration of the machine, including emits and transformers.
 * @returns An object containing the created machine, onOrchestrationEvent function, and onOrchestrationState function.
 *
 * @example
 * ```typescript
 * // Example orchestration machine creation:
 * const machine = createOrchestrationMachine<{bookId: string}>({
 *   id: 'RegulatedSummaryStateMachine',
 *   initial: 'FetchData',
 *   context: ({ input }) => ({
 *     bookId: (input as any).bookId,
 *   }),
 *   states: {
 *     FetchData: {
 *       emit: 'onFetchData',
 *       // ... other state configurations ...
 *     },
 *     Summarise: {
 *       emit: 'onSummarise',
 *       // ... other state configurations ...
 *     },
 *     Regulate: {
 *       type: 'parallel',
 *       // ... other state configurations ...
 *     },
 *     Error: { type: 'final' },
 *     Done: { type: 'final' },
 *   },
 * }, {
 *   emits: {
 *     onFetchData: (id, state, {context}) => ({
 *       type: 'cmd.book.fetch',
 *       data: {
 *         bookId: context.bookId
 *       }
 *     }),
 *     // ... other emits configurations ...
 *   },
 *   transformers: {
 *     onSummarySucces: (event) => ({
 *       success: true
 *     }),
 *     // ... other transformers configurations ...
 *   }
 * });
 * ```
 */
export function createOrchestrationMachine<
  TContext extends Record<string, any>,
>(
  config: OrchestrationMachineConfig<TContext>,
  options?: CreateOrchestrationMachineOptions<TContext>,
) {
  return {
    machine: createMachine(
      {
        ...(config as any),
        types: {} as {
          context: TContext;
        },
      },
      {
        actions: {
          ...(options?.actions || {}),
          updateContext: assignEventDataToContext as any,
          updateLogs: assignLogsToContext as any,
        },
        guards: options?.guards,
      },
    ),
    onOrchestrationEvent: makeOnOrchestrationEvent(
      config,
      options?.transformers,
    ),
    onOrchestrationState: makeOnOrchestrationState(config, options?.emits),
  };
}
