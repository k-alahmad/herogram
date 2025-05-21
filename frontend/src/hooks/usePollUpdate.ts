import { useContext } from 'react';
import { PollUpdateContext, type PollUpdateContextType } from '../components/PollUpdateContext';

export const usePollUpdate = (): PollUpdateContextType => {
  const context = useContext(PollUpdateContext);
  if (context === undefined) {
    throw new Error('usePollUpdate must be used within a PollUpdateProvider');
  }
  return context;
};