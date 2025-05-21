import React, { createContext, useState, useCallback,type ReactNode } from 'react';

export interface PollUpdateContextType { 
  pollUpdateTrigger: number;
  triggerPollUpdate: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PollUpdateContext = createContext<PollUpdateContextType | undefined>(undefined);

interface PollUpdateProviderProps {
  children: ReactNode;
}

export const PollUpdateProvider: React.FC<PollUpdateProviderProps> = ({ children }) => {
  const [pollUpdateTrigger, setPollUpdateTrigger] = useState(0);

  const triggerPollUpdate = useCallback(() => {
    setPollUpdateTrigger(prev => {
      console.log(`[CONTEXT] PollUpdateTrigger changing from ${prev} to ${prev + 1}`);
      return prev + 1;
    });
  }, []);

  const value = {
    pollUpdateTrigger,
    triggerPollUpdate,
  };

  return (
    <PollUpdateContext.Provider value={value}>
      {children}
    </PollUpdateContext.Provider>
  );
};