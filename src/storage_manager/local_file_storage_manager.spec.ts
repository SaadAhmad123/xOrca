import * as fs from 'fs';
import * as path from 'path';
import LocalFileStorageManager from './local_file_storage_manager'; // Update this path to the correct location

describe('LocalFileStorageManager', () => {
  let rootDir: string;
  let manager: LocalFileStorageManager;

  beforeAll(() => {
    // Create a temporary directory for testing
    rootDir = path.join(__dirname, 'tempTestDir');
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir);
    }
    manager = new LocalFileStorageManager(rootDir);
  });

  afterAll(() => {
    // Clean up and delete the temporary directory after tests
    fs.rmdirSync(rootDir, { recursive: true });
  });

  it('should write data to a file', async () => {
    const data = 'Hello World';
    const relativePath = 'testFile.txt';

    await manager.write(data, relativePath);

    const writtenData = fs.readFileSync(
      path.join(rootDir, relativePath),
      'utf-8',
    );
    expect(writtenData).toBe(data);
  });

  it('should write data to a file in a non existant directory', async () => {
    const data = 'Hello World';
    const relativePath = 'temp_test/testFile.txt';
    await manager.write(data, relativePath);
    const writtenData = fs.readFileSync(
      path.join(rootDir, relativePath),
      'utf-8',
    );
    expect(writtenData).toBe(data);
  });

  it('should read data from a file', async () => {
    const data = 'Hello Again';
    const relativePath = 'anotherTestFile.txt';
    fs.writeFileSync(path.join(rootDir, relativePath), data);

    const readData = await manager.read(relativePath);
    expect(readData).toBe(data);
  });

  it('should return default value when reading from a non-existent file', async () => {
    const defaultValue = 'Default Value';
    const readData = await manager.read('nonExistentFile.txt', defaultValue);

    expect(readData).toBe(defaultValue);
  });

  it('should delete a file', async () => {
    const relativePath = 'fileToDelete.txt';
    fs.writeFileSync(path.join(rootDir, relativePath), 'Data to be deleted');

    await manager.delete(relativePath);

    const fileExists = fs.existsSync(path.join(rootDir, relativePath));
    expect(fileExists).toBe(false);
  });

  it('should not throw an error when trying to delete a non-existent file', async () => {
    const relativePath = 'nonExistentFileToDelete.txt';

    await expect(manager.delete(relativePath)).resolves.not.toThrow();
  });

  it('should check if a file exists', async () => {
    const relativePath = 'existentFile.txt';
    fs.writeFileSync(path.join(rootDir, relativePath), 'Some data');

    const doesExist = await manager.exists(relativePath);
    expect(doesExist).toBe(true);
  });

  it('should check if a file does not exist', async () => {
    const doesNotExist = await manager.exists('nonExistentFileCheck.txt');
    expect(doesNotExist).toBe(false);
  });
});
