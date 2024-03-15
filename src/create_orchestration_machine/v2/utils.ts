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
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as zod from 'zod';
import { TraceParent } from 'xorca-cloudevent-router';

const isFunction = (variable: any) => typeof variable === 'function';
const isBoolean = (variable: any) => typeof variable === 'boolean';

export function makeOnOrchestrationState<TContext extends Record<string, any>>(
  config: OrchestrationMachineConfig<TContext, string, string | boolean>,
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
  config: OrchestrationMachineConfig<TContext, string, string | boolean>,
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
              type: event.type,
              data: resp?.data || event.data || {},
            };
          }) as OnOrchestrationEvent,
        };
      }),
  ) as Record<string, OnOrchestrationEvent>;
}

/**
 * Retrieves the value at the specified path of the object.
 *
 * The function traverses the object based on the path provided. Each element in the path
 * array specifies the next key in the object to navigate down. If any key is not found, or an error occurs,
 * the function logs the error to the console and returns `undefined`.
 *
 * @param {string[]} path - An array of strings representing the path to navigate down the object.
 * @param {any} obj - The object to be traversed.
 * @returns {any} The value at the end of the path, or `undefined` if the path is invalid or an error occurs.
 */
export const getObjectOnPath = (path: string[], obj: any) =>
  path.reduce((acc: any, curr: string) => {
    try {
      return acc?.[curr];
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, obj);

/**
 * Attempts to convert a Zod schema to a JSON schema format safely.
 *
 * This function wraps the conversion process in a try-catch block to handle any potential errors
 * gracefully. If an error occurs during the conversion, the error is logged to the console,
 * and the function returns `undefined`. This approach ensures that the application can continue
 * running even if the conversion fails.
 *
 * @param {any} schema - The Zod schema to be converted to JSON schema format. The type is `any`
 * to accommodate any valid Zod schema, but it's recommended to pass a specific Zod schema type
 * for more predictable outcomes.
 * @returns {any | undefined} The JSON schema representation of the provided Zod schema if the conversion
 * is successful, or `undefined` if the conversion fails due to an error.
 */
export const safeZodToJSON = (schema: any) => {
  try {
    return zodToJsonSchema(schema);
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

interface IEventSchemaToZod {
  type: string;
  zodDataSchema: zod.ZodObject<any>;
  source: string;
}

/**
 * Conver the event to zod schema
 * @returns
 */
export function eventSchemaToZod({
  type,
  zodDataSchema,
  source,
}: IEventSchemaToZod) {
  return zodToJsonSchema(
    zod.object({
      id: zod.string().optional().describe('A UUID of this event'),
      subject: zod.string().describe('The process reference'),
      type: zod.literal(type).describe('The topic of the event'),
      source: zod
        .literal(encodeURI(source))
        .describe('The orchestrator source name'),
      data: zodDataSchema,
      datacontenttype: zod.literal(
        'application/cloudevents+json; charset=UTF-8',
      ),
      traceparent: zod
        .string()
        .regex(TraceParent.validationRegex)
        .optional()
        .describe(
          [
            'The traceparent header represents the incoming request in a tracing system in a common format.',
            'See the W3C spec for the definition as per [CloudEvents Distributed Tracing ',
            'Specification](https://github.com/cloudevents/spec/blob/main/cloudevents/extensions/distributed-tracing.md).',
          ].join(''),
        ),
      tracestate: zod
        .string()
        .optional()
        .describe(
          'Additional tracing info as per the [spec](https://www.w3.org/TR/trace-context/#tracestate-header)',
        ),
      to: zod
        .null()
        .describe(
          'The orchestrator does not respond to any event. Rather it is calculating the next event',
        ),
      redirectTo: zod
        .string()
        .optional()
        .describe(
          'The orchestrator does not respond to any event. Rather it is calculating the next event',
        ),
    }),
  );
}
