import React, { useState, useEffect } from 'react';
import * as d3 from 'd3';
import ParticipantNodes from './ParticipantNodes';
import ConversationStrip from './ConversationStrip';
import TooltipContainer from './TooltipContainer';
import ControlPanel from './ControlPanel';
import { ConversationTurn, ConversationsData } from '../types/conversationTypes';
import { extractEdges, filterByFacilitator, filterFrontline, extractFacilitators } from '../utils/dataUtils';

interface ConversationVizProps {
  conversationsData: ConversationsData;
}

const ConversationViz: React.FC<ConversationVizProps> = ({ conversationsData }) => {
  // State for selected filters and highlighted elements
  const [selectedConversation, setSelectedConversation] = useState<string>('all');
  const [selectedFacilitator, setSelectedFacilitator] = useState<string>('All Facilitators');
  const [hideFrontline, setHideFrontline] = useState<boolean>(false);
  const [highlightedSpeaker, setHighlightedSpeaker] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ConversationTurn | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ConversationTurn | null>(null);
  const [scale, setScale] = useState<number>(1);
  
  // Reference to the tooltip container for scrolling
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  
  // State for filtered data
  const [filteredData, setFilteredData] = useState<ConversationsData>(conversationsData);
  
  // Extract facilitators
  const facilitators = extractFacilitators(conversationsData);
  
  // Apply filters when selection changes
  useEffect(() => {
    let filtered = { ...conversationsData };
    
    // Filter by facilitator
    filtered = filterByFacilitator(filtered, selectedFacilitator);
    
    // Filter frontline/documentary
    filtered = filterFrontline(filtered, hideFrontline);
    
    // Filter by selected conversation
    if (selectedConversation !== 'all') {
      filtered = { [selectedConversation]: filtered[selectedConversation] };
    }
    
    setFilteredData(filtered);
  }, [conversationsData, selectedConversation, selectedFacilitator, hideFrontline]);
  
  // Handle zoom controls
  const handleZoomIn = () => {
    setScale(Math.min(1.5, scale + 0.1));
  };
  
  const handleZoomOut = () => {
    setScale(Math.max(0.3, scale - 0.1));
  };
  
  // Helper function to safely process turn objects to ensure words is properly formatted
  const safelyProcessTurn = (turn: ConversationTurn | null): ConversationTurn | null => {
    if (!turn) return null;
    
    // Create a copy to avoid mutating the original
    const processedTurn = { ...turn };
    
    // Ensure words is an array
    if (processedTurn.words === undefined || processedTurn.words === null) {
      processedTurn.words = [];
    } else if (typeof processedTurn.words === 'string') {
      processedTurn.words = [processedTurn.words];
    } else if (!Array.isArray(processedTurn.words)) {
      try {
        // Try to convert to string and then split (or wrap in array)
        const wordsStr = String(processedTurn.words);
        processedTurn.words = [wordsStr];
      } catch (e) {
        console.warn('Could not convert words to array:', e);
        processedTurn.words = [];
      }
    }
    
    return processedTurn;
  };
  
  // Handle turn hover events
  const handleTurnHover = (turn: ConversationTurn | null) => {
    try {
      // Process turn to ensure words is formatted correctly
      const processedTurn = safelyProcessTurn(turn);
      setHoveredNode(processedTurn);
      
      // If turn is clicked (not null) and different from current selection, update selection
      if (processedTurn !== null) {
        // Update selected conversation if needed
        if (selectedConversation !== 'all' && processedTurn.conversation_id !== selectedConversation) {
          setSelectedConversation(processedTurn.conversation_id);
        }
      }
    } catch (error) {
      console.error("Error handling turn hover:", error);
      // Reset the hover state to be safe
      setHoveredNode(null);
    }
  };
  
  // Handle node/turn selection
  const handleTooltipClick = (turn: ConversationTurn) => {
    try {
      // Process turn to ensure words is formatted correctly
      const processedTurn = safelyProcessTurn(turn);
      
      if (selectedNode?.speaker_turn === turn.speaker_turn && 
          selectedNode?.conversation_id === turn.conversation_id) {
        setSelectedNode(null);
      } else {
        setSelectedNode(processedTurn);
        // Make sure the correct conversation is selected
        if (selectedConversation !== 'all' && turn.conversation_id !== selectedConversation) {
          setSelectedConversation(turn.conversation_id);
        }
      }
    } catch (error) {
      console.error("Error handling tooltip click:", error);
      // Don't change selection on error
    }
  };
  
  // Scroll to selected turn when hoveredNode changes
  useEffect(() => {
    if (hoveredNode && tooltipRef.current) {
      const tooltipElement = tooltipRef.current.querySelector(
        `.tooltip-${hoveredNode.speaker_turn}`
      );
      if (tooltipElement) {
        tooltipElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [hoveredNode]);
  
  // Determine which conversation data to display in the tooltip
  const getTooltipConversationData = () => {
    // If a node is hovered, show its conversation
    if (hoveredNode) {
      return filteredData[hoveredNode.conversation_id] || {};
    }
    
    // Otherwise show the selected conversation or first available
    if (selectedConversation !== 'all') {
      return filteredData[selectedConversation] || {};
    }
    
    // Default to first conversation
    return Object.values(filteredData)[0] || {};
  };
  
  // Define heights for conversation components
  const baseConvHeight = 300; // Original height per conversation
  const reducedConvHeight = baseConvHeight / 4; // Reduced height (1/4 of original)
  const convSpacing = 10; // Small spacing between conversation strips (reduced from ~30)
  
  return (
    <div className="conversation-viz-container" style={{ width: '100%', height: '100vh' }}>
      <ControlPanel
        conversationIds={Object.keys(conversationsData)}
        selectedConversation={selectedConversation}
        onConversationChange={setSelectedConversation}
        facilitators={facilitators}
        selectedFacilitator={selectedFacilitator}
        onFacilitatorChange={setSelectedFacilitator}
        hideFrontline={hideFrontline}
        onHideFrontlineChange={setHideFrontline}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
      
      <div className="visualization-content">
        {/* Tooltip container */}
        <div className="tooltip-wrapper" ref={tooltipRef}>
          <TooltipContainer
            conversationData={getTooltipConversationData()}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            onTooltipClick={handleTooltipClick}
          />
        </div>
        
        {/* Main visualization area */}
        <div className="visualization-area" style={{ 
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          transition: 'transform 0.3s ease'
        }}>
          {Object.entries(filteredData).map(([convId, convData], index) => {
            const edges = extractEdges(convData);
            const tooltipWidth = 450; // Width of tooltip container
            const participantNodesWidth = 300; // Width of participant nodes panel
            const availableWidth = Math.max(500, window.innerWidth - tooltipWidth - 60); // Ensure minimum width
            
            // Calculate top position with reduced spacing
            const topPosition = index * (reducedConvHeight + convSpacing);
            
            return (
              <div key={convId} style={{ 
                position: 'relative', 
                height: `${reducedConvHeight}px`, 
                width: '100%',
                marginBottom: `${convSpacing}px` 
              }}>
                {/* Participant nodes in red square */}
                <div style={{ position: 'absolute', left: 0, top: 0, height: reducedConvHeight, width: participantNodesWidth }}>
                  <ParticipantNodes 
                    data={convData} 
                    edges={edges}
                    onNodeHover={setHighlightedSpeaker}
                    width={participantNodesWidth}
                    height={baseConvHeight} // Pass original height, component will reduce internally
                  />
                </div>
                
                {/* Conversation strip */}
                <div style={{ position: 'absolute', left: participantNodesWidth, top: 0, right: 0, height: reducedConvHeight }}>
                  <ConversationStrip 
                    data={convData} 
                    edges={edges}
                    highlightedSpeaker={highlightedSpeaker}
                    width={availableWidth - participantNodesWidth}
                    height={baseConvHeight} // Pass original height, component will reduce internally
                    onTurnHover={handleTurnHover}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConversationViz; 