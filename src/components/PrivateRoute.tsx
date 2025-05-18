import { Navigate, useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase";
import { JSX, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

type Props = {
  children: JSX.Element;
};

const PrivateRoute = ({ children }: Props) => {
  const [user, loading] = useAuthState(auth);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkApproval = async () => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setIsApproved(docSnap.data().approved === true);
        }
      }
      setCheckingApproval(false);
    };

    if (user && !loading) {
      checkApproval();
    }
  }, [user, loading]);

  // If still loading auth state, show a persistent loader
  if (loading) {
    return <div className="fullscreen-loader">Loading...</div>;
  }

  // If auth check is done but approval is still being verified
  if (user && checkingApproval) {
    return <div className="fullscreen-loader">Verifying access...</div>;
  }

  // Redirect conditions
  if (!user || !isApproved) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;