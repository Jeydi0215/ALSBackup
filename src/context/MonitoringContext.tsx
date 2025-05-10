import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface MonitoringContextType {
  loggedInCount: number;
  totalUsers: number;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(undefined);

export const MonitoringProvider = ({ children }: { children: ReactNode }) => {
  const [loggedInCount, setLoggedInCount] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    const loggedInQuery = query(collection(db, 'users'), where('status', '==', 'online'));
    const unsubscribeLoggedIn = onSnapshot(loggedInQuery, (snapshot) => {
      setLoggedInCount(snapshot.size);
    });

    const unsubscribeTotalUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setTotalUsers(snapshot.size);
    });

    return () => {
      unsubscribeLoggedIn();
      unsubscribeTotalUsers();
    };
  }, []);

  return (
    <MonitoringContext.Provider value={{ loggedInCount, totalUsers }}>
      {children}
    </MonitoringContext.Provider>
  );
};

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
};
