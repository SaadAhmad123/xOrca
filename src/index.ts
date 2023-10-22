import {
  createMachine,
  interpret,
  StateMachine,
  EventObject,
  Interpreter,
  Typestate,
} from 'xstate';
import DurableXState from './durable_x_state';
import StorageManager from './storage_manager';
import LocalFileStorageManager from './storage_manager/local_file_storage_manager';
import S3StorageManager from './storage_manager/s3_storage_manager';

export {
  DurableXState,
  StorageManager,
  LocalFileStorageManager,
  S3StorageManager,
};

async function main() {
  const storageManager = new LocalFileStorageManager('.statemachines');
  const machine = new DurableXState(storageManager, {
    id: 'light',
    initial: 'red',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
        },
      },
      yellow: {
        on: {
          TIMER: 'red',
        },
      },
      red: {
        on: {
          TIMER: 'green',
        },
      },
    },
  });

  const instanceId = 'saad';
  await machine.use(instanceId);
  machine.start().event(['TIMER']).stop();
  await machine.save();

  console.log({ machineVal: machine.value() });
}

main();
