/**
 * Custom error class for errors related to creating state machines from YAML.
 * This error class extends the built-in Error class.
 */
export class CreateMachineYamlError extends Error {
  private _details: any;

  /**
   * Getter for the 'details' property, containing additional information about the error.
   * @returns Additional details about the validation error.
   */
  public get details() {
    return this._details;
  }

  /**
   * Constructor for CreateMachineYamlError.
   * @param message - A descriptive error message.
   * @param details - Additional details about the error (default is an empty object).
   */
  constructor(message: string, details: any = {}) {
    // Call the constructor of the base Error class with the provided message.
    super(message);

    // Set the private '_details' property with the provided details.
    this._details = details;
  }
}
