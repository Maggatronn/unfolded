import React, { useState } from 'react';
import { useD3 } from '../hooks/useD3';
import * as d3 from 'd3';
import { ConversationTurn, Edge } from '../types/conversationTypes';

interface ParticipantNodesProps {
  data: Record<string, ConversationTurn>;
  edges: Edge[];
  onNodeHover: (speaker: string | null) => void;
  width: number;
  height: number;
}

const ParticipantNodes: React.FC<ParticipantNodesProps> = ({ 
  data, 
  edges,
  onNodeHover,
  width, 
  height
}) => {
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  
  const adjustedHeight = height * 0.8; // Reduce height by 20%
  
  const ref = useD3((svg) => {
    // Clear previous content
    svg.selectAll("*").remove();
    
    // Create a group for the visualization elements
    const visualizationGroup = svg.append("g");
    
    // Calculate square size as 80% of adjusted height
    const squareSize = adjustedHeight * 0.8;
    
    // Add bright red square box at the start
    visualizationGroup.append("rect")
      .attr("x", 10)  // Add some padding from the left
      .attr("y", adjustedHeight/2 - squareSize/2)  // Center vertically
      .attr("width", squareSize)  // Square size
      .attr("height", squareSize)  // Square size
      .attr("fill", "white")
      .attr("stroke", "#FF0000")
      .attr("stroke-width", 2);
    
    // Get the first node (facilitator)
    const firstNode = Object.values(data)[0].speaker_name;
    
    // Add participant nodes inside the square
    const speakers = Array.from(new Set(Object.values(data).map(d => d.speaker_name)));
    
    // Calculate positions for nodes in a circular arrangement
    const centerX = 10 + squareSize/2;  // Center of the square
    const centerY = adjustedHeight/2;  // Center of the square
    const radius = squareSize/3;  // Radius for the circle of nodes
    
    // Calculate total words per speaker for node sizing
    const speakerWordCounts: { [key: string]: number } = {};
    Object.values(data).forEach(d => {
      if (!speakerWordCounts[d.speaker_name]) {
        speakerWordCounts[d.speaker_name] = 0;
      }
      speakerWordCounts[d.speaker_name] += d.words.length;
    });
    
    // Create scale for node sizes
    const minRadius = 5;
    const maxRadius = 15;
    const nodeSizeScale = d3.scaleLinear()
      .domain([0, Math.max(...Object.values(speakerWordCounts))])
      .range([minRadius, maxRadius]);
    
    // Create a map of speaker positions
    const speakerPositions: { [key: string]: { x: number, y: number } } = {};
    
    // Add participant nodes
    speakers.forEach((speaker, i) => {
      const angle = (i / speakers.length) * 2 * Math.PI;  // Evenly space around circle
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      speakerPositions[speaker] = { x, y };
      
      visualizationGroup.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", nodeSizeScale(speakerWordCounts[speaker]))
        .attr("fill", speaker === firstNode ? "#0066cc" : "white")
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .attr("class", "participant-node")
        .style("cursor", "pointer")
        .on("mouseover", () => onNodeHover(speaker))
        .on("mouseout", () => onNodeHover(null))
        .append("title")
        .text(`${speaker}\n${speakerWordCounts[speaker]} words`);
    });
    
    // Track speaker interactions to avoid duplicate edges
    const speakerInteractions = new Set();
    
    edges.forEach(edge => {
      const sourceSpeaker = edge.source.speaker_name;
      const targetSpeaker = edge.target.speaker_name;
      const interactionKey = `${sourceSpeaker}-${targetSpeaker}`;
      
      if (!speakerInteractions.has(interactionKey)) {
        speakerInteractions.add(interactionKey);
        
        const sourcePos = speakerPositions[sourceSpeaker];
        const targetPos = speakerPositions[targetSpeaker];
        
        if (sourcePos && targetPos) {
          visualizationGroup.append("line")
            .attr("x1", sourcePos.x)
            .attr("y1", sourcePos.y)
            .attr("x2", targetPos.x)
            .attr("y2", targetPos.y)
            .attr("stroke", edge.type === "responsive_substantive" ? "#FF0000" : "#999999")
            .attr("stroke-width", edge.score * 2)
            .attr("stroke-opacity", 0.6)
            .attr("stroke-dasharray", edge.type === "responsive_substantive" ? "none" : "2,2");
        }
      }
    });
    
    // Calculate metrics
    const numTurns = Object.keys(data).length;
    const numSpeakers = speakers.length;
    const facilitatorTurns = Object.values(data).filter(d => d.speaker_name === firstNode).length;
    const facilitatorPercentage = (facilitatorTurns / numTurns * 100).toFixed(1);
    
    // Calculate Gini coefficient for speaking time
    const speakingTimes = speakers.map(speaker => {
      return Object.values(data)
        .filter(d => d.speaker_name === speaker)
        .reduce((sum, d) => sum + d.words.length, 0);
    }).sort((a, b) => a - b);
    
    const n = speakingTimes.length;
    const mean = speakingTimes.reduce((a, b) => a + b) / n;
    const gini = speakingTimes.reduce((sum, _, i) => 
      sum + (2 * i - n + 1) * speakingTimes[i], 0) / (n * n * mean);
    
    // Define metric definitions
    const metricDefinitions = {
      "Turns": "Total number of speaking turns in the conversation.",
      "Speakers": "Number of unique participants in the conversation.",
      "Faciliator": "Percentage of total conversation turns taken by the facilitator.",
      "Gini": "Measure of inequality in speaking time distribution (0 = equal, 1 = unequal)."
    };
    
    // Add metrics text
    const metricsGroup = visualizationGroup.append("g")
      .attr("transform", `translate(${squareSize + 20}, ${adjustedHeight/2 - squareSize/3})`);
    
    // Add table header
    metricsGroup.append("text")
      .attr("y", -20)
      .attr("x", 40)
      .attr("fill", "#333")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text("Metrics");

    // Add table column headers
    metricsGroup.append("text")
      .attr("y", 0)
      .attr("x", 0)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Metric");

    metricsGroup.append("text")
      .attr("y", 0)
      .attr("x", 80)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Value");

    // Add separator line
    metricsGroup.append("line")
      .attr("x1", 0)
      .attr("y1", 5)
      .attr("x2", 120)
      .attr("y2", 5)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);
    
    // Turns row
    const turnsRow = metricsGroup.append("g")
      .style("cursor", "help")
      .on("mouseover", function() {
        // Show tooltip on hover
        visualizationGroup.append("text")
          .attr("class", "metric-tooltip")
          .attr("x", squareSize + 20)
          .attr("y", adjustedHeight/2 - squareSize/3 + 120)
          .attr("fill", "#333")
          .style("font-size", "12px")
          .style("font-style", "italic")
          .text(metricDefinitions["Turns"]);
      })
      .on("mouseout", function() {
        // Remove tooltip when not hovering
        visualizationGroup.selectAll(".metric-tooltip").remove();
      });
    
    turnsRow.append("text")
      .attr("y", 20)
      .attr("x", 0)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Turns");
    
    turnsRow.append("text")
      .attr("y", 20)
      .attr("x", 80)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text(`${numTurns}`);
    
    // Speakers row
    const speakersRow = metricsGroup.append("g")
      .style("cursor", "help")
      .on("mouseover", function() {
        visualizationGroup.append("text")
          .attr("class", "metric-tooltip")
          .attr("x", squareSize + 20)
          .attr("y", adjustedHeight/2 - squareSize/3 + 120)
          .attr("fill", "#333")
          .style("font-size", "12px")
          .style("font-style", "italic")
          .text(metricDefinitions["Speakers"]);
      })
      .on("mouseout", function() {
        visualizationGroup.selectAll(".metric-tooltip").remove();
      });
    
    speakersRow.append("text")
      .attr("y", 40)
      .attr("x", 0)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Speakers");
    
    speakersRow.append("text")
      .attr("y", 40)
      .attr("x", 80)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text(`${numSpeakers}`);
    
    // Facilitator row
    const facilitatorRow = metricsGroup.append("g")
      .style("cursor", "help")
      .on("mouseover", function() {
        visualizationGroup.append("text")
          .attr("class", "metric-tooltip")
          .attr("x", squareSize + 20)
          .attr("y", adjustedHeight/2 - squareSize/3 + 120)
          .attr("fill", "#333")
          .style("font-size", "12px")
          .style("font-style", "italic")
          .text(metricDefinitions["Faciliator"]);
      })
      .on("mouseout", function() {
        visualizationGroup.selectAll(".metric-tooltip").remove();
      });
    
    facilitatorRow.append("text")
      .attr("y", 60)
      .attr("x", 0)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Faciliator");
    
    facilitatorRow.append("text")
      .attr("y", 60)
      .attr("x", 80)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text(`${facilitatorPercentage}%`);
    
    // Gini row
    const giniRow = metricsGroup.append("g")
      .style("cursor", "help")
      .on("mouseover", function() {
        visualizationGroup.append("text")
          .attr("class", "metric-tooltip")
          .attr("x", squareSize + 20)
          .attr("y", adjustedHeight/2 - squareSize/3 + 120)
          .attr("fill", "#333")
          .style("font-size", "12px")
          .style("font-style", "italic")
          .text(metricDefinitions["Gini"]);
      })
      .on("mouseout", function() {
        visualizationGroup.selectAll(".metric-tooltip").remove();
      });
    
    giniRow.append("text")
      .attr("y", 80)
      .attr("x", 0)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Gini");
    
    giniRow.append("text")
      .attr("y", 80)
      .attr("x", 80)
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text(`${gini.toFixed(3)}`);
  }, [data, edges, width, height, adjustedHeight, onNodeHover, selectedSpeaker]);
  
  return <svg ref={ref} width={width} height={adjustedHeight}></svg>;
};

export default ParticipantNodes; 