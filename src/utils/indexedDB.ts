// src/utils/OfflineDB.ts
class OfflineDB {
  private dbName: string;
  private dbVersion: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string, version = 1) {
    this.dbName = dbName;
    this.dbVersion = version;
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error("IndexedDB error:", (event.target as IDBRequest).error);
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result;
        if (!db.objectStoreNames.contains('attendance')) {
          db.createObjectStore('attendance', { keyPath: 'localId' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'localId' });
        }
      };
    });
  }

  async saveAttendance(data: any): Promise<string> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance', 'syncQueue'], 'readwrite');
      const localId = Date.now().toString();
      
      const attendanceStore = transaction.objectStore('attendance');
      const syncStore = transaction.objectStore('syncQueue');
      
      const record = { ...data, localId, status: 'pending' };
      
      const attendanceRequest = attendanceStore.add(record);
      const syncRequest = syncStore.add(record);
      
      attendanceRequest.onsuccess = () => {
        syncRequest.onsuccess = () => resolve(localId);
        syncRequest.onerror = (e) => {
          console.error("Error adding to sync queue:", e);
          reject((e.target as IDBRequest).error);
        };
      };
      
      attendanceRequest.onerror = (e) => {
        console.error("Error saving attendance:", e);
        reject((e.target as IDBRequest).error);
      };
    });
  }

  async getPendingSyncItems(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction('syncQueue', 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async removeSyncedItem(localId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendance', 'syncQueue'], 'readwrite');
      const attendanceStore = transaction.objectStore('attendance');
      const syncStore = transaction.objectStore('syncQueue');
      
      const attendanceRequest = attendanceStore.delete(localId);
      const syncRequest = syncStore.delete(localId);
      
      syncRequest.onsuccess = () => resolve();
      syncRequest.onerror = (e) => {
        console.error("Error removing synced item:", e);
        reject((e.target as IDBRequest).error);
      };
    });
  }
}

export const offlineDB = new OfflineDB('AttendanceDB');