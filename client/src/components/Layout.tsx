import React from 'react';
import { NavLink } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode; fullWidth?: boolean }> = ({ children, fullWidth = false }) => {
    return (
        <div className="layout-container">
            <header className="layout-header">
                <div className="header-content">
                    <div className="brand">
                        <div className="status-dot" />
                        <h1 className="brand-text text-2xl font-bold tracking-tight">Signal Studio</h1>
                    </div>
                    <nav className="nav-links flex gap-2">
                        <NavLink 
                            to="/" 
                            className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                isActive 
                                    ? 'bg-cyan-500 text-black shadow-lg hover:shadow-xl' 
                                    : 'text-secondary hover:text-accent hover:bg-hover'
                            }`}
                        >
                            Offline Analysis
                        </NavLink>
                        <NavLink 
                            to="/realtime" 
                            className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                isActive 
                                    ? 'bg-cyan-500 text-black shadow-lg hover:shadow-xl' 
                                    : 'text-secondary hover:text-accent hover:bg-hover'
                            }`}
                        >
                            Real-Time Stream
                        </NavLink>
                        <NavLink 
                            to="/game" 
                            className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                isActive 
                                    ? 'bg-cyan-500 text-black shadow-lg hover:shadow-xl' 
                                    : 'text-secondary hover:text-accent hover:bg-hover'
                            }`}
                        >
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
