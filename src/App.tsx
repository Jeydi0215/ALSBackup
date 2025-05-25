import { useState, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider } from "./context/AuthContext";
import { MonitoringProvider } from "./context/MonitoringContext";
import "./css/App.module.css"
import PublicRoute from "./components/PublicRoute";

function App() {
  const [isLogout, setIsLogout] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  const handleLogoutClick = useCallback(() => {
    setIsLogout((prev) => !prev);
  }, []);

  const handlePageClick = useCallback((value: number) => {
    setPageNumber(value);
  }, []);

  return (
    <AuthProvider>
      <MonitoringProvider>
        <Router>
          <Routes>
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/home"
              element={
                <PrivateRoute>
                  <Home
                    handleLogoutClick={handleLogoutClick}
                    isLogout={isLogout}
                    handlePageClick={handlePageClick}
                    pageNumber={pageNumber}
                  />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<div>404 - Page Not Found</div>} />
          </Routes>
        </Router>
      </MonitoringProvider>
    </AuthProvider>
  );
}

export default App;
