import PersistableActor, { withPersistableActor } from './persistable_actor';
import CloudOrchestrationActor, {
  orchestrateCloudEvents,
  createCloudOrchestrationActor,
} from './cloud_orchestration_actor';
import {
  PersistableActorInput,
  CloudEventMiddleware,
  CloudOrchestrationStateMiddleware,
  CloudOrchestratorMiddlewares,
  CloudOrchestrationActorOptions,
  IOrchestrateCloudEvents,
} from './types';
import {
  createCloudEvent,
  assignEventDataToContext,
  assignLogsToContext,
} from './utils';
import { CreateMachineYamlError } from './createMachineYaml/errors';
import {
  GenericEventObject,
  GenericActionFunction,
  GenericGuardFunction,
  CreateMachineYamlOptions,
} from './createMachineYaml/types';
import { createMachineYaml } from './createMachineYaml';
import { CreateStateMachineJSONSchemaValidator } from './createMachineYaml/schema';

const Core = {
  PersistableActor,
  CloudOrchestrationActor,
  withPersistableActor,
  createCloudOrchestrationActor,
  orchestrateCloudEvents,
};

const Utils = {
  CreateMachineYamlError,
  createMachineYaml,
  createCloudEvent,
  assignEventDataToContext,
  assignLogsToContext,
  CreateStateMachineJSONSchemaValidator,
};

export {
  Core,
  Utils,
  PersistableActorInput as PersistableActorInputType,
  CloudEventMiddleware as CloudEventMiddlewareType,
  CloudOrchestrationStateMiddleware as CloudOrchestrationStateMiddlewareType,
  CloudOrchestratorMiddlewares as CloudOrchestratorMiddlewaresType,
  CloudOrchestrationActorOptions as CloudOrchestrationActorOptionsType,
  IOrchestrateCloudEvents,
  GenericEventObject,
  GenericActionFunction,
  GenericGuardFunction,
  CreateMachineYamlOptions,
};
