import { useState, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";


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
    <Router>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Login />} />
        <Route
          path="/home"
          element={
            <Home
              handleLogoutClick={handleLogoutClick}
              isLogout={isLogout}
              handlePageClick={handlePageClick}
              pageNumber={pageNumber}
            />
          }
        />
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </Router>
  );
}

export default App;
