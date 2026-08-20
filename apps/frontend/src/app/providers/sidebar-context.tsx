'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setIsCollapsed: (collapsed: boolean) => void;
  isReady: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('housive_sidebar_collapsed');
        if (saved !== null) {
          return saved === 'true';
        }
      } catch (e) {
        // Ignore localStorage error
      }
    }
    return false;
  });

  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('housive_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsedState(saved === 'true');
      }
    } catch (e) {}
    setIsReady(true);
  }, []);

  const setIsCollapsed = (collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem('housive_sidebar_collapsed', String(collapsed));
    } catch (e) {}
  };

  const toggleSidebar = () => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('housive_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setIsCollapsed, isReady }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
