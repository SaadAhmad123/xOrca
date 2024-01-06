import { createMachineYaml } from '.';
import { readFile } from '../utils';
import { StateValue, StateValueMap, createActor } from 'xstate';

describe('Testing YAMLStateMachine', () => {
  it('should load a yaml state machine', async () => {
    const machine = createMachineYaml<Record<string, string>>(
      readFile('createMachineYaml/createMachineYaml.spec.data.yaml'),
    );
    let state: StateValue | StateValueMap = '';
    let context: Record<string, string> = {};
    const actor = createActor(machine);
    actor.subscribe((snapshot) => {
      state = snapshot.value;
      context = snapshot.context;
    });
    actor.start();
    expect(state === 'Step1').toBe(true);
    expect(state === 'Step2').toBe(false);
    expect(context).toEqual({});
    actor.send({ type: 'CHANGE', name: 'saad ahmad' });
    expect(state === 'Step2').toBe(true);
    console.log(JSON.stringify({ context }, null, 2));
    expect(context.name).toEqual('saad ahmad');
  });
});
