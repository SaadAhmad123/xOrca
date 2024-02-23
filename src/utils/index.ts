import * as fs from 'fs';
import * as path from 'path';
import { CloudEvent, CloudEventV1 } from 'cloudevents';
import { assign } from 'xstate';
import { Version } from '../cloud_orchestration_actor/types';

/**
 * Represents a path and its corresponding value in an object.
 */
export type PathValue = {
  path: string[];
  value: any;
};

/**
 * Recursively retrieves all paths and their corresponding values from an object.
 *
 * @param obj - The object from which paths are extracted.
 * @returns An array of PathValue, each containing a path and its corresponding value.
 * @throws Will throw an error if `obj` is not a string or an object.
 */
export function getAllPaths(obj: Record<string, any>): PathValue[] {
  if (!obj || !(typeof obj === 'string' || typeof obj === 'object')) {
    throw new Error(
      `[getAllPaths] the 'obj' type must be 'string' or 'object'. The given obj is '${obj}' of type '${typeof obj}'`,
    );
  }

  let result: PathValue[] = [];
  let stack: { obj: any; path: string[] }[] = [{ obj, path: [] }];

  while (stack.length > 0) {
    let { obj: currentObj, path: currentPath } = stack.pop()!;

    if (typeof currentObj !== 'object' || currentObj === null) {
      result.push({ path: currentPath, value: currentObj });
    } else {
      for (const key in currentObj) {
        if (currentObj.hasOwnProperty(key)) {
          stack.push({ obj: currentObj[key], path: currentPath.concat(key) });
        }
      }
    }
  }

  return result;
}

export const pathValueToString = (item: PathValue): string => {
  return !(item.path || []).length
    ? item.value.toString()
    : `${item.path.map((i) => `#${i}`).join('.')}.${item.value}`;
};

/**
 * Interface representing the parameters required for creating a CloudEvent.
 *
 * @property subject - A descriptive string identifying the subject or aspect of the event.
 * @property source - A URI reference that identifies the context in which the event happened.
 * @property type - A string representing the topic or category of the event.
 * @property data - An object containing event-specific data. It can be any type of data that is relevant to the event.
 */
export interface ICreateCloudEvent {
  subject: string;
  source: string;
  type: string;
  data: Record<string, any>;
  statemachineversion?: Version;
}

/**
 * Creates a new CloudEvent based on the provided parameters.
 * This function encapsulates the complexity of creating a CloudEvent by setting up necessary fields and encoding data.
 *
 * @param params - An object conforming to the ICreateCloudEvent interface, providing the necessary information to create a CloudEvent.
 * @property params.subject - A descriptive string identifying the subject or aspect of the event.
 * @property params.source - A URI reference that identifies the context in which the event happened.
 * @property params.type - A string representing the topic or category of the event.
 * @property params.data - An object containing event-specific data. It can be any type of data that is relevant to the event.
 * @returns A new instance of CloudEvent, which is a standardized event format for describing event data in a common way.
 *
 * The CloudEvent instance includes:
 * - `source`: A URI reference that uniquely identifies the origin of the event.
 * - `datacontenttype`: Set to "application/json" indicating the type of data included in the event.
 * - `data`: The actual data relevant to the event, passed as part of the `params`.
 * - `subject`: A string providing contextual information about the event.
 * - `type`: The topic or category under which this event falls.
 */
export function createCloudEvent(params: ICreateCloudEvent) {
  let data: Partial<CloudEventV1<Record<string, any>>> = {
    source: params.source,
    datacontenttype: 'application/cloudevents+json; charset=UTF-8',
    data: params.data,
    subject: params.subject,
    type: params.type,
  };
  return new CloudEvent<Record<string, any>>(data, true);
}

/**
 * An XState action that assigns event data to the context, excluding the 'type' property of the event.
 * This action is useful in scenarios where the context needs to be updated with new data from an event,
 * but the event's type should not overwrite any existing context properties.
 *
 * @returns A context object updated with the data from the event, minus the event's type.
 */
export const assignEventDataToContext = assign(({ event, context }) => {
  const { type, ...restOfEvent } = event;
  return { ...context, ...restOfEvent };
});

/**
 * An XState action that appends machine logs to the context, including information
 * from the current event and context.
 *
 * @function
 * @param {object} context - The current state machine context.
 * @param {object} event - The current event that triggered the transition.
 * @returns {object} A new context object containing the appended machine logs.
 *
 * @remarks
 * This action is designed for logging purposes within an XState machine. It appends
 * a log entry to the '__machineLogs' property in the context. Each log entry includes
 * information such as CloudEvent ID, CloudEvent data, event details, context details,
 * timestamp, and ISO timestamp.
 *
 * The resulting '__machineLogs' array provides a history of events and their associated
 * data during the execution of the state machine.
 *
 * Example usage:
 * ```typescript
 * const machineConfig = {
 *   // ... other machine configuration
 *   actions: {
 *     logMachineActivity: assignLogsToContext,
 *     // ... other actions
 *   },
 * };
 * ```
 */
