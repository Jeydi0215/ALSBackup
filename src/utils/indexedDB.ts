export const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('AttendanceDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pendingLogs')) {
        db.createObjectStore('pendingLogs', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePendingLog = async (logData: any) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pendingLogs', 'readwrite');
    const store = transaction.objectStore('pendingLogs');
    const request = store.add(logData);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getPendingLogs = async () => {
  const db = await initDB();
  return new Promise<any[]>((resolve, reject) => {
    const transaction = db.transaction('pendingLogs', 'readonly');
    const store = transaction.objectStore('pendingLogs');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearPendingLogs = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pendingLogs', 'readwrite');
    const store = transaction.objectStore('pendingLogs');
    const request = store.clear();
    
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};