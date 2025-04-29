import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth"; // OR directly from firebase hooks
import { auth } from "../firebase"; 
import { JSX } from "react";

type Props = {
  children: JSX.Element;
};

const PrivateRoute = ({ children }: Props) => {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return <div>Loading...</div>; 
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
