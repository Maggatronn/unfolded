import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useD3 } from '../hooks/useD3';
import * as d3 from 'd3';
import { ConversationTurn, Edge } from '../types/conversationTypes';

interface ConversationStripProps {
  data: Record<string, ConversationTurn>;
  edges: Edge[];
  highlightedSpeaker: string | null;
  width: number;
  height: number;
  onTurnHover: (turn: ConversationTurn | null) => void;
}

const ConversationStrip: React.FC<ConversationStripProps> = ({ 
  data, 
  edges, 
  highlightedSpeaker,
  width, 
  height,
  onTurnHover 
}) => {
  const [nodes, setNodes] = useState<d3.Selection<SVGRectElement, ConversationTurn, SVGGElement, unknown> | null>(null);
  const [paths, setPaths] = useState<d3.Selection<SVGPathElement, Edge, SVGGElement, unknown> | null>(null);
  const [hoveredTurn, setHoveredTurn] = useState<ConversationTurn | null>(null);
  const [totalContentWidth, setTotalContentWidth] = useState<number>(0);
  const [fixedSvgInitialized, setFixedSvgInitialized] = useState<boolean>(false);
  // Add state for speaker visibility
  const [hiddenSpeakers, setHiddenSpeakers] = useState<Set<string>>(new Set());
  // Add a ref to track if we need to detect the facilitator
  const facilitatorRef = useRef<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fixedSvgRef = useRef<SVGSVGElement>(null);
  const scrollableSvgRef = useRef<SVGSVGElement>(null);
  
  // Add cache ref to avoid recalculating relationships on every hover
  const relationshipsRef = useRef<{
    turnToEdges: Map<number, Edge[]>;
    turnToConnectedTurns: Map<number, Set<number>>;
  }>({
    turnToEdges: new Map(),
    turnToConnectedTurns: new Map()
  });
  
  // Mouse position ref to avoid throttling issues
  const lastHoveredTurnRef = useRef<number | null>(null);
  
  // Add a timeout ref for debouncing
  const debounceTimeoutRef = useRef<number | null>(null);
  
  // Add a flag to track if we're currently hovering over any element
  const isHoveringRef = useRef<boolean>(false);
  
  // Add a static flag to track currently hovered element
  const hoveredElementIdRef = useRef<number | null>(null);
  
  // Reduce the height to 1/4 of original
  const adjustedHeight = height / 4;

  // Define margin values to be used consistently
  const margin = { top: 0, right: 30, bottom: 20, left: 100 }; // Reduced bottom margin
  
  // Toggle speaker visibility
  const toggleSpeakerVisibility = (speakerName: string) => {
    setHiddenSpeakers(prevHidden => {
      const newHidden = new Set(prevHidden);
      if (newHidden.has(speakerName)) {
        newHidden.delete(speakerName);
      } else {
        newHidden.add(speakerName);
      }
      return newHidden;
    });
  };

  // Toggle facilitator visibility
  const hideFacilitator = () => {
    if (!facilitatorRef.current) return;
    
    // Toggle the facilitator visibility
    toggleSpeakerVisibility(facilitatorRef.current);
  };

  // Show all speakers
  const showAllSpeakers = () => {
    setHiddenSpeakers(new Set());
  };

  // Filter data based on hidden speakers
  const getVisibleData = useCallback(() => {
    const filteredData: Record<string, ConversationTurn> = {};
    
    Object.entries(data).forEach(([key, turn]) => {
      if (!hiddenSpeakers.has(turn.speaker_name)) {
        filteredData[key] = turn;
      }
    });
    
    return filteredData;
  }, [data, hiddenSpeakers]);

  // Filter edges based on hidden speakers
  const getVisibleEdges = useCallback(() => {
    return edges.filter(edge => 
      !hiddenSpeakers.has(edge.source.speaker_name) && 
      !hiddenSpeakers.has(edge.target.speaker_name)
    );
  }, [edges, hiddenSpeakers]);
  
  // Helper function to create curved paths between source and target
  const curvedPath = (
    source: ConversationTurn, 
    target: ConversationTurn, 
    xScale: d3.ScaleLinear<number, number>, 
    yScale: d3.ScalePoint<string>
  ) => {
    // Use start_time for positioning with fallback
    const sourceTime = source.start_time || 0;
    const targetTime = target.start_time || 0;
    
    // Get positions with proper rounding to avoid sub-pixel rendering
    const x1 = Math.round(xScale(sourceTime));
    const y1 = Math.round(yScale(source.speaker_name) as number);
    const x2 = Math.round(xScale(targetTime));
    const y2 = Math.round(yScale(target.speaker_name) as number);
    
    // For very close points, use a straight line to avoid rendering issues
    if (Math.abs(x2 - x1) < 10) {
      return `M ${x1},${y1} L ${x2},${y2}`;
    }
    
    // For paths that go between speakers, use a curve
    const midX = Math.round((x1 + x2) / 2);
    // Reduce curve offset to match smaller height
    const curveOffset = 15;
    
    // For longer distances or when speakers are the same, use simple quadratic curve
    if (source.speaker_name === target.speaker_name || Math.abs(x2 - x1) > 100) {
      return `M ${x1},${y1} Q ${midX},${y1 - curveOffset} ${x2},${y2}`;
    }

    // For more complex paths, use D3's curve generator
    try {
      const line = d3.line().curve(d3.curveBasis);
      const points = [
        [x1, y1],
        [x1 + (midX - x1) * 0.5, y1],
        [midX, y1 - curveOffset],
        [x2 - (x2 - midX) * 0.5, y2],
        [x2, y2]
      ];
      
      const pathData = line(points as [number, number][]);
      return pathData || `M ${x1},${y1} Q ${midX},${y1 - curveOffset} ${x2},${y2}`;
    } catch (e) {
      console.warn('Error generating curved path:', e);
      // Fallback to simple curve
    return `M ${x1},${y1} Q ${midX},${y1 - curveOffset} ${x2},${y2}`;
    }
  };
  
  // Helper function to reset all elements to full opacity
  const resetAllElementsToFullOpacity = () => {
    if (!nodes || !paths) return;
    
    // Reset all nodes to full opacity
    nodes
      .style("opacity", 1)
      .style("stroke", "black")
      .style("stroke-width", 0.2);
    
    // Reset all paths to full opacity
    paths
      .style("opacity", 0.8) // Slight transparency for all paths by default
      .style("stroke-width", d => scoreScale(d.score))
      .style("stroke", d => d.type === "responsive_substantive" ? "red" : "#999999");
  };
  
  // Helper function to format time for axis display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle rendering the fixed part (y-axis) of the visualization
  const renderFixedVisualization = () => {
    if (!fixedSvgRef.current) return;

    const svg = d3.select(fixedSvgRef.current);
    svg.selectAll('*').remove();
    
    // Get array of conversation turn objects
    const dataArray = Object.values(data);
    if (dataArray.length === 0) return;
    
    // Adjust the SVG to fit the container with reduced height
    svg.attr("width", margin.left)
      .attr("height", adjustedHeight)
      .attr("preserveAspectRatio", "xMinYMin meet")
      .attr("overflow", "visible");
    
    // Get unique speakers
    const speakers = Array.from(new Set(dataArray.map(d => d.speaker_name)));

    // Try to identify the facilitator (speaker with most turns)
    const speakerCounts: Record<string, number> = {};
    dataArray.forEach(turn => {
      speakerCounts[turn.speaker_name] = (speakerCounts[turn.speaker_name] || 0) + 1;
    });
    
    // Find the speaker with the most turns - likely the facilitator
    let maxCount = 0;
    let likelyFacilitator = null;
    
    for (const [speaker, count] of Object.entries(speakerCounts)) {
      if (count > maxCount) {
        maxCount = count;
        likelyFacilitator = speaker;
      }
    }
    
    // Store facilitator reference for the hide facilitator button
    facilitatorRef.current = likelyFacilitator;
    
    // Define scales with reduced height
    const yScale = d3.scalePoint()
      .domain(speakers)
      .range([0, adjustedHeight - margin.top - margin.bottom])
      .padding(0.3); // Reduced padding for tighter spacing
    
    // Add y-axis for speaker names with buttons to toggle visibility
    const axisGroup = svg.append("g")
      .attr("transform", `translate(${margin.left - 1},0)`);
    
    // Add axis without ticks
    axisGroup.call(d3.axisLeft(yScale).tickSize(0))
      .style("font-size", "8px"); // Reduced font size from 16px to 12px
    
    // Add toggle buttons for each speaker
    axisGroup.selectAll(".speaker-toggle")
      .data(speakers)
      .enter()
      .append("circle")
      .attr("class", "speaker-toggle")
      .attr("cx", -10) // Position to the left of speaker names
      .attr("cy", d => yScale(d) as number)
      .attr("r", 4)
      .attr("fill", d => hiddenSpeakers.has(d) ? "#ccc" : "#44a")
      .attr("stroke", d => d === facilitatorRef.current ? "red" : "none")
      .attr("stroke-width", d => d === facilitatorRef.current ? 1 : 0)
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        event.stopPropagation();
        toggleSpeakerVisibility(d);
      });
    
    // Add an indicator for which speaker is the facilitator
    if (facilitatorRef.current) {
      axisGroup.selectAll(".facilitator-indicator")
        .data([facilitatorRef.current])
        .enter()
        .append("text")
        .attr("class", "facilitator-indicator")
        .attr("x", margin.left - 15)
        .attr("y", d => (yScale(d) as number) + 3)
        .attr("text-anchor", "end")
        .attr("font-size", "8px")
        .attr("fill", "red")
        .text("(facilitator)");
    }

    // Store the yScale in a data attribute to access it later
    svg.node()?.setAttribute('data-y-scale', JSON.stringify(speakers));
    
    // Mark fixed SVG as initialized
    setFixedSvgInitialized(true);
  };

  // Modified pre-compute relationships for hover highlighting
  const preComputeRelationships = (edges: Edge[]) => {
    const turnToEdges = new Map<number, Edge[]>();
    const turnToConnectedTurns = new Map<number, Set<number>>();
    
    // Build indices for quick lookups
    edges.forEach(edge => {
      const sourceTurn = edge.source.speaker_turn;
      const targetTurn = edge.target.speaker_turn;
      
      // Map turns to edges
      if (!turnToEdges.has(sourceTurn)) {
        turnToEdges.set(sourceTurn, []);
      }
      if (!turnToEdges.has(targetTurn)) {
        turnToEdges.set(targetTurn, []);
      }
      turnToEdges.get(sourceTurn)!.push(edge);
      turnToEdges.get(targetTurn)!.push(edge);
      
      // Map turns to connected turns
      if (!turnToConnectedTurns.has(sourceTurn)) {
        turnToConnectedTurns.set(sourceTurn, new Set<number>());
      }
      if (!turnToConnectedTurns.has(targetTurn)) {
        turnToConnectedTurns.set(targetTurn, new Set<number>());
      }
      turnToConnectedTurns.get(sourceTurn)!.add(targetTurn);
      turnToConnectedTurns.get(targetTurn)!.add(sourceTurn);
    });
    
    relationshipsRef.current = {
      turnToEdges,
      turnToConnectedTurns
    };
  };

  // Optimized function for highlighting
  const highlightConnectedElements = (turnId: number | null) => {
    if (!scrollableSvgRef.current) return;
    
    // Use direct selections to ensure we're updating the actual DOM elements
    const svgElement = d3.select(scrollableSvgRef.current);
    const allNodes = svgElement.selectAll<SVGRectElement, ConversationTurn>(".turn");
    const allPaths = svgElement.selectAll<SVGPathElement, Edge>(".link");
    
    // Update the currently hovered element ID in our reference
    hoveredElementIdRef.current = turnId;
    
    // If no turn is hovered, reset everything and return
    if (turnId === null) {
      // Reset nodes
      allNodes
        .style("opacity", 1)
        .style("stroke", "black")
        .style("stroke-width", 0.2)
        .classed("hovered", false)
        .classed("connected", false);
      
      // Reset paths 
      allPaths
        .style("opacity", 0.8)
        .style("stroke-width", d => scoreScale(d.score))
        .style("stroke", d => d.type === "responsive_substantive" ? "red" : "#999999")
        .classed("connected-path", false);
      
      return;
    }
    
    console.log("Highlighting turn:", turnId);
    
    // Get connected turns and edges from our cached relationships
    const { turnToEdges, turnToConnectedTurns } = relationshipsRef.current;
    
    // If we don't have data for this turn, reset to default state
    if (!turnToConnectedTurns.has(turnId)) {
      console.warn("No relationship data for turn:", turnId);
      return;
    }
    
    // Get the visible turn data to determine which turns should be shown
    const visibleData = getVisibleData();
    const visibleTurnIds = new Set(
      Object.values(visibleData).map(turn => turn.speaker_turn)
    );
    
    // Get all connected turns and add the current turn
    const connectedTurns = new Set<number>();
    
    // Only add connected turns that are currently visible
    turnToConnectedTurns.get(turnId)?.forEach(connectedTurnId => {
      if (visibleTurnIds.has(connectedTurnId)) {
        connectedTurns.add(connectedTurnId);
      }
    });
    
    // Always add the hovered turn if it's visible
    if (visibleTurnIds.has(turnId)) {
      connectedTurns.add(turnId);
    }
    
    // Get all edges connected to this turn that are between visible turns
    const connectedEdges = (turnToEdges.get(turnId) || []).filter(edge => 
      visibleTurnIds.has(edge.source.speaker_turn) && 
      visibleTurnIds.has(edge.target.speaker_turn)
    );
    
    const connectedEdgeIds = new Set(connectedEdges.map(e => `${e.source.speaker_turn}-${e.target.speaker_turn}`));
    
    // console.log("Connected visible turns:", Array.from(connectedTurns));
    // console.log("Connected visible edges:", connectedEdges.length);
    
    // Apply extremely dramatic opacity difference for easier debugging
    allNodes.each(function(d) {
      const isConnected = connectedTurns.has(d.speaker_turn);
      const isHovered = d.speaker_turn === turnId;
      
      d3.select(this)
        .classed("hovered", isHovered)
        .classed("connected", isConnected && !isHovered)
        .style("opacity", isConnected ? 1 : 0.1)
        .style("stroke", isHovered ? "#2196F3" : (isConnected ? "red" : "black"))
        .style("stroke-width", isHovered ? 3 : (isConnected ? 2 : 0.2));
    });
    
    allPaths.each(function(d) {
      const edgeId = `${d.source.speaker_turn}-${d.target.speaker_turn}`;
      const isConnected = connectedEdgeIds.has(edgeId);
      
      d3.select(this)
        .classed("connected-path", isConnected)
        .style("opacity", isConnected ? 1 : 0.05)
        .style("stroke-width", isConnected ? d.score * 4 : d.score * 0.5);
    });
  };

  // Add a ref to track hover timeouts
  const hoverTimeoutRef = useRef<number | null>(null);

  // Cleanup function to clear timeouts
  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Refine the hover handler for improved interactivity
  const handleTurnHover = useCallback((turn: ConversationTurn | null) => {
    console.log("Turn hover event:", turn?.speaker_turn || "null");
    
    // Clear any existing timeout
    clearHoverTimeout();
    
    // If we're already hovering on this turn, do nothing
    if (turn && hoveredTurn && turn.speaker_turn === hoveredTurn.speaker_turn) {
      return;
    }
    
    // Update the hover tracking ref
    lastHoveredTurnRef.current = turn?.speaker_turn || null;
    isHoveringRef.current = turn !== null;
    
    // Process turn data if we have it
    if (turn) {
      // Check if the turn belongs to a hidden speaker
      if (hiddenSpeakers.has(turn.speaker_name)) {
        console.log("Attempted to hover on a hidden speaker's turn");
        return;
      }
      
      // Ensure turn has properly processed data
      const safeTurn = { ...turn };
      
      // Safely handle turn.words
      if (!Array.isArray(safeTurn.words)) {
        safeTurn.words = typeof safeTurn.words === 'string' ? 
          [safeTurn.words] : (safeTurn.words ? [String(safeTurn.words)] : []);
      }
      
      // Set state first so we know this turn is being hovered
      setHoveredTurn(safeTurn);
      
      // Then apply highlighting
      highlightConnectedElements(turn.speaker_turn);
      
      // Call onTurnHover immediately since we want the state to persist
      onTurnHover(safeTurn);
    } else {
      // Only clear hover state if we're not hovering anything now
      if (!isHoveringRef.current) {
        // Clear hover state
        setHoveredTurn(null);
        
        // Reset opacity
        highlightConnectedElements(null);
        
        // Clear turn hover immediately since we're no longer hovering
        onTurnHover(null);
        
        // Re-apply speaker highlighting if needed
        if (highlightedSpeaker !== null && !hiddenSpeakers.has(highlightedSpeaker)) {
          highlightBySpeaker(highlightedSpeaker);
        }
      }
    }
  }, [highlightedSpeaker, onTurnHover, hoveredTurn, hiddenSpeakers]);

  // Create nodes for conversation turns with direct D3 event binding
  const createNodes = (
    container: d3.Selection<SVGGElement, unknown, null, undefined>, 
    data: ConversationTurn[], 
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScalePoint<string>,
    opacityScale: d3.ScaleLinear<number, number>,
    initialInDegreeMap: Record<number, number>,
    minTime: number
  ) => {
    const nodes = container.selectAll(".turn")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "turn")
      .attr("data-turn", d => d.speaker_turn)
      .attr("x", d => xScale(d.start_time || 0))
      .attr("y", d => yScale(d.speaker_name) as number - 2)
      .attr("width", d => {
        const duration = (d.end_time || d.start_time || 0) - (d.start_time || 0);
        return Math.max(xScale(minTime + duration) - xScale(minTime), 5);
      })
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("height", d => {
        const baseHeight = d.arousal ? 
          d3.scaleLinear().domain([-1, 1]).range([2, 12])(d.arousal) :
          3;
        return baseHeight;
      })
      .attr("stroke", 'black')
      .attr("stroke-width", 0.2)
      .attr("fill", 'black')
      .attr("fill-opacity", d => opacityScale(initialInDegreeMap[d.speaker_turn] || 0))
      .attr("shape-rendering", "crispEdges");
    
    // Attach event listeners
    nodes.on("mouseenter", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      console.log("Node mouseenter:", d.speaker_turn);
      handleTurnHover(d);
    });
    
    nodes.on("mouseleave", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      console.log("Node mouseleave:", d.speaker_turn);
      handleTurnHover(null);
    });
    
    nodes.on("click", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      console.log("Node click:", d.speaker_turn);
      handleTurnHover(d);
    });
    
    return nodes;
  };

  // Highlight elements based on speaker name with direct D3 selections
  const highlightBySpeaker = (speakerName: string | null) => {
    if (!scrollableSvgRef.current) return;
    
    // If speaker is hidden, don't highlight
    if (speakerName !== null && hiddenSpeakers.has(speakerName)) {
      console.log("Attempted to highlight a hidden speaker");
      return;
    }
    
    const svgElement = d3.select(scrollableSvgRef.current);
    const allNodes = svgElement.selectAll<SVGRectElement, ConversationTurn>(".turn");
    const allPaths = svgElement.selectAll<SVGPathElement, Edge>(".link");
    
    if (speakerName === null) {
      // Reset nodes
      allNodes
        .style("opacity", 1)
        .style("stroke", "black")
        .style("stroke-width", 0.2);
      
      // Reset paths 
      allPaths
        .style("opacity", 0.8)
        .style("stroke-width", d => scoreScale(d.score))
        .style("stroke", d => d.type === "responsive_substantive" ? "red" : "#999999");
      
      return;
    }
    
    // Apply extremely dramatic opacity difference for easier debugging
    allNodes.each(function(d) {
      const isSameSpeaker = d.speaker_name === speakerName;
      
      d3.select(this)
        .style("opacity", isSameSpeaker ? 1 : 0.1)
        .style("stroke", isSameSpeaker ? "red" : "black")
        .style("stroke-width", isSameSpeaker ? 3 : 0.2);
    });
    
    allPaths.each(function(d) {
      const isConnected = d.source.speaker_name === speakerName || d.target.speaker_name === speakerName;
      
      d3.select(this)
        .style("opacity", isConnected ? 1 : 0.05)
        .style("stroke-width", isConnected ? d.score * 4 : d.score * 0.5);
    });
  };

  // Set up the scrollable visualization
  const renderScrollableVisualization = () => {
    if (!scrollableSvgRef.current || !fixedSvgInitialized) return;
    
    // Clear previous content completely
    const svgElement = d3.select(scrollableSvgRef.current);
    svgElement.selectAll('*').remove();
    
    // First, set initial attributes for the SVG
    svgElement
      .attr("width", totalContentWidth || width * 2)
      .attr("height", adjustedHeight)
      .attr("preserveAspectRatio", "xMinYMin meet");
    
    // Helper function to safely process turn objects
    const safelyProcessTurn = (turn: ConversationTurn): ConversationTurn => {
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
    
    // Get filtered data based on visible speakers
    const visibleData = getVisibleData();
    const visibleEdges = getVisibleEdges();
    
    // Process all data to ensure words is in the correct format
    const safeData: Record<string, ConversationTurn> = {};
    Object.entries(visibleData).forEach(([key, turn]) => {
      safeData[key] = safelyProcessTurn(turn);
    });
    
    // Process all edges to ensure their source and target have correctly formatted words
    const safeEdges = visibleEdges.map(edge => ({
      ...edge,
      source: safelyProcessTurn(edge.source),
      target: safelyProcessTurn(edge.target)
    }));
    
    // Pre-compute relationships for efficient hover
    preComputeRelationships(safeEdges);
    console.log("Relationship maps built successfully");
    
    const turnsArray = Object.values(safeData).sort((a, b) => a.speaker_turn - b.speaker_turn);
    // console.log(`Rendering ${turnsArray.length} turns and ${safeEdges.length} edges`);
    
    // Create a map of unique speaker names
    const speakers = Array.from(new Set(turnsArray.map(d => d.speaker_name)));
    
    // Compute in-degree for each turn for opacity scaling
    const initialInDegreeMap: Record<number, number> = {};
    safeEdges.forEach(edge => {
      const targetTurn = edge.target.speaker_turn;
      initialInDegreeMap[targetTurn] = (initialInDegreeMap[targetTurn] || 0) + 1;
    });
    
    // Create opacity scale based on in-degree values
    const opacityScale = d3.scaleLinear()
      .domain([0, Math.max(...Object.values(initialInDegreeMap)) || 1]) // Ensure non-zero domain
      .range([0.1, 1]);
    
    // Create score scale for stroke width
    const scoreScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0.5, 1.5]); // Reduced max stroke width from [1, 3] to [0.5, 1.5]
    
    // Find min and max time for the x-axis
    const minTime = d3.min(turnsArray, d => d.start_time || 0) || 0;
    const maxTime = d3.max(turnsArray, d => d.end_time || d.start_time || 0) || 1;
    
    // Add a buffer to max time for better visualization
    const timeBuffer = (maxTime - minTime) * 0.1;
    
    // Calculate available width for visualization
    const availableWidth = Math.max(width - margin.right, 100); // Ensure minimum width
    
    // Create x scale based on time
    const xScale = d3.scaleLinear()
      .domain([minTime, maxTime + timeBuffer]) // Use time range with buffer
      .range([0, availableWidth * 2]); // Make visualization twice as wide for scrolling
    
    // Store the total content width for scrolling
    const calculatedWidth = availableWidth * 2 + margin.right;
    setTotalContentWidth(calculatedWidth);
    
    // Create a consistent yScale for all elements to use
    const yScale = d3.scalePoint<string>()
      .domain(speakers)
      .range([0, adjustedHeight - margin.top - margin.bottom])
      .padding(0.3);
    
    // Update SVG width immediately to avoid rendering issues
    svgElement.attr("width", calculatedWidth);
    
    // Add x-axis (stays within scrollable area) with time labels
    const conversationG = svgElement.append('g');
    conversationG.append("g")
      .attr("transform", `translate(0,${adjustedHeight - margin.bottom})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(10)
          .tickFormat(d => formatTime(d as number))
      )
      .selectAll("text")
      .style("font-size", "8px")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");
    
    // Add x-axis label
    conversationG.append("text")
      .attr("class", "x-axis-label")
      .attr("text-anchor", "middle")
      .attr("x", availableWidth)
      .attr("y", adjustedHeight - 2)
      .style("font-size", "8px")
      .text("Time (minutes:seconds)");
    
    // Create defs for arrow marker with a unique ID to avoid conflicts
    const markerId = `arrow-${Date.now()}`;
    const defs = svgElement.append("defs");
    defs.append("marker")
      .attr("id", markerId)
      .attr("viewBox", [0, 0, 10, 10])
      .attr("refX", 5)
      .attr("refY", 5)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 Z")
      .attr("fill", "black");
    
    // Create paths first to ensure they're behind the nodes
    const createdPaths = conversationG.selectAll<SVGPathElement, Edge>(".link")
      .data(safeEdges)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d => curvedPath(d.source, d.target, xScale, yScale))
      .attr("stroke", d => d.type === "responsive_substantive" ? "red" : "#999999")
      .attr("stroke-dasharray", d => d.type === "responsive_substantive" ? "none" : "2,3")
      .attr("stroke-opacity", 1)
      .attr("stroke-width", d => scoreScale(d.score))
      .attr("fill", "none")
      .attr("shape-rendering", "geometricPrecision")
      .attr("marker-end", `url(#${markerId})`)
      .style("opacity", 0.8); // Apply opacity directly on creation
    
    // Create nodes with improved hover behavior that persists
    const createdNodes = conversationG.selectAll<SVGRectElement, ConversationTurn>(".turn")
      .data(turnsArray)
      .enter()
      .append("rect")
      .attr("class", "turn")
      .attr("data-turn", d => d.speaker_turn)
      .attr("x", d => xScale(d.start_time || 0))
      .attr("y", d => yScale(d.speaker_name) as number - 2)
      .attr("width", d => {
        const duration = (d.end_time || d.start_time || 0) - (d.start_time || 0);
        return Math.max(xScale(minTime + duration) - xScale(minTime), 5);
      })
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("height", d => {
        const baseHeight = d.arousal ? 
          d3.scaleLinear().domain([-1, 1]).range([2, 12])(d.arousal) :
          3;
        return baseHeight;
      })
      .attr("stroke", "black")
      .attr("stroke-width", 0.2)
      .attr("fill", "black")
      .attr("fill-opacity", d => opacityScale(initialInDegreeMap[d.speaker_turn] || 0))
      .attr("shape-rendering", "crispEdges")
      .style("opacity", 1)
      .style("cursor", "pointer")
      .style("pointer-events", "all"); // Ensure this element captures all pointer events

    // Directly attach mouseenter/mouseleave with no debounce
    createdNodes.on("mouseenter", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      
      // Cancel any pending unhighlight
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      // Mark as hovering
      isHoveringRef.current = true;
      
      // Store the hovered turn
      lastHoveredTurnRef.current = d.speaker_turn;
      hoveredElementIdRef.current = d.speaker_turn;
      
      console.log(`ENTER turn ${d.speaker_turn} - setting hover`);
      
      // Call handleTurnHover without causing scroll
      handleTurnHover(d);
    });
    
    createdNodes.on("mouseleave", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      
      // Mark as not hovering this element
      isHoveringRef.current = false;
      
      console.log(`LEAVE turn ${d.speaker_turn} - clearing hover`);
      
      // Only clear if we're leaving the currently hovered element
      if (hoveredElementIdRef.current === d.speaker_turn) {
        hoveredElementIdRef.current = null;
        handleTurnHover(null);
      }
    });
    
    createdNodes.on("click", function(event, d) {
      event.stopPropagation();
      event.preventDefault();
      
      console.log(`CLICK turn ${d.speaker_turn}`);
      
      // Clear any pending timeout
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      // Handle the click
      lastHoveredTurnRef.current = d.speaker_turn;
      hoveredElementIdRef.current = d.speaker_turn;
      handleTurnHover(d);
    });

    // Handle SVG background clicks to clear hover
    svgElement.on("click", function(event) {
      // Only handle if target is the SVG background
      if (event.target === svgElement.node()) {
        console.log("Background click - clearing hover");
        
        // Clear hover state
        hoveredElementIdRef.current = null;
        isHoveringRef.current = false;
        lastHoveredTurnRef.current = null;
        
        handleTurnHover(null);
      }
    });

    // Store selections for later use
    setPaths(createdPaths as any);
    setNodes(createdNodes as any);
    
    console.log("Visualization rendered successfully");
  };
  
  // Render the fixed SVG when component mounts or data changes
  useEffect(() => {
    renderFixedVisualization();
    
    // Clean up on unmount or data change
    return () => {
      if (fixedSvgRef.current) {
        d3.select(fixedSvgRef.current).selectAll('*').remove();
      }
    };
  }, [data, hiddenSpeakers]); // Add hiddenSpeakers to dependencies

  // Render the scrollable SVG after the fixed SVG is initialized
  useEffect(() => {
    if (fixedSvgInitialized) {
      renderScrollableVisualization();
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (scrollableSvgRef.current) {
        // Don't clean up on every render, only when necessary
        // This prevents flickering when other state changes
      }
    };
  }, [fixedSvgInitialized, data, edges, width, height, hiddenSpeakers]); // Add hiddenSpeakers to dependencies
  
  // Simplified effect for highlighted state management
  useEffect(() => {
    if (highlightedSpeaker !== null && nodes && paths) {
      if (hiddenSpeakers.has(highlightedSpeaker)) {
        // If the highlighted speaker is now hidden, clear the highlight
        highlightBySpeaker(null);
      } else {
        highlightBySpeaker(highlightedSpeaker);
      }
    }
  }, [highlightedSpeaker, nodes, paths, hiddenSpeakers]);
  
  // Add an effect to handle when a speaker is hidden/shown
  useEffect(() => {
    // If we have a hovered turn and its speaker got hidden, clear the hover state
    if (hoveredTurn && hiddenSpeakers.has(hoveredTurn.speaker_name)) {
      setHoveredTurn(null);
      onTurnHover(null);
      highlightConnectedElements(null);
    }
    
    // Rerender the visualization when hidden speakers change
    if (fixedSvgInitialized) {
      renderScrollableVisualization();
    }
  }, [hiddenSpeakers, onTurnHover, hoveredTurn, fixedSvgInitialized]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts to prevent memory leaks
      clearHoverTimeout();
      
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      // Remove all event listeners to prevent memory leaks
      if (scrollableSvgRef.current) {
        d3.select(scrollableSvgRef.current).on(".clearSelection", null);
        d3.select(scrollableSvgRef.current).on("click", null);
      }
      
      // Clean up all SVG elements
      if (fixedSvgRef.current) {
        d3.select(fixedSvgRef.current).selectAll('*').remove();
      }
      
      if (scrollableSvgRef.current) {
        d3.select(scrollableSvgRef.current).selectAll('*').remove();
      }
    };
  }, []);
  
  // Return a container with fixed and scrollable parts
  return (
    <div style={{ position: 'relative', width: `${width}px`, height: `${adjustedHeight + 40}px` }}>
      {/* Controls to hide/show speakers */}
      <div style={{ 
        position: 'absolute', 
        left: 0, 
        top: `${adjustedHeight + 5}px`, 
        width: '100%',
        display: 'flex',
        gap: '10px',
        padding: '5px'
      }}>
        <button 
          onClick={hideFacilitator} 
          style={{ 
            fontSize: '10px', 
            padding: '2px 5px', 
            background: '#f0f0f0', 
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer',
            color: facilitatorRef.current && hiddenSpeakers.has(facilitatorRef.current) ? '#ff0000' : 'inherit'
          }}
          title={facilitatorRef.current ? `Facilitator: ${facilitatorRef.current}` : 'No facilitator detected'}
          disabled={!facilitatorRef.current}
        >
          {facilitatorRef.current && hiddenSpeakers.has(facilitatorRef.current) ? 'Show Facilitator' : 'Hide Facilitator'}
        </button>
        <button 
          onClick={showAllSpeakers} 
          style={{ 
            fontSize: '10px', 
            padding: '2px 5px', 
            background: '#f0f0f0', 
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          disabled={hiddenSpeakers.size === 0}
        >
          Show All Speakers
        </button>
        <span style={{ fontSize: '10px', marginLeft: 'auto', color: '#666' }}>
          {hiddenSpeakers.size > 0 ? `${hiddenSpeakers.size} speaker${hiddenSpeakers.size !== 1 ? 's' : ''} hidden` : 'All speakers visible'}
        </span>
      </div>
      
      {/* Fixed container for the y-axis */}
      <div style={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        height: `${adjustedHeight}px`,
        zIndex: 2, 
        backgroundColor: 'white' // Ensure fixed part covers scrollable content when needed
      }}>
        <svg 
          ref={fixedSvgRef} 
          width={margin.left} 
          height={adjustedHeight}
        ></svg>
      </div>
      
      {/* Scrollable container for the main visualization */}
      <div
        ref={scrollContainerRef}
        style={{ 
          position: 'absolute', 
          left: `${margin.left}px`, 
          top: 0, 
          width: `${width - margin.left}px`, 
          height: `${adjustedHeight}px`,
          overflowX: 'auto',
          overflowY: 'hidden'
        }}
      >
        <svg 
          ref={scrollableSvgRef}
          width={totalContentWidth || width * 2} 
          height={adjustedHeight}
          preserveAspectRatio="xMinYMin meet"
        ></svg>
      </div>
    </div>
  );
};

export default ConversationStrip; 

// Helper function for score scaling (used in multiple places)
const scoreScale = (score: number) => {
  const scale = d3.scaleLinear().domain([0, 1]).range([0.5, 1.5]); // Reduced max stroke width from [1, 3] to [0.5, 1.5]
  return scale(score);
}; 