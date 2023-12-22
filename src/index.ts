import StorageManager from './storage_manager';
import LocalFileStorageManager from './storage_manager/local_file_storage_manager';
import S3StorageManager from './storage_manager/s3_storage_manager';
import withPersistance from './with_persistant';

export {
  StorageManager,
  LocalFileStorageManager,
  S3StorageManager,
  withPersistance,
};
