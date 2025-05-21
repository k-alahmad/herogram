import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PollVotingPage from './components/PollVotingPage';
import PollResultsPage from './components/PollResultsPage';
import CreatePollPage from './components/CreatePollPage';
import AuthDisplay from './components/AuthDisplay';
import { getAnonymousToken } from './api';

import './App.css';
import { PollUpdateProvider } from './components/PollUpdateContext';

function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const authenticateAnonUser = async () => {
      try {
        const token = localStorage.getItem('anon_jwt_token');
        if (!token) {
          console.log('No existing anonymous token found, fetching a new one...');
          await getAnonymousToken();
          console.log('New anonymous token fetched and saved.');
        } else {
          console.log('Existing anonymous token found.');
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('Error fetching anonymous token:', err);
        setAuthError('Failed to initialize anonymous session. Please try again.');
      } finally {
        setIsAuthLoading(false);
      }
    };

    authenticateAnonUser();
  }, []);

  if (isAuthLoading) {
    return (
      <div className="App-loading">
        <p>Initializing application...</p>
        {authError && <p className="error-message">{authError}</p>}
      </div>
    );
  }

  return (
    <Router>
      <PollUpdateProvider>
        <div className="App">
          <header className="App-header">
            <h1>Team Polls</h1>
            <nav>
              <Link to="/poll">Vote on Poll</Link> |{' '}
              <Link to="/poll-results">View Poll Results</Link> |{' '}
              <Link to="/create-poll">Create New Poll</Link>
            </nav>
          </header>

          <main>
            <Routes>
              <Route path="/poll/:id" element={<PollVotingPage />} />
              <Route path="/poll" element={<PollVotingPage />} />

              <Route path="/poll/:id/results" element={<PollResultsPage />} />
              <Route path="/poll-results" element={<PollResultsPage />} />

              <Route path="/create-poll" element={<CreatePollPage />} />
              <Route path="/" element={
                <div className="home-page">
                  <h2>Welcome to Team Polls!</h2>
                </div>
              } />
            </Routes>
          </main>

          <footer className="App-footer">
            <AuthDisplay />
          </footer>
        </div>
      </PollUpdateProvider>
    </Router>
  );
}

export default App;