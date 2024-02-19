import { CloudEventHandler } from 'xorca-cloudevent-router';
import * as zod from 'zod';
import { AnyActorLogic } from 'xstate';
import PersistableActor from '../persistable_actor';
import { getStateMachine } from './utils';
import { makeSubject } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { IOrchestrationRouter } from './types';

/**
 * Creates an event handler for initializing orchestrations in xOrca.
 *
 * @returns {CloudEventHandler} - Cloud event handler for orchestration initialization.
 */
export function createOrchestrationInitHandler<TLogic extends AnyActorLogic>({
  name,
  statemachine,
  storageManager,
  logger,
  onSnapshot,
  initialContextZodSchema,
}: IOrchestrationRouter<TLogic>) {
  return new CloudEventHandler<
    `xorca.initializer.${string}`,
    | 'cmd.{{resource}}'
    | 'notif.{{resource}}'
    | `xorca.initializer.${string}.error`
    | `sys.xorca.initializer.${string}.error`
  >({
    logger: logger,
    name: `xorca.initializer.${name}`,
    description: `[xOrca initialization handler] This handler deals with the initialization of the orchestration`,
    accepts: {
      type: `xorca.initializer.${name}`,
      description: [
        'Accepts an special init event to initiate the ',
        'orchestration. The event type must be `xorca.initializer.*`. ',
        'For example, `xorca.initializer.book.summarisation`',
      ].join(''),
      zodSchema: zod.object({
        processId: zod
          .string()
          .describe(
            `The process ID seed of the orchestration. It must be a unique id. It is used to generate the storage key and trace id of the orchestration`,
          ),
        context: initialContextZodSchema.describe(
          `The initial data seeded to the orchestration context. e.g. { bookId: "some-book.pdf", status: "pending" }. ${initialContextZodSchema.description}`,
        ),
        version: zod
          .string()
          .regex(/^\d+\.\d+\.\d+$/)
          .optional()
          .describe(
            `The version for the orchestration. If not provided, the latest version will be used. The version must be of format '{number}.{number}.{number}'`,
          ),
      }),
    },
    emits: [
      {
        type: `cmd.{{resource}}`,
        description: [
          'The orchestration router should only be able ',
          'emit event with `cmd.` prefix.',
        ].join(''),
        zodSchema: zod.object({}),
      },
      {
        type: `notif.{{resource}}`,
        description: [
          'The orchestration router should be able ',
          'emit notification events with `notif.` prefix.',
        ].join(''),
        zodSchema: zod.object({}),
      },
      {
        type: `xorca.initializer.${name}.error`,
        description: [
          'An error that occurs during the initialization ',
          'of the orchestration. It is mostly due to either being ',
          'unable to create a store via storage manager, a state already ',
          'exists for the given state machine name, version and the given ',
          'process id or there is a error in the logic of the state machine ',
          'provided.',
        ].join(''),
        zodSchema: zod.object({
          errorName: zod.string().optional().describe('The name of the error'),
          errorMessage: zod
            .string()
            .optional()
            .describe('The message of the error'),
          errorStack: zod
            .string()
            .optional()
            .describe('The stack of the error'),
          eventData: zod.any().optional().describe('The input to the handler'),
        }),
      },
    ],
    handler: async ({ type, data, params, logger, spanContext }) => {
      let persistablActor:
        | PersistableActor<TLogic, CloudOrchestrationActor<TLogic>>
        | undefined = undefined;
      const startTime = performance.now();
      const responses: {
        type:
          | 'cmd.{{resource}}'
          | 'notif.{{resource}}'
          | `xorca.initializer.${string}.error`;
        data: Record<string, any>;
        subject?: string;
        source: string;
        orchestrator: string;
      }[] = [];
      let subject = 'unknown-subject';
      try {
        const { processId, context, version } = data;
        const logic = getStateMachine(name, statemachine, version);
        subject = makeSubject(processId || uuidv4(), name, logic.version);
        await logger({
          type: 'START',
          source: `xorca.initializer.${name}`,
          spanContext: spanContext,
          startTime,
          input: {
            type,
            data,
          },
          params,
        });
        persistablActor = new PersistableActor<
          TLogic,
          CloudOrchestrationActor<TLogic>
        >({
          id: subject,
          storageManager: storageManager,
          actorCreator: (id, snapshot) => {
            if (snapshot)
              throw new Error(
                `An orchestration state with processId=${processId}, orchestration name=${name} and machine version=${version} already exists ==> subject=${subject}`,
              );
            return createCloudOrchestrationActor(logic.orchestrationMachine, {
              version: logic.version,
              name: name,
              id,
              snapshot,
              input: {
                ...context,
                __traceId: spanContext.traceId,
              },
            });
          },
        });
        await persistablActor.init();
        await persistablActor.actor.start();
        for (const item of persistablActor.actor.eventsToEmit) {
          responses.push({
            type: item.type as 'cmd.{{resource}}' | 'notif.{{resource}}',
            data: item.data || {},
            subject: item.subject,
            source: `xorca.initializer.${name}`,
            orchestrator: `xorca.${name}`,
          });
        }
        try {
          const snapshot = persistablActor.actor.getSnapshot();
          onSnapshot?.(subject, snapshot);
        } catch (e) {
          console.log(e);
        }
        await persistablActor.save();
        await persistablActor.close();
      } catch (e) {
        await persistablActor?.close();
        responses.push({
          type: `xorca.initializer.${name}.error` as `xorca.initializer.${string}.error`,
          data: {
            eventData: data,
            errorMessage: (e as Error)?.message,
            errorName: (e as Error)?.name,
            errorStack: (e as Error)?.stack,
          },
          subject,
          source: `xorca.initializer.${name}`,
          orchestrator: `xorca.${name}`,
        });
        await logger({
          type: 'ERROR',
          source: `xorca.initializer.${name}`,
          spanContext: spanContext,
          error: e as Error,
          params,
          input: {
            type,
            data,
          },
        });
      }
      await Promise.all(
        responses.map(
          async (item) =>
            await logger({
              type: 'LOG',
              source: `xorca.initializer.${name}`,
              spanContext: spanContext,
              output: item,
            }),
        ),
      );
      const endTime = performance.now();
      await logger({
        type: 'END',
        source: `xorca.initializer.${name}`,
        spanContext: spanContext,
        startTime,
        endTime,
        duration: endTime - startTime,
      });
      return responses;
    },
  });
}
