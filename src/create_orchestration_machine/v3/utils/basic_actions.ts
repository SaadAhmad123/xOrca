import { assign } from 'xstate';
import Action from '../Action';
import { BasicContext, BasicEventObject } from '../types';

/**
 * An XState action that assigns event data to the context, excluding the 'type' property of the event.
 * This action is useful in scenarios where the context needs to be updated with new data from an event,
 * but the event's type should not overwrite any existing context properties.
 */
const updateContext = new Action<Record<string, any>, Record<string, any>>({
  name: 'updateContext',
  handler: assign(({ event, context }) => {
    const { type, ...restOfEvent } = event;
    return { ...context, ...restOfEvent };
  }),
});

/**
 * An XState action that appends machine logs to the context, including information
 * from the current event and context.
 *
 * This action is designed for logging purposes within an XState machine. It appends
 * a log entry to the '__machineLogs' property in the context. Each log entry includes
 * information such as CloudEvent ID, CloudEvent data, event details, context details,
 * timestamp, and ISO timestamp.
 *
 * The resulting '__machineLogs' array provides a history of events that we recieved and their associated
 * data during the execution of the state machine.
 */
const updateLogs = new Action<Record<string, any>, Record<string, any>>({
  name: 'updateLogs',
  handler: assign({
    __machineLogs: ({ event, context }) => {
      const {
        __machineLogs,
        __cloudevent,
        __traceId,
        __orchestrationTime,
        __cumulativeExecutionUnits,
        ...contextToLog
      } = context || {};
      const { __cloudevent: ce, ...eventLog } = event || {};
      return [
        ...(__machineLogs || []),
        {
          cloudeventId: (ce as any)?.id,
          cloudevent: ce,
          context: contextToLog,
          timestamp: Date.now(),
          isoTime: new Date().toISOString(),
        },
      ];
    },
  }),
});

/**
 * A action which can update the orchestration time
 * and log the checkpoint
 */
export const updateCheckpoint = new Action<
  Record<string, any>,
  Record<string, any>
>({
  name: 'updateCheckpoint',
  handler: assign({
    __orchestrationTime: ({ event, context }) => {
      const { __orchestrationTime } = context || {};
      const startTime = __orchestrationTime?.[0]?.start || Date.now();
      const checkpointTime = Date.now();
      return [
        ...(__orchestrationTime || []),
        {
          event_type: event.type,
          start: startTime,
          checkpoint: checkpointTime,
          elapsed: checkpointTime - startTime,
        },
      ];
    },
  }),
});

/**
 * For an event, it checks the payload for field `__executionunits`
 * and then appends the execution units of the orchestrations
 */
const updateExecutionUnits = new Action<
  Record<string, any>,
  Record<string, any>
>({
  name: 'updateExecutionUnits',
  handler: assign({
    __cumulativeExecutionUnits: ({ event, context }: any) => {
      return [
        ...(context?.__cumulativeExecutionUnits || []),
        {
          event_type: event.type,
          units: event?.__cloudevent?.executionunits || (0).toString(),
        },
      ];
    },
  }),
});

/**
 * A dictionary to reference the basic actions
 */
export const BasicActions = {
  updateContext,
  updateLogs,
  updateCheckpoint,
  updateExecutionUnits,
};

/**
 * This function adds the default actions to the action list
 * The default actions are:
 * - BasicActions.updateLogs
 * - BasicActions.updateCheckpoint
 * - BasicActions.updateExecutionUnits
 *
 * @param args - The other actions
 * @returns a list of all the actions
 */
export function withBasicActions<
  TContext extends Record<string, any>,
  TEventData extends Record<string, any>,
>(...args: Action<TContext, TEventData>[]): Action<TContext, TEventData>[] {
  const aggregate = [
    ...(args || []),
    updateLogs,
    updateCheckpoint,
    updateExecutionUnits,
  ];
  return Object.values(
    aggregate.reduce(
      (acc, cur) => {
        return {
          ...acc,
          [cur.ref]: cur,
        };
      },
      {} as Record<string, any>,
    ),
  );
}
