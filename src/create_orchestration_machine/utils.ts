import { OnOrchestrationEvent, OnOrchestrationState } from '../cloud_orchestration_actor/types';
import { getAllPaths } from '../utils';
import {
  OnOrchestrationEventTransformer,
  OnOrchestrationStateEmit,
  OrchestrationMachineAllowedStringKeys,
  OrchestrationMachineConfig,
} from './types';

export function makeOnOrchestrationState<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<TContext>,
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
      .map(
        (item) =>
          [
            item.path.length > 1
              ? `${item.path
                  .slice(0, -1)
                  .map((i) => `#${i}`)
                  .join('.')}.${item.path.pop()}`
              : item.path.pop(),
            emits?.[item.value],
          ] as [string, OnOrchestrationStateEmit<TContext> | undefined],
      )
      .filter(([_, value]) => Boolean(value))
      .map(([key, value]) => ({ [key]: value })),
  ) as Record<string, OnOrchestrationState>;
}

export function makeOnOrchestrationEvent<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<TContext>,
  transformers?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationEventTransformer
  >,
) {
  return Object.assign(
    {},
    ...getAllPaths(config)
      .filter((item) => item.path.includes('transformer'))
      .map(
        (item) =>
          [item.path[item.path.length - 2], transformers?.[item.value]] as [
            string,
            OnOrchestrationEventTransformer | undefined,
          ],
      )
      .filter(([_, value]) => Boolean(value))
      .map(([key, value]) => ({
        [key]: ((event) => ({
          type: event.type,
          data: value?.(event) || event.data || {},
        })) as OnOrchestrationEvent,
      })),
  ) as Record<string, OnOrchestrationEvent>;
}
