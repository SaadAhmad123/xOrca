import {
  createMachine,
  EventObject,
  StateSchema,
  MachineConfig,
  StateMachine,
  interpret,
  Interpreter,
} from 'xstate';
import StorageManager from './storage_manager';

type StateMachineInstance<
  TContext,
  TStates extends StateSchema = any,
  TEvent extends EventObject = EventObject,
> = {
  instanceId: string;
  config: MachineConfig<TContext, TStates, TEvent>;
  currentState: any;
};

/**
 * DurableXState class ensures that an xstate state machine is simple and serializable.
 */
export default class DurableXState<
  TContext,
  TEvent extends EventObject = EventObject,
  TStates extends StateSchema = any,
> {
  private storageManager: StorageManager;
  private machineConfig: MachineConfig<TContext, TStates, TEvent>;
  private machine: StateMachine<TContext, TStates, TEvent>;
  private interpreter?: any;
  private stateMachineInstance?: StateMachineInstance<
    TContext,
    TStates,
    TEvent
  >;

  constructor(
    storageManager: StorageManager,
    machineConfig: MachineConfig<TContext, TStates, TEvent>,
  ) {
    this.storageManager = storageManager;
    this.machineConfig = machineConfig;

    if (!this.isSimpleStateMachine()) {
      throw new Error(
        [
          'The machineConfig must be a simple state machine. ',
          'The state machine will be serialized and persisted, ',
          'so ensure no complications arise from side-effects ',
          'in the machine definition.',
        ].join(' '),
      );
    }

    this.machine = createMachine(machineConfig);
    this.interpreter = undefined;
    this.stateMachineInstance = undefined;
  }

  async create(instanceId: string) {
    if (await this.exists_in_storage(instanceId)) {
      throw new Error(
        `A statemachine (id=${instanceId}) already exists. Either 'use' that one or 'delete' the existing and then 'create' it.`,
      );
    }
    this.stateMachineInstance = {
      instanceId,
      config: this.machineConfig,
      currentState: JSON.stringify(this.machine.initialState.toJSON()),
    };
    this.save();
    return this;
  }

  async exists_in_storage(instanceId: string) {
    return await this.storageManager.exists(`${instanceId}.json`);
  }

  async use(instanceId: string) {
    if (!(await this.exists_in_storage(instanceId))) {
      throw new Error(
        `A statemachine (id=${instanceId}) does NOT exists. Please 'create' a new instance.`,
      );
    }
    const data = await this.storageManager.read(`${instanceId}.json`, '');
    if (!data) {
      throw new Error(
        `A statemachine (id=${instanceId}) does NOT exists or some problem occured while reading it. Please, 'create' a new instance`,
      );
    }
    const _stateMachineInstance = JSON.parse(data);
    if (
      JSON.stringify(this.machineConfig) !==
      JSON.stringify(_stateMachineInstance.config)
    ) {
      throw new Error(
        `The stored machine config is different from provide machine config. Either fix the provided config or 'create' a new instance.`,
      );
    }
    this.stateMachineInstance = _stateMachineInstance;
    return this;
  }

  start() {
    if (!this.stateMachineInstance) {
      throw new Error(
        `No state machine instance defined. Either 'use' one or 'create' a new one`,
      );
    }
    this.interpreter = interpret(this.machine);
    this.interpreter.start(JSON.parse(this.stateMachineInstance.currentState));
    return this;
  }

  event(events: string[]) {
    if (!this.stateMachineInstance) {
      throw new Error(
        `No state machine instance defined. Either 'use' one or 'create' a new one`,
      );
    }
    if (!this.interpreter) {
      throw new Error(`The machine is not running. First 'start' it`);
    }
    this.interpreter.send(events);
    this.stateMachineInstance.currentState = JSON.stringify(
      this.interpreter?.getSnapshot().toJSON(),
    );
    return this;
  }

  stop() {
    if (!this.stateMachineInstance) {
      throw new Error(
        `No state machine instance defined. Either 'use' one or 'create' a new one`,
      );
    }
    if (!this.interpreter) {
      throw new Error(`The machine is not running. First 'start' it`);
    }
    this.interpreter?.stop();
    this.stateMachineInstance.currentState = JSON.stringify(
      this.interpreter?.getSnapshot().toJSON(),
    );
    return this;
  }

  value() {
    if (!this.interpreter) {
      throw new Error(`The machine is not running. First 'start' it`);
    }
    return this.interpreter.getSnapshot().value;
  }

  async save() {
    if (!this.stateMachineInstance) {
      throw new Error(
        `No state machine instance defined. Either 'use' one or 'create' a new one`,
      );
    }
    await this.storageManager.write(
      JSON.stringify(this.stateMachineInstance),
      `${this.stateMachineInstance.instanceId}.json`,
    );
    return this;
  }

  /**
   * Checks if the provided state machine configuration is simple.
   */
  private isSimpleStateMachine(): boolean {
    const { states } = this.machineConfig;

    if (!states) return false;

    for (const stateKey in states) {
      const state = states[stateKey];

      if (
        this.hasForbiddenProperties(state) ||
        !this.hasSimpleTransitions(state)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the state has properties that are not allowed for simple state machines.
   */
  private hasForbiddenProperties(state: any): boolean {
    return state.invoke || state.entry || state.exit || state.activities;
  }

  /**
   * Ensures transitions are simple.
   */
  private hasSimpleTransitions(state: any): boolean {
    if (!state.on) return true;

    for (const eventKey in state.on) {
      const transition = state.on[eventKey];

      if (!this.isTransitionSimple(transition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if a transition is simple.
   */
  private isTransitionSimple(transition: any): boolean {
    if (typeof transition === 'string') return true;

    if (Array.isArray(transition)) {
      return transition.every(
        (individualTransition) => typeof individualTransition === 'string',
      );
    }

    return false;
  }
}
