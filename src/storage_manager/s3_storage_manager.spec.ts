import { S3 } from 'aws-sdk';
import S3StorageManager from './s3_storage_manager';
import { config } from 'dotenv';

config();

const { AWS_ACCESS_KEY, AWS_SECRET_KEY, TEST_BUCKET_NAME } = process.env;

const s3 = new S3({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY
});

const createBucket = async (bucketName: string) => {
    const params = {
        Bucket: bucketName,
        ACL: 'private'
    };
    await s3.createBucket(params).promise();
};

const deleteBucket = async (bucketName: string) => {
    const params = {
        Bucket: bucketName
    };
    await s3.deleteBucket(params).promise();
};


const storageManager = new S3StorageManager(TEST_BUCKET_NAME!, AWS_ACCESS_KEY, AWS_SECRET_KEY);
const testFilePath = 'jest-test-file.txt';
const testData = 'Hello Jest!';

describe('S3StorageManager', () => {
    beforeAll(async () => {
        // Create an S3 bucket for testing
        await createBucket(TEST_BUCKET_NAME!);
    });

    afterAll(async () => {
        // Delete test files if they exist after all tests are done
        try {
            await storageManager.delete(testFilePath);
        } catch (error) {
            console.log(error)
        }
        // Delete the test S3 bucket after all tests are done
        await deleteBucket(TEST_BUCKET_NAME!);
    });

    it('should write data to S3', async () => {
        await expect(storageManager.write(testData, testFilePath)).resolves.not.toThrow();
    });

    it('should check if file exists on S3', async () => {
        await expect(storageManager.exists(testFilePath)).resolves.toBe(true);
    });

    it('should check if file does not exist on S3', async () => {
        await expect(storageManager.exists("some-random-file.txt")).resolves.toBe(false);
    });

    it('should read data from S3', async () => {
        const data = await storageManager.read(testFilePath);
        expect(data).toBe(testData);
    });

    it('should return default value if file does not exist', async () => {
        const defaultValue = 'DEFAULT_VALUE';
        const data = await storageManager.read('non-existent-file.txt', defaultValue);
        expect(data).toBe(defaultValue);
    });

    it('should delete data from S3', async () => {
        await storageManager.delete(testFilePath);
        const existsAfterDelete = await storageManager.exists(testFilePath);
        expect(existsAfterDelete).toBe(false);
    });
});
