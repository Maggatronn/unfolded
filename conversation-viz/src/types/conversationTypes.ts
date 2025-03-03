export interface Segment {
  link_turn_id: string;
  majority_label: string;
  segment_words: string[];
  score: number;
}

export interface ConversationTurn {
  speaker_name: string;
  speaker_turn: number;
  words: string[];
  segments: Record<string, Segment>;
  cumulativeWords?: number;
  arousal?: number;
  valence?: number;
  conversation_id: string;
  title?: string;
  facilitator?: string;
  link_turn_id?: string | string[];
  start_time?: number;
  end_time?: number;
}

export interface Edge {
  source: ConversationTurn;
  target: ConversationTurn;
  type: string;
  count: number;
  score: number;
}

export interface SpeakerPosition {
  x: number;
  y: number;
}

export interface ConversationData {
  [turnId: string]: ConversationTurn;
}

export interface ConversationsData {
  [conversationId: string]: ConversationData;
} 