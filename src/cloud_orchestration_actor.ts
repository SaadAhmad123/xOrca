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
