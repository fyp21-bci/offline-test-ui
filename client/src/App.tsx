import { Routes, Route } from 'react-router-dom';
import OfflineAnalysis from './pages/OfflineAnalysis';
import RealTimeAnalysis from './pages/RealTimeAnalysis';

function App() {
  return (
    <Routes>
      <Route path="/" element={<OfflineAnalysis />} />
      <Route path="/realtime" element={<RealTimeAnalysis />} />
    </Routes>
  );
}

export default App;
