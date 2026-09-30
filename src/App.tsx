import { Suspense, lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import LessonPage from './pages/LessonPage';
import { NotFound } from './pages/NotFound';

const Workspace = lazy(() => import('./pages/Workspace'));
const Playground = lazy(() => import('./pages/Playground'));

function Loading() {
  return <div className="boot" role="status"><span className="spinner" aria-hidden="true" /> Loading editor…</div>;
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lesson/:lessonId" element={<LessonPage />} />
          <Route path="/lesson/:lessonId/:exId" element={<Workspace />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
