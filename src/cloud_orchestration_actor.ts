import {
  Actor,
  AnyActorLogic,
  AnyMachineSnapshot,
  ContextFrom,
  EventFromLogic,
  InspectedSnapshotEvent,
  InspectionEvent,
} from 'xstate';
import { CloudEvent } from 'cloudevents';
import {
  CloudOrchestratorMiddlewares,
  CloudOrchestrationActorOptions,
  IOrchestrateCloudEvents,
} from './types';
import { getAllPaths } from './utils';
import { withPersistableActor } from './persistable_actor';

/**
 * A specialized Actor class designed for cloud orchestration scenarios. It extends the XState Actor class,
 * incorporating cloud-related functionalities. This actor is capable of handling CloudEvents and orchestrating them
 * based on its internal logic and state, using middleware for custom processing.
 */
export default class CloudOrchestrationActor<
  TLogic extends AnyActorLogic,
> extends Actor<TLogic> {
  private middleware: CloudOrchestratorMiddlewares | undefined;
  private orchestrationEvents: CloudEvent<Record<string, any>>[] = [];
  private _id: string;
  private stateMachineVersion: `${number}.${number}.${number}`;

  /**
   * Constructor for CloudOrchestrationActor. Initializes the actor with given logic and options.
   * The constructor also configures an inspection handler to process machine snapshots, which is crucial
   * for capturing state changes and orchestrating corresponding cloud events.
   *
   * @param logic - The logic instance that dictates the behavior of the actor.
   * @param options - Optional. Configuration options for the actor. These options include custom middleware
   *                  for cloud event processing, and an optional snapshot for state restoration.
   */
  constructor(logic: TLogic, options?: CloudOrchestrationActorOptions<TLogic>) {
    if (!options?.id) {
      throw new Error(
        'The orchestrator must have an id. This must be the orchestration process id',
      );
    }
    const existingSnapshotCount: number = options?.snapshot
      ? getAllPaths((options.snapshot as AnyMachineSnapshot).value || {}).length
      : 0;
    let initiatedCount: number = 0;
    super(logic, {
      ...options,
      inspect: (evt: InspectionEvent) => {
        if (evt.type === '@xstate.snapshot') {
          if (existingSnapshotCount > initiatedCount) {
            initiatedCount += 1;
          } else {
            const _evt: InspectedSnapshotEvent = evt;
            this.processSnapshot(_evt.snapshot as AnyMachineSnapshot);
          }
        }
        options?.inspect?.(evt);
      },
    });
    this._id = options.id;
    this.stateMachineVersion = options.version;
    this.middleware = options?.middleware;
  }

  /**
   * Processes a snapshot of the actor's state machine. This method is responsible for extracting
   * relevant information from the snapshot, determining the appropriate cloud orchestration events,
   * and queuing them for emission. It is typically triggered in response to state changes in the actor.
   *
   * @param snapshot - The snapshot of the state machine, providing a complete picture of the current state.
   */
  private processSnapshot(snapshot: AnyMachineSnapshot) {
    const orchEvts = getAllPaths(snapshot.value)
      .map((item) => {
        return !(item.path || []).length
          ? item.value
          : `${item.path.map((i) => `#${i}`).join('.')}.${item.value}`;
      })
      .map(
        (item) =>
          this.middleware?.orchestration?.[item]?.(this._id, item, snapshot),
      )
      .map((item) =>
        item
          ? new CloudEvent<Record<string, any>>(
              {
                ...item.toJSON(),
                statemachineversion: this.stateMachineVersion,
              },
              true,
            )
          : undefined,
      )
      .filter((item) => Boolean(item)) as CloudEvent<Record<string, any>>[];
    this.orchestrationEvents = [...this.orchestrationEvents, ...orchEvts];
  }

  /**
   * Processes a CloudEvent and dispatches it as an actor event. This method applies any configured
   * middleware to transform the CloudEvent before sending it to the actor's internal state machine.
   * This is essential for integrating external cloud events into the actor's workflow.
   *
   * @public
   * @param {CloudEvent<Record<string, any>>} event - The CloudEvent to be processed. It must be a structured cloudevent,
   *                  [see](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/bindings/http-protocol-binding.md#32-structured-content-mode).
   *                  That is, it must of of type CloudEvent<Record<string, any>> and it must be a JSON event.
   * @throws Error - Throws an error if the 'datacontenttype' of the CloudEvent is not valid, or if
   *                 the 'statemachineversion' specified in the CloudEvent does not match the actor's
   *                 state machine version. The error message provides details about the nature of
   *                 the validation failure.
   */
  cloudevent(event: CloudEvent<Record<string, any>>): void {
    if (
      !event.datacontenttype ||
      !(
        event.datacontenttype.includes('application/cloudevents+json') ||
        event.datacontenttype.includes('application/json')
      )
    ) {
      throw new Error(
        `[cloudevent][Invalid content type] The 'datacontenttype' must be either 'application/cloudevents+json' or 'application/json'. The given is datacontenttype=${event.datacontenttype}`,
      );
    }
    const transformedData = this.middleware?.cloudevent?.[event.type]?.(event);
    const evt = {
      type: transformedData?.type || event.type,
      __cloudevent: event,
      ...(transformedData?.data || event.data || {}),
    } as EventFromLogic<TLogic>;
    const eventVersion: any = (event as any).statemachineversion;
    if (eventVersion && this.stateMachineVersion !== eventVersion) {
      throw new Error(
        `[cloudevent][Invalid state machine version] The event expects state machine version=${eventVersion}, however, the state machine is version=${this.stateMachineVersion}`,
      );
    }
    return this.send(evt);
  }

  /**
   * Getter method that provides the list of orchestrated CloudEvents. These events are ready to be emitted
   * and typically represent the actor's response to state changes or external inputs.
   *
   * @returns An array of CloudEvents that have been prepared for emission, based on the actor's logic and state.
   */
  public get eventsToEmit() {
    return this.orchestrationEvents;
  }
}

