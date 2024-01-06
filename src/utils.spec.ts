import {
  getAllPaths,
  createCloudEvent,
  isDictionary,
  PathValue,
} from './utils'; // Replace 'yourFileName' with the actual file name

describe('getAllPaths', () => {
  test('returns paths and values from an object', () => {
    const obj = { a: { b: { c: 'value' } }, x: { y: 'anotherValue' } };
    const result = getAllPaths(obj);
    expect(result).toEqual([
      { path: ['x', 'y'], value: 'anotherValue' },
      { path: ['a', 'b', 'c'], value: 'value' },
    ]);
  });

  test('throws an error for invalid input', () => {
    const invalidInput: any = 234324342;
    expect(() => getAllPaths(invalidInput)).toThrowError(
      /the 'obj' type must be 'string' or 'object'/,
    );
  });
});

describe('createCloudEvent', () => {
  test('creates a CloudEvent with the provided parameters', () => {
    const params = {
      subject: 'subjectValue',
      source: 'sourceValue',
      type: 'eventType',
      data: { key: 'value' },
    };
    const result = createCloudEvent(params);
    // Assuming you have a CloudEvent class with toJSON method
    expect(result.toJSON()).toMatchObject({
      source: 'sourceValue',
      datacontenttype: 'application/cloudevents+json; charset=UTF-8',
      data: { key: 'value' },
      subject: 'subjectValue',
      type: 'eventType',
    });
  });
});

describe('isDictionary', () => {
  test('returns true for a dictionary-like object', () => {
    const dict = { key: 'value' };
    expect(isDictionary(dict)).toBe(true);
  });

  test('returns false for non-dictionary-like object', () => {
    const nonDict: any = 'notADictionary';
    expect(isDictionary(nonDict)).toBe(false);
  });
});
