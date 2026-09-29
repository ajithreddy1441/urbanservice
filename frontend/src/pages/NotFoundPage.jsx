import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <h1 className="text-4xl font-extrabold">Page not found</h1>
        <Link to="/" className="mt-4 inline-block font-bold text-[var(--brand)]">Back home</Link>
      </div>
    </div>
  );
}