export const assignLogsToContext = assign({
  __machineLogs: ({ event, context }) => {
    const { __machineLogs, __cloudevent, ...contextToLog } = context || {};
    const { __cloudevent: ce, ...eventLog } = event || {};
    return [
      ...(context?.__machineLogs || []),
      {
        cloudeventId: (ce as any)?.id,
        cloudevent: ce,
        context: contextToLog,
        timestamp: Date.now(),
        isoTime: new Date().toISOString(),
      },
    ];
  },
});

/**
 * A action which can update the orchestration time 
 * and log the checkpoint
 */
export const assignOrchestrationTimeToContext = assign({
  __orchestrationTime: ({ event, context }) => {
    const { __orchestrationTime } = context || {};
    const startTime = __orchestrationTime?.[0]?.start || Date.now()
    const checkpointTime = Date.now();
    return [
      ...(__orchestrationTime || []),
      {
        event_type: event.type, 
        start: startTime,
        checkpoint: checkpointTime,
        elapsed: checkpointTime - startTime,
      },
    ];
  },
});

/**
 * Check if an object is a dictionary-like object.
 *
 * @param obj - The object to check.
 * @returns True if the object is a dictionary-like object, false otherwise.
 */
export function isDictionary(obj: Record<string, any>) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    obj.constructor === Object &&
    Object.getPrototypeOf(obj) === Object.prototype
  );
}

/**
 * Reads the content of a file synchronously.
 * @param _path - The path to the file.
 * @param __default - The default value to return if file reading fails (default is an empty string).
 * @returns The content of the file as a string, or the default value if reading fails.
 * @throws {Error} - Throws an error if reading the file encounters an issue.
 *
 * @example
 * // Example Usage:
 * // Assuming a file named 'example.txt' with content 'Hello, World!' exists in the same directory as the calling module.
 * const fileContent = readFile('example.txt', 'Default Content');
 * console.log(fileContent); // Output: 'Hello, World!'
 *
 * // Example with Default Value:
 * // If the file 'nonexistent.txt' does not exist, the default value 'Default Content' will be returned.
 * const nonExistentFileContent = readFile('nonexistent.txt', 'Default Content');
 * console.log(nonExistentFileContent); // Output: 'Default Content'
 */
export function readFile(_path: string, __default: string = ''): string {
  try {
    // Read the file content synchronously using 'fs.readFileSync'.
    // The path is calculated relative to the current module's directory using '__dirname'.
    return fs.readFileSync(path.join(__dirname, _path), 'utf-8');
  } catch (error) {
    // Log the error message to the console.
    console.error((error as Error).message);

    // Return the default value if reading the file fails.
    return __default;
  }
}

/**
 * Creates a subject string for a given process, name, and version.
 * The subject is encoded in base64 format.
 *
 * @param processId - The ID of the process.
 * @param name - The name associated with the process.
 * @param version - The version of the process.
 * @returns A base64-encoded string representing the subject.
 * @example
 * const subject = makeSubject("12345", "ExampleProcess", "1.0.0");
 * // Result: <A base64 string>
 */
export const makeSubject = (
  processId: string,
  name: string,
  version: Version,
) => {
  const subjectObj = { processId, name, version };
  return Buffer.from(JSON.stringify(subjectObj)).toString('base64');
};

/**
 * Parses a subject string and returns an object with processId, name, and version.
 *
 * @param subject - The base64-encoded subject string.
 * @returns An object containing processId, name, and version.
 * @throws Will throw an error if the subject is invalid or missing required fields.
 * @example
 * const subjectString = <A base64 string>;
 * const parsedSubject = parseSubject(subjectString);
 * // Result: { processId: "12345", name: "ExampleProcess", version: "1.0.0" }
 */
export const parseSubject = (subject: string) => {
  try {
    const obj = JSON.parse(Buffer.from(subject, 'base64').toString('utf-8'));
    if (!obj.processId) throw new Error('No processId is found');
    if (!obj.name) throw new Error('No name is found');
    if (!obj.version) throw new Error('No version is found');
    return obj as {
      processId: string;
      name: string;
      version: Version;
    };
  } catch (err) {
    throw new Error(
      `[orchestrateCloudEvents][parseSubject] Invalid subject=${subject}. Error -> ${
        (err as Error).message
      }`,
    );
  }
};
