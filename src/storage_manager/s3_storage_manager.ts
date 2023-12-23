import { S3 } from 'aws-sdk';
import { StorageManagerWithLocking } from '.';

/**
 * A StorageManager implementation for storing data on Amazon S3.
 *
 * This class provides methods to write, read, delete, and check existence
 * of files in a specified S3 bucket.
 */
export default class S3StorageManager extends StorageManagerWithLocking {
  private s3: S3;
  private bucketName: string;

  /**
   * Initializes an instance of the S3StorageManager with the given parameters.
   *
   * @param bucketName - Name of the S3 bucket to operate on.
   * @param awsAccessKey - AWS access key ID (optional if configured elsewhere).
   * @param awsSecretKey - AWS secret access key (optional if configured elsewhere).
   */
  constructor(
    bucketName: string,
    private awsAccessKey?: string,
    private awsSecretKey?: string,
  ) {
    super();
    this.bucketName = bucketName;

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
    return true;
  }

  async unlock(path: string): Promise<Boolean> {
    return true;
  }
}
