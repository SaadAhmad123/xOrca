import {
  CloudEventHandler,
  CloudEventHandlerFunctionOutput,
  getActiveContext,
  logToSpan,
} from 'xorca-cloudevent-router';
import * as zod from 'zod';
import { AnyActorLogic } from 'xstate';
import PersistableActor from '../persistable_actor';
import { getStateMachine } from './utils';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { IOrchestrationRouter } from './types';
import { OrchestratorTerms } from '../create_orchestration_machine/utils';
import { XOrcaBaseContract } from 'xorca-contract';
import {
  SpanStatusCode,
  context as TelemetryContext,
  trace,
} from '@opentelemetry/api';

/**
 * Creates an event handler for orchestrating events in xOrca.
 *
 * @returns {CloudEventHandler} - Cloud event handler for orchestrating events.
 */
export function createOrchestrationSystemErrorHandler<
  TLogic extends AnyActorLogic,
>({
  name,
  statemachine,
  storageManager,
  onSnapshot,
  locking,
  enableRoutingMetaData,
  raiseError,
}: IOrchestrationRouter<TLogic>) {
  const contract = new XOrcaBaseContract({
    accepts: {
      /**
       * The handler listens to the orcehstration events only.
       * These event types are prefixed by `sys.` prefix.
       */
      type: `sys.{{resource}}`,
      schema: zod.object({}),
    },
    emits: {
      /**
       * The orchestration router should only be able
       * emit event with `cmd.` prefix.
       */
      [`cmd.{{resource}}`]: zod.object({}),

      /**
       * The orchestration router should be able
       * emit notification events with `notif.` prefix.
       */
      [`notif.{{resource}}`]: zod.object({}),

      /**
       * An error that occurs during the initialization
       * of the orchestration. It is mostly due to either being
       * unable to create a store via storage manager, a state already
       * exists for the given state machine name, version and the given
       * process id or there is a error in the logic of the state machine
       * provided.
       */
      [OrchestratorTerms.error(name)]: OrchestratorTerms.errorSchema(),
    },
  });

  return new CloudEventHandler({
    disableRoutingMetadata: !enableRoutingMetaData,
    name: `xorca.orchestrator.${name}`,
    description: `[xOrca orchestration handler] This handler deals with the orchestration of the events for the orchestrations which have already been initialized`,
    contract,
    handler: async ({ type, data, params, openTelemetry, event }) => {
      const activeTelemetryContext = getActiveContext(
        openTelemetry.context.traceparent,
      );
      const activeTelemetrySpan = openTelemetry.tracer.startSpan(
        `Orchestration.errorHandler<${OrchestratorTerms.source(name)}>.event<${type}>`,
        {
          attributes: {
            'openinference.span.kind': 'CHAIN',
            'xorca.span.kind': 'ORCHESTRATOR',
          },
        },
        activeTelemetryContext,
      );

      const result = await TelemetryContext.with(
        trace.setSpan(activeTelemetryContext, activeTelemetrySpan),
        async () => {
          let persistablActor:
            | PersistableActor<TLogic, CloudOrchestrationActor<TLogic>>
            | undefined = undefined;
          const responses: CloudEventHandlerFunctionOutput<typeof contract>[] =
            [];
          let subject = 'unknown-subject';
          try {
            subject = event.subject || subject;
            const logic = getStateMachine(
              subject,
              [name],
              statemachine,
              raiseError,
            );
            if (!logic) return [];
            logToSpan(activeTelemetrySpan, {
              level: 'INFO',
              message: `Orchestration Error Handler - Started - ${OrchestratorTerms.source(name)} - Event - ${type}`,
            });
            persistablActor = new PersistableActor({
              id: subject,
              storageManager,
              locking,
              actorCreator: (id, snapshot) => {
                if (!snapshot) {
                  throw new Error(`The subject=${id} not already initiated.`);
                }
                return createCloudOrchestrationActor(
                  logic.orchestrationMachine,
                  {
                    name,
                    version: logic.version,
                    id,
                    snapshot,
                  },
                );
              },
            });
            await persistablActor.init();
            await persistablActor.actor.start();
            activeTelemetrySpan.setAttribute(
              'xorca.orchestration.start_state',
              JSON.stringify(
                (persistablActor?.actor?.getSnapshot() as any)?.value || {},
              ),
            );
            await persistablActor.actor.cloudevent(event.toCloudEvent());
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
              logToSpan(activeTelemetrySpan, {
                level: 'INFO',
                message: `Orchestration Error Handler - Snapshot - ${OrchestratorTerms.source(name)}\n\nStatus: ${(snapshot as any)?.status}\n\nCurrent state: ${JSON.stringify((snapshot as any)?.value || {})}`,
              });
              onSnapshot?.(subject, snapshot);
            } catch (e) {
              logToSpan(activeTelemetrySpan, {
                level: 'ERROR',
                message: `Orchestration Error Handler - Snapshot - ${OrchestratorTerms.source(name)}\n\n${(e as Error).message}\n\nError stack - ${(e as Error).stack}`,
              });
            }
            await persistablActor.save();
            activeTelemetrySpan.setAttribute(
              'xorca.orchestration.end_state',
              JSON.stringify(
                (persistablActor?.actor?.getSnapshot() as any)?.value || {},
              ),
            );
            activeTelemetrySpan.setAttribute(
              'xorca.orchestration.status',
              JSON.stringify(
                (persistablActor?.actor?.getSnapshot() as any)?.status || {},
              ),
            );
            await persistablActor.close();
          } catch (e) {
            await persistablActor?.close();
            responses.push({
              type: OrchestratorTerms.error(
                name,
              ) as `xorca.orchestrator.${string}.error`,
              data: {
                eventData: data,
                errorMessage: (e as Error)?.message,
                errorName: (e as Error)?.name,
                errorStack: (e as Error)?.stack,
              },
              subject,
              source: OrchestratorTerms.source(name),
            });
            activeTelemetrySpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: (e as Error).message,
            });
            logToSpan(activeTelemetrySpan, {
              level: 'CRITICAL',
              message: `Orchestration Error Handler - Failed - ${OrchestratorTerms.source(name)}\n\n${(e as Error).message}\n\nError stack - ${(e as Error).stack}`,
            });
          }
          logToSpan(activeTelemetrySpan, {
            level: 'INFO',
            message: `Orchestration Error Handler - Step Completed - ${OrchestratorTerms.source(name)}`,
          });
          return responses;
        },
      );

      activeTelemetrySpan.end();
      return result;
    },
  });
}
