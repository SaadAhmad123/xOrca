import { AnyActorLogic, ContextFrom } from 'xstate';
import { CloudEvent } from 'cloudevents';
import { IOrchestrateCloudEvents, InitialOrchestrationEvent } from './types';
import { Version } from '../cloud_orchestration_actor/types';
import { makeSubject, parseSubject } from '../utils';
import { withPersistableActor } from '../utils/with_persistable_actor';
import CloudOrchestrationActor from '../cloud_orchestration_actor';
import { createCloudOrchestrationActor } from '../utils/create_cloud_orchestration_actor';
import { v4 as uuidv4 } from 'uuid';

/**
 * Orchestrates cloud events by processing each event, managing the state with persistent actors,
 * and emitting new cloud events based on the defined orchestration logic.
 *
 * @param param - Parameters for orchestrating cloud events, including state machine logic, storage manager, and middleware.
 * @param events - An array of CloudEvent objects to be processed during the orchestration.
 * @param inits - Optional. An array of initialization objects containing a subject (process ID) and initial context for actors.
 * @returns Promise resolving to an array of CloudEvent objects to be emitted as a result of the orchestration.
 * @throws Error if any cloud event lacks a subject, or if there's an overlap in subjects between events and initialization objects.
 *
 * @example
 * const orchestrationParams = {
 *   statemachine: [...], // Define state machines
 *   name: "ExampleOrchestrator", // Orchestrator name
 *   storageManager: someStorageManager, // Storage manager for persistent actors
 *   onOrchestrationState: (id, state) => { // middleware for handling orchestration state changes // },
 *   onCloudEvent: (id, event) => { // middleware for handling cloud events during orchestration // },
 *   onSnapshot: (id, snapshot) => { // callback for handling actor snapshots // },
 * };
 * const initialEvents = [
 *   { processId: "123", version: "v1.0", context: {} },
 *   // ... more initialization objects
 * ];
 * const cloudEvents = [
 *   { subject: "123", // cloud event data // },
 *   // ... more cloud events
 * ];
 * const result = await orchestrateCloudEvents(orchestrationParams, cloudEvents, initialEvents);
 * console.log(result.eventsToEmit); // Array of CloudEvents to be emitted
 * console.log(result.processContext); // Map of process IDs to their corresponding contexts
 * console.log(result.errors); // Array of errors encountered during orchestration
 */
