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
import { makeSubject } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { IOrchestrationRouter } from './types';
import { OrchestratorTerms } from '../create_orchestration_machine/utils';
import { XOrcaBaseContract } from 'xorca-contract';
import { Version } from '../cloud_orchestration_actor/types';
import {
  SpanStatusCode,
  context as TelemetryContext,
  trace,
} from '@opentelemetry/api';

/**
 * Creates an event handler for initializing orchestrations in xOrca.
 *
 * @returns {CloudEventHandler} - Cloud event handler for orchestration initialization.
 */
export function createOrchestrationInitHandler<TLogic extends AnyActorLogic>({
  name,
  statemachine,
  storageManager,
  onSnapshot,
  initialContextZodSchema,
  enableRoutingMetaData,
  raiseError,
}: IOrchestrationRouter<TLogic>) {
  const contract = new XOrcaBaseContract({
    accepts: {
      /**
       * Accepts an special init event to initiate the
       * orchestration.
       */
      type: OrchestratorTerms.start(name),
      schema: OrchestratorTerms.startSchema(initialContextZodSchema),
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
      [OrchestratorTerms.startError(name)]: OrchestratorTerms.errorSchema(),
    },
  });

  return new CloudEventHandler({
    disableRoutingMetadata: !enableRoutingMetaData,
    description: `[xOrca initialization handler] This handler deals with the initialization of the orchestration`,
    contract: contract,
    handler: async ({ type, params, data, openTelemetry }) => {
      const activeTelemetryContext = getActiveContext(
        openTelemetry.context.traceparent,
      );
      const activeTelemetrySpan = openTelemetry.tracer.startSpan(
        `Orchestration.init<${OrchestratorTerms.source(name)}>.event<${type}>`,
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
            const { processId, context, version } = data;
            subject = makeSubject(
              processId || uuidv4(),
              name,
              version as Version,
            );
            const logic = getStateMachine(
              subject,
              [name],
              statemachine,
              raiseError,
            );
            if (!logic) return [];
            logToSpan(activeTelemetrySpan, {
              level: 'INFO',
              message: `Init orchestration - Started - ${OrchestratorTerms.source(name)}\n\nInput:\n${JSON.stringify(
                {
                  type,
                  data,
                  params,
                },
              )}`,
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
                return createCloudOrchestrationActor(
                  logic.orchestrationMachine,
                  {
                    version: logic.version,
                    name: name,
                    id,
                    snapshot,
                    input: {
                      ...(context as any),
                      __traceId: activeTelemetrySpan.spanContext().traceId,
                    },
                  },
                );
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
              logToSpan(activeTelemetrySpan, {
                level: 'INFO',
                message: `Init orchestrator - Snapshot - ${OrchestratorTerms.source(name)}\n\nStatus: ${(snapshot as any)?.status}\n\nCurrent state: ${JSON.stringify((snapshot as any)?.value || {})}`,
              });
              onSnapshot?.(subject, snapshot);
            } catch (e) {
              logToSpan(activeTelemetrySpan, {
                level: 'ERROR',
                message: `Init orchestrator - Snapshot - ${OrchestratorTerms.source(name)}\n\n${(e as Error).message}\n\nError stack - ${(e as Error).stack}`,
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
              type: OrchestratorTerms.startError(
                name,
              ) as `xorca.${string}.start.error`,
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
              message: `Init Orchestration - Failed - ${OrchestratorTerms.source(name)}\n\n${(e as Error).message}\n\nError stack - ${(e as Error).stack}`,
            });
          }
          logToSpan(activeTelemetrySpan, {
            level: 'INFO',
            message: `Init orchestration - Completed - ${OrchestratorTerms.source(name)}`,
          });
          return responses;
        },
      );
      activeTelemetrySpan.end();
      return result;
    },
  });
}
