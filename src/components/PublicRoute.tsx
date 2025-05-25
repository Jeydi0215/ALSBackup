// src/components/PublicRoute.tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = { children: ReactNode };

export default function PublicRoute({ children }: Props) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading…</div>;
  }
  // If logged in, immediately redirect to /home
  if (currentUser) {
    return <Navigate to="/home" replace />;
  }
  // Otherwise show the login/signup form
  return <>{children}</>;
}
