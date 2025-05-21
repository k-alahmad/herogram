
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPoll, getAnonymousToken } from '../api';
import './CreatePollPage.css';

const CreatePollPage: React.FC = () => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '']); 
  const [expiresAt, setExpiresAt] = useState<string>(''); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdPollId, setCreatedPollId] = useState<string | null>(null); 

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setCreatedPollId(null); 

    if (!question.trim()) {
      setError('Poll question cannot be empty.');
      return;
    }

    const filteredOptions = options.map(opt => opt.trim()).filter(opt => opt !== '');

    if (filteredOptions.length < 2) {
      setError('Please provide at least two unique options.');
      return;
    }

    const uniqueOptions = new Set(filteredOptions.map(opt => opt.toLowerCase())); 
    if (uniqueOptions.size !== filteredOptions.length) {
      setError('Options cannot have duplicate text.');
      return;
    }

    if (!expiresAt) {
      setError('Please set an expiry date and time.');
      return;
    }

    const expiryDateTime = new Date(expiresAt).toISOString();

    setLoading(true);
    try {
      let token = localStorage.getItem('anon_jwt_token');
      if (!token) {
        token = await getAnonymousToken();
        localStorage.setItem('anon_jwt_token', token);
      }

      const pollId = await createPoll(question, filteredOptions, expiryDateTime);
      setCreatedPollId(pollId); // Save the ID
      setSuccessMessage(`Poll created successfully! Poll ID: ${pollId}`);
      setTimeout(() => {
        navigate(`/poll/${pollId}`);
      }, 1500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.message && err.message.includes('Unique constraint failed')) {
        setError('Error creating poll: An option with the same text already exists for this poll. Please ensure all options are unique.');
      } else {
        setError(err.message || 'Failed to create poll. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="create-poll-container">
      <h2>Create New Poll</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="question">Poll Question:</label>
          <input
            type="text"
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What's your favorite color?"
            required
          />
        </div>

        <div className="form-group">
          <label>Options:</label>
          {options.map((option, index) => (
            <div key={index} className="option-input-group">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                required={index < 2} 
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(index)} className="remove-option-btn">
                  &times;
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOption} className="add-option-btn">
            Add Option
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="expiresAt">Expires At:</label>
          <input
            type="datetime-local"
            id="expiresAt"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={getMinDateTime()}
            required
          />
        </div>

        {error && <p className="error-message">{error}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        {createdPollId && <p className="created-poll-id">Generated Poll ID: <strong>{createdPollId}</strong></p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Poll...' : 'Create Poll'}
        </button>
      </form>
    </div>
  );
};

export default CreatePollPage;