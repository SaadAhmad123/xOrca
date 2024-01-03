import { CloudEvent } from 'cloudevents';

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
export function getAllPaths(obj: any): PathValue[] {
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
  return new CloudEvent<Record<string, any>>(
    {
      source: params.source,
      datacontenttype: 'application/json',
      data: params.data,
      subject: params.subject,
      type: params.type,
    },
    true,
  );
}
