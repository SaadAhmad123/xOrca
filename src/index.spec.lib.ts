import * as AWS from 'aws-sdk';

/**
 * Manages DynamoDB tables, providing methods to create, delete, and check the existence of tables.
 * This class encapsulates the functionality for managing DynamoDB tables,
 * including creating, deleting, and checking for their existence using the AWS SDK for JavaScript.
 */
export class DynamoDbManager {
  private db: AWS.DynamoDB;

  /**
   * Initializes a new instance of DynamoDbManager.
   *
   * @param tableName - The name of the DynamoDB table to be managed.
   * @param awsAccessKey - (Optional) AWS access key ID for authentication.
   * @param awsSecretKey - (Optional) AWS secret access key for authentication.
   * @param awsRegion - (Optional) The AWS region where the DynamoDB table is located.
   *
   * @remarks
   * Sets up the AWS SDK configuration using the provided credentials and region,
   * and initializes a DynamoDB instance for table management operations.
   */
  constructor(
    private tableName: string,
    private awsAccessKey?: string,
    private awsSecretKey?: string,
    private awsRegion?: string,
  ) {
    if (!tableName) {
      throw new Error(`[DynamoDbManager] The table name cannot be empty`);
    }

    AWS.config.update({
      accessKeyId: this.awsAccessKey,
      secretAccessKey: this.awsSecretKey,
      region: this.awsRegion,
    });

    this.db = new AWS.DynamoDB();
  }

  /**
   * Creates a DynamoDB table using the class-level table name.
   *
   * @returns {Promise<AWS.DynamoDB.CreateTableOutput>} A promise that resolves to the output of the CreateTable operation in DynamoDB.
   *
   * @remarks
   * This method creates a table with a primary key named 'id'. It sets the billing mode to 'PAY_PER_REQUEST'.
   */
  async createTable(): Promise<AWS.DynamoDB.CreateTableOutput> {
    const params: AWS.DynamoDB.CreateTableInput = {
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S', // 'S' denotes a string type
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH', // 'HASH' denotes the attribute as the primary key
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TableName: this.tableName,
    };

    return await this.db.createTable(params).promise();
  }

  /**
   * Deletes the DynamoDB table specified by the class-level table name.
   *
   * @returns {Promise<AWS.DynamoDB.DeleteTableOutput>} A promise that resolves to the output of the DeleteTable operation in DynamoDB.
   *
   * @remarks
   * This method deletes the table with the name specified in the class instance. Use with caution, as this operation is irreversible.
   */
  async deleteTable(): Promise<AWS.DynamoDB.DeleteTableOutput> {
    const params: AWS.DynamoDB.DeleteTableInput = {
      TableName: this.tableName,
    };

    return await this.db.deleteTable(params).promise();
  }

  /**
   * Checks if the specified DynamoDB table exists.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the table exists, or false otherwise.
   *
   * @remarks
   * This method attempts to retrieve details about the table. If successful, the table exists; otherwise, it does not.
   */
  async doesTableExist(): Promise<boolean> {
    try {
      await this.db.describeTable({ TableName: this.tableName }).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).code === 'ResourceNotFoundException') {
        return false;
      }
      throw error; // Re-throw the error if it's not a ResourceNotFoundException
    }
  }

  /**
   * Checks if the DynamoDB table is created and ready for use.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the table is ready for use, or false otherwise.
   *
   * @remarks
   * This method checks the table's status by calling `describeTable`. If the table's status is 'ACTIVE', it is ready for use.
   */
  async isTableReady(): Promise<boolean> {
    try {
      const response = await this.db
        .describeTable({ TableName: this.tableName })
        .promise();
      return response.Table?.TableStatus === 'ACTIVE';
    } catch (error) {
      if ((error as AWS.AWSError).code === 'ResourceNotFoundException') {
        return false;
      }
      throw error; // Re-throw the error if it's not a ResourceNotFoundException
    }
  }

  /**
   * Waits for the DynamoDB table to be ready for use, retrying every 100ms until a maximum timeout.
   *
   * @param maxTimeoutMs (default:5000ms) - The maximum time in milliseconds to wait for the table to become ready.
   * @returns {Promise<boolean>} A promise that resolves to true if the table becomes ready, or false if the timeout is reached.
   *
   * @remarks
   * This method repeatedly checks if the table is ready, waiting 100ms between each attempt,
   * until the table is ready or the maximum timeout is reached.
   */
  async waitForReady(maxTimeoutMs: number = 5000): Promise<boolean> {
    if (maxTimeoutMs <= 100) {
      throw new Error('Maximum timeout must be greater than 100ms.');
    }

    const startTime = Date.now();
    const checkInterval = 100;

    while (true) {
      if (await this.isTableReady()) {
        return true;
      }

      if (Date.now() - startTime > maxTimeoutMs) {
        return false; // Return false if the maximum timeout is reached
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
  }
}
