import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth"; // OR directly from firebase hooks
import { auth, db } from "../firebase"; 
import { JSX } from "react";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

type Props = {
  children: JSX.Element;
};

const PrivateRoute = ({ children }: Props) => {
  const [user, loading] = useAuthState(auth);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const[isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const checkApproval = async () => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsApproved(data.approved === true);
        }
      }
      setCheckingApproval(false);
    };

    if (user && !loading) {
      checkApproval();
    }
  }, [user, loading]);

  if (loading || (user && checkingApproval)) {
    return <div>Loading...</div>; // Show spinner or loading screen
  }

  if (!user || !isApproved) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
