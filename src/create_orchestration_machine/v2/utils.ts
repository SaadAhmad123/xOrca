import {
  OnOrchestrationEvent,
  OnOrchestrationState,
} from '../../cloud_orchestration_actor/types';
import { getAllPaths } from '../../utils';
import {
  OnOrchestrationEventTransformer,
  OnOrchestrationStateEmit,
  OrchestrationMachineAllowedStringKeys,
  OrchestrationMachineConfig,
} from '../types';

const isFunction = (variable: any) => typeof variable === 'function';
const isBoolean = (variable: any) => typeof variable === 'boolean';

export function makeOnOrchestrationState<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<
    TContext,
    | OnOrchestrationStateEmit<
        TContext,
        {
          type: string;
          data: Record<OrchestrationMachineAllowedStringKeys, any>;
        }
      >
    | string,
    string | boolean
  >,
  emits?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationStateEmit<TContext>
  >,
) {
  return Object.assign(
    {},
    ...getAllPaths(config)
      .filter((item) => item.path.includes('emit'))
      .map((item) => ({
        ...item,
        path: item.path.filter((item) => item !== 'states').slice(0, -1),
      }))
      .map((item) => {
        type ReturnType = [
          string,
          OnOrchestrationStateEmit<TContext> | undefined,
          string | undefined,
        ];
        const pathKey: string | undefined =
          item.path.length > 1
            ? `${item.path
                .slice(0, -1)
                .map((i) => `#${i}`)
                .join('.')}.${item.path.pop()}`
            : item.path.pop();
        if (isFunction(item.value)) {
          return [pathKey, item.value, undefined] as ReturnType;
        }
        return [pathKey, emits?.[item.value], item.value] as ReturnType;
      })
      .filter(
        ([pathKey, value, _emitKey]) => Boolean(value) && Boolean(pathKey),
      )
      .map(([key, value, emitKey]) => ({
        [key]: ((...args) => {
          const resp = value?.(...args);
          return {
            type: resp?.type || emitKey,
            data: resp?.data || {},
          };
        }) as OnOrchestrationState,
      })),
  ) as Record<string, OnOrchestrationState>;
}

export function makeOnOrchestrationEvent<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<
    TContext,
    | OnOrchestrationStateEmit<
        TContext,
        {
          type: string;
          data: Record<OrchestrationMachineAllowedStringKeys, any>;
        }
      >
    | string,
    string | boolean
  >,
  transformers?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationEventTransformer
  >,
) {
  return Object.assign(
    {},
    ...getAllPaths(config)
      .filter((item) => item.path.includes('transformer'))
      .map((item) => {
        type ReturnType = [
          string | undefined,
          OnOrchestrationEventTransformer | undefined,
        ];
        if (isBoolean(item.value)) {
          if (item.value) {
            return [
              item.path[item.path.length - 2],
              transformers?.[item.path[item.path.length - 2]],
            ] as ReturnType;
          }
          return [undefined, undefined] as ReturnType;
        } else {
          return [
            item.path[item.path.length - 2],
            transformers?.[item.value],
          ] as ReturnType;
        }
      })
      .filter(([key, value]) => Boolean(value) && Boolean(key))
      .map(([key, value]) => {
        if (!key) return {};
        return {
          [key]: ((event) => {
            const resp = value?.(event);
            return {
              type: resp?.type || event.type,
              data: resp?.data || event.data || {},
            };
          }) as OnOrchestrationEvent,
        };
      }),
  ) as Record<string, OnOrchestrationEvent>;
}
