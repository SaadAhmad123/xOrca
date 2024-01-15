import PersistableActor, { withPersistableActor } from './persistable_actor';
import CloudOrchestrationActor, {
  orchestrateCloudEvents,
  createCloudOrchestrationActor,
  makeSubject,
  parseSubject
} from './cloud_orchestration_actor';
import {
  PersistableActorInput,
  OnOrchestrationEvent,
  OnOrchestrationState,
  CloudOrchestratorMiddlewares,
  CloudOrchestrationActorOptions,
  IOrchestrateCloudEvents,
} from './types';
import {
  createCloudEvent,
  assignEventDataToContext,
  assignLogsToContext,
} from './utils';
import { CreateMachineYamlError } from './create_machine_yaml/errors';
import {
  GenericEventObject,
  GenericActionFunction,
  GenericGuardFunction,
  CreateMachineYamlOptions,
} from './create_machine_yaml/types';
import { createMachineYaml } from './create_machine_yaml';
import { CreateStateMachineJSONSchemaValidator } from './create_machine_yaml/schema';

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
  makeCloudEventSubject: makeSubject,
  parseCloudEventSubject: parseSubject,
};

export {
  Core,
  Utils,
  PersistableActorInput,
  OnOrchestrationEvent,
  OnOrchestrationState,
  CloudOrchestratorMiddlewares,
  CloudOrchestrationActorOptions,
  IOrchestrateCloudEvents,
  GenericEventObject,
  GenericActionFunction,
  GenericGuardFunction,
  CreateMachineYamlOptions,
};
