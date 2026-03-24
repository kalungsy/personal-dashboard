import { NavLink } from "react-router-dom";

export function Nav() {
  return (
    <nav className="top-nav">
      <span className="nav-label">Dashboard:</span>
      <NavLink end className={({ isActive }) => (isActive ? "active" : "")} to="/">
        Standard
      </NavLink>
      <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/enhanced">
        Enhanced
      </NavLink>
      <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/rs-ranking">
        RS Ranking
      </NavLink>
      <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/rsi">
        RSI
      </NavLink>
    </nav>
  );
}
