import { Logger } from 'xorca-cloudevent-router';
import { IOrchestrateCloudEvents } from '../orchestrate_cloud_events/types';
import { Actor, AnyActorLogic } from 'xstate';
import * as zod from 'zod';
import PersistableActor from '../persistable_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { CloudEvent } from 'cloudevents';

export interface IOrchestrationRouter<TLogic extends AnyActorLogic>
  extends IOrchestrateCloudEvents<TLogic> {
  /**
   * The description of the orchestration router
   */
  description?: string;
  /**
   * The logger function to access the router logs
   */
  logger?: Logger;
  /**
   * The schema for the initial context data
   */
  initialContextZodSchema: zod.ZodObject<any>;
}

export type OrchestrationRouterResponse = {
  event: CloudEvent<Record<string, any>>;
  success: boolean;
  errorMessage?: string | undefined;
  errorStack?: string | undefined;
  errorType?: string | undefined;
  eventToEmit?: CloudEvent<Record<string, any>> | undefined;
};
