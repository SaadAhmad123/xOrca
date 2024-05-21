import {
  CloudEventRouter,
  CloudEventRouterError,
  ICloudEventRouter,
} from 'xorca-cloudevent-router';
import { CloudEvent } from 'cloudevents';
import { matchTemplates } from 'xorca-cloudevent-router/dist/utils';
import { OrchestrationRouterResponse } from './types';
import { CloudEventRouterHandlerOptions } from 'xorca-cloudevent-router/dist/CloudEventRouter/types';

export default class OrchectrationRouter extends CloudEventRouter {
  constructor(params: ICloudEventRouter) {
    super(params);
  }

  /**
   * Processes an array of CloudEvents using registered CloudEventHandlers.
   *
   * @param events - An array of CloudEvents to be processed.
   * @param errorOnNotFound - If true, returns an error for events without a corresponding handler.
   * @returns A Promise resolving to an array of processed CloudEvents.
   */
  async cloudevents(
    events: CloudEvent<Record<string, any>>[],
    options?: CloudEventRouterHandlerOptions,
  ): Promise<OrchestrationRouterResponse[]> {
    const subjectToEvents = events.reduce(
      (acc, cur) => {
        const subject = (cur.subject || '') as string;
        if (!acc[subject]) {
          acc[subject] = [];
        }
        acc[subject].push(cur);
        return acc;
      },
      {} as Record<string, CloudEvent<Record<string, any>>[]>,
    );
    const handlerKeys = Object.keys(this.handlerMap || {});
    return (
      await Promise.all(
        Object.entries(subjectToEvents).map(async ([subject, events]) => {
          let resps: OrchestrationRouterResponse[] = [];
          for (const item of events) {
            try {
              const matchTemplateResp = matchTemplates(item.type, handlerKeys);
              if (!matchTemplateResp) {
                if (!options?.errorOnNotFound) return [];
                throw new CloudEventRouterError(
                  `[OrchestrationRouterError][cloudevents] No handler found for event.type=${item.type}. The accepts type are: ${handlerKeys.join(', ')}`,
                );
              }
              resps = [
                ...resps,
                ...(
                  await this.handlerMap[
                    matchTemplateResp.matchedTemplate
                  ].safeCloudevent(item)
                ).map((resp) => ({
                  event: item,
                  success: resp.success,
                  eventToEmit: resp.eventToEmit,
                })),
              ];
            } catch (error) {
              resps = [
                ...resps,
                {
                  event: item,
                  success: false,
                  errorMessage: (error as Error)?.message,
                  errorStack: (error as Error)?.stack,
                  errorType: (error as Error)?.name,
                },
              ];
            }
          }
          await options?.responseCallback?.(resps).catch(console.error);
          return resps;
        }),
      )
    ).reduce(
      (acc, cur) => [...acc, ...cur],
      [] as OrchestrationRouterResponse[],
    );
  }
}
