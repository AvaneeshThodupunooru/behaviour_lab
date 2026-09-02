import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';

function App() {
  return (
    // The app is served from a sub-path (see `base` in vite.config.js), so the
    // router needs the same prefix or none of the routes match.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
