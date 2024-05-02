import {
  OrchestrationStateConfig,
  OrchestrationTransitionConfig,
} from '../../types';
import {
  BasicContext,
  OrchestrationMachineConfigV3,
  OrchestrationStateConfigV3,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export function compileMachine<
  TContext extends Record<string, any>,
  TInput extends Record<string, any> = Record<string, any>,
>(config: OrchestrationMachineConfigV3<TContext, TInput>) {
  let actionFunctions: Record<string, any> = {};
  let emitFunctions: Record<string, any> = {};
  let guardFunctions: Record<string, any> = {};
  const _compileState = <TContext extends Record<string, any>>(
    state: OrchestrationStateConfigV3<TContext>,
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
      on: (state.on || []).reduce(
        (acc, cur) => {
          actionFunctions = {
            ...actionFunctions,
            ...cur.actionFunctions,
          };
          guardFunctions = {
            ...guardFunctions,
            ...cur.guardFunctions,
          };
          if (acc[cur.ref]) {
            throw new Error(`Duplicate transition events ${cur.ref}`);
          }
          return {
            ...acc,
            [cur.ref]: cur.handler,
          };
        },
        {} as Record<string, OrchestrationTransitionConfig[]>,
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
          [key]: _compileState(value as OrchestrationStateConfigV3<TContext>),
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
          [key]: _compileState(value as OrchestrationStateConfigV3<TContext>),
        })),
      ),
    },
    actions: actionFunctions,
    guards: guardFunctions,
    emits: emitFunctions,
  };
}

function toBase62(num: bigint) {
  const base = 62;
  const digits =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  while (num > 0) {
    result = digits.charAt(Number(num % BigInt(base))) + result;
    num /= BigInt(base);
  }
  return result;
}

export function generateShortUuid() {
  const fullUuid = uuidv4();
  const hasher = createHash('sha256');
  hasher.update(fullUuid);
  const hash = hasher.digest('hex');
  const hashNumber = BigInt('0x' + hash);
  const encoded = toBase62(hashNumber);
  return encoded.substring(0, 8);
}
