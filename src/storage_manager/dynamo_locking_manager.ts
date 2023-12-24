import * as AWS from 'aws-sdk';
import { LockingManager } from '.';

/**
 * Get the current timestamp in seconds since the Unix epoch.
 * @returns {number} The current timestamp in seconds.
 */
function getTimestamp(): number {
  // Create a new Date object representing now
  const now = new Date();
  // Convert date to seconds since Unix epoch
  return Math.floor(now.getTime() / 1000);
}

/**
 * A locking manager that uses AWS DynamoDB for distributed locking.
 * It provides mechanisms to acquire and release locks on resource paths
 * stored in a specified DynamoDB table.
 *
 * @remarks
 * The DynamoDB table must be configured with a primary key named `id` of type String,
 * which will store the resource paths. Optionally, a Time to Live (TTL) attribute
 * `expireAt` can be configured to automatically expire locks after a certain period,
 * ensuring stale locks do not persist indefinitely.
 *
 * **Terraform to build the table**
 * ```hcl
 * provider "aws" {
 *   # Define your AWS provider settings here
 *   # region = "us-west-2"
 *   # ...
 * }
 *
 * resource "aws_dynamodb_table" "locking_table" {
 *   name           = "lockingTable"  # You can name your table as needed
 *   billing_mode   = "PAY_PER_REQUEST"
 *   hash_key       = "id"
 *
 *   attribute {
 *     name = "id"
 *     type = "S"  # 'S' denotes a string type
 *   }
 *
 *   # Optionally, define the TTL attribute
 *   ttl {
 *     attribute_name = "expireAt"
 *     enabled        = true
 *   }
 *
 *   # Add additional settings like tags, if required
 *   tags = {
 *     Name = "LockingTable"
 *     Environment = "Production"
 *   }
 * }
 * ```
 */
export default class DynamoLockingManager extends LockingManager {
  private dynamoDb: AWS.DynamoDB.DocumentClient;

  /**
   * Creates an instance of DynamoLockingManager.
   * @param tableName - The name of the DynamoDB table to use for locking.
   * @param awsAccessKey - (Optional) AWS access key ID for authentication.
   * @param awsSecretKey - (Optional) AWS secret access key for authentication.
   * @param awsRegion - (Optional) The AWS region where the DynamoDB table is located.
   * @param timeToLiveDurationInSeconds - (Optional) The duration in seconds after which the lock will expire, defaults to 900 seconds (15 minutes).
   */
  constructor(
    private tableName: string,
    private awsAccessKey?: string,
    private awsSecretKey?: string,
    private awsRegion?: string,
    private timeToLiveDurationInSeconds: number = 900,
  ) {
    super();
    if (!tableName) {
      throw new Error(`[DynamoLockingManager] The table name cannot be empty`)
    }
    AWS.config.update({
      accessKeyId: this.awsAccessKey,
      secretAccessKey: this.awsSecretKey,
      region: this.awsRegion,
    });
    this.dynamoDb = new AWS.DynamoDB.DocumentClient();
  }

  /**
   * Attempts to acquire a lock on the specified resource path.
   * @param path - The resource path for which the lock is requested.
   * @returns {Promise<Boolean>} A promise that resolves to true if the lock is successfully acquired, or false if it fails.
   */
  async lock(path: string): Promise<Boolean> {
    const createdAt = getTimestamp();
    const params = {
      TableName: this.tableName,
      Item: {
        id: path,
        createdAt,
        expireAt: createdAt + this.timeToLiveDurationInSeconds,
      },
      ConditionExpression: 'attribute_not_exists(id)',
    };
    try {
      await this.dynamoDb.put(params).promise();
      return true;
    } catch (error) {
      const e = JSON.stringify({
        tableName: this.tableName,
        name: (error as AWS.AWSError).name,
        message: (error as AWS.AWSError).message,
        statusCode: (error as AWS.AWSError).statusCode,
        code: (error as AWS.AWSError).code,
      });
      console.error(`[Error][DynamoLockingManager.lock] ${e}`);
      return false;
    }
  }

  /**
   * Releases a lock on the specified resource path.
   * @param path - The resource path for which the lock is to be released.
   * @returns {Promise<boolean>} A promise that resolves to true if the lock is successfully released, or false if it fails.
   */
  async unlock(path: string): Promise<boolean> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: path,
      },
      ConditionExpression: 'attribute_exists(id)',
    };

    try {
      await this.dynamoDb.delete(params).promise();
      return true;
    } catch (error) {
      const e = JSON.stringify({
        tableName: this.tableName,
        name: (error as AWS.AWSError).name,
        message: (error as AWS.AWSError).message,
        statusCode: (error as AWS.AWSError).statusCode,
        code: (error as AWS.AWSError).code,
      });
      console.error(`[Error][DynamoLockingManager.unlock] ${e}`);
      return false;
    }
  }
}
