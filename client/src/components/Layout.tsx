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
                    <nav className="nav-links flex gap-3">
                        <NavLink 
                            to="/" 
                            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 relative ${
                                isActive 
                                    ? 'bg-accent text-black shadow-lg hover:shadow-xl scale-105' 
                                    : 'text-secondary hover:text-primary hover:bg-bg-active border-2 border-transparent hover:border-accent'
                            }`}
                        >
                            {({ isActive }) => (
                                <>
                                    <span>📊</span>
                                    <span>Offline Analysis</span>
                                    {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-light rounded-full animate-pulse"></span>}
                                </>
                            )}
                        </NavLink>
                        <NavLink 
                            to="/realtime" 
                            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 relative ${
                                isActive 
                                    ? 'bg-accent text-black shadow-lg hover:shadow-xl scale-105' 
                                    : 'text-secondary hover:text-primary hover:bg-bg-active border-2 border-transparent hover:border-accent'
                            }`}
                        >
                            {({ isActive }) => (
                                <>
                                    <span>⚡</span>
                                    <span>Real-Time Stream</span>
                                    {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-light rounded-full animate-pulse"></span>}
                                </>
                            )}
                        </NavLink>
                        <NavLink 
                            to="/game" 
                            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 relative ${
                                isActive 
                                    ? 'bg-accent text-black shadow-lg hover:shadow-xl scale-105' 
                                    : 'text-secondary hover:text-primary hover:bg-bg-active border-2 border-transparent hover:border-accent'
                            }`}
                        >
                            {({ isActive }) => (
                                <>
                                    <span>🎮</span>
                                    <span>Game Mode</span>
                                    {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-light rounded-full animate-pulse"></span>}
                                </>
                            )}
                        </NavLink>
                        <NavLink 
                            to="/questionnaire" 
                            className={({ isActive }) => `px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 inline-flex items-center gap-2 relative ${
                                isActive 
                                    ? 'bg-accent text-black shadow-lg hover:shadow-xl scale-105' 
                                    : 'text-secondary hover:text-primary hover:bg-bg-active border-2 border-transparent hover:border-accent'
                            }`}
                        >
                            {({ isActive }) => (
                                <>
                                    <span>📋</span>
                                    <span>Questionnaire</span>
                                    {isActive && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-light rounded-full animate-pulse"></span>}
                                </>
                            )}
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
