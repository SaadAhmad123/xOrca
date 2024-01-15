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
  Version,
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
  private stateMachineVersion: Version;

  /**
   * Constructor for CloudOrchestrationActor. Initializes the actor with given logic and options.
   * The constructor also configures an inspection handler to process machine snapshots, which is crucial
   * for capturing state changes and orchestrating corresponding cloud events.
   *
   * @param logic - The logic instance that dictates the behavior of the actor.
   * @param options - Optional. Configuration options for the actor. These options include custom middleware
   *                  for cloud event processing, and an optional snapshot for state restoration.
   */
  constructor(
    public logic: TLogic,
    public options: CloudOrchestrationActorOptions<TLogic>,
  ) {
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
        (item) => this.middleware?.onState?.[item]?.(this._id, item, snapshot),
      )
      .map((item) =>
        item
          ? new CloudEvent<Record<string, any>>(
              {
                subject: this._id,
                type: item.type,
                data: item.data,
                datacontenttype: 'application/cloudevents+json; charset=UTF-8',
                source: `/orchestrationActor/xstate/${this.options.name}/${this.options.version}/`,
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
    const transformedData =
      this.middleware?.onCloudEvent?.[event.type]?.(event);
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
  options: CloudOrchestrationActorOptions<TLogic>,
): CloudOrchestrationActor<TLogic> {
  return new CloudOrchestrationActor(logic, options);
}

type InitialOrchestrationEvent<TLogic extends AnyActorLogic> = {
  processId: string;
  context: ContextFrom<TLogic>;
  version: Version;
};

/**
 * Creates a subject string for a given process, name, and version.
 * The subject is encoded in base64 format.
 *
 * @param processId - The ID of the process.
 * @param name - The name associated with the process.
 * @param version - The version of the process.
 * @returns A base64-encoded string representing the subject.
 * @example
 * const subject = makeSubject("12345", "ExampleProcess", "1.0.0");
 * // Result: <A base64 string>
 */
export const makeSubject = (
  processId: string,
  name: string,
  version: Version,
) => {
  const subjectObj = { processId, name, version };
  return Buffer.from(JSON.stringify(subjectObj)).toString('base64');
};

/**
 * Parses a subject string and returns an object with processId, name, and version.
 *
 * @param subject - The base64-encoded subject string.
 * @returns An object containing processId, name, and version.
 * @throws Will throw an error if the subject is invalid or missing required fields.
 * @example
 * const subjectString = <A base64 string>;
 * const parsedSubject = parseSubject(subjectString);
 * // Result: { processId: "12345", name: "ExampleProcess", version: "1.0.0" }
 */
export const parseSubject = (subject: string) => {
  try {
    const obj = JSON.parse(Buffer.from(subject, 'base64').toString('utf-8'));
    if (!obj.processId) throw new Error('No processId is found');
    if (!obj.name) throw new Error('No name is found');
    if (!obj.version) throw new Error('No version is found');
    return obj as {
      processId: string;
      name: string;
      version: Version;
    };
  } catch (err) {
    throw new Error(
      `[orchestrateCloudEvents][parseSubject] Invalid subject=${subject}. Error -> ${
        (err as Error).message
      }`,
    );
  }
};

/**
 * Orchestrates cloud events by processing each event, managing the state with persistent actors,
 * and emitting new cloud events based on the defined orchestration logic.
 *
 * @param param - Parameters for orchestrating cloud events, including state machine logic, storage manager, and middleware.
 * @param events - An array of CloudEvent objects to be processed during the orchestration.
 * @param inits - Optional. An array of initialization objects containing a subject (process ID) and initial context for actors.
 * @returns Promise resolving to an array of CloudEvent objects to be emitted as a result of the orchestration.
 * @throws Error if any cloud event lacks a subject, or if there's an overlap in subjects between events and initialization objects.
 * 
 * @example
 * const orchestrationParams = {
 *   statemachine: [...], // Define state machines
 *   name: "ExampleOrchestrator", // Orchestrator name
 *   storageManager: someStorageManager, // Storage manager for persistent actors
 *   onOrchestrationState: (id, state) => { // middleware for handling orchestration state changes // },
 *   onCloudEvent: (id, event) => { // middleware for handling cloud events during orchestration // },
 *   onSnapshot: (id, snapshot) => { // callback for handling actor snapshots // },
 * };
 * const initialEvents = [
 *   { processId: "123", version: "v1.0", context: {} },
 *   // ... more initialization objects
 * ];
 * const cloudEvents = [
 *   { subject: "123", // cloud event data // },
 *   // ... more cloud events
 * ];
 * const result = await orchestrateCloudEvents(orchestrationParams, cloudEvents, initialEvents);
 * console.log(result.eventsToEmit); // Array of CloudEvents to be emitted
 * console.log(result.processIdContext); // Map of process IDs to their corresponding contexts
 * console.log(result.errors); // Array of errors encountered during orchestration
 */
export async function orchestrateCloudEvents<TLogic extends AnyActorLogic>(
  param: IOrchestrateCloudEvents<TLogic>,
  events: CloudEvent<Record<string, any>>[],
  inits: InitialOrchestrationEvent<TLogic>[] = [],
) {
  const errors: {
    error: string;
    initEvents?: InitialOrchestrationEvent<TLogic>[];
    events?: CloudEvent<Record<string, any>>[];
  }[] = [];
  events = events.filter((e) => Boolean(e?.subject));
  const eventSubjects = Array.from(new Set(events.map((e) => e.subject)));
  const initSubjects = Array.from(new Set(inits.map((e) => e.processId)));
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

  if (
    Array.from(new Set(param.statemachine.map((item) => item.version)))
      .length !== param.statemachine.length
  ) {
    throw new Error(
      `[orchestrateCloudEvents] Duplicate state machine versions found.`,
    );
  }

  const getStateMachine = (version: Version) => {
    const machines = param.statemachine.filter(
      (item) => item.version === version,
    );
    if (!machines.length) {
      throw new Error(
        `[orchestrateCloudEvents][getStateMachine] The state machine name=${
          param.name
        } version=${version} not found. Provided versions are ${param.statemachine
          .map((item) => item.version)
          .join(',')}`,
      );
    }
    return machines[0];
  };

  await Promise.all(
    (inits || []).map(async (initEvent) => {
      try {
        const statemachine = getStateMachine(initEvent.version);
        const subject = makeSubject(
          initEvent.processId,
          param.name,
          statemachine.version,
        );
        return await withPersistableActor<
          TLogic,
          CloudOrchestrationActor<TLogic>
        >(
          {
            id: subject,
            storageManager: param.storageManager,
            actorCreator: (id, snapshot) => {
              if (snapshot)
                throw new Error(
                  `The subject=${id} already exists so it cannot be initiated`,
                );
              return createCloudOrchestrationActor(statemachine.logic, {
                version: statemachine.version,
                name: param.name,
                id,
                snapshot,
                input: initEvent.context,
                middleware: {
                  onState: param.onOrchestrationState,
                  onCloudEvent: param.onCloudEvent,
                },
              });
            },
          },
          async (actor) => {
            actor.start();
            eventsToEmit = [...eventsToEmit, ...actor.eventsToEmit];
            try {
              const snapshot = actor.getSnapshot();
              param?.onSnapshot?.(subject, snapshot);
              processContextMap[subject] = (snapshot as any)?.context;
            } catch (error) {
              console.error(
                JSON.stringify(
                  {
                    processId: subject,
                    error: (error as Error)?.message,
                  },
                  null,
                  2,
                ),
              );
            }
          },
        );
      } catch (e) {
        errors.push({
          error: (e as Error)?.message,
          initEvents: [initEvent],
        });
      }
    }),
  );

  for (const id of Object.keys(subjectToEvents)) {
    console.log({ 'subjectToEvents[id]': subjectToEvents[id] });
    try {
      const { name, version } = parseSubject(id);
      if (name !== param.name) {
        throw new Error(
          `[orchestrateCloudEvents] Event statemachine Name=${name} the given statemachine Name=${param.name}`,
        );
      }
      const statemachine = getStateMachine(version);
      await withPersistableActor<TLogic, CloudOrchestrationActor<TLogic>>(
        {
          id,
          storageManager: param.storageManager,
          actorCreator: (id, snapshot) => {
            if (!snapshot) {
              throw new Error(`The subject=${id} not already initiated.`);
            }
            return createCloudOrchestrationActor(statemachine.logic, {
              name,
              version: statemachine.version,
              id,
              snapshot,
              middleware: {
                onState: param.onOrchestrationState,
                onCloudEvent: param.onCloudEvent,
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
    } catch (e) {
      errors.push({
        error: (e as Error).message,
        events: subjectToEvents[id],
      });
    }
  }

  return {
    eventsToEmit,
    processIdContext: processContextMap,
    errors,
  };
}
