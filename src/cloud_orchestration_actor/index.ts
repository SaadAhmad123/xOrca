import {
  Actor,
  AnyActorLogic,
  AnyMachineSnapshot,
  EventFromLogic,
  InspectedSnapshotEvent,
  InspectionEvent,
} from 'xstate';
import { CloudEvent } from 'cloudevents';
import {
  CloudOrchestrationMiddlewares,
  CloudOrchestrationActorOptions,
  Version,
} from './types';
import { getAllPaths, pathValueToString } from '../utils';

/**
 * A specialized Actor class designed for cloud orchestration scenarios. It extends the XState Actor class,
 * incorporating cloud-related functionalities. This actor is capable of handling CloudEvents and orchestrating them
 * based on its internal logic and state, using middleware for custom processing.
 */
export default class CloudOrchestrationActor<
  TLogic extends AnyActorLogic,
> extends Actor<TLogic> {
  private middleware: CloudOrchestrationMiddlewares | undefined;
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
    let snapshotSignature: string | undefined;
    let updatedPaths: string[] = [];
    const ignoreInits: boolean = Boolean(options.snapshot);
    super(logic, {
      ...options,
      inspect: (evt: InspectionEvent) => {
        if (evt.type === '@xstate.snapshot') {
          const _evt: InspectedSnapshotEvent = evt;
          const evtSnapShotSign = Buffer.from(
            JSON.stringify(_evt.snapshot || {}),
          ).toString('base64');
          const snapshotPaths = getAllPaths(
            (_evt?.snapshot as AnyMachineSnapshot)?.value || {},
          ).map(pathValueToString);
          if (!(_evt.event.type === 'xstate.init' && ignoreInits)) {
            if (snapshotSignature !== evtSnapShotSign) {
              try {
                this.processSnapshot(
                  snapshotPaths.filter((item) => !updatedPaths.includes(item)),
                  _evt.snapshot as AnyMachineSnapshot,
                );
              } catch (e) {
                console.error(
                  `[CloudOrchestrationActor][OnOrchestrationState] ${
                    (e as Error).message
                  }`,
                );
              }
            }
          }
          snapshotSignature = evtSnapShotSign;
          updatedPaths = [...snapshotPaths];
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
  private processSnapshot(
    pathsToUpdate: string[],
    snapshot: AnyMachineSnapshot,
  ) {
    const orchEvts = pathsToUpdate
      .map((item) =>
        this.middleware?.onOrchestrationState?.[item]?.(
          this._id,
          item,
          snapshot,
        ),
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
      this.middleware?.onOrchestrationEvent?.[event.type]?.(event);
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
