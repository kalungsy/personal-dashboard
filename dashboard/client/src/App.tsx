import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { EnhancedPage } from "./pages/EnhancedPage";
import { RSRankingPage } from "./pages/RSRankingPage";
import { RSIPage } from "./pages/RSIPage";
import { StandardPage } from "./pages/StandardPage";

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<StandardPage />} />
        <Route path="/enhanced" element={<EnhancedPage />} />
        <Route path="/rs-ranking" element={<RSRankingPage />} />
        <Route path="/rsi" element={<RSIPage />} />
      </Routes>
    </>
  );
}
