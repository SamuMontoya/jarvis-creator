import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { Lightbulb, ListTree } from 'lucide-react';
import { routes } from './constants';
import logo from './assets/ds/logo.svg';

function NavTab({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm font-medium transition-colors ${
          isActive ? 'bg-ink text-white shadow-sm' : 'text-stone hover:bg-paper-warm hover:text-ink'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </NavLink>
  );
}

function Navbar() {
  return (
    <header className="border-b border-dust bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4">
        <NavLink to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="font-display text-xl font-bold tracking-tight text-ink">Kreanding</span>
        </NavLink>

        <nav className="flex gap-2">
          <NavTab to={routes.home()} icon={Lightbulb} label="Ideas" />
          <NavTab to={routes.allPlans()} icon={ListTree} label="Planes" />
        </nav>
      </div>
    </header>
  );
}

export default memo(Navbar);
