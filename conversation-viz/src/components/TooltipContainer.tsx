import React from 'react';
import { ConversationTurn } from '../types/conversationTypes';

interface TooltipContainerProps {
  conversationData: Record<string, ConversationTurn>;
  selectedNode: ConversationTurn | null;
  hoveredNode: ConversationTurn | null;
  onTooltipClick: (turn: ConversationTurn) => void;
}

const TooltipContainer: React.FC<TooltipContainerProps> = ({ 
  conversationData, 
  selectedNode,
  hoveredNode,
  onTooltipClick 
}) => {
  // Get the facilitator (first speaker)
  const sortedData = Object.values(conversationData)
    .sort((a, b) => a.speaker_turn - b.speaker_turn);
  
  const firstNode = sortedData[0]?.speaker_name;

  // Helper function to safely get text from a turn's words property
  const safelyGetText = (turn: ConversationTurn): string => {
    // Handle undefined or null words
    if (!turn.words) return '';
    
    // If words is already a string, return it directly
    if (typeof turn.words === 'string') return turn.words;
    
    // If words is an array with a join method, use it
    if (Array.isArray(turn.words) && typeof turn.words.join === 'function') {
      return turn.words.join(' ');
    }
    
    // For any other type, safely convert to string
    try {
      return String(turn.words);
    } catch (error) {
      console.warn('Error converting turn.words to string:', error);
      return '';
    }
  };
  
  return (
    <div className="tooltip-scrollable-container">
      {sortedData.map((turn, index) => {
        const fullText = safelyGetText(turn);
        const shortText = fullText.length > 50 
          ? fullText.slice(0, 50) + '...' 
          : fullText;
        
        const isSelected = selectedNode?.speaker_turn === turn.speaker_turn &&
                           selectedNode?.conversation_id === turn.conversation_id;
        
        const isHovered = hoveredNode?.speaker_turn === turn.speaker_turn &&
                         hoveredNode?.conversation_id === turn.conversation_id;
        
        return (
          <div 
            key={`${turn.conversation_id}-${turn.speaker_turn}`}
            className={`tooltip tooltip-${turn.speaker_turn} ${isSelected ? 'expanded' : ''} ${isHovered ? 'hovered' : ''}`}
            onClick={() => onTooltipClick(turn)}
          >
            <div className="tooltip-header">
              <strong>
                {turn.speaker_name === firstNode && (
                  <span style={{ color: '#983AEF' }}>[Facilitator] </span>
                )}
                {turn.speaker_name}
              </strong> 
              <span className="turn-number">
                (Turn {turn.speaker_turn})
              </span>
            </div>
            
            <div className={`tooltip-content ${isSelected ? 'expanded' : 'collapsed'}`}
              style={{ 
                display: isSelected ? 'block' : (turn === selectedNode ? 'none' : 'block')
              }}>
              {isSelected ? fullText : shortText}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TooltipContainer; 