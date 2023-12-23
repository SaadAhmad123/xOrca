import { Actor, AnyActorLogic, Snapshot } from 'xstate';
import { WithPersistanceInput } from './types';
import { StorageManagerWithLocking } from './storage_manager';

/**
 * Custom error when lock acquisition fails
 */
export class PersistanceLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistanceLockError';
  }
}

/**
 * Small helper to wait for a specified duration
 *
 * @param ms - Duration to wait in milliseconds
 */
export const waitForTime = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Attempt to acquire a lock, retrying if needed
 *
 * @param pathToLock - The resource path to lock
 * @param storageManager - StorageManager interface
 * @param maxRetry - Max retry attempts
 * @param retryWait - Wait duration between retries
 *
 * @throws {PersistanceLockError} - If lock not acquired after max retries
 */
export async function acquireLock(
  pathToLock: string,
  storageManger: StorageManagerWithLocking,
  maxRetry: number = 5,
  retryWait: number = 400,
): Promise<void> {
  for (let i = 0; i < maxRetry; i++) {
    const lockAcquired = await storageManger.lock(pathToLock);
    if (lockAcquired) return;
    await waitForTime(retryWait);
  }
  throw new PersistanceLockError(
    `Could not acquire lock on path ${pathToLock}.`,
  );
}