export async function orchestrateCloudEvents<TLogic extends AnyActorLogic>(
  param: IOrchestrateCloudEvents<TLogic>,
  events: CloudEvent<Record<string, any>>[] = [],
  inits: InitialOrchestrationEvent<TLogic>[] = [],
) {
  const errors: {
    error: string;
    initEvents?: InitialOrchestrationEvent<TLogic>[];
    events?: CloudEvent<Record<string, any>>[];
  }[] = [];
  events = events.filter((e) => Boolean(e?.subject));
  inits = inits.map((item) => ({
    ...item,
    processId: item.processId || uuidv4(),
  }));
  const eventSubjects = Array.from(new Set(events.map((e) => e.subject)));
  const initSubjects = Array.from(new Set(inits.map((e) => e.processId)));
  const uniqueSubjects = Array.from(
    new Set([...eventSubjects, ...initSubjects]),
  );

  if (new Set(initSubjects).size !== initSubjects.length) {
    throw new Error(
      'Duplicate subject ids found in initialization objects. Each init object must have a unique subject id.',
    );
  }
  if (uniqueSubjects.length !== eventSubjects.length + initSubjects.length) {
    throw new Error(
      'Overlap detected: A subject id used for initialization cannot be used for events.',
    );
  }

  let eventsToEmit: CloudEvent<Record<string, any>>[] = [];
  const processContextMap: Record<
    string,
    {
      status?: string;
      context?: ContextFrom<TLogic>;
    }
  > = {};
  const subjectToEvents = events.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.subject || '']: [...(acc[cur.subject || ''] || []), cur],
    }),
    {} as Record<string, CloudEvent<Record<string, any>>[]>,
  );

  if (
    Array.from(new Set(param.statemachine.map((item) => item.version)))
      .length !== param.statemachine.length
  ) {
    throw new Error(
      `[orchestrateCloudEvents] Duplicate state machine versions found.`,
    );
  }

  const getStateMachine = (version?: Version) => {
    if (!version) {
      if (!param.statemachine.length) {
        throw new Error(
          `[orchestrateCloudEvents][getStateMachine] No state machines(name=${param.name}) versions provided`,
        );
      }
      return param.statemachine[param.statemachine.length - 1];
    }
    const machines = param.statemachine.filter(
      (item) => item.version === version,
    );
    if (!machines.length) {
      throw new Error(
        `[orchestrateCloudEvents][getStateMachine] The state machine name=${
          param.name
        } version=${version} not found. Provided versions are ${param.statemachine
          .map((item) => item.version)
          .join(',')}`,
      );
    }
    return machines[0];
  };

  await Promise.all(
    (inits || []).map(async (initEvent) => {
      try {
        const statemachine = getStateMachine(initEvent.version);
        const subject = makeSubject(
          initEvent.processId || uuidv4(),
          param.name,
          statemachine.version,
        );
        return await withPersistableActor<
          TLogic,
          CloudOrchestrationActor<TLogic>
        >(
          {
            id: subject,
            storageManager: param.storageManager,
            actorCreator: (id, snapshot) => {
              if (snapshot)
                throw new Error(
                  `The subject=${id} already exists so it cannot be initiated`,
                );
              return createCloudOrchestrationActor(
                statemachine.orchestrationMachine,
                {
                  version: statemachine.version,
                  name: param.name,
                  id,
                  snapshot,
                  input: initEvent.context,
                },
              );
            },
          },
          async (actor) => {
            actor.start();
            eventsToEmit = [...eventsToEmit, ...actor.eventsToEmit];
            try {
              const snapshot = actor.getSnapshot();
              param?.onSnapshot?.(subject, snapshot);
              processContextMap[subject] = {
                context: (snapshot as any)?.context,
                status: (snapshot as any)?.status,
              };
            } catch (error) {
              console.error(
                JSON.stringify(
                  {
                    processId: subject,
                    error: (error as Error)?.message,
                  },
                  null,
                  2,
                ),
              );
            }
          },
        );
      } catch (e) {
        errors.push({
          error: (e as Error)?.message,
          initEvents: [initEvent],
        });
      }
    }),
  );

  for (const id of Object.keys(subjectToEvents)) {
    try {
      const { name, version } = parseSubject(id);
      if (name !== param.name) {
        throw new Error(
          `[orchestrateCloudEvents] Event statemachine Name=${name} the given statemachine Name=${param.name}`,
        );
      }
      const statemachine = getStateMachine(version);
      await withPersistableActor<TLogic, CloudOrchestrationActor<TLogic>>(
        {
          id,
          storageManager: param.storageManager,
          actorCreator: (id, snapshot) => {
            if (!snapshot) {
              throw new Error(`The subject=${id} not already initiated.`);
            }
            return createCloudOrchestrationActor(
              statemachine.orchestrationMachine,
              {
                name,
                version: statemachine.version,
                id,
                snapshot,
              },
            );
          },
        },
        async (actor) => {
          actor.start();
          subjectToEvents[id].forEach((evt) => actor.cloudevent(evt));
          eventsToEmit = [...eventsToEmit, ...actor.eventsToEmit];
          try {
            const snapshot = actor.getSnapshot();
            param?.onSnapshot?.(id, snapshot);
            processContextMap[id] = {
              context: (snapshot as any)?.context,
              status: (snapshot as any)?.status,
            };
          } catch (error) {
            console.error(
              JSON.stringify(
                {
                  processId: id,
                  error: (error as Error)?.message,
                },
                null,
                2,
              ),
            );
          }
        },
      );
    } catch (e) {
      errors.push({
        error: (e as Error).message,
        events: subjectToEvents[id],
      });
    }
  }

  return {
    eventsToEmit,
    processContext: processContextMap,
    errors,
  };
}
