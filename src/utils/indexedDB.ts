export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Delete existing database if it exists to ensure clean setup
    const deleteRequest = indexedDB.deleteDatabase('AttendanceDB');
    
    deleteRequest.onsuccess = () => {
      console.log("🗑️ Old database deleted successfully");
      createNewDatabase();
    };
    
    deleteRequest.onerror = () => {
      console.log("⚠️ No existing database to delete, creating new one");
      createNewDatabase();
    };
    
    deleteRequest.onblocked = () => {
      console.log("⚠️ Database deletion blocked, proceeding with creation");
      createNewDatabase();
    };
    
    function createNewDatabase() {
      const request = indexedDB.open('AttendanceDB', 1);
      
      request.onupgradeneeded = (event) => {
        console.log("🔧 Creating new database schema");
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains('pendingLogs')) {
          const store = db.createObjectStore('pendingLogs', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          console.log("✅ Created pendingLogs object store");
        }
      };

      request.onsuccess = () => {
        console.log("✅ Database initialized successfully");
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error("❌ Database initialization failed:", request.error);
        reject(request.error);
      };
    }
  });
};

export const savePendingLog = async (logData: any): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('pendingLogs', 'readwrite');
        const store = transaction.objectStore('pendingLogs');
        const request = store.add(logData);
        
        request.onsuccess = () => {
          console.log("✅ Log saved to IndexedDB:", request.result);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error("❌ Failed to save log:", request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error("❌ Transaction failed:", transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error("❌ Error in savePendingLog transaction:", error);
        reject(error);
      }
    });
  } catch (error) {
    console.error("❌ Failed to initialize database for saving:", error);
    throw error;
  }
};

export const getPendingLogs = async (): Promise<any[]> => {
  try {
    const db = await initDB();
    return new Promise<any[]>((resolve, reject) => {
      try {
        // Check if object store exists
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("⚠️ Object store 'pendingLogs' doesn't exist, returning empty array");
          resolve([]);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readonly');
        const store = transaction.objectStore('pendingLogs');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const result = request.result || [];
          console.log(`📦 Retrieved ${result.length} pending logs from IndexedDB`);
          resolve(result);
        };
        
        request.onerror = () => {
          console.error("❌ Failed to get logs:", request.error);
          resolve([]); // Return empty array instead of rejecting
        };
        
        transaction.onerror = () => {
          console.error("❌ Transaction failed:", transaction.error);
          resolve([]); // Return empty array instead of rejecting
        };
      } catch (error) {
        console.error("❌ Error in getPendingLogs transaction:", error);
        resolve([]); // Return empty array instead of rejecting
      }
    });
  } catch (error) {
    console.error("❌ Failed to initialize database for reading:", error);
    return []; // Return empty array instead of throwing
  }
};

export const clearPendingLogs = async (): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      try {
        // Check if object store exists
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("⚠️ Object store 'pendingLogs' doesn't exist, nothing to clear");
          resolve(true);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readwrite');
        const store = transaction.objectStore('pendingLogs');
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log("🗑️ Cleared all pending logs from IndexedDB");
          resolve(true);
        };
        
        request.onerror = () => {
          console.error("❌ Failed to clear logs:", request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error("❌ Transaction failed:", transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error("❌ Error in clearPendingLogs transaction:", error);
        reject(error);
      }
    });
  } catch (error) {
    console.error("❌ Failed to initialize database for clearing:", error);
    throw error;
  }
};

export const deletePendingLog = async (id: number): Promise<boolean> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      try {
        // Check if object store exists
        if (!db.objectStoreNames.contains('pendingLogs')) {
          console.log("⚠️ Object store 'pendingLogs' doesn't exist, nothing to delete");
          resolve(true);
          return;
        }
        
        const transaction = db.transaction('pendingLogs', 'readwrite');
        const store = transaction.objectStore('pendingLogs');
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`🗑️ Deleted log ${id} from IndexedDB`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to delete log ${id}:`, request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error("❌ Transaction failed:", transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error("❌ Error in deletePendingLog transaction:", error);
        reject(error);
      }
    });
  } catch (error) {
    console.error("❌ Failed to initialize database for deleting:", error);
    throw error;
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
    console.error("❌ Failed to get database info:", error);
    return {
      supported: true,
      objectStores: [],
      recordCount: 0
    };
  }
};