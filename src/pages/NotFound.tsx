import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/bits';

export function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap narrow not-found">
        <p className="eyebrow">404</p>
        <h1 className="display">That page went out of scope.</h1>
        <p className="lede">The lesson or exercise you’re looking for doesn’t exist (it may have been renamed).</p>
        <Link className="btn primary" to="/">Back to the roadmap</Link>
      </main>
    </>
  );
}
