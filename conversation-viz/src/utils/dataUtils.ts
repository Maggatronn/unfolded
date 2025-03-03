import { ConversationTurn, ConversationData, ConversationsData, Edge } from '../types/conversationTypes';

// Process conversation data to extract edges between speakers
export const extractEdges = (data: ConversationData): Edge[] => {
  return Object.values(data)
    .flatMap(d => {
      if (!d.link_turn_id) return [];
      if (Array.isArray(d.link_turn_id) && d.link_turn_id.includes("NA")) return [];
      
      const source = d;
      
      // Ensure segments exists
      if (!Object.keys(d).includes("segments")) {
        return [];
      }
      
      return Object.keys(d.segments).map(segmentKey => {
        const segment = d.segments[segmentKey];
        const linkId = segment.link_turn_id;
        const target = data[linkId];
        const type = segment.majority_label;
        const segWords = segment.segment_words;
        const score = segment.score;
        
        if (target && source) {
          // Handle the case where segment_words might not be an array
          const wordCount = Array.isArray(segWords) ? segWords.length : 
                           (typeof segWords === 'string' ? (segWords as string).split(' ').length : 1);
          
          return { 
            source, 
            target, 
            type, 
            count: wordCount,
            score 
          };
        }
        return null;
      });
    })
    .filter((edge): edge is Edge => edge !== null);
};

// Filter conversations based on facilitator name
export const filterByFacilitator = (
  conversations: ConversationsData,
  facilitator: string
): ConversationsData => {
  if (facilitator === "All Facilitators") {
    return conversations;
  }
  
  const filtered: ConversationsData = {};
  
  Object.entries(conversations).forEach(([key, conv]) => {
    // Find the turn that has facilitator field
    const facilitatorTurn = Object.values(conv).find(turn => turn.facilitator);
    if (facilitatorTurn && facilitatorTurn.facilitator === facilitator) {
      filtered[key] = conv;
    }
  });
  
  return filtered;
};

// Filter out frontline/documentary speakers if needed
export const filterFrontline = (
  conversations: ConversationsData, 
  hideFrontline: boolean
): ConversationsData => {
  if (!hideFrontline) {
    return conversations;
  }
  
  const filtered: ConversationsData = {};
  
  Object.entries(conversations).forEach(([key, conv]) => {
    const filteredTurns: ConversationData = {};
    
    Object.entries(conv).forEach(([turnId, turn]) => {
      if (!turn.speaker_name || !turn.speaker_name.toUpperCase().includes("FRONTLINE")) {
        filteredTurns[turnId] = turn;
      }
    });
    
    if (Object.keys(filteredTurns).length > 0) {
      filtered[key] = filteredTurns;
    }
  });
  
  return filtered;
};

// Extract unique facilitators from conversations data
export const extractFacilitators = (conversations: ConversationsData): string[] => {
  const facilitators = Object.values(conversations).map(conv => {
    // Find the turn that has facilitator field
    const facilitatorTurn = Object.values(conv).find(turn => turn.facilitator);
    return facilitatorTurn?.facilitator || "Unknown";
  });
  
  return Array.from(new Set(facilitators));
}; 