import {
  CreateOrchestrationMachineOptions,
  MachineEventSchema,
  OrchestrationMachine,
  OrchestrationMachineConfig,
} from '../types';
import { AnyActorLogic, createMachine } from 'xstate';
import {
  eventSchemaToZod,
  getObjectOnPath,
  makeOnOrchestrationEvent,
  makeOnOrchestrationState,
  safeZodToJSON,
} from './utils';
import {
  assignEventDataToContext,
  assignLogsToContext,
  assignOrchestrationTimeToContext,
  getAllPaths,
} from '../../utils';
import { JsonSchema7Type } from 'zod-to-json-schema';
import * as zod from 'zod';
import { OrchestratorTerms } from '../utils';

/**
 * Creates an orchestration state machine designed to run in a short-lived serverless environment.
 * The machine returned by this function can be used by the `CloudOrchestrationActor` for execution.
 * This machine adheres to the State Machine defined in XState [XState Documentation](https://stately.ai/docs/machines),
 * with limitations on `invoke` and `delay` functionality, which can be achieved through a microservice in a serverless fleet.
 *
 * There are some helper functions out of the box as well. You can pass these via the `actions` in the events parts (`on`). These are:
 * - `updateContext` which will update the context of the machine when a new event is processed.
 * - `updateLogs` which will update the logs of the of machine
 * - `updateCheckpoint` which will log time of the event processed by the orchestration
 *
 * Prohibited context variable name (don't use them or put them in the context):
 * - `__machineLogs` contains the machine logs upon usage of `updateLogs`
 * - `__cloudevent` contains the most recent cloudevent used
 * - `__traceId` contains the string with which you can trace the entire orchestration
 * - `__orchestrationTime` contains the list of all checkpoint times and elapsed times
 *
 * @param config - The orchestration machine definition, specifying its structure and behavior.
 * @param options - The options for the configuration of the machine, including emits and transformers.
 * @returns An object containing the created machine, onOrchestrationEvent function, and onOrchestrationState function.
 *
 * @example
 * ```typescript
import { createOrchestrationMachineV2 } from '../../src/create_orchestration_machine/v2';
import * as zod from 'zod';

type TriState = 'TRUE' | 'FALSE' | 'ERRORED';

export type SummaryStateMachineContext = {
  bookId: string;
  bookData?: string[];
  summary?: string;
  grounded?: TriState;
  compliant?: TriState;
};

export const summaryStateMachine =
  createOrchestrationMachineV2<SummaryStateMachineContext>(
    {
      id: 'RegulatedSummaryStateMachine',
      initial: 'FetchData',
      context: ({ input }) => ({
        ...(input || {}),
        bookId: (input as any).bookId,
      }),
      states: {
        FetchData: {
          eventSchema: {
            type: 'cmd.book.fetch',
            data: zod.object({
              bookId: zod.string(),
            }),
          },
          emit: (id, state, { context }) => ({
            type: 'cmd.book.fetch',
            data: {
              bookId: context.bookId,
            },
          }),
          on: {
            'evt.book.fetch.success': {
              eventSchema: {
                type: 'evt.book.fetch.success',
                data: zod.object({
                  bookData: zod.string().array(),
                }),
              },
              transformer: false,
              target: 'Summarise',
              actions: ['updateContext', 'updateLogs'],
            },
            'books.evt.fetch.error': {
              eventSchema: {
                type: 'books.evt.fetch.error',
                data: zod.object({
                  bookData: zod.string().array(),
                }),
              },
              target: 'Error',
              actions: ['updateContext', 'updateLogs'],
            },
          },
        },
        Summarise: {
          emit: 'cmd.gpt.summary',
          eventSchema: {
            type: 'cmd.gpt.summary',
            data: zod.object({
              content: zod.string().array(),
            }),
          },
          on: {
            'evt.gpt.summary.success': {
              eventSchema: {
                type: 'evt.gpt.summary.success',
                data: zod.object({
                  summary: zod.string(),
                }),
              },
              target: 'Regulate',
              actions: ['updateContext', 'updateLogs'],
            },
            'evt.gpt.summary.error': {
              eventSchema: {
                type: 'evt.gpt.summary.error',
                data: zod.object({
                  error: zod.string(),
                }),
              },
              target: 'Error',
              actions: ['updateContext', 'updateLogs'],
            },
          },
        },
        Regulate: {
          type: 'parallel',
          states: {
            Grounded: {
              initial: 'Check',
              states: {
                Check: {
                  emit: 'cmd.regulations.grounded',
                  eventSchema: {
                    type: 'cmd.regulations.grounded',
                    data: zod.object({
                      content: zod.string().array(),
                      summary: zod.string(),
                    }),
                  },
                  on: {
                    'evt.regulations.grounded.success': {
                      transformer: 'onGroundedSuccess',
                      eventSchema: {
                        type: 'evt.regulations.grounded.success',
                        data: zod.object({
                          grounded: zod.boolean(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.grounded.error': {
                      eventSchema: {
                        type: 'evt.regulations.grounded.error',
                        data: zod.object({
                          error: zod.string(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                  },
                },
                Done: { type: 'final' },
              },
            },
            Compliant: {
              initial: 'Check',
              states: {
                Check: {
                  emit: 'cmd.regulations.compliant',
                  eventSchema: {
                    type: 'cmd.regulations.compliant',
                    data: zod.object({
                      content: zod.string().array(),
                      summary: zod.string(),
                    }),
                  },
                  on: {
                    'evt.regulations.compliant.success': {
                      transformer: true,
                      eventSchema: {
                        type: 'evt.regulations.compliant.success',
                        data: zod.object({
                          content: zod.string().array(),
                          summary: zod.string(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                    'evt.regulations.compliant.error': {
                      eventSchema: {
                        type: 'evt.regulations.compliant.error',
                        data: zod.object({
                          error: zod.string(),
                        }),
                      },
                      target: 'Done',
                      actions: ['updateContext', 'updateLogs'],
                    },
                  },
                },
                Done: { type: 'final' },
              },
            },
          },
          onDone: { target: 'Done' },
        },
        Error: { type: 'final' },
        Done: { type: 'final', emit: 'onDone' },
      },
    },
    {
      emits: {
        'cmd.gpt.summary': (id, state, { context }) => ({
          data: {
            content: context.bookData,
          },
        }),
        'cmd.regulations.grounded': (id, state, { context }) => ({
          data: {
            content: context.bookData,
            summary: context.summary,
          },
        }),
        'cmd.regulations.compliant': (id, state, { context }) => ({
          data: {
            content: context.summary,
          },
        }),
        onDone: (id, state, { context }) => ({
          type: 'notif.done',
          data: context,
        }),
      },
      transformers: {
        'evt.regulations.compliant.success': (event) => {
          return {
            data: {
              compliant: (event?.data?.compliant
                ? 'TRUE'
                : 'FALSE') as TriState,
            },
          };
        },
        'evt.book.fetch.success': (event) => ({
          data: event.data || {},
        }),
        onGroundedSuccess: (event) => {
          return {
            data: {
              grounded: (event?.data?.grounded ? 'TRUE' : 'FALSE') as TriState,
            },
          };
        },
      },
    },
  );
 * ```
 */
export function createOrchestrationMachineV2<
  TContext extends Record<string, any>,
  TEmit extends string = string,
>(
  config: OrchestrationMachineConfig<TContext, TEmit, string | boolean>,
  options?: CreateOrchestrationMachineOptions<TContext>,
) {
  return {
    machine: createMachine(
      {
        ...(config as any),
        types: {} as {
          context: TContext;
        },
        context: ({ input }) => {
          const startTime = Date.now();
          return {
            __traceId: (input as any)?.__traceId,
            __machineLogs: [],
            __cloudevent: undefined,
            __orchestrationTime: [
              {
                event_type: 'init',
                start: startTime,
                checkpoint: startTime,
                elapsed: 0,
              },
            ],
            ...(config?.context?.({ input }) || {}),
          };
        },
      },
      {
        actions: {
          ...(options?.actions || {}),
          updateContext: assignEventDataToContext as any,
          updateLogs: assignLogsToContext as any,
          updateCheckpoint: assignOrchestrationTimeToContext as any,
        },
        guards: options?.guards,
      },
    ),
    onOrchestrationEvent: makeOnOrchestrationEvent(
      config,
      options?.transformers,
    ),
    onOrchestrationState: makeOnOrchestrationState(config, options?.emits),

    getOrchestrationEvents: (
      sourceName?: string,
      initialContextZodSchema?: zod.ZodObject<any>,
    ) => {
      let events = getAllPaths(config)
        .filter((item) => item.path[item.path.length - 1] === 'emit')
        .filter((item) => !item.path.includes('on'))
        .map((item) => item.path.slice(0, -1))
        .map((item) => {
          const obj = getObjectOnPath(item, config);
          return {
            emits: [eventSchemaToZod({
              type:
                obj?.eventSchema?.type ||
                (typeof obj?.emit === 'function' ? undefined : obj?.emit) ||
                '#unknown_event',
              zodDataSchema: obj?.eventSchema?.data || zod.object({}),
              source: OrchestratorTerms.source(sourceName),
            })],
            accepts: Object.entries((obj?.on || {}) as Record<string, any>).map(
              ([key, value]) =>
                eventSchemaToZod({
                  type: value?.eventSchema?.type || key,
                  zodDataSchema: value?.eventSchema?.data || zod.object({}),
                  source: OrchestratorTerms.source(sourceName),
                }),
            ),
          };
        }) as MachineEventSchema[];

      return {
        orchestrationEvents: events,
        orchestrationInit: {
          accepts: [
            eventSchemaToZod({
              type: OrchestratorTerms.start(sourceName),
              zodDataSchema: OrchestratorTerms.startSchema(
                initialContextZodSchema,
              ),
              source: OrchestratorTerms.source(sourceName),
            })
          ],
          emits: [
            ...(config.initial ? [config.initial] : Object.keys(config.states)).map(item => {
              const obj = config.states[item];
              return eventSchemaToZod({
                type:
                  obj?.eventSchema?.type ||
                  (typeof obj?.emit === 'function' ? undefined : obj?.emit) ||
                  '#unknown_event',
                zodDataSchema: obj?.eventSchema?.data || zod.object({}),
                source: OrchestratorTerms.source(sourceName),
              })
            }),
            eventSchemaToZod({
              type: OrchestratorTerms.startError(sourceName),
              zodDataSchema: OrchestratorTerms.errorSchema(),
              source: OrchestratorTerms.source(sourceName),
            }),
          ]
        } as MachineEventSchema,
        orchestrationError: {
          emits: [
            eventSchemaToZod({
              type: OrchestratorTerms.error(sourceName),
              zodDataSchema: OrchestratorTerms.errorSchema(),
              source: OrchestratorTerms.source(sourceName),
            })
          ],
          accepts: Array.from(
            new Set(
              events.reduce(
                (acc, item) => [
                  ...acc,
                  ...item.accepts.map((item) => JSON.stringify(item)),
                ],
                [] as string[],
              ),
            ),
          ).map((item) => JSON.parse(item)),
        } as MachineEventSchema,
      };
    },
  } as OrchestrationMachine<AnyActorLogic>;
}
