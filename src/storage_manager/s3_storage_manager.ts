import { S3 } from 'aws-sdk';
import { StorageManagerWithLocking, LockingManager } from './index';
import { PersistanceLockError } from '../utils';

/**
 * A StorageManager implementation for storing data on Amazon S3.
 *
 * This class provides methods to write, read, delete, and check existence
 * of files in a specified S3 bucket.
 */
export default class S3StorageManager extends StorageManagerWithLocking {
  private s3: S3;

  /**
   * S3-backed persistent storage manager.
   * Provides data storage and locking using AWS S3 and DynamoDB.
   * @param bucketName - S3 bucket for data storage
   * @param awsAccessKey - IAM access key ID (optional)
   * @param awsSecretKey - IAM secret access key (optional)
   * @param lockingManager - Handles lock acquisition
   *
   * **Usage**:
   *
   * const storage = new S3StorageManager({
   *   bucket: 'my-bucket',
   *   lockingManager: new DynamoLockingManager();
   * });
   *
   * // Save, load, delete data from S3
   * // Use lock() and unlock() for safe access
   *
   * Authentication:
   *
   * The AWS access keys are optional. If not provided, the default
   * credential provider chain will be used. Required permissions:
   *
   * - s3:GetObject, s3:PutObject on storage bucket
   * - dynamodb:GetItem, dynamodb:PutItem on locking table
   */
  constructor(
    private bucketName: string,
    private awsAccessKey?: string,
    private awsSecretKey?: string,
    private lockingManager?: LockingManager,
  ) {
    super();
    this.s3 = new S3({
      accessKeyId: this.awsAccessKey,
      secretAccessKey: this.awsSecretKey,
    });
  }

  /**
   * Reads the data from the given path on S3. If data is not found, returns a default value.
   *
   * @param path - The S3 key/path from where data should be read.
   * @param __default - The default value to return if data is not found.
   * @returns The data read from the path or the default value if data is not found.
   */
  async read(path: string, __default: string = ''): Promise<string> {
    try {
      const response = await this.s3
        .getObject({ Bucket: this.bucketName, Key: path })
        .promise();
      return response.Body?.toString() || __default;
    } catch (error) {
      if ((error as any).code === 'NoSuchKey') {
        console.log(`File ${path} not found in bucket ${this.bucketName}.`);
        return __default;
      } else {
        throw error;
      }
    }
  }

  /**
   * Deletes the data from the given path on S3.
   *
   * @param path - The S3 key/path from where data should be deleted.
   */
  async delete(path: string): Promise<void> {
    await this.s3
      .deleteObject({ Bucket: this.bucketName, Key: path })
      .promise();
    console.log(
      `File ${path} deleted successfully from bucket ${this.bucketName}.`,
    );
  }

  /**
   * Writes the specified data to the given path on S3.
   *
   * @param data - The string data to be written.
   * @param path - The S3 key/path where data should be written.
   */
  async write(data: string, path: string): Promise<void> {
    await this.s3
      .putObject({ Body: data, Bucket: this.bucketName, Key: path })
      .promise();
    console.log(
      `File ${path} has been written successfully in bucket ${this.bucketName}.`,
    );
  }

  /**
   * Check if the given path exists in the S3 bucket.
   *
   * @param path - The path (key) of the object to check.
   * @returns True if the object exists, False otherwise.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({ Bucket: this.bucketName, Key: path })
        .promise();
      return true;
    } catch (error) {
      if ((error as any).code === 'NotFound') {
        return false;
      } else {
        throw error;
      }
    }
  }

  async lock(path: string): Promise<Boolean> {
    if (!this.lockingManager) {
      throw new PersistanceLockError(
        `[lock(path=${path})] LockingManager not provided.`,
      );
    }
    return await this.lockingManager.lock(path);
  }

  async unlock(path: string): Promise<Boolean> {
    if (!this.lockingManager) {
      throw new PersistanceLockError(
        `[unlock(path=${path})] LockingManager not provided.`,
      );
    }
    return await this.lockingManager.unlock(path);
  }
}
