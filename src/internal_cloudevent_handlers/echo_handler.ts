import { CloudEventHandler } from 'xorca-cloudevent-router';
import { XOrcaBaseContract } from 'xorca-contract';
import * as zod from 'zod';

/**
 * Defines a CloudEventHandler for handling dummy events specifically designed
 * to echo the received events back to the orchestrator. This handler is typically
 * used to flush outdated events from the state in scenarios involving loops within
 * state machines.
 *
 * This handler accepts a specific event type and, upon processing, emits a success
 * event indicating that the operation was completed successfully.
 */
const InternalEchoCloudEventHandler = new CloudEventHandler({
  executionUnits: 0,
  contract: new XOrcaBaseContract({
    accepts: {
      type: 'cmd.xorca_internal.echo',
      schema: zod.object({}),
    },
    emits: {
      'evt.xorca_internal.echo.success': zod.object({}),
    },
  }),
  handler: async () => {
    return [
      {
        type: 'evt.xorca_internal.echo.success',
        data: {},
      },
    ];
  },
});

export default InternalEchoCloudEventHandler;
