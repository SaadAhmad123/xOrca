import {
  CloudEventHandler,
  CloudEventHandlerFunctionOutput,
} from 'xorca-cloudevent-router';
import * as zod from 'zod';
import { AnyActorLogic } from 'xstate';
import PersistableActor from '../persistable_actor';
import { getStateMachine } from './utils';
import { makeSubject } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { IOrchestrationRouter } from './types';
import { OrchestratorTerms } from '../create_orchestration_machine/utils';

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
  enableRoutingMetaData,
  raiseError,
}: IOrchestrationRouter<TLogic>) {
  return new CloudEventHandler<
    `xorca.${string}.start`,
    | 'cmd.{{resource}}'
    | 'notif.{{resource}}'
    | `xorca.${string}.start.error`
    | `sys.xorca.${string}.start.error`
  >({
    disableRoutingMetadata: !enableRoutingMetaData,
    logger: logger,
    name: OrchestratorTerms.start(name),
    description: `[xOrca initialization handler] This handler deals with the initialization of the orchestration`,
    accepts: {
      type: OrchestratorTerms.start(name),
      description: [
        'Accepts an special init event to initiate the ',
        'orchestration. The event type must be `xorca.initializer.*`. ',
        'For example, `xorca.initializer.book.summarisation`',
      ].join(''),
      zodSchema: OrchestratorTerms.startSchema(initialContextZodSchema),
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
        type: OrchestratorTerms.startError(name),
        description: [
          'An error that occurs during the initialization ',
          'of the orchestration. It is mostly due to either being ',
          'unable to create a store via storage manager, a state already ',
          'exists for the given state machine name, version and the given ',
          'process id or there is a error in the logic of the state machine ',
          'provided.',
        ].join(''),
        zodSchema: OrchestratorTerms.errorSchema(),
      },
    ],
    handler: async ({ type, data, params, logger, spanContext }) => {
      let persistablActor:
        | PersistableActor<TLogic, CloudOrchestrationActor<TLogic>>
        | undefined = undefined;
      const startTime = performance.now();

      const responses: CloudEventHandlerFunctionOutput<
        | 'cmd.{{resource}}'
        | 'notif.{{resource}}'
        | `xorca.${string}.start.error`
      >[] = [];
      let subject = 'unknown-subject';
      try {
        const { processId, context, version } = data;
        subject = makeSubject(processId || uuidv4(), name, version);
        const logic = getStateMachine(
          subject,
          [name],
          statemachine,
          raiseError,
        );
        if (!logic) return [];
        await logger({
          type: 'START',
          source: OrchestratorTerms.source(name), 
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
            source: OrchestratorTerms.source(name),
          });
        }
        try {
          const snapshot = persistablActor.actor.getSnapshot();
          onSnapshot?.(subject, snapshot);
        } catch (e) {
          console.error(e);
        }
        await persistablActor.save();
        await persistablActor.close();
      } catch (e) {
        await persistablActor?.close();
        responses.push({
          type: OrchestratorTerms.startError(name) as `xorca.${string}.start.error`,
          data: {
            eventData: data,
            errorMessage: (e as Error)?.message,
            errorName: (e as Error)?.name,
            errorStack: (e as Error)?.stack,
          },
          subject,
          source: OrchestratorTerms.source(name),
        });
        await logger({
          type: 'ERROR',
          source: OrchestratorTerms.source(name),
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
              source: OrchestratorTerms.source(name),
              spanContext: spanContext,
              output: item,
            }),
        ),
      );
      const endTime = performance.now();
      await logger({
        type: 'END',
        source: OrchestratorTerms.source(name),
        spanContext: spanContext,
        startTime,
        endTime,
        duration: endTime - startTime,
      });
      return responses;
    },
  });
}
