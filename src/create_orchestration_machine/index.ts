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
 * There are some helper functions out of the box as well. You can pass these via the `actions` in the events parts (`on`). These are:
 * - `updateContext` which will update the context of the machine when a new event is processed.
 * - `updateLogs` which will update the logs of the of machine
 *
 * Prohibited context variable name (don't use them or put them in the context):
 * - `__machineLogs` contains the machine logs upon usage of `updateLogs`
 * - `__cloudevent` contains the most recent cloudevent used
 * - `__traceId` contains the string with which you can trace the entire orchestration
 *
 * @param config - The orchestration machine definition, specifying its structure and behavior.
 * @param options - The options for the configuration of the machine, including emits and transformers.
 * @returns An object containing the created machine, onOrchestrationEvent function, and onOrchestrationState function.
 *
 * @example
 * ```typescript
 * export const summaryStateMachine =
 * createOrchestrationMachine<SummaryStateMachineContext>(
 *  {
 *    id: 'RegulatedSummaryStateMachine',
 *    initial: 'FetchData',
 *    context: ({ input }) => ({
 *      ...(input || {}),
 *      bookId: (input as any).bookId,
 *    }),
 *    states: {
 *      FetchData: {
 *        emit: 'cmd.book.fetch',
 *        on: {
 *          'evt.book.fetch.success': {
 *            target: 'Summarise',
 *            actions: ['updateContext', 'updateLogs'],
 *          },
 *          'books.evt.fetch.error': {
 *            target: 'Error',
 *            actions: ['updateContext', 'updateLogs'],
 *          },
 *        },
 *      },
 *      Summarise: {
 *        emit: 'cmd.gpt.summary',
 *        on: {
 *          'evt.gpt.summary.success': {
 *            target: 'Regulate',
 *            actions: ['updateContext', 'updateLogs'],
 *          },
 *          'evt.gpt.summary.error': {
 *            target: 'Error',
 *            actions: ['updateContext', 'updateLogs'],
 *          },
 *        },
 *      },
 *      Regulate: {
 *        type: 'parallel',
 *        states: {
 *          Grounded: {
 *            initial: 'Check',
 *            states: {
 *              Check: {
 *                emit: 'cmd.regulations.grounded',
 *                on: {
 *                  'evt.regulations.grounded.success': {
 *                    target: 'Done',
 *                    actions: ['updateContext', 'updateLogs'],
 *                  },
 *                  'evt.regulations.grounded.error': {
 *                    target: 'Done',
 *                    actions: ['updateContext', 'updateLogs'],
 *                  },
 *                },
 *              },
 *              Done: { type: 'final' },
 *            },
 *          },
 *          Compliant: {
 *            initial: 'Check',
 *            states: {
 *              Check: {
 *                emit: 'cmd.regulations.compliant',
 *                on: {
 *                  'evt.regulations.compliant.success': {
 *                    target: 'Done',
 *                    actions: ['updateContext', 'updateLogs'],
 *                  },
 *                  'evt.regulations.compliant.error': {
 *                    target: 'Done',
 *                    actions: ['updateContext', 'updateLogs'],
 *                  },
 *                },
 *              },
 *              Done: { type: 'final' },
 *            },
 *          },
 *        },
 *        onDone: { target: 'Done' },
 *      },
 *      Error: { type: 'final' },
 *      Done: { type: 'final', emit: 'onDone' },
 *    },
 *  },
 *  {
 *    emits: {
 *      'cmd.book.fetch': (id, state, { context }) => ({
 *        data: {
 *          bookId: context.bookId,
 *        },
 *      }),
 *      'cmd.gpt.summary': (id, state, { context }) => ({
 *        data: {
 *          content: context.bookData,
 *        },
 *      }),
 *      'cmd.regulations.grounded': (id, state, { context }) => ({
 *        data: {
 *          content: context.bookData,
 *          summary: context.summary,
 *        },
 *      }),
 *      'cmd.regulations.compliant': (id, state, { context }) => ({
 *        data: {
 *          content: context.summary,
 *        },
 *      }),
 *      onDone: (id, state, { context }) => ({
 *        type: 'notif.done',
 *        data: context,
 *      }),
 *    },
 *    transformers: {
 *     'evt.book.fetch.success': (event: CloudEvent<Record<string, any>>) => ({
 *       success: true
 *       summary: event.data.summary
 *     }),
 *     // ... other transformers configurations ...
 *   }
 *  },
 *);
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
