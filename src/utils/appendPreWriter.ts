import { parseSubject } from '.';

/**
 * Represents the record structure for pre-writing operations in a unified storage manager context.
 * This type includes various properties related to the orchestration process, providing
 * metadata about the execution state, status, and logging information.
 */
export type PreWriterRecord = {
  /**
   * The current execution stage of the orchestration state machine.
   * This property can be used to track the progress within the orchestration flow.
   */
  stage?: string;

  /**
   * The overall status of the orchestration process. Valid values are 'done', 'active', or 'error'.
   * This allows for quick assessment of the orchestration's health and operational state.
   */
  status?: string;

  /**
   * A JSON string representing the operation context of the orchestration machine.
   * This context includes runtime details that are essential for understanding the current state
   * and history of the orchestration process.
   */
  context?: string;

  /**
   * The unique identifier (trace ID) for the orchestration, facilitating traceability and logging
   * across the orchestration lifecycle. This ID is crucial for debugging and monitoring.
   */
  traceId?: string;

  /**
   * The name of the orchestrator. This identifier can be used to categorize or identify
   * the specific orchestration logic or workflow being executed.
   */
  name?: string;

  /**
   * A unique seed used for generating process IDs within the orchestrator.
   * This supports the orchestration's execution tracking and identification.
   */
  processId?: string;

  /**
   * The version of the orchestrator. Versioning helps in managing updates and understanding
   * the evolution of the orchestration logic over time.
   */
  version?: string;

  /**
   * A JSON string containing timestamps of when the orchestrator received and processed events.
   * This chronological record is essential for performance analysis and optimization.
   */
  orchestrationCheckpoints?: string;

  /**
   * A JSON string representing the log entries generated during the orchestration process.
   * These logs include events emitted by the orchestrator, providing insight into its operational behavior.
   */
  orchestrationLogs?: string;
}


/**
 * Use this as a append pre writer for the unified storage manager
 *
 * Optional transformation function applied before writing data to DynamoDB.
 * The function takes data and path as input and returns an object with additional attributes.
 * Properties 'data', 'path', and 'updatedAt' are reserved and cannot be overridden.
 * @param data - The JSON string of the data to be stored
 * @param path - The key against which this is stored
 * @returns
 */
export function appendPreWriter(
  data: string,
  path: string,
): PreWriterRecord {
  try {
    const { name, processId, version } = parseSubject(
      path.replace('.json', ''),
    );
    const { status, context, value } = JSON.parse(data);
    return {
      stage: JSON.stringify({ value }),
      status: status || 'UNKNOWN',
      context: JSON.stringify(
        Object.assign(
          {},
          ...Object.entries((context || {}) as Record<string, any>)
            .filter(
              ([key, _]) => !['__cloudevent', '__machineLogs', '__traceId', '__orchestrationTime'].includes(key),
            )
            .map(([key, value]) => ({ [key]: value })),
        ),
      ),
      traceId: context?.__traceId || 'UNKNOWN',
      orchestrationLogs: JSON.stringify(context?.__machineLogs || {}),
      name,
      processId,
      version,
      orchestrationCheckpoints: JSON.stringify(context?.__orchestrationTime || [])
    };
  } catch (e) {
    console.error({ data, path, e });
    return {};
  }
}
