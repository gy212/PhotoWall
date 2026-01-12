import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import FrontendReady from './components/FrontendReady';
import { useThemeColor } from './hooks/useThemeColor';
import { useAutoScanEvents } from './hooks/useAutoScanEvents';
import './index.css';

function App() {
  useThemeColor();
  useAutoScanEvents();

  return (
    <>
      <FrontendReady />
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
