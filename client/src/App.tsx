import { Routes, Route } from 'react-router-dom';
import OfflineAnalysis from './pages/OfflineAnalysis';
import RealTimeAnalysis from './pages/RealTimeAnalysis';
import GameMode from './pages/GameMode';

function App() {
  return (
    <Routes>
      <Route path="/" element={<OfflineAnalysis />} />
      <Route path="/realtime" element={<RealTimeAnalysis />} />
      <Route path="/game" element={<GameMode />} />
    </Routes>
  );
}

export default App;
