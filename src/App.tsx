import { Suspense, lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import LessonPage from './pages/LessonPage';
import Glossary from './pages/Glossary';
import { NotFound } from './pages/NotFound';

const Workspace = lazy(() => import('./pages/Workspace'));
const Review = lazy(() => import('./pages/Review'));
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
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/review" element={<Review />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
