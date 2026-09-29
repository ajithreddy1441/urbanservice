import { Link, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function PublicLayout() {
  return (
    <div className="min-h-dvh bg-slate-950">
      <Navbar />
      <Outlet />
      <footer className="bg-slate-950 px-4 py-12 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="text-lg font-extrabold text-white transition hover:opacity-80">Urban Services</Link>
            <p className="mt-2 text-sm leading-6">Professional home services with verified technicians, exact locations, and clear pricing.</p>
          </div>
          <div>
            <p className="font-bold text-white">Explore</p>
            <div className="mt-2 space-y-2 text-sm"><Link to="/services">All services</Link><br /><a href="/#how">How it works</a><br /><a href="/#faq">FAQ</a></div>
          </div>
          <div>
            <p className="font-bold text-white">Partners</p>
            <div className="mt-2 text-sm"><Link to="/technician/register">Join as a technician</Link></div>
          </div>
          <div>
            <p className="font-bold text-white">Contact</p>
            <p className="mt-2 text-sm leading-6">Guntur, Andhra Pradesh<br />hello@urbanservices.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
