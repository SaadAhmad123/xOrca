import { OrchestrationStateConfig } from '../types';
import {
  BasicContext,
  OrchestrationMachineConfigV3,
  OrchestrationStateConfigV3,
} from './types';

export function compileMachine<
  TContext extends BasicContext,
  TEmit extends string,
  TInput extends Record<string, any> = Record<string, any>,
>(config: OrchestrationMachineConfigV3<TContext, TEmit, TInput>) {
  let actionFunctions: Record<string, any> = {};
  let emitFunctions: Record<string, any> = {};
  let guardFunctions: Record<string, any> = {};
  const _compileState = <
    TContext extends Record<string, any>,
    TState extends string,
  >(
    state: OrchestrationStateConfigV3<TContext, TState>,
  ): OrchestrationStateConfig<TContext> => {
    if (state.emit) {
      emitFunctions[state.emit.ref] = state.emit.handler;
    }
    return {
      ...state,
      emit: state.emit?.ref,
      eventSchema: state.emit?.schema
        ? {
            type: state.emit?.ref,
            data: state.emit?.schema,
          }
        : undefined,
      entry: state?.entry?.map((item) => {
        actionFunctions[item.ref] = item.handler;
        return item.ref;
      }),
      exit: state?.exit?.map((item) => {
        actionFunctions[item.ref] = item.handler;
        return item.ref;
      }),
      on: Object.assign(
        {},
        ...(state.on || []).map((item) => {
          actionFunctions = {
            ...actionFunctions,
            ...item.actionFunctions,
          };
          guardFunctions = {
            ...guardFunctions,
            ...item.guardFunctions,
          };
          return { [item.ref]: item.handler };
        }),
      ),
      always: (() => {
        if (!state.always) return undefined;
        actionFunctions = {
          ...actionFunctions,
          ...state.always.actionFunctions,
        };
        guardFunctions = {
          ...guardFunctions,
          ...state.always.guardFunctions,
        };
        return state.always.handler;
      })(),
      states: Object.assign(
        {},
        ...Object.entries(state.states || {}).map(([key, value]) => ({
          [key]: _compileState(
            value as OrchestrationStateConfigV3<TContext, string>,
          ),
        })),
      ),
    };
  };
  return {
    config: {
      ...(config as any),
      types: {} as {
        context: TContext;
      },
      context: ({ input }: { input: TInput }) => {
        const startTime = Date.now();
        return {
          ...(config?.context?.({ input }) || {}),
          __traceId: (input as any)?.__traceId,
          __machineLogs: [],
          __cloudevent: undefined,
          __orchestrationTime: [
            {
              event_type: 'init',
              start: startTime,
              checkpoint: startTime,
              elapsed: 0,
            },
          ],
          __cumulativeExecutionUnits: [
            {
              event_type: 'init',
              units: (1).toString(),
            },
          ],
        };
      },
      states: Object.assign(
        {},
        ...Object.entries(config.states || {}).map(([key, value]) => ({
          [key]: _compileState(
            value as OrchestrationStateConfigV3<TContext, string>,
          ),
        })),
      ),
    },
    actions: actionFunctions,
    guards: guardFunctions,
    emits: emitFunctions,
  };
}
