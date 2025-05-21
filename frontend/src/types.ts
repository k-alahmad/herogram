export interface PollOption {
  id: string; 
  text: string;
}

export interface PollResultItem {
  optionId: string;
  text: string; 
  votes: number;
}

export interface PollDetailsResponse {
  id: string;
  question: string;
  expiresAt: string; 
  createdAt: string; 
  isClosed: boolean;
  results: PollResultItem[]; 
}
export interface PollResults {
  question: string;
  options: PollOption[]; 
  tally: PollTally[];    
  totalVotes: number;
  isClosed: boolean;
}

export interface PollTally {
  optionId: string;
  votes: number;
}

export interface VotePayload {
  optionId: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  expiresAt: string; 
}

export interface AuthResponse {
  token: string;
  userId: string; 
  message: string; 
}