/**
 * Factory function for creating instances of CloudOrchestrationActor. This function simplifies the instantiation
 * process, providing a convenient way to create new actors with custom logic and orchestration capabilities.
 *
 * @param logic - The logic instance that dictates the behavior of the actor.
 * @param options - Optional. Configuration options for the actor, including middleware and snapshot handling.
 * @returns A new instance of CloudOrchestrationActor configured with the provided logic and options.
 */
export function createCloudOrchestrationActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: CloudOrchestrationActorOptions<TLogic>,
): CloudOrchestrationActor<TLogic> {
  return new CloudOrchestrationActor(logic, options);
}

/**
 * Orchestrates cloud events by processing each event, managing the state with persistent actors,
 * and emitting new cloud events based on the defined orchestration logic.
 *
 * @param param - Parameters for orchestrating cloud events, including state machine logic, storage manager, and middleware.
 * @param events - An array of CloudEvent objects to be processed during the orchestration.
 * @param inits - Optional. An array of initialization objects containing a subject (process ID) and initial context for actors.
 * @returns Promise resolving to an array of CloudEvent objects to be emitted as a result of the orchestration.
 * @throws Error if any cloud event lacks a subject, or if there's an overlap in subjects between events and initialization objects.
 */
export async function orchestrateCloudEvents<TLogic extends AnyActorLogic>(
  param: IOrchestrateCloudEvents<TLogic>,
  events: CloudEvent<Record<string, any>>[],
  inits: { subject: string; context: ContextFrom<TLogic> }[] = [],
) {
  events = events.filter((e) => Boolean(e?.subject));
  const eventSubjects = Array.from(new Set(events.map((e) => e.subject)));
  const initSubjects = Array.from(new Set(inits.map((e) => e.subject)));
  const uniqueSubjects = Array.from(
    new Set([...eventSubjects, ...initSubjects]),
  );

  if (new Set(initSubjects).size !== initSubjects.length) {
    throw new Error(
      'Duplicate subject ids found in initialization objects. Each init object must have a unique subject id.',
    );
  }
  if (uniqueSubjects.length !== eventSubjects.length + initSubjects.length) {
    throw new Error(
      'Overlap detected: A subject id used for initialization cannot be used for events.',
    );
  }

  let eventsToEmit: CloudEvent<Record<string, any>>[] = [];
  const processContextMap: Record<string, ContextFrom<TLogic>> = {};
  const subjectToEvents = events.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.subject || '']: [...(acc[cur.subject || ''] || []), cur],
    }),
    {} as Record<string, CloudEvent<Record<string, any>>[]>,
  );

  await Promise.all(
    (inits || []).map((initEvent) =>
      withPersistableActor<TLogic, CloudOrchestrationActor<TLogic>>(
        {
          id: initEvent.subject,
          storageManager: param.storageManager,
          actorCreator: (id, snapshot) => {
            if (snapshot)
              throw new Error(
                `The subject=${id} already exists so it cannot be initiated`,
              );
            return createCloudOrchestrationActor(param.statemachine.logic, {
              version: param.statemachine.version,
              id,
              snapshot,
              input: initEvent.context,
              middleware: {
                orchestration: param.onOrchestrationState,
                cloudevent: param.onCloudEvent,
              },
            });
          },
        },
        async (actor) => {
          actor.start();
          eventsToEmit = [...eventsToEmit, ...actor.eventsToEmit];
          try {
            const snapshot = actor.getSnapshot();
            param?.onSnapshot?.(initEvent.subject, snapshot);
            processContextMap[initEvent.subject] = (snapshot as any)?.context;
          } catch (error) {
            console.error(
              JSON.stringify(
                {
                  processId: initEvent.subject,
                  error: (error as Error)?.message,
                },
                null,
                2,
              ),
            );
          }
        },
      ),
    ),
  );

  for (const id of Object.keys(subjectToEvents)) {
    await withPersistableActor<TLogic, CloudOrchestrationActor<TLogic>>(
      {
        id,
        storageManager: param.storageManager,
        actorCreator: (id, snapshot) => {
          if (!snapshot) {
            throw new Error(`The subject=${id} not already initiated.`);
          }
          return createCloudOrchestrationActor(param.statemachine.logic, {
            version: param.statemachine.version,
            id,
            snapshot,
            middleware: {
              orchestration: param.onOrchestrationState,
              cloudevent: param.onCloudEvent,
            },
          });
        },
      },
      async (actor) => {
        actor.start();
        subjectToEvents[id].forEach((evt) => actor.cloudevent(evt));
        eventsToEmit = [...eventsToEmit, ...actor.eventsToEmit];
        try {
          const snapshot = actor.getSnapshot();
          param?.onSnapshot?.(id, snapshot);
          processContextMap[id] = (snapshot as any)?.context;
        } catch (error) {
          console.error(
            JSON.stringify(
              {
                processId: id,
                error: (error as Error)?.message,
              },
              null,
              2,
            ),
          );
        }
      },
    );
  }
  return {
    eventsToEmit,
    processIdContext: processContextMap,
  };
}
