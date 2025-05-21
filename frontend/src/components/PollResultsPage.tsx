import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPollResults, connectToPollResultsWs } from '../api';
import type { PollResults, PollOption } from '../types';

import './PollResultsPage.css';
import { usePollUpdate } from '../hooks/usePollUpdate';


const PollResultsPage: React.FC = () => {
  console.count('PollResultsPage Render'); 

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pollUpdateTrigger } = usePollUpdate(); 

  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputPollId, setInputPollId] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  const onWsUpdate = useCallback((updatedResults: PollResults) => {
    console.log('[PAGE-WS-CALLBACK] WebSocket onUpdate callback triggered. New data:', updatedResults);
    setResults(updatedResults);
    console.log('[PAGE-WS-CALLBACK] setResults called. Next render expected.');
  }, []);

  useEffect(() => {
    console.log(`[PAGE-EFFECT] useEffect re-running. Trigger: ${pollUpdateTrigger}, ID: ${id}`);

    let currentWs: WebSocket | null = null;

    const fetchAndConnect = async () => {
      if (!id) {
        setResults(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`[PAGE-EFFECT] Fetching initial results for poll: ${id} (Trigger: ${pollUpdateTrigger})`);
        const initialResults = await getPollResults(id);
        console.log('[PAGE-EFFECT] Initial results fetched:', initialResults);
        setResults(initialResults);
        console.log('[PAGE-EFFECT] setResults called for initial fetch. Next render expected.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('[PAGE-EFFECT] Error fetching initial results:', err);
        setError(err.message || 'Poll not found for initial fetch. Please check the ID.');
        setResults(null);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }

      if (wsRef.current) {
        console.log(`[PAGE-EFFECT] Closing previous WebSocket for poll ${id} from ref.`);
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log(`[PAGE-EFFECT] Attempting to connect to WebSocket for live updates for poll: ${id}`);
      currentWs = connectToPollResultsWs(id, onWsUpdate);
      wsRef.current = currentWs;
    };

    fetchAndConnect();

    return () => {
      if (currentWs) {
        console.log(`[PAGE-EFFECT] Cleanup: Closing WebSocket for poll ${id} for this effect instance.`);
        currentWs.close();
      }
    };
  }, [id, onWsUpdate, pollUpdateTrigger]); 

  useEffect(() => {
    console.log('[PAGE-RESULTS-STATE] Current results state updated:', results);
  }, [results]);


  const handleIdSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputPollId.trim()) {
      navigate(`/poll/${inputPollId.trim()}/results`);
      setInputPollId('');
      setError(null);
    } else {
      setError('Please enter a Poll ID.');
    }
  };

  const getTotalVotes = (): number => {
    return results?.tally.reduce((sum, item) => sum + item.votes, 0) || 0;
  };

  const getPercentage = (optionId: string): number => {
    const totalVotes = getTotalVotes();
    if (totalVotes === 0) return 0;
    const votesForOption = results?.tally.find(item => item.optionId === optionId)?.votes || 0;
    return (votesForOption / totalVotes) * 100;
  };

  if (!id) {
    return (
      <div className="results-container">
        <h2>Enter Poll ID to View Results</h2>
        <form onSubmit={handleIdSubmit} className="poll-id-input-form">
          <input
            type="text"
            placeholder="Enter Poll ID"
            value={inputPollId}
            onChange={(e) => setInputPollId(e.target.value)}
          />
          <button type="submit">Load Results</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="results-container">
        Loading poll results...
        <p>Current poll ID: {id}</p>
      </div>
    );
  }

  if (error) {
    return <div className="results-container error">Error: {error}</div>;
  }

  if (!results) {
    return <div className="results-container">No results found for this poll or failed to load.</div>;
  }

  return (
    <div className="results-container">
      <h2>{results.question}</h2>
      <p>Total votes: {results.totalVotes}</p>
      {results.isClosed && <p className="poll-closed-message">This poll is closed. No more votes can be cast.</p>}

      <div className="results-list">
        {results.options.map((option: PollOption) => {
          const percentage = getPercentage(option.id);
          const votes = results.tally.find(item => item.optionId === option.id)?.votes || 0;
          return (
            <div key={option.id} className="result-item">
              <div className="option-text">{option.text}</div>
              <div className="vote-bar-container">
                <div className="vote-bar" style={{ width: `${percentage}%` }}></div>
              </div>
              <div className="vote-count">{votes} votes ({percentage.toFixed(1)}%)</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PollResultsPage;