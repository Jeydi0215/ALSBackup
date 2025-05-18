import { getDatabase, ref, get } from "firebase/database";
import { app } from "../firebase"; // Import your Firebase app instance

const db = getDatabase(app);

export const getOpenCageKey = async (): Promise<string> => {
  try {
    const apiKeyRef = ref(db, 'apiKeys/openCage');
    const snapshot = await get(apiKeyRef);
    
    if (!snapshot.exists()) {
      throw new Error("OpenCage API key not found in database");
    }
    
    return snapshot.val();
  } catch (error) {
    console.error("Failed to fetch API key:", error);
    throw error; // Let the calling code handle this
  }
};