import { Logger } from 'xorca-cloudevent-router';
import { IOrchestrateCloudEvents } from '../orchestrate_cloud_events/types';
import { Actor, AnyActorLogic } from 'xstate';
import * as zod from 'zod';
import PersistableActor from '../persistable_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';

export interface IOrchestrationRouter<TLogic extends AnyActorLogic>
  extends IOrchestrateCloudEvents<TLogic> {
  description?: string;
  logger?: Logger;
  initialContextZodSchema: zod.ZodObject<any>;
  actorMap?: Map<
    string,
    PersistableActor<TLogic, CloudOrchestrationActor<TLogic>>
  >;
}
