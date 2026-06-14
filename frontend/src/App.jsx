import { Routes, Route, NavLink } from "react-router-dom";
import StocksPage from "./pages/StocksPage.jsx";
import OptionsPage from "./pages/OptionsPage.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold text-white mr-4">OP Investing Guru</span>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`
          }
        >
          📈 Stocks
        </NavLink>
        <NavLink
          to="/options"
          className={({ isActive }) =>
            `text-sm font-medium px-3 py-1.5 rounded transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`
          }
        >
          🔧 Options
        </NavLink>
      </nav>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<StocksPage />} />
          <Route path="/options" element={<OptionsPage />} />
        </Routes>
      </main>
    </div>
  );
}
