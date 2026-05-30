import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="w-full h-20 bg-black border-b border-gray-800 flex items-center justify-between px-8 relative z-50">
      {/* Logo */}
      <Link to="/" className="text-3xl font-bold text-white hover:text-blue-400 transition-colors">
        IntellMeet
      </Link>

      {/* Navigation */}
      <div className="flex items-center gap-6 text-white text-lg">
        <Link to="/" className="hover:text-blue-500 transition-colors">Home</Link>
        <Link to="/about" className="hover:text-blue-500 transition-colors">About</Link>

        {user ? (
          <>
            <Link to="/join" className="hover:text-blue-500 transition-colors">Join</Link>
            <Link to="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</Link>
            <Link to="/history" className="hover:text-blue-500 transition-colors">History</Link>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user.name}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-48 py-2 z-50">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-800 transition-colors text-sm"
                  >
                    👤 Profile
                  </Link>
                  <Link
                    to="/history"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-800 transition-colors text-sm"
                  >
                    📋 Meeting History
                  </Link>
                  <hr className="border-gray-700 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors text-sm text-red-400"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-blue-500 transition-colors">Login</Link>
            <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl transition-colors font-semibold">
              Signup
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
