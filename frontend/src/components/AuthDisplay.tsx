import React, { useState, useEffect } from 'react';
import type { AuthResponse } from '../types';
import './AuthDisplay.css'; 

const AuthDisplay: React.FC = () => {
  const [authInfo, setAuthInfo] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSaveNewToken = async (): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3000/api/auth/anon', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get anonymous token');
      }
      const data: AuthResponse = await response.json();
      localStorage.setItem('anon_jwt_token', data.token); 
      return data;
    } finally {
      setLoading(false);
    }
  };

  const handleFetchToken = async () => {
    const data = await fetchAndSaveNewToken();
    setAuthInfo(data); 
  };

  useEffect(() => {
    const existingToken = localStorage.getItem('anon_jwt_token');
    if (existingToken) {
      setAuthInfo({
        token: existingToken,
        userId: 'N/A (from localStorage)', 
        message: 'Existing token found in localStorage.',
      });
    }
  }, []);

  return (
    <div className="auth-display-container">
      <button onClick={handleFetchToken} disabled={loading}>
        {loading ? 'Fetching Token...' : 'Get New Anonymous Token & User'}
      </button>

      {error && <p className="auth-error-message">{error}</p>}

      {authInfo && (
        <div className="auth-info">
          <p><strong>User ID:</strong> {authInfo.userId}</p>
        </div>
      )}
    </div>
  );
};

export default AuthDisplay;