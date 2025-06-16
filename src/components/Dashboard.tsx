import { useState, useEffect, useRef } from "react";
import styles from "../css/Dashboard.module.css";
import Camera from "../assets/camera.png";
import Eye from "../assets/eye.png";
import { useAuth } from "../context/AuthContext";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch,
  addDoc,
  GeoPoint,
  serverTimestamp,
  setDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import html2pdf from "html2pdf.js";
import dtrStyles from "../css/DTR.css?inline";
import { savePendingLog, getPendingLogs, clearPendingLogs } from "../utils/indexedDB";

interface UserData {
  firstName: string;
  surname: string;
}

interface ClockLogEntry {
  imageUrl: string;
  id: string;
  uid: string;
  key: string;
  time?: Timestamp;
  timeString: string;
  date: string;
  image?: string;
  status?: string;
  userFirstName?: string;
  userSurname?: string;
  isAuto?: boolean;
  notes?: string;
}

interface DashboardProps {
  handleCameraClick: (key: string, isOffline?: boolean) => void;
  showCamera: boolean;
}

interface WeeklyReportDay {
  id?: string;
  date: string;
  clockIn?: string;
  breakIn?: string;
  breakOut?: string;
  clockOut?: string;
  workingHours: string;
  status?: string;
  userId?: string;
  logIds: string[];
  employeeName?: string;
  isComplete: boolean;
  hasPending?: boolean;
}

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
        console.log("IndexedDB opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result;
        console.log("IndexedDB upgrade needed");

        if (!db.objectStoreNames.contains("attendance")) {
          const attendanceStore = db.createObjectStore("attendance", {
            keyPath: "localId",
          });
          console.log("Created attendance object store");
        }

        if (!db.objectStoreNames.contains("syncQueue")) {
          const syncStore = db.createObjectStore("syncQueue", {
            keyPath: "localId",
          });
          console.log("Created syncQueue object store");
        }
      };
    });
  }

  async saveAttendance(data: any): Promise<string> {
    console.log("Saving attendance to IndexedDB:", data);

    if (!this.db) {
      console.log("Database not initialized, initializing...");
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ["attendance", "syncQueue"],
        "readwrite"
      );
      const localId = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const attendanceStore = transaction.objectStore("attendance");
      const syncStore = transaction.objectStore("syncQueue");

      const record = { ...data, localId, status: "pending" };
      console.log("Record to save:", record);

      transaction.oncomplete = () => {
        console.log("IndexedDB transaction completed successfully");
        resolve(localId);
      };

      transaction.onerror = (e) => {
        console.error("IndexedDB transaction error:", e);
        reject((e.target as IDBRequest).error);
      };

      const attendanceRequest = attendanceStore.add(record);
      attendanceRequest.onsuccess = () => {
        console.log("Added to attendance store");
        const syncRequest = syncStore.add(record);
        syncRequest.onerror = (e) => {
          console.error("Error adding to sync queue:", e);
        };
      };

      attendanceRequest.onerror = (e) => {
        console.error("Error saving attendance:", e);
      };
    });
  }

  async getPendingSyncItems(): Promise<any[]> {
    if (!this.db) await this.init();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction("syncQueue", "readonly");
      const store = transaction.objectStore("syncQueue");
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(
          "Retrieved pending sync items:",
          request.result?.length || 0
        );
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error("Error getting pending sync items");
        resolve([]);
      };
    });
  }

  async removeSyncedItem(localId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ["attendance", "syncQueue"],
        "readwrite"
      );
      const attendanceStore = transaction.objectStore("attendance");
      const syncStore = transaction.objectStore("syncQueue");

      transaction.oncomplete = () => {
        console.log("Removed synced item:", localId);
        resolve();
      };

      transaction.onerror = (e) => {
        console.error("Error removing synced item:", e);
        reject((e.target as IDBRequest).error);
      };

      attendanceStore.delete(localId);
      syncStore.delete(localId);
    });
  }

  // New method to check both IndexedDB and localStorage
  async getAllPendingItems(): Promise<any[]> {
    const indexedDBItems = await this.getPendingSyncItems();

    // Check localStorage fallback items
    const localStorageItems: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("attendance_")) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || "{}");
          localStorageItems.push({
            ...item,
            localId: key,
            isFromLocalStorage: true,
          });
        } catch (error) {
          console.error("Error parsing localStorage item:", key, error);
        }
      }
    }

    console.log(
      "Found items - IndexedDB:",
      indexedDBItems.length,
      "localStorage:",
      localStorageItems.length
    );
    return [...indexedDBItems, ...localStorageItems];
  }
}

const offlineDB = new OfflineDB("AttendanceDB");

