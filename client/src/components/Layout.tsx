import React from 'react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="layout-container">
            <header className="layout-header">
                <div className="header-content">
                    <div className="brand">
                        <div className="status-dot" />
                        <h1 className="brand-text">Signal Studio</h1>
                    </div>
                    <nav className="nav-links">
                        {/* Navigation items can go here */}
                    </nav>
                </div>
            </header>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;
