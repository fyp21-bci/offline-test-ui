import React from 'react';
import { NavLink } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode; fullWidth?: boolean }> = ({ children, fullWidth = false }) => {
    return (
        <div className="layout-container">
            <header className="layout-header">
                <div className="header-content">
                    <div className="brand">
                        <div className="status-dot" />
                        <h1 className="brand-text">Signal Studio</h1>
                    </div>
                    <nav className="nav-links flex gap-4">
                        <NavLink to="/" className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            Offline Analysis
                        </NavLink>
                        <NavLink to="/realtime" className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            Real-Time Stream
                        </NavLink>
                        <NavLink to="/game" className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-accent text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            Game Mode
                        </NavLink>
                    </nav>
                </div>
            </header>
            <main className="main-content" style={fullWidth ? { padding: 0 } : {}}>
                {children}
            </main>
        </div>
    );
};

export default Layout;
