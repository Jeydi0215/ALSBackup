import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export type ExtendedUser = User & {
  admin?: boolean;
  approved?: boolean;
};

type AuthContextType = {
  currentUser: ExtendedUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUser({
            ...user,
            admin: userData.admin,
            approved: userData.approved,
          });
        } else {
          setCurrentUser(user); // fallback in case no doc exists
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
