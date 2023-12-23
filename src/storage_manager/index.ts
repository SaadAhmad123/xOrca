/**
 * Abstract base class representing a generic storage manager.
 *
 * This class provides an interface for basic storage operations,
 * such as writing, reading, deleting, and checking the existence of data.
 * Implementations should provide concrete implementations for these operations.
 */
export default abstract class StorageManager {
  /**
   * Writes the specified data to the specified path.
   *
   * @param data - The data to be written.
   * @param path - The path where data should be written.
   */
  abstract write(data: string, path: string): Promise<void>;

  /**
   * Reads data from the specified path. If data is not found, the default value is returned.
   *
   * @param path - The path from where data should be read.
   * @param __default - The default value to return if data is not found.
   * @returns The data read from the path or the default value if data is not found.
   */
  abstract read(path: string, __default: string): Promise<string>;

  /**
   * Deletes data from the specified path.
   *
   * @param path - The path from where data should be deleted.
   */
  abstract delete(path: string): Promise<void>;

  /**
   * Checks if the specified data exists.
   *
   * @param path - The path on which to check if the data exists.
   * @returns True if the data exists, False otherwise.
   */
  abstract exists(path: string): Promise<boolean>;
}

/**
 * Abstract base class representing a storage manager with locking capabilities.
 *
 * This class extends the base StorageManager class and adds support for
 * locking/unlocking access to specific paths.
 */
export abstract class StorageManagerWithLocking extends StorageManager {
  /**
   * Acquires a lock on the specified path.
   *
   * @param path - The path to lock
   * @returns A promise resolving to true if the lock was acquired, false otherwise.
   */
  abstract lock(path: string): Promise<Boolean>;

  /**
   * Releases a previously acquired lock on the specified path.
   *
   * @param path - The path to unlock
   * @returns A promise resolving once the lock has been released.
   */
  abstract unlock(path: string): Promise<Boolean>;
}
