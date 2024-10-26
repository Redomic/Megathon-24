import { MemoryRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import MapPage from "./pages/MapPage";

import LoadingOverlay from "./components/LoadingOverlay";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapPage />} />
        {/* <Route path="/crawler" element={<CrawlerPage />} /> */}
      </Routes>
      <LoadingOverlay />
    </Router>
  );
}
