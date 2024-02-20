import {
  CloudEventHandler,
  CloudEventHandlerFunctionOutput,
} from 'xorca-cloudevent-router';
import * as zod from 'zod';
import { AnyActorLogic } from 'xstate';
import PersistableActor from '../persistable_actor';
import { getStateMachine } from './utils';
import { makeSubject, parseSubject } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { IOrchestrationRouter } from './types';

/**
 * Creates an event handler for orchestrating events in xOrca.
 *
 * @returns {CloudEventHandler} - Cloud event handler for orchestrating events.
 */
export function createOrchestrationHandler<TLogic extends AnyActorLogic>({
  name,
  statemachine,
  storageManager,
  logger,
  onSnapshot,
  locking,
}: IOrchestrationRouter<TLogic>) {
  return new CloudEventHandler<
    `evt.${string}`,
    | 'cmd.{{resource}}'
    | 'notif.{{resource}}'
    | `xorca.orchestrator.${string}.error`
    | `sys.xorca.orchestrator.${string}.error`
  >({
    logger,
    name: `xorca.orchestrator.${name}`,
    description: `[xOrca orchestration handler] This handler deals with the orchestration of the events for the orchestrations which have already been initialized`,
    accepts: {
      type: `evt.{{resource}}`,
      description: [
        'The handler listens to the orcehstration events only. ',
        'These event types are prefixed by `evt.` prefix.',
      ].join(''),
      zodSchema: zod.object({}).describe(''),
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
        type: `xorca.orchestrator.${name}.error`,
        description: [
          'An error that occurs during the process ',
          'of the orchestration. It is mostly due to either being ',
          'unable to access a store via storage manager, a state not already ',
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
    handler: async ({ type, data, params, logger, spanContext, event }) => {
      let persistablActor:
        | PersistableActor<TLogic, CloudOrchestrationActor<TLogic>>
        | undefined = undefined;
      const startTime = performance.now();
      const responses: CloudEventHandlerFunctionOutput<
        | 'cmd.{{resource}}'
        | 'notif.{{resource}}'
        | `xorca.orchestrator.${string}.error`
      >[] = [];
      let subject = 'unknown-subject';
      try {
        subject = event.subject || subject;
        const { name, version } = parseSubject(subject);
        const logic = getStateMachine(name, statemachine, version);
        await logger({
          type: 'START',
          source: `xorca.orchestrator.${name}`,
          spanContext: spanContext,
          startTime,
          input: {
            type,
            data,
          },
          params,
        });
        persistablActor = new PersistableActor({
          id: subject,
          storageManager,
          locking,
          actorCreator: (id, snapshot) => {
            if (!snapshot) {
              throw new Error(`The subject=${id} not already initiated.`);
            }
            return createCloudOrchestrationActor(logic.orchestrationMachine, {
              name,
              version: logic.version,
              id,
              snapshot,
            });
          },
        });
        await persistablActor.init();
        await persistablActor.actor.start();
        await persistablActor.actor.cloudevent(event);
        for (const item of persistablActor.actor.eventsToEmit) {
          responses.push({
            type: item.type as 'cmd.{{resource}}' | 'notif.{{resource}}',
            data: item.data || {},
            subject: item.subject,
            source: `xorca.${name}`,
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
          type: `xorca.orchestrator.${name}.error` as `xorca.orchestrator.${string}.error`,
          data: {
            eventData: data,
            errorMessage: (e as Error)?.message,
            errorName: (e as Error)?.name,
            errorStack: (e as Error)?.stack,
          },
          subject,
          source: `xorca.${name}`,
        });
        await logger({
          type: 'ERROR',
          source: `xorca.orchestrator.${name}`,
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
              source: `xorca.orchestrator.${name}`,
              spanContext: spanContext,
              output: item,
            }),
        ),
      );
      const endTime = performance.now();
      await logger({
        type: 'END',
        source: `xorca.orchestrator.${name}`,
        spanContext: spanContext,
        startTime,
        endTime,
        duration: endTime - startTime,
      });
      return responses;
    },
  });
}
