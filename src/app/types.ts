export type Session = {
  id: string;
  player1_token?: string | null;
  player2_token?: string | null;
  keyword: string;
  white: 'player1' | 'player2';
  started: boolean;
  moves: string;
  player1_ready: boolean;
  player2_ready: boolean;
};
