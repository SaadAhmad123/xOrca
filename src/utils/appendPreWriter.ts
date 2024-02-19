import { parseSubject } from '.';

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
): {
  status?: string;
  context?: string;
  traceId?: string;
  name?: string;
  processId?: string;
  version?: string;
} {
  try {
    const { name, processId, version } = parseSubject(
      path.replace('.json', ''),
    );
    const { status, context } = JSON.parse(data);
    return {
      status: status || 'UNKNOWN',
      context: JSON.stringify(
        Object.assign(
          {},
          ...Object.entries((context || {}) as Record<string, any>)
            .filter(
              ([key, _]) => !['__cloudevent', '__machineLogs'].includes(key),
            )
            .map(([key, value]) => ({ [key]: value })),
        ),
      ),
      traceId: context?.__traceId || 'UNKNOWN',
      name,
      processId,
      version,
    };
  } catch (e) {
    console.error({ data, path, e });
    return {};
  }
}
