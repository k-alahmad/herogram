import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPoll, castVote, getAnonymousToken } from '../api';
import type { Poll, PollOption } from '../types';

import './PollVotingPage.css';
import { usePollUpdate } from '../hooks/usePollUpdate';


const PollVotingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { triggerPollUpdate } = usePollUpdate(); // Use the hook

  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [inputPollId, setInputPollId] = useState<string>('');

  useEffect(() => {
    const fetchPoll = async () => {
      if (!id) {
        setPoll(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      setVoteSubmitted(false);
      setSelectedOption(null);

      try {
        let token = localStorage.getItem('anon_jwt_token');
        if (!token) {
          token = await getAnonymousToken();
          localStorage.setItem('anon_jwt_token', token);
        }

        const fetchedPoll = await getPoll(id);
        setPoll(fetchedPoll);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message || 'Failed to load poll. Please check the ID.');
        setPoll(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [id]);

  const handleIdSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputPollId.trim()) {
      navigate(`/poll/${inputPollId.trim()}`);
    } else {
      setError('Please enter a Poll ID.');
    }
  };

  const handleSubmitVote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || !selectedOption) {
      setError("Please select an option and ensure poll ID is valid.");
      return;
    }

    try {
      setLoading(true);
      console.log('[VOTING] Attempting to cast vote...');
      await castVote(id, selectedOption);
      setVoteSubmitted(true);
      console.log('[VOTING] Vote cast successfully. Calling triggerPollUpdate...');
      triggerPollUpdate(); 
      console.log('[VOTING] triggerPollUpdate called.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote. This might be a closed poll or invalid ID.');
      console.error('[VOTING] Error casting vote, triggerPollUpdate NOT called due to error.', err);
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <div className="poll-container">
        <h2>Enter Poll ID to Vote</h2>
        <form onSubmit={handleIdSubmit} className="poll-id-input-form">
          <input
            type="text"
            placeholder="Enter Poll ID"
            value={inputPollId}
            onChange={(e) => setInputPollId(e.target.value)}
          />
          <button type="submit">Load Poll</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return <div className="poll-container">Loading poll data...</div>;
  }

  if (error) {
    return <div className="poll-container error">Error: {error}</div>;
  }

  if (!poll) {
    return <div className="poll-container">Poll not found or failed to load.</div>;
  }

  return (
    <div className="poll-container">
      <h2>{poll.question}</h2>
      {voteSubmitted ? (
        <div className="vote-success">
          <p>Your vote has been submitted!</p>
          <button onClick={() => navigate(`/poll/${id}/results`)}>View Results</button>
        </div>
      ) : (
        <form onSubmit={handleSubmitVote}>
          {poll.options.map((option: PollOption) => (
            <div key={option.id} className="option-item">
              <input
                type="radio"
                id={option.id}
                name="pollOption"
                value={option.id}
                checked={selectedOption === option.id}
                onChange={() => setSelectedOption(option.id)}
              />
              <label htmlFor={option.id}>{option.text}</label>
            </div>
          ))}
          <button type="submit" disabled={!selectedOption || loading}>
            {loading ? 'Submitting...' : 'Submit Vote'}
          </button>
        </form>
      )}
      <div className="poll-actions">
        <button onClick={() => navigate(`/poll/${id}/results`)}>View Current Results</button>
      </div>
    </div>
  );
};

export default PollVotingPage;