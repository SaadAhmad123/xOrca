import * as fs from 'fs';
import * as path from 'path';
import { StorageManagerWithLocking, LockingManager } from './index';
import { PersistanceLockError } from '../utils';

/**
 * A local storage manager implementation using the Node.js file system.
 *
 * This class provides concrete implementations for basic storage operations
 * such as writing, reading, deleting, and checking the existence of data using
 * the Node.js file system. All paths provided are considered relative to the
 * specified root directory.
 */
export default class LocalFileStorageManager extends StorageManagerWithLocking {
  /**
   * Initializes a new instance of the LocalFileStorageManager.
   *
   * @param rootDir - The root directory for the file storage.
   * @param lockingManager - Handles lock acquisition
   */
  constructor(
    private rootDir: string,
    private lockingManager?: LockingManager,
  ) {
    super();
  }

  /**
   * Writes data to the specified path.
   *
   * If the directory doesn't exist, it gets created.
   *
   * @param data - The data to be written.
   * @param relativePath - The path where the data should be written, relative to the root directory.
   */
  async write(data: string, relativePath: string): Promise<void> {
    const fullPath = path.join(this.rootDir, relativePath);
    // Ensure the directory exists
    const directory = path.dirname(fullPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
    console.log(`File ${fullPath} has been written successfully.`);
  }

  /**
   * Reads data from the specified path. If the file is not found or any
   * other exception occurs, the default value is returned.
   *
   * @param relativePath - The path from where data should be read, relative to the root directory.
   * @param __default - The default value to return if the file is not found or an error occurs.
   * @returns The data read from the path or the default value.
   */
  async read(relativePath: string, __default: string = ''): Promise<string> {
    const fullPath = path.join(this.rootDir, relativePath);
    try {
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
      console.error(err);
      return __default;
    }
  }

  /**
   * Deletes the file at the specified path.
   *
   * If the file doesn't exist, an informational message is printed.
   *
   * @param relativePath - The path of the file to be deleted, relative to the root directory.
   */
  async delete(relativePath: string): Promise<void> {
    const fullPath = path.join(this.rootDir, relativePath);
    try {
      fs.unlinkSync(fullPath);
      console.log(`File ${fullPath} has been deleted successfully.`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`File ${fullPath} not found.`);
      } else {
        console.error(err);
      }
    }
  }

  /**
   * Checks if a file at the specified path exists.
   *
   * @param relativePath - The path to check, relative to the root directory.
   * @returns True if the file exists, False otherwise.
   */
  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(path.join(this.rootDir, relativePath));
  }

  /**
   * Acquires a lock on the specified file path.
   *
   * @param path - The file path to lock
   * @throws {PersistanceLockError} If no locking manager provided
   * @returns True if lock acquired successfully, false otherwise
   */
  async lock(path: string): Promise<Boolean> {
    if (!this.lockingManager) {
      throw new PersistanceLockError(
        `[lock(path=${path})] LockingManager not provided.`,
      );
    }
    return await this.lockingManager.lock(path);
  }

  /**
   * Releases the lock on the specified file path.
   *
   * @param path - The file path to unlock
   * @throws {PersistanceLockError} If no locking manager provided  
   * @returns True if lock released successfully, false otherwise
   */
  async unlock(path: string): Promise<Boolean> {
    if (!this.lockingManager) {
      throw new PersistanceLockError(
        `[unlock(path=${path})] LockingManager not provided.`,
      );
    }
    return await this.lockingManager.unlock(path);
  }
}
