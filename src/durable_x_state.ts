import StorageManager from "./storage_manager";

export default class DurableXState {
    private storageManager: StorageManager
    
    constructor (storageManager: StorageManager) {
        this.storageManager = storageManager
    }
}