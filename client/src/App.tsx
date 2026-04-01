import { Routes, Route } from 'react-router-dom';
import OfflineAnalysis from './pages/OfflineAnalysis';
import RealTimeAnalysis from './pages/RealTimeAnalysis';
import GameMode from './pages/GameMode';
import QuestionnaireMode from './pages/QuestionnaireMode';

function App() {
  return (
    <Routes>
      <Route path="/" element={<OfflineAnalysis />} />
      <Route path="/realtime" element={<RealTimeAnalysis />} />
      <Route path="/game" element={<GameMode />} />
      <Route path="/questionnaire" element={<QuestionnaireMode />} />
    </Routes>
  );
}

export default App;
