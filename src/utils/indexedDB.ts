export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('AttendanceDB', 1);
      
      request.onupgradeneeded = (event) => {
        console.log("Creating database schema");
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('pendingLogs')) {
          const store = db.createObjectStore('pendingLogs', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          console.log("Created pendingLogs object store");
        }
      };

      request.onsuccess = () => {
        console.log("Database initialized successfully");
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error("Database initialization failed:", request.error);
        reject(new Error(`Database failed: ${request.error}`));
      };

      request.onblocked = () => {
        console.warn("Database blocked");
        reject(new Error("Database blocked - close other tabs"));
      };
    } catch (error) {
      console.error("Error opening database:", error);
      reject(error);
    }
  });
};

export const savePendingLog = async (logData: any): Promise<any> => {
  console.log("Saving log to IndexedDB...");
  
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('pendingLogs', 'readwrite');
        
        transaction.onerror = () => {
          console.error("Transaction error:", transaction.error);
          reject(new Error(`Transaction failed: ${transaction.error}`));
        };
        
        const store = transaction.objectStore('pendingLogs');
        const dataToSave = {
          ...logData,
          savedAt: new Date().toISOString()
        };
        
        const request = store.add(dataToSave);
        
        request.onsuccess = () => {
          console.log("Log saved successfully with ID:", request.result);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error("Save request failed:", request.error);
          reject(new Error(`Save failed: ${request.error}`));
        };
      } catch (transactionError) {
        console.error("Transaction setup error:", transactionError);
        reject(transactionError);
      }
    });
  } catch (initError) {
    console.error("Database init error:", initError);
    throw new Error(`Database initialization failed: ${initError.message}`);
  }
};

export const getPendingLogs = async (): Promise<any[]> => {
  console.log("Getting logs from IndexedDB...");
  
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("Object store doesn't exist, returning empty array");
          resolve([]);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readonly');
        const store = transaction.objectStore('pendingLogs');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const result = request.result || [];
          console.log(`Retrieved ${result.length} logs from IndexedDB`);
          resolve(result);
        };
        
        request.onerror = () => {
          console.error("Get logs failed:", request.error);
          resolve([]);
        };
        
        transaction.onerror = () => {
          console.error("Transaction failed:", transaction.error);
          resolve([]);
        };
      } catch (error) {
        console.error("Error in getPendingLogs:", error);
        resolve([]);
      }
    });
  } catch (error) {
    console.error("Failed to get logs:", error);
    return [];
  }
};

export const clearPendingLogs = async (): Promise<boolean> => {
  console.log("Clearing all logs from IndexedDB...");
  
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("Object store doesn't exist, nothing to clear");
          resolve(true);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readwrite');
        const store = transaction.objectStore('pendingLogs');
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log("Cleared all logs successfully");
          resolve(true);
        };
        
        request.onerror = () => {
          console.error("Clear failed:", request.error);
          resolve(false);
        };
        
        transaction.onerror = () => {
          console.error("Transaction failed:", transaction.error);
          resolve(false);
        };
      } catch (error) {
        console.error("Error in clearPendingLogs:", error);
        resolve(false);
      }
    });
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return false;
  }
};

export const deletePendingLog = async (id: number): Promise<boolean> => {
  console.log("Deleting log from IndexedDB:", id);
  
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      try {
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("Object store doesn't exist, nothing to delete");
          resolve(true);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readwrite');
        const store = transaction.objectStore('pendingLogs');
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`Deleted log ${id} successfully`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`Failed to delete log ${id}:`, request.error);
          resolve(false);
        };
        
        transaction.onerror = () => {
          console.error("Transaction failed:", transaction.error);
          resolve(false);
        };
      } catch (error) {
        console.error("Error in deletePendingLog:", error);
        resolve(false);
      }
    });
  } catch (error) {
    console.error("Failed to delete log:", error);
    return false;
  }
};

// Utility function to check if IndexedDB is supported
export const isIndexedDBSupported = (): boolean => {
  return 'indexedDB' in window && indexedDB !== null;
};

// Utility function to get database info
export const getDatabaseInfo = async (): Promise<{
  supported: boolean;
  objectStores: string[];
  recordCount: number;
}> => {
  if (!isIndexedDBSupported()) {
    return {
      supported: false,
      objectStores: [],
      recordCount: 0
    };
  }
  
  try {
    const db = await initDB();
    const objectStores = Array.from(db.objectStoreNames);
    const logs = await getPendingLogs();
    
    return {
      supported: true,
      objectStores,
      recordCount: logs.length
    };
  } catch (error) {
    console.error("Failed to get database info:", error);
    return {
      supported: true,
      objectStores: [],
      recordCount: 0
    };
  }
};