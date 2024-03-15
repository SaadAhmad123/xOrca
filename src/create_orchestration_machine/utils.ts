import {
  OnOrchestrationEvent,
  OnOrchestrationState,
} from '../cloud_orchestration_actor/types';
import { getAllPaths } from '../utils';
import {
  OnOrchestrationEventTransformer,
  OnOrchestrationStateEmit,
  OrchestrationMachineAllowedStringKeys,
  OrchestrationMachineConfig,
} from './types';
import * as zod from 'zod';

export function makeOnOrchestrationState<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<TContext>,
  emits?: Record<
    OrchestrationMachineAllowedStringKeys,
    OnOrchestrationStateEmit<
      TContext,
      string,
      {
        type?: string;
        data: Record<OrchestrationMachineAllowedStringKeys, any>;
      }
    >
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
            item.value,
          ] as [string, OnOrchestrationStateEmit<TContext> | undefined, string],
      )
      .filter(([_, value, _emitKey]) => Boolean(value))
      //.map(([key, value, _emitKey]) => ({[key] : value}))
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
      .map(([key, value]) => {
        if (!key) return {};
        return {
          [key]: ((event) => {
            const resp = value?.(event);
            return {
              type: event.type,
              data: resp?.data || event.data || {},
            };
          }) as OnOrchestrationEvent,
        };
      }),
  ) as Record<string, OnOrchestrationEvent>;
}

export const OrchestratorTerms = {
  source: (name?: string) =>
    `xorca.orchestrator.${name || 'noSourceAvailable'}` as `xorca.orchestrator.${string}`,
  error: (name?: string) =>
    `xorca.orchestrator.${name || 'noSourceAvailable'}.error` as `xorca.orchestrator.${string}.error`,
  errorSchema: () =>
    zod.object({
      errorName: zod.string().optional().describe('The name of the error'),
      errorMessage: zod
        .string()
        .optional()
        .describe('The message of the error'),
      errorStack: zod.string().optional().describe('The stack of the error'),
      eventData: zod.any().optional().describe('The input to the handler'),
    }),
  start: (name?: string) =>
    `xorca.${name || 'noSourceAvailable'}.start` as `xorca.${string}.start`,
  startError: (name?: string) =>
    `xorca.${name || 'noSourceAvailable'}.start.error` as `xorca.${string}.start.error`,
  startSchema: (initialContextZodSchema?: zod.ZodObject<any>) =>
    zod.object({
      processId: zod
        .string()
        .describe(
          `The process ID seed of the orchestration. It must be a unique id. It is used to generate the storage key and trace id of the orchestration`,
        ),
      context: (initialContextZodSchema || zod.object({})).describe(
        `The initial data seeded to the orchestration context. e.g. { bookId: "some-book.pdf", status: "pending" }. ${initialContextZodSchema?.description}`,
      ),
      version: zod
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .optional()
        .describe(
          `The version for the orchestration. If not provided, the latest version will be used. The version must be of format '{number}.{number}.{number}'`,
        ),
    }),
};
