import type { Poll, AuthResponse, PollDetailsResponse, PollResults, PollOption, PollTally, VotePayload } from './types';

const API_BASE_URL = 'http://localhost:3000/api';
const WS_BASE_URL = 'ws://localhost:3000/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('anon_jwt_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const getAnonymousToken = async (): Promise<string> => { 
  console.log("Attempting to get a new anonymous token...");
  const response = await fetch(`${API_BASE_URL}/auth/anon`, {
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
  console.log("New anonymous token fetched and saved.");
  return data.token; 
};

async function callAuthenticatedApi<T>(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers, 
      ...getAuthHeaders(), 
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    if ((response.status === 401 || (errorData && errorData.message === "Invalid or expired token")) && retryCount < 1) {
      console.warn("Token expired or invalid, attempting to refresh token...");
      try {
        await getAnonymousToken(); 
        console.log("Token refreshed, retrying original request...");
        return callAuthenticatedApi(url, options, retryCount + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (refreshError: any) {
        console.error("Failed to refresh token:", refreshError.message);
        throw new Error(errorData.message || 'Authentication required, but token refresh failed.');
      }
    }
    throw new Error(errorData.message || `API call failed with status ${response.status}`);
  }

  return response.json();
}
export const createPoll = async (question: string, options: string[], expiresAt: string): Promise<string> => {
  const data: PollDetailsResponse = await callAuthenticatedApi(
    `${API_BASE_URL}/poll`,
    {
      method: 'POST',
      body: JSON.stringify({ question, options, expiresAt }),
    }
  );
  return data.id;
};

export const castVote = async (pollId: string, optionId: string): Promise<void> => {
  const payload: VotePayload = { optionId };
  const results = await callAuthenticatedApi<void>( 
    `${API_BASE_URL}/poll/${pollId}/vote`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  console.log("results ===> ",results)
};

export const getPollResults = async (pollId: string): Promise<PollResults> => {
  const data: PollDetailsResponse = await callAuthenticatedApi(
    `${API_BASE_URL}/poll/${pollId}`,
    {
      method: 'GET',
    }
  );

  const options: PollOption[] = data.results.map(item => ({
    id: item.optionId,
    text: item.text,
  }));

  const tally: PollTally[] = data.results.map(item => ({
    optionId: item.optionId,
    votes: item.votes,
  }));

  const totalVotes = tally.reduce((sum, item) => sum + item.votes, 0);

  return {
    question: data.question,
    options,
    tally,
    totalVotes,
    isClosed: data.isClosed,
  };
};

export const getPoll = async (pollId: string): Promise<Poll> => {
  const data: PollDetailsResponse = await callAuthenticatedApi(
    `${API_BASE_URL}/poll/${pollId}`,
    {
      method: 'GET',
    }
  );

  const options: PollOption[] = data.results.map(item => ({
    id: item.optionId,
    text: item.text,
  }));

  return {
    id: data.id,
    question: data.question,
    options,
    expiresAt: data.expiresAt,
  };
};

export const connectToPollResultsWs = (pollId: string, onUpdate: (data: PollResults) => void) => {
  const cleanPollId = pollId.startsWith('/') ? pollId.substring(1) : pollId;
  const ws = new WebSocket(`${WS_BASE_URL}/poll-ws?pollId=${cleanPollId}`);

  ws.onopen = () => {
    console.log(`[WS] Connected to WebSocket for poll ${cleanPollId}`);
  };

  ws.onmessage = (event) => {
    try {
      console.log(`[WS] Raw message received for poll ${cleanPollId}:`, event.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData: any = JSON.parse(event.data); 
      if (!rawData || !Array.isArray(rawData.results)) {
        console.warn(`[WS] Received data is not in expected PollDetailsResponse format or missing 'results' array:`, rawData);
        return; 
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: PollOption[] = rawData.results.map((item: any) => ({
        id: item.optionId,
        text: item.text,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tally: PollTally[] = rawData.results.map((item: any) => ({
        optionId: item.optionId,
        votes: item.votes,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalVotes = tally.reduce((sum: number, item: any) => sum + (item.votes || 0), 0);

      const transformedData: PollResults = {
        question: rawData.question,
        options,
        tally,
        totalVotes,
        isClosed: rawData.isClosed,
      };

      onUpdate(transformedData);

    } catch (error) {
      console.error(`[WS] Failed to parse WebSocket message or update state for poll ${cleanPollId}:`, error);
      console.error('[WS] Raw WS message that caused error:', event.data);
    }
  };

  ws.onclose = () => {
    console.log(`[WS] Disconnected from WebSocket for poll ${cleanPollId}`);
  };

  ws.onerror = (error) => {
    console.error(`[WS] WebSocket error for poll ${cleanPollId}:`, error);
  };

  return ws;
};
