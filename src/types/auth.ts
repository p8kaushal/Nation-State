export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface GameSave {
  id: string;
  user_id: string;
  scenario_id: string;
  current_turn: number;
  game_state_json: any;
  updated_at: string;
}

import { NationState } from '../types';

export interface RunHistory {
  id: string;
  user_id: string;
  scenario_id: string;
  turns_survived: number;
  result: 'win' | 'loss';
  loss_reason: string | null;
  ended_at: string;

  grade?: string;
  performanceTitle?: string;
  badgesEarned?: string[];
  finalStats?: NationState;
  endReason?: string;
}

export interface GameState {
  scenarioId: string;
  state: NationState;
  decisionIndex: number;
  turnLogsHistory: string[];
}

export interface RunSummary {
  id?: string;
  user_id?: string;
  scenario_id: string;
  turns_survived: number;
  result: 'win' | 'loss';
  loss_reason: string | null;
  ended_at?: string;

  grade?: string;
  performanceTitle?: string;
  badgesEarned?: string[];
  finalStats?: NationState;
  endReason?: string;
}