const Dashboard: React.FC<DashboardProps> = ({ handleCameraClick }) => {
  const actionKeyRef = useRef<string>("clockIn");
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [clockLog, setClockLog] = useState<ClockLogEntry[]>([]);
  const [time, setTime] = useState("");
  const [timestamps, setTimestamps] = useState({
    clockIn: "",
    breakIn: "",
    breakOut: "",
    clockOut: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // New state for sync functionality
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [pendingCount, setPendingCount] = useState(0);

  // Function to check pending items count from both sources
  const checkPendingItems = async () => {
    try {
      // Get IndexedDB items using your functions with error handling
      let indexedDBItems: any[] = [];
      try {
        indexedDBItems = await getPendingLogs();
      } catch (indexedDBError) {
        console.error("Error getting IndexedDB items:", indexedDBError);
        // Continue with localStorage only if IndexedDB fails
      }
      
      // Get localStorage items (Home.tsx format)
      let localStorageCount = 0;
      if (currentUser) {
        const localStorageKey = `offline_clock_entries_${currentUser.uid}`;
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
          try {
            const entries = JSON.parse(stored);
            localStorageCount = entries.length;
          } catch (error) {
            console.error("Error parsing localStorage entries:", error);
          }
        }
      }
      
      const totalCount = indexedDBItems.length + localStorageCount;
      setPendingCount(totalCount);
      console.log(`📊 Updated pending count: ${totalCount} (IndexedDB: ${indexedDBItems.length}, localStorage: ${localStorageCount})`);
    } catch (error) {
      console.error("Error checking pending items:", error);
      setPendingCount(0);
    }
  };

  // FIXED syncPendingData function with all improvements
  const syncPendingData = async (isManualSync = false) => {
    try {
      if (isManualSync) {
        setSyncStatus("syncing");
        console.log("Starting manual sync...");
      }

      // Get all pending items from both IndexedDB and localStorage
      const allPendingItems = await offlineDB.getAllPendingItems();

      if (allPendingItems.length === 0) {
        console.log("✅ No offline records to sync.");
        if (isManualSync) {
          setSyncStatus("success");
          setTimeout(() => setSyncStatus("idle"), 2000);
        }
        setPendingCount(0);
        return;
      }

      console.log(`🔄 Syncing ${allPendingItems.length} offline records...`);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      const processedItems: any[] = []; // Track successfully processed items

      // Process each item sequentially
      for (const item of allPendingItems) {
        const { localId, status, isFromLocalStorage, ...rawFirebaseData } =
          item;

        try {
          console.log("Syncing item:", localId);
          console.log("Raw data:", rawFirebaseData);

          // Validate required fields
          if (
            !rawFirebaseData.uid ||
            !rawFirebaseData.key ||
            !rawFirebaseData.timeString ||
            !rawFirebaseData.date
          ) {
            throw new Error(`Missing required fields for item ${localId}`);
          }

          // Create proper Timestamp - FIX: Handle different time formats correctly
          let firestoreTime;
          if (item.isFromLocalStorage && item.timestamp) {
            // From localStorage format - timestamp is a number
            firestoreTime = Timestamp.fromDate(new Date(item.timestamp));
          } else if (item.time) {
            // From IndexedDB format - handle Timestamp objects
            if (item.time instanceof Timestamp) {
              firestoreTime = item.time;
            } else if (typeof item.time === 'object' && (item.time.seconds || item.time._seconds)) {
              const seconds = item.time.seconds || item.time._seconds;
              const nanoseconds = item.time.nanoseconds || item.time._nanoseconds || 0;
              firestoreTime = new Timestamp(seconds, nanoseconds);
            } else {
              // Fallback: try to parse as date
              firestoreTime = Timestamp.fromDate(new Date(item.time));
            }
          } else {
            // No time data available, use current time
            firestoreTime = Timestamp.now();
          }

          // Build clean data object for Firebase
          const cleanedData: any = {
            uid: String(item.uid),
            key: String(item.key),
            time: firestoreTime,
            timeString: String(rawFirebaseData.timeString),
            date: String(rawFirebaseData.date),
            status: String(rawFirebaseData.status || "pending"),
            imageUrl: String(rawFirebaseData.imageUrl || ""),
            userFirstName: String(rawFirebaseData.userFirstName || ""),
            userSurname: String(rawFirebaseData.userSurname || ""),
            isAuto: Boolean(rawFirebaseData.isAuto),
            notes: String(rawFirebaseData.notes || ""),
          };

          // Add location if it exists and is valid
          if (
            rawFirebaseData.location &&
            typeof rawFirebaseData.location.latitude === "number" &&
            typeof rawFirebaseData.location.longitude === "number" &&
            !isNaN(rawFirebaseData.location.latitude) &&
            !isNaN(rawFirebaseData.location.longitude)
          ) {
            cleanedData.location = {
              coordinates: new GeoPoint(
                rawFirebaseData.location.latitude,
                rawFirebaseData.location.longitude
              ),
              address: String(rawFirebaseData.location.address || ""),
              timestamp: serverTimestamp(),
            };
          }

          console.log("📤 Sending to Firebase:", cleanedData);
          
          // Add to Firebase with timeout - FIX: Proper error handling
          const docRef = await Promise.race([
            addDoc(collection(db, "clockLog"), cleanedData),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Firebase timeout after 15 seconds')), 15000)
            )
          ]);
          
          console.log("✅ Document added with ID:", docRef.id);
          
          // Mark item as successfully processed
          processedItems.push(item);
          successCount++;
          
          // Small delay between operations to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error: any) {
          console.error(`❌ Error syncing item ${item.id}:`, error);
          errors.push(`${item.id}: ${error.message}`);
          errorCount++;
          
          // Continue with next item instead of stopping
          continue;
        }
      }

      // Remove successfully synced items from storage
      if (processedItems.length > 0) {
        console.log(`🗑️ Removing ${processedItems.length} successfully synced items from storage...`);
        
        // Remove from localStorage
        const localStorageProcessed = processedItems.filter(item => item.isFromLocalStorage);
        if (localStorageProcessed.length > 0 && currentUser) {
          const localStorageKey = `offline_clock_entries_${currentUser.uid}`;
          const stored = localStorage.getItem(localStorageKey);
          if (stored) {
            try {
              const entries = JSON.parse(stored);
              const processedIds = localStorageProcessed.map(item => item.id);
              const filteredEntries = entries.filter((entry: any) => !processedIds.includes(entry.id));
              
              if (filteredEntries.length === 0) {
                localStorage.removeItem(localStorageKey);
              } else {
                localStorage.setItem(localStorageKey, JSON.stringify(filteredEntries));
              }
              console.log(`🗑️ Removed ${localStorageProcessed.length} items from localStorage`);
            } catch (error) {
              console.error("Error updating localStorage:", error);
            }
          }
        }

        // Remove from IndexedDB - only if we had IndexedDB items processed
        const indexedDBProcessed = processedItems.filter(item => !item.isFromLocalStorage);
        if (indexedDBProcessed.length > 0) {
          try {
            await clearPendingLogs();
            console.log("🗑️ Cleared all IndexedDB entries");
          } catch (error) {
            console.error("Error clearing IndexedDB:", error);
          }
        }
      }
      
      console.log(`✅ Sync complete. Success: ${successCount}, Errors: ${errorCount}`);
      
      if (errors.length > 0) {
        console.error("Sync errors:", errors);
      }
      
      if (isManualSync) {
        if (errorCount === 0) {
          setSyncStatus("success");
          setTimeout(() => setSyncStatus("idle"), 3000);
        } else {
          setSyncStatus("error");
          setTimeout(() => setSyncStatus("idle"), 3000);
          // Show specific error to user
          alert(
            `Sync completed with errors. ${successCount} items synced, ${errorCount} failed. Check console for details.`
          );
        }
      }
      
      // Update pending count
      await checkPendingItems();
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('syncCompleted', { 
        detail: { successCount, errorCount } 
      }));
      
    } catch (error: any) {
      console.error("❌ Error during offline sync:", error);
      if (isManualSync) {
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 3000);
        alert(`Sync failed: ${error.message}`);
      }
    }
  };

  // Manual sync button handler
  const handleManualSync = async () => {
    if (!isOnline) {
      alert(
        "You are currently offline. Please check your internet connection and try again."
      );
      return;
    }

    if (syncStatus === "syncing") {
      console.log("⚠️ Sync already in progress");
      return;
    }

    console.log("🔄 Manual sync triggered");
    await syncPendingData(true);
  };

  // IMPROVED useEffect for online/offline handling
  useEffect(() => {
    const handleOnline = async () => {
      console.log("🌐 Connection restored - going online");
      setIsOnline(true);
      
      // Wait a bit for connection to stabilize, then sync
      setTimeout(async () => {
        console.log("🔄 Auto-syncing after connection restored...");
        try {
          await syncPendingData();
          console.log("✅ Auto-sync completed successfully");
        } catch (error) {
          console.error("❌ Auto-sync failed:", error);
        }
      }, 2000); // Increased delay for connection stability
    };
    
    const handleOffline = () => {
      console.log("📱 Connection lost - going offline");
      setIsOnline(false);
      setShowOfflineAlert(true);
    };

    // Add custom event listener for sync triggers from other components
    const handleTriggerSync = async () => {
      console.log("🔔 Sync triggered by external event");
      if (isOnline) {
        try {
          await syncPendingData();
          console.log("✅ External sync completed successfully");
        } catch (error) {
          console.error("❌ External sync failed:", error);
        }
      } else {
        console.log("⚠️ Cannot sync - currently offline");
      }
    };

    // Add visibility change handler to sync when app becomes visible
    const handleVisibilityChange = async () => {
      if (!document.hidden && navigator.onLine && isOnline) {
        console.log("👁️ App became visible - checking for pending sync");
        setTimeout(async () => {
          try {
            await checkPendingItems();
            if (pendingCount > 0) {
              console.log(`🔄 Found ${pendingCount} pending items, syncing...`);
              await syncPendingData();
            }
          } catch (error) {
            console.error("❌ Visibility sync failed:", error);
          }
        }, 1000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('triggerOfflineSync', handleTriggerSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial setup
    console.log("🚀 Dashboard mounted, initializing...");
    console.log("🔌 Initial online status:", navigator.onLine);
    
    // Check pending items and auto-sync if online
    const initializeSync = async () => {
      try {
        await checkPendingItems();
        if (navigator.onLine) {
          console.log("🔄 Initial sync check...");
          await syncPendingData();
        }
      } catch (error) {
        console.error("❌ Initial sync failed:", error);
      }
    };
    
    initializeSync();

    // Check pending items periodically (every 30 seconds instead of 10)
    const intervalId = setInterval(async () => {
      try {
        await checkPendingItems();
        // Also try to sync if online and there are pending items
        if (navigator.onLine && isOnline && pendingCount > 0) {
          console.log("⏰ Periodic sync check - found pending items");
          await syncPendingData();
        }
      } catch (error) {
        console.error("❌ Periodic check failed:", error);
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('triggerOfflineSync', handleTriggerSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [isOnline, pendingCount]); // Added pendingCount as dependency

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const q = currentUser.admin
      ? query(
          collection(db, "clockLog"),
          where("status", "==", "pending"),
          orderBy("time", "desc")
        )
      : query(
          collection(db, "clockLog"),
          where("uid", "==", currentUser.uid),
          orderBy("time", "desc")
        );

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const logs = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ClockLogEntry[];

        setClockLog(logs);

        if (!currentUser.admin) {
          const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
          });

          const newTimestamps = {
            clockIn: "-",
            breakIn: "-",
            breakOut: "-",
            clockOut: "-",
          };

          const todayLogs = logs.filter((log) => log.date === today);

          todayLogs.forEach((log) => {
            let timeStr = log.timeString;

            // Adjust clock-in before 8:00 AM
            if (log.key === "clockIn" && parseTimeToMinutes(timeStr) < 8 * 60) {
              timeStr = "8:00 AM (auto)";
            }

            // Adjust clock-out between 5:00 PM and 8:00 PM
            if (
              log.key === "clockOut" &&
              parseTimeToMinutes(timeStr) >= 17 * 60 &&
              parseTimeToMinutes(timeStr) < 20 * 60
            ) {
              timeStr = "5:00 PM (auto)";
            }

            if (log.key && newTimestamps[log.key] === "-") {
              newTimestamps[log.key] = timeStr;
            }
          });

          setTimestamps(newTimestamps);

          // Handle missed 8PM clock-out
          const hasClockIn = todayLogs.some((log) => log.key === "clockIn");
          const hasClockOut = todayLogs.some((log) => log.key === "clockOut");
          const now = new Date();
          const isAfter8PM = now.getHours() >= 20;

          if (hasClockIn && !hasClockOut && isAfter8PM && !isProcessing) {
            setIsProcessing(true);
            try {
              await addDoc(collection(db, "clockLog"), {
                uid: currentUser.uid,
                key: "clockOut",
                time: null,
                timeString: "NULL (Missed 8PM)",
                date: today,
                status: "pending",
                imageUrl: "",
                location: "",
                userFirstName: userData?.firstName,
                userSurname: userData?.surname,
                isAuto: true,
                notes: "Missed 8:00 PM clock-out cutoff",
              });
            } catch (err) {
              console.error("Auto clock-out failed:", err);
            } finally {
              setIsProcessing(false);
            }
          }
        }
      },
      (error) => {
        console.error("Error fetching logs:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser, isProcessing, userData]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      };
      setTime(now.toLocaleTimeString("en-US", options) + " PHT");
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateWorkingHours = (
    clockInTime: string,
    breakInTime: string,
    breakOutTime: string,
    clockOutTime: string
  ) => {
    const isAutoClockOut =
      !clockOutTime &&
      (new Date().getHours() > 17 ||
        (new Date().getHours() === 17 && new Date().getMinutes() >= 30));
    const effectiveClockOut = isAutoClockOut ? "5:00 PM" : clockOutTime;

    if (!clockInTime || !effectiveClockOut) return "-";

    const clockInMinutes = parseTimeToMinutes(clockInTime);
    let startTimeMinutes = clockInMinutes;

    const EIGHT_AM = 8 * 60;
    const isEarlyClockIn = clockInMinutes < EIGHT_AM;
    if (isEarlyClockIn) {
      startTimeMinutes = EIGHT_AM;
    }

    const clockOutMinutes = parseTimeToMinutes(effectiveClockOut);
    let totalMinutes = clockOutMinutes - startTimeMinutes;

    if (breakInTime && breakOutTime) {
      const breakInMinutes = parseTimeToMinutes(breakInTime);
      const breakOutMinutes = parseTimeToMinutes(breakOutTime);
      totalMinutes -= breakOutMinutes - breakInMinutes;
    }

    if (totalMinutes <= 0) return "0m";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let suffix = "";
    if (isAutoClockOut) suffix += "*";
    if (isEarlyClockIn) suffix += "⁑";

    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m${suffix}`;
  };

  // Enhanced handleCameraButtonClick with debugging
  const handleCameraButtonClick = async (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("📷 Camera button clicked for:", key);
    console.log("🔍 Button enabled check:", isButtonEnabled(key));

    if (!isButtonEnabled(key)) {
      alert(
        `You have already submitted your "${key.replace(
          /([A-Z])/g,
          " $1"
        )}" today.`
      );
      return;
    }

    actionKeyRef.current = key;
    console.log(" Action key set to:", actionKeyRef.current);
    console.log(" Calling handleCameraClick with:", {
      key,
      isOffline: !isOnline,
    });

    handleCameraClick(key, !isOnline);
  };

  const getWeeklyReportData = (): WeeklyReportDay[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    const dates: Record<string, WeeklyReportDay> = {};

    clockLog.forEach((log) => {
      if (!log.time || !log.key || !log.timeString) return;

      const logDateObj =
        log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time);
      const logDateStr = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      if (logDateObj < sevenDaysAgo || logDateObj > now) return;

      const groupKey = currentUser?.admin
        ? `${log.uid}_${logDateStr}`
        : logDateStr;

      if (!dates[groupKey]) {
        dates[groupKey] = {
          date: logDateStr,
          workingHours: "",
          userId: log.uid,
          logIds: [],
          employeeName: currentUser?.admin
            ? `${log.userFirstName || ""} ${log.userSurname || ""}`.trim()
            : undefined,
          isComplete: false,
          hasPending: true,
        };
      }

      dates[groupKey].logIds.push(log.id);

      if (!dates[groupKey][log.key]) {
        dates[groupKey][log.key] = log.timeString;
      }

      dates[groupKey].status = log.status;
    });

    Object.values(dates).forEach((day) => {
      day.workingHours = calculateWorkingHours(
        day.clockIn || "",
        day.breakIn || "",
        day.breakOut || "",
        day.clockOut || ""
      );

      day.isComplete = !!day.clockIn && !!day.clockOut;
    });

    return Object.values(dates).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const calculateUndertime = (entry: WeeklyReportDay): string => {
    const expectedMinutes = 8 * 60;

    const parseMinutes = (time: string | undefined): number => {
      if (!time) return 0;
      const [timePart, period] = time.split(" ");
      const [hours, minutes] = timePart.split(":").map(Number);
      let h = hours;
      if (period === "PM" && h < 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + minutes;
    };

    if (!entry.clockIn || !entry.clockOut) return "-";

    const rawClockIn = parseMinutes(entry.clockIn);
    const rawClockOut = parseMinutes(entry.clockOut);

    // 🛑 Edge case: identical time
    if (rawClockIn === rawClockOut) return "No Working Hours";

    const start = Math.max(rawClockIn, 8 * 60);
    let end = rawClockOut;

    if (end >= 17 * 60 && end <= 20 * 60) end = 17 * 60;

    // Deduct break
    if (entry.breakOut && entry.breakIn) {
      const bOut = parseMinutes(entry.breakOut);
      const bIn = parseMinutes(entry.breakIn);
      if (bOut && bIn && bIn > bOut) {
        end -= (bIn - bOut);
      }
    }

    const total = end - start;
    const diff = expectedMinutes - total;

    if (diff <= 0) return "-";

    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins}m`;
  };

  const getMonthlyGroupedLogs = (): Record<string, WeeklyReportDay[]> => {
    const logs = [...clockLog]; // all logs from Firestore
    const monthlyGrouped: Record<string, WeeklyReportDay[]> = {};

    const logsByDate: Record<string, WeeklyReportDay> = {};

    logs.forEach((log) => {
      if (!log.time || !log.key || !log.timeString) return;

      const logDateObj =
        log.time instanceof Timestamp ? log.time.toDate() : new Date(log.time);
      const fullDateStr = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      const monthKey = logDateObj.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      const groupKey = currentUser?.admin
        ? `${log.uid}_${fullDateStr}`
        : fullDateStr;

      if (!logsByDate[groupKey]) {
        logsByDate[groupKey] = {
          date: fullDateStr,
          workingHours: "",
          userId: log.uid,
          logIds: [],
          employeeName: currentUser?.admin
            ? `${log.userFirstName || ""} ${log.userSurname || ""}`.trim()
            : undefined,
          isComplete: false,
          hasPending: true,
        };
      }

      logsByDate[groupKey].logIds.push(log.id);
      if (!logsByDate[groupKey][log.key]) {
        logsByDate[groupKey][log.key] = log.timeString;
      }
      logsByDate[groupKey].status = log.status;
    });

    Object.values(logsByDate).forEach((entry) => {
      entry.workingHours = calculateWorkingHours(
        entry.clockIn || "",
        entry.breakIn || "",
        entry.breakOut || "",
        entry.clockOut || ""
      );
      entry.isComplete = !!entry.clockIn && !!entry.clockOut;

      const dateObj = new Date(entry.date);
      const monthKey = dateObj.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      if (!monthlyGrouped[monthKey]) {
        monthlyGrouped[monthKey] = [];
      }

      monthlyGrouped[monthKey].push(entry);
    });

    return monthlyGrouped;
  };

  const availableMonths = Object.keys(getMonthlyGroupedLogs());

  const generateDTRHtml = (
    name: string,
    position: string,
    office: string,
    logs: WeeklyReportDay[],
    month: string,
    holidayMap: Record<string, string>
  ): string => {
    const logMap: Record<number, WeeklyReportDay> = {};
    logs.forEach((log) => {
      const date = new Date(log.date);
      logMap[date.getDate()] = log;
    });

    const [monthName, yearStr] = month.split(" ");
    const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr, 10);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const rows = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateObj = new Date(year, monthIndex, day);
      const dateStr = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
      const log = logMap[day];
      const readableDate = dateObj.toLocaleDateString("en-US", {
        day: "2-digit",
      });

      const isSunday = dateObj.getDay() === 0;
      const isHoliday = holidayMap[dateStr];
      const isFutureDate = dateObj > new Date();

      const notes = isHoliday
        ? holidayMap[dateStr]
        : isSunday
          ? "Sunday"
          : isFutureDate
            ? "—"
            : log
              ? ""
              : "Absent";

      const rowStyle = isHoliday
        ? 'style="background-color: #ffff;"'
        : isSunday
          ? 'style="background-color:rgb(255, 255, 255);"'
          : isFutureDate
            ? ''
            : log
              ? ''
              : 'style="background-color:rgb(255, 255, 255);"'; // Yellow for absent

      return `
        <tr ${rowStyle}>
          <td>${readableDate}</td>
          <td>${log?.clockIn || "-"}</td>
          <td>${log?.breakIn || "-"}</td>
          <td>${log?.breakOut || "-"}</td>
          <td>${log?.clockOut || "-"}</td>
          <td>${notes || calculateUndertime(log)}</td>
        </tr>`;
    }).join("");

    return `
    <div class="DTR">
      <div class="Civil">
        <span>Civil Service Form No. 48</span>
        <span>1-136</span>
      </div>

      <div class="Daily">
        <span class="Bold">DAILY TIME RECORD</span>
        <div class="Daily-inner">
          <span class="Bold Name">${name}</span>
          <span>${position}</span>
          <span>${office}</span>
        </div>
      </div>

      <div class="Month">
        <span>For the Month of: ${month}</span>
        <div class="Month-inner">
          <span>Official Hours of:</span>
          <span>Regular Days:</span>
          <span>Arrival and Departure:</span>
          <span>Saturdays:</span>
        </div>
      </div>

      <div class="Table">
        <span class="Bold">PERMANENT</span>
        <table border="1" cellpadding="4" cellspacing="0">
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th colspan="2">AM</th>
              <th colspan="2">PM</th>
              <th rowspan="2">UNDERTIME</th>
            </tr>
            <tr>
              <th>ARRIVAL</th>
              <th>DEPARTURE</th>
              <th>ARRIVAL</th>
              <th>DEPARTURE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="Certify">
        <span>I Certify on my honor that the above is a true and correct report of the hours work performed, record, of which was daily at the time of arrival and departure from office.</span>
        <span class="Signature"></span>
        <span>Reviewed by:</span>
        <span class="Signature"></span>
        <span class="Bold">Immediate Supervisor/Grade Leader/ Department Head</span>
      </div>

      <div class="Verified">
        <span>VERIFIED as to the prescribed office hours</span>
        <div class="Verified-inner">
          <span class="Bold">DR. ELEONORA C. CAYABYAB</span>
          <span class="Bold">Chief - Curriculum Implementation Division</span>
        </div>
      </div>
    </div>`;
  };

  const fetchPhilippineHolidays = async (): Promise<Record<string, string>> => {
    const res = await fetch(
      "https://date.nager.at/api/v3/PublicHolidays/2025/PH"
    );
    const data = await res.json();

    // Return as map: { "2025-01-01": "New Year's Day", ... }
    const holidayMap: Record<string, string> = {};
    data.forEach((item: any) => {
      holidayMap[item.date] = item.localName;
    });

    return holidayMap;
  };

  const exportToPDF = async () => {
    const holidayMap = await fetchPhilippineHolidays();
    const logsByMonth = getMonthlyGroupedLogs();
    const wrapper = document.createElement("div");

    Object.entries(logsByMonth).forEach(([month, logs]) => {
      const html = generateDTRHtml(
        `${userData?.firstName} ${userData?.surname}`,
        "Position Here",
        "Office Name Here",
        logs,
        month,
        holidayMap
      );

      const div = document.createElement("div");
      div.innerHTML = html;
      wrapper.appendChild(div);
    });

    // Add CSS
    const style = document.createElement("style");
    style.innerHTML = dtrStyles;
    wrapper.prepend(style);

    html2pdf()
      .set({ filename: "DTR.pdf", html2canvas: { scale: 2 } })
      .from(wrapper)
      .save();
  };

  const handleExportSingleMonth = async () => {
    if (!selectedMonth) return;

    const holidayMap = await fetchPhilippineHolidays();
    const customSnapshot = await getDocs(collection(db, "customHolidays"));
customSnapshot.docs.forEach(doc => {
  const data = doc.data();
  holidayMap[data.date] = "Custom Holiday"; // Just like how PH holidays are stored
});
    const monthlyData = getMonthlyGroupedLogs();
    const logs = monthlyData[selectedMonth];
    if (!logs) return;

    const wrapper = document.createElement("div");
    const html = generateDTRHtml(
      `${userData?.firstName} ${userData?.surname}`,
      "Your Position",
      "Your Office",
      logs,
      selectedMonth,
      holidayMap
    );

    const div = document.createElement("div");
    div.innerHTML = html;
    wrapper.appendChild(div);

    const style = document.createElement("style");
    style.innerHTML = dtrStyles;
    wrapper.prepend(style);

    html2pdf()
      .set({ filename: `DTR_${selectedMonth}.pdf`, html2canvas: { scale: 2 } })
      .from(wrapper)
      .save();
  };

  const handleApprove = async (logIds: string[]) => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      logIds.forEach((logId) => {
        const logRef = doc(db, "clockLog", logId);
        batch.update(logRef, { status: "approved" });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error approving logs:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (logIds: string[]) => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      logIds.forEach((logId) => {
        const logRef = doc(db, "clockLog", logId);
        batch.update(logRef, { status: "rejected" });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error rejecting logs:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isButtonEnabled = (key: string): boolean => {
    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });

    const todayLogs = clockLog.filter((log) => log.date === todayStr);
    const hasBreakIn = todayLogs.some((log) => log.key === "breakIn");
    const hasBreakOut = todayLogs.some((log) => log.key === "breakOut");
    const hasClockOut = todayLogs.some((log) => log.key === "clockOut");

    if (hasClockOut) return false;

    switch (key) {
      case "clockIn":
        return !todayLogs.some((log) => log.key === "clockIn");

      case "breakIn":
        return (
          todayLogs.some((log) => log.key === "clockIn") &&
          !todayLogs.some((log) => log.key === "breakIn")
        );

      case "breakOut":
        return (
          todayLogs.some((log) => log.key === "breakIn") &&
          !todayLogs.some((log) => log.key === "breakOut")
        );

      case "clockOut":
        return (
          todayLogs.some((log) => log.key === "clockIn") &&
          !todayLogs.some((log) => log.key === "clockOut") &&
          (!hasBreakIn || hasBreakOut)
        );

      default:
        return false;
    }
  };

  // CLEAN handleClockLogSubmit function
  const handleClockLogSubmit = async (
    image: string,
    timestamp: string,
    imageUrl?: string,
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  ) => {
    console.log("🎯 handleClockLogSubmit called");

    if (!currentUser || !actionKeyRef.current) {
      console.error("❌ Missing user or action key");
      alert("Missing required data. Please try again.");
      return;
    }

    try {
      const now = new Date();
      const manilaTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );
      const formattedDate = manilaTime.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      const baseData = {
        uid: currentUser.uid,
        key: actionKeyRef.current,
        time: Timestamp.fromDate(manilaTime),
        timeString: timestamp,
        date: formattedDate,
        status: "pending",
        imageUrl: imageUrl || "",
        userFirstName: userData?.firstName || "",
        userSurname: userData?.surname || "",
        isAuto: false,
        notes: "",
        createdAt: now.toISOString(),
      };

      console.log(" Base data:", baseData);

      if (isOnline) {
        console.log(" Attempting online save...");

        const firestoreData = {
          ...baseData,
          ...(location && location.latitude && location.longitude
            ? {
                location: {
                  coordinates: new GeoPoint(
                    location.latitude,
                    location.longitude
                  ),
                  address: location.address || "",
                  timestamp: serverTimestamp(),
                },
              }
            : {}),
        };

        // Remove createdAt from Firestore data as it's not needed there
        const { createdAt, ...cleanFirestoreData } = firestoreData;
        await addDoc(collection(db, "clockLog"), cleanFirestoreData);
        console.log("Online save successful");
      } else {
        console.log("📱 Attempting offline save...");

        const offlineData = {
          ...baseData,
          ...(location ? { location } : {}),
        };

        const localId = await offlineDB.saveAttendance(offlineData);
        console.log(" Offline save successful:", localId);

        await checkPendingItems();
        alert(
          "You're offline. Your entry has been saved and will sync when online."
        );
      }
    } catch (mainError) {
      console.error(" Main save failed:", mainError);

      if (isOnline) {
        console.log("🔄 Trying offline fallback...");
        try {
          const fallbackData = {
            uid: currentUser.uid,
            key: actionKeyRef.current,
            time: Timestamp.now(),
            timeString: timestamp,
            date: new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "2-digit",
              year: "numeric",
            }),
            status: "pending",
            imageUrl: imageUrl || "",
            userFirstName: userData?.firstName || "",
            userSurname: userData?.surname || "",
            isAuto: false,
            notes: "",
            createdAt: new Date().toISOString(),
            ...(location ? { location } : {}),
          };

          const localId = await offlineDB.saveAttendance(fallbackData);
          console.log("✅ Fallback save successful:", localId);
          await checkPendingItems();
          alert(
            "Network error. Saved offline - will sync when connection restored."
          );
        } catch (fallbackError) {
          console.error("❌ All fallback attempts failed:", fallbackError);
          alert("Failed to save entry. Please try again.");
        }
      } else {
        alert("Failed to save entry. Please try again.");
      }
    }
  };

  const weeklyReportData = getWeeklyReportData();

  const [locationShared, setLocationShared] = useState(false);

  const [shareLocationRequest, setShareLocationRequest] = useState(false);

useEffect(() => {
  const unsub = onSnapshot(doc(db, "system", "locationTrigger"), (docSnap) => {
    const data = docSnap.data();
    const request = data?.shareLocationRequest ?? false;
    setShareLocationRequest(request);
    

    if (request) {
      handleShareLocation(); 
    }
  });

  return () => unsub();
}, []);

  const handleShareLocation = () => {
    if (locationShared) return;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const user = currentUser;

      if (!user) return;

      await addDoc(collection(db, "locations"), {
        uid: user.uid,
        name: userData?.firstName || "Unknown User",
        surname: userData?.surname,
        email: user.email,
        latitude,
        longitude,
        sharedAt: new Date(),
      });

      setLocationShared(true);
      await setDoc(doc(db, "system", "locationTrigger"), {
  shareLocationRequest: false,
  timestamp: Date.now()
});

    },
    (error) => {
      console.error("Error sharing location:", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000
    }
  );
};



  return (
    <div className={styles.Dashboard}>
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <h1 className={styles.Dash_title}>Dashboard</h1>

      {/* Sync Button Section - Always visible */}
      <div
        className={styles.SyncSection}
        style={{
          background: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "15px",
          margin: "10px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: isOnline ? "#28a745" : "#dc3545",
            }}
          ></div>
          <span style={{ fontWeight: "600", color: "#495057" }}>
            {isOnline ? "Online" : "Offline"}
          </span>
          {pendingCount > 0 && (
            <span
              style={{
                background: "#ffc107",
                color: "#212529",
                padding: "4px 8px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {pendingCount} pending sync
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {syncStatus === "success" && (
            <span
              style={{ color: "#28a745", fontSize: "14px", fontWeight: "500" }}
            >
              Sync completed successfully!
            </span>
          )}
          {syncStatus === "error" && (
            <span
              style={{ color: "#dc3545", fontSize: "14px", fontWeight: "500" }}
            >
              Sync failed. Please try again.
            </span>
          )}

          <button
            onClick={handleManualSync}
            disabled={!isOnline || syncStatus === "syncing"}
            style={{
              background:
                syncStatus === "syncing"
                  ? "#6c757d"
                  : syncStatus === "success"
                  ? "#28a745"
                  : isOnline
                  ? "#007bff"
                  : "#6c757d",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor:
                syncStatus === "syncing" || !isOnline
                  ? "not-allowed"
                  : "pointer",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
              opacity: syncStatus === "syncing" || !isOnline ? 0.6 : 1,
            }}
          >
            {syncStatus === "syncing" ? (
              <>
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid transparent",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></span>
                Syncing...
              </>
            ) : syncStatus === "success" ? (
              <>Synced</>
            ) : (
              <>Sync Now</>
            )}
          </button>
        </div>
      </div>

      {!currentUser?.admin && (
        <div className={styles.Dashboard_widgets}>
          <div className={styles.Widget_top}>
            <div className={styles.Widget_left}>
              <div className={styles.Date}>
                <span>
                  {new Date().toLocaleDateString("en-US", { weekday: "long" })}
                </span>
                <span>{new Date().getDate()}</span>
              </div>
              <span className={styles.Name}>
                {userData?.firstName} {userData?.surname}
              </span>
            </div>

            <div className={styles.Widget_right}>
              <div className={styles.Pause_con}></div>
              <span className={styles.Time}>{time}</span>
            </div>
          </div>

          <div className={styles.Widget_bottom}>
            {[
              { label: "Clock In", key: "clockIn" },
              { label: "Clock Out", key: "breakIn" },
              { label: "Clock In", key: "breakOut" },
              { label: "Clock Out", key: "clockOut" },
            ].map(({ label, key }) => (
              <div className={styles.Clockin1} key={key}>
                <div className={styles.Clock_widget}>
                  <div className={styles.Clock_inner}>
                    <span>{label}</span>
                    <img className={styles.Eye} src={Eye} alt="eye" />
                  </div>
                  <span className={styles.Time_widget}>
                    {timestamps[key] || "-"}
                  </span>
                </div>
                <img
                  className={styles.Camera}
                  src={Camera}
                  alt="camera"
                  onClick={(e) => handleCameraButtonClick(e, key)}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    opacity: isButtonEnabled(key) ? 1 : 0.5,
                    cursor: isButtonEnabled(key) ? "pointer" : "not-allowed",
                  }}
                />
              </div>
            ))}
          </div>

          {shareLocationRequest && (
  locationShared ? (
    <button className={styles.Location}>Location Shared</button>
  ) : (
    <button onClick={handleShareLocation} className={styles.Location2}>
      Share Location
    </button>
  )
)}
        </div>
      )}

      <div className={styles.Weekly}>
        <div className={styles.Weekly_head}>
          <span className={styles.ReportText}>
            {currentUser?.admin ? "Employee Time Logs" : "Weekly Report"}
          </span>
          <div className={styles.Head_button}>
            {!currentUser?.admin && (
              <div style={{ margin: "1rem 0" }}>
                <label
                  htmlFor="monthSelect"
                  style={{ marginRight: "10px", fontWeight: "600" }}
                >
                  Select Month:
                </label>
                <select
                  id="monthSelect"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: "14px" }}
                >
                  <option value="">-- Choose a Month --</option>
                  {Object.keys(getMonthlyGroupedLogs()).map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportSingleMonth}
                  disabled={!selectedMonth}
                  style={{
                    marginLeft: "10px",
                    padding: "6px 12px",
                    backgroundColor: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: selectedMonth ? "pointer" : "not-allowed",
                  }}
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {clockLog.length > 0 ? (
          <div className={styles.WeeklyTable}>
            <div className={styles.Clock_day}>
              <div className={styles.Clock_morning}>
                <h2>Morning:</h2>
                <table>
                  <thead>
                    <tr>
                      {currentUser?.admin && <th>Employee</th>}
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReportData.map((entry, index) => {
                      const employeeName = entry.employeeName || "Unknown User";

                      return (
                        <tr key={index}>
                          {currentUser?.admin && <td>{employeeName}</td>}
                          <td>{entry.date}</td>
                          <td>{entry.clockIn || "-"}</td>
                          <td>{entry.breakIn || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.Clock_afternoon}>
                <h2>Afternoon:</h2>
                <table>
                  <thead>
                    <tr>
                      {currentUser?.admin && <th>Employee</th>}
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyReportData.map((entry, index) => {
                      const employeeName = entry.employeeName || "Unknown User";
                      const statusText = entry.status || "-";
                      const statusStyle = {
                        color:
                          entry.status === "approved"
                            ? "green"
                            : entry.status === "rejected"
                            ? "red"
                            : entry.status === "pending"
                            ? "orange"
                            : "inherit",
                      };

                      return (
                        <tr key={index}>
                          {currentUser?.admin && <td>{employeeName}</td>}
                          <td>{entry.date}</td>
                          <td>{entry.breakOut || "-"}</td>
                          <td>{entry.clockOut || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                color: "#666",
                marginTop: "10px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "20px",
              }}
            >
              <span>* Auto null at when no clock out until 8:00 PM</span>
              <span>⁑ Early clock-in adjusted to 8:00 AM</span>
            </div>
          </div>
        ) : (
          <p style={{ padding: "1rem", color: "#888" }}>
            No clock-in records found.
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
