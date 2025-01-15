// d3.json('merged_data.json').then(function (conversations) {
d3.json('5459.json').then(function (conversations) {
  // Define margins first
  const margin = {top: 20, right: 30, bottom: 30, left: 100};
  
  // Select the SVG element
  const svg = d3.select("#conversation-viz");
  const zoomG = svg.append('g');
  const mainG = zoomG.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Add zoom buttons to the control panel
  const zoomButtonContainer = d3.select("#button-container")
    .append("div")
    .style("margin-left", "20px")
    .style("display", "inline-block");

  let hideFirstSpeaker = false;
  
    // Track current scale
  let currentScale = 1;
  const scaleStep = 0.5;  // Amount to change scale by each click
  const minScale = 0.3;   // Minimum scale allowed
  const maxScale = 1.5;    // Maximum scale allowed

  // Add minus button
  zoomButtonContainer.append("button")
    .attr("id", "zoom-out")
    .style("margin-right", "5px")
    .text("−")
    .on("click", function() {
      currentScale = Math.max(minScale, currentScale - scaleStep);
      mainG.transition()
        .duration(750)
        .attr("transform", `translate(${margin.left},${margin.top}) scale(${currentScale})`)
        .on("end", () => {
          if (currentScale <= 0.5) {
            // Scroll to top-left corner when zoomed out significantly
            document.querySelector("#conversation-viz").parentNode.scrollTo(0, 0);
          }
        });
    });

  // Add plus button
  zoomButtonContainer.append("button")
    .attr("id", "zoom-in")
    .text("+")
    .on("click", function() {
      currentScale = Math.min(maxScale, currentScale + scaleStep);
      mainG.transition()
        .duration(750)
        .attr("transform", `translate(${margin.left},${margin.top}) scale(${currentScale})`);
    });

  // Add some basic styling to the buttons
  zoomButtonContainer.selectAll("button")
    .style("width", "30px")
    .style("height", "30px")
    .style("font-size", "20px")
    .style("cursor", "pointer")
    .style("border-radius", "4px")
    .style("border", "1px solid #ccc")
    .style("background", "white");

  // Initialize arrays for tracking nodes and links
  let firstNodesAndLinks = [];
  let nonFirstNodesAndLinks = [];

  // Add conversation options to dropdown
  const conversationSelector = d3.select("#conversation-selector");

  // Add "All Conversations" option first
  conversationSelector
    .append("option")
    .attr("value", "all")
    .text("All Conversations");

  // Add individual conversation options
  Object.keys(conversations).sort().forEach(convoId => {
    conversationSelector
      .append("option")
      .attr("value", convoId)
      .text(`Conversation ${convoId}`);
  });

  // Function to update visualization based on selected conversation
  function updateVisualization(selectedConvo) {
    // Clear existing visualization
    mainG.selectAll("g").remove();
    d3.selectAll(".tooltip").remove();

    // Filter conversations if needed
    let convoData;
    if (selectedConvo === 'all') {
      convoData = conversations;
    } else if (typeof selectedConvo === 'string') {
      convoData = { [selectedConvo]: conversations[selectedConvo] };
    } else {
      // Handle case where selectedConvo is already a filtered object
      convoData = selectedConvo;
    }

    // Update SVG height based on filtered data
    const conversationCount = Object.keys(convoData).length;
    const perConversationHeight = 300; // Restore original height per conversation
    const totalHeight = perConversationHeight * conversationCount;
    svg.attr("height", totalHeight);

    // Reset arrays for first nodes and links
    firstNodesAndLinks.length = 0;
    nonFirstNodesAndLinks.length = 0;

    // Your existing visualization code here, but using convoData instead of conversations
    Object.keys(convoData).forEach((conversationKey, index) => {
      const data = convoData[conversationKey];
      let selectedNode = null; // Track the selected node

      const width = svg.attr("width") - margin.left - margin.right;
      const height = perConversationHeight - margin.top - margin.bottom;
      
      // Create a group for each conversation's visualization
      const conversationG = mainG.append("g")
        .attr("transform", `translate(0,${index * perConversationHeight})`);

      // const speakers = Array.from(new Set(Object.values(data.conversation).map(d => d.speaker_name)));
      // const timeExtent = d3.extent(Object.values(data.conversation), d => d.speaker_turn);
      const speakers = Array.from(new Set(Object.values(data).map(d => d.speaker_name)));
      const timeExtent = d3.extent(Object.values(data), d => d.speaker_turn);

      const yScale = d3.scalePoint().domain(speakers).range([0, height]).padding(0.5);
      const xScale = d3.scaleLinear().domain(timeExtent).range([0, Object.keys(data).length]);
      const scoreScale = d3.scaleLinear().domain([0, 1]).range([0, 10]);

      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3.axisLeft(yScale)
        .tickSize(0);  // Optional: removes tick marks

      const buffer = 20;
      // Compute cumulative word count for each data point
      let cumulativeWordCount = 0;
      // Object.values(data.conversation).forEach((d) => {
      Object.values(data).forEach((d) => {

        d.cumulativeWords = cumulativeWordCount;
        cumulativeWordCount += d.words.length * 2 + buffer;
      });
      
      const totalWords = cumulativeWordCount;
      xScale.domain([0, totalWords]).range([0, totalWords/20]); // Adjust xScale based on total words
      
      conversationG.append("g").attr("transform", `translate(0,${height})`).call(xAxis);
      conversationG.append("g")
        .call(yAxis)
        .style("font-size", "20px");  // Increase font size for speaker names

      // Marker for arrows
      svg.append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", [0, 0, 10, 10])
        .attr("refX", 5)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 Z")
        .attr("fill", "black");

      // const edges = Object.values(data.conversation)
      const edges = Object.values(data)
        .flatMap(d => {
          if (!d.link_turn_id || d.link_turn_id == ["NA"]) return [];
          const source = d;
          // console.log(d.segments)
          // console.log(d)
          if ( !Object.keys(d).includes("segments")) {
            d.segments = {}
          };
          return Object.keys(d.segments).map(segmentKey => {
            const linkId = d.segments[segmentKey];
            // const target = data.conversation[linkId.link_turn_id];
            const target = data[linkId.link_turn_id];
            const type = d.segments[segmentKey]["majority_label"];
            const seg_words = d.segments[segmentKey]["segment_words"];
            const score = d.segments[segmentKey]["score"];
            // const link_words = d.segments[segmentKey]["link_words"];
            if (target && source) {
              return { source: source, target: target, type: type, count: seg_words.length, score: score};
            }
            return null;
          });
        })
        .filter(edge => edge !== null);

      const inDegreeMap = {};

      edges.forEach(edge => {
        // if (edge.type == 'responsive_substantive'){
          if (inDegreeMap[edge.target.speaker_turn]) {
            inDegreeMap[edge.target.speaker_turn] += 1;
          } else {
            inDegreeMap[edge.target.speaker_turn] = 1;
          }
        // }
        
      });

      Object.values(data).forEach(d => {
      // Object.values(data.conversation).forEach(d => {
        if (!inDegreeMap[d.speaker_turn]) {
          inDegreeMap[d.speaker_turn] = 0;
        }
      });
      const paths = conversationG.selectAll(".link")
        .data(edges)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d => curvedPath(d.source, d.target, xScale, yScale))
        .attr("stroke", d => (d.type === "responsive_substantive" ? "red" : "black"))
        .attr("stroke-opacity", d => d.type == "responsive_substantive" ? 1 : 0.2)
        // .attr("stroke-width", d => d.count/100)
        .attr("stroke-width", d => scoreScale(d.score))
        .attr("fill", "none");
      
        const nodes = conversationG.selectAll(".turn")
          // .data(Object.values(data.conversation))
          .data(Object.values(data))
          .enter()
          .append("rect")
          .attr("class", "turn")
          .attr("data-turn", d => d.speaker_turn)
          .attr("x", d => xScale(d.cumulativeWords))
          .attr("y", d => yScale(d.speaker_name) - 5)
          .attr("width", d => d.words.length / buffer)
          .attr("height", 20)
          .attr("fill", 'black')
          .attr("fill-opacity", d => (inDegreeMap[d.speaker_turn] || 0) / 5)
          .on('click', (event, d) => handleClick(event, d))
          .on('mouseover', (event, d) => {
            if (!selectedNode) {
              handleMouseOver(event, d);
              highlightConnected(d);
            }
          })
          .on('mouseout', () => {
            if (!selectedNode) {
              handleMouseOut();
              resetHighlights();
            }
          });
      
      // Select the first node and its links for each conversation
      // const firstNode = Object.values(data.conversation)[0].speaker_name;
      const firstNode = Object.values(data)[0].speaker_name;
      const firstNodeLinks = edges.filter(e => e.source.speaker_name === firstNode);
      firstNodesAndLinks.push({ node: firstNode, links: firstNodeLinks, nodesGroup: nodes, pathsGroup: paths });

      // // Select the first node and its links for each conversation
      // const nonFirstNodeLinks = edges.filter(e => e.source.speaker_name != firstNode);
      // nonFirstNodesAndLinks.push({ node: firstNode, links: nonFirstNodeLinks, nodesGroup: nodes, pathsGroup: paths });

      

      // Event listener for the hide facilitator checkbox
      d3.select("#toggle-opacity").on("change", function () {
        hideFirstSpeaker = d3.select(this).property("checked");
        firstNodesAndLinks.forEach(({ node, links, nodesGroup, pathsGroup }) => {
          toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, hideFirstSpeaker);
        });
      });

      function toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, hide) {
        // Hide first speaker nodes
        nodesGroup.filter(d => d.speaker_name === node)
          .attr("fill-opacity", hide ? 0 : (d => (inDegreeMap[d.speaker_turn] || 0) / 5));

        // Hide edges connected to first speaker (both from and to)
        pathsGroup.filter(d => d.source.speaker_name === node || d.target.speaker_name === node)
          .attr("stroke-opacity", hide ? 0 : (d => d.type === "responsive_substantive" ? 1 : 0.2));
      }

      function curvedPath(source, target, xScale, yScale) {
        const x1 = xScale(source.cumulativeWords), y1 = yScale(source.speaker_name);
        const x2 = xScale(target.cumulativeWords), y2 = yScale(target.speaker_name);
        const midX = (x1 + x2) / 2;
        const curveOffset = 50;

        return `M ${x1},${y1} Q ${midX},${y1 - curveOffset} ${x2},${y2}`;
      }

      function handleMouseOver(event, node) {
        // Clear any existing tooltips before showing new ones
        d3.selectAll('.tooltip').remove();

        // Highlight the hovered node and all connected nodes
        highlightConnected(node);

        // Show tooltips for ALL nodes, not just connected ones
        // const allNodes = Object.values(data.conversation)
        const allNodes = Object.values(data)
          .sort((a, b) => a.speaker_turn - b.speaker_turn);
        
        allNodes.forEach((currentNode, index) => {
          showTooltip(node, currentNode, index);
        });

        // Find the tooltip corresponding to the hovered node
        const activeTooltip = d3.select(`.tooltip-${node.speaker_turn}`).node();
        if (activeTooltip) {
          // Scroll the tooltip into view with smooth behavior
          activeTooltip.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Update conversation info
        d3.select('.conversation-info')
          .text(` ${node.conversation_id}`);
      }

      function handleMouseOut() {
        if (!selectedNode) {
          resetHighlights();
          // Remove the line that clears tooltips
          // d3.selectAll('.tooltip').remove();

          // Clear conversation info
          // d3.select('.conversation-info')
          //   .text('');
        }
        console.log(hideFirstSpeaker)
      }

      function handleClick(event, d) {
        // If clicking the same node, deselect it
        if (selectedNode === d) {
          selectedNode = null;
          resetHighlights();
        } 
        // If clicking a different node
        else {
          // Check if the new selection is in a different conversation
          const currentConversation = d.conversation_id; // or however you track which conversation a node belongs to
          const previousConversation = selectedNode?.conversation_id;
          
          // If there was a previous selection in a different conversation, reset it
          if (selectedNode && currentConversation !== previousConversation) {
            resetHighlights();
          }
          
          // Select the new node
          selectedNode = d;
          highlightConnected(d, true);
        }
      }

      function highlightConnected(node, isSelected = false) {
        const connectedLinks = edges.filter(e => {
          if (hideFirstSpeaker) {
            // Skip links connected to first speaker
            // const firstSpeaker = Object.values(data.conversation)[0].speaker_name;
            const firstSpeaker = Object.values(data)[0].speaker_name;
            if (e.source.speaker_name === firstSpeaker || e.target.speaker_name === firstSpeaker) {
              return false;
            }
          }
          return e.source === node || e.target === node;
        });
        
        const connectedNodes = new Set(connectedLinks.flatMap(e => [e.source, e.target]));

        // Highlight nodes in visualization, respecting hideFirstSpeaker
        nodes.attr("fill", n => {
          // if (hideFirstSpeaker && n.speaker_name === Object.values(data.conversation)[0].speaker_name) {
          if (hideFirstSpeaker && n.speaker_name === Object.values(data)[0].speaker_name) {
            return 'none';
          }
          return connectedNodes.has(n) ? "red" : "#ccc";
        })
        .attr("stroke", n => (n === node ? "red" : "none"))
        .attr("stroke-width", n => (n === node ? 2 : 0));

        // Show connected paths and their colors
        paths.attr("stroke-opacity", e => {
          if (hideFirstSpeaker) {
            // const firstSpeaker = Object.values(data.conversation)[0].speaker_name;
            const firstSpeaker = Object.values(data)[0].speaker_name;
            if (e.source.speaker_name === firstSpeaker || e.target.speaker_name === firstSpeaker) {
              return 0;
            }
          }
          return connectedLinks.includes(e) ? 1 : 0;
        })
        .attr("stroke", d => (d.type === "responsive_substantive" ? "red" : "black"));

        // Update tooltip highlighting and expand connected tooltips if selected
        d3.selectAll('.tooltip')
          .each(function() {
            const tooltip = d3.select(this);
            const tooltipClass = tooltip.attr('class');
            const tooltipTurn = tooltipClass.match(/tooltip-(\d+)/)[1];
            
            const isConnected = connectedNodes.has(node) && 
              Array.from(connectedNodes).some(n => n.speaker_turn == tooltipTurn);
            const isActive = tooltipTurn == node.speaker_turn;

            // Set border style
            if (isActive) {
              tooltip.style('border', '3px solid red');
            } else {
              const connection = connectedLinks.find(e => 
                e.target.speaker_turn == tooltipTurn || 
                e.source.speaker_turn == tooltipTurn
              );
              
              if (connection) {
                const edgeColor = connection.type === "responsive_substantive" ? "red" : "black";
                tooltip.style('border', `2px solid ${edgeColor}`);
              } else {
                tooltip.style('border', '1px solid #ccc');
              }
            }

            // Set background
            tooltip.style('background', isActive ? '#ffebee' : 'white');

            // Expand/collapse tooltip if selected
            if (isSelected && (isActive || isConnected)) {
              // Expand this tooltip
              tooltip
                .classed('expanded', true)
                .style('height', 'auto');
              
              tooltip.select('.tooltip-content.collapsed').style('display', 'none');
              tooltip.select('.tooltip-content.expanded').style('display', null);
            } else if (isSelected) {
              // Collapse non-connected tooltips
              tooltip
                .classed('expanded', false)
                .style('height', '60px');
              
              tooltip.select('.tooltip-content.collapsed').style('display', null);
              tooltip.select('.tooltip-content.expanded').style('display', 'none');
            }
          });

        // Adjust positions of tooltips after expansion
        if (isSelected) {
          let currentTop = 0;
          const baseSpacing = 10;
          
          d3.selectAll('.tooltip')
            .each(function() {
              const tooltip = d3.select(this);
              tooltip.style('top', `${currentTop}px`);
              currentTop += this.offsetHeight + baseSpacing;
            });
        }
      }

      function resetHighlights() {

        
        nodes.attr("fill", 'black')
          .attr("fill-opacity", d => (inDegreeMap[d.speaker_turn] || 0) / 5)
          .attr("stroke", "none")
          .attr("stroke-width", 0);

        paths.attr("stroke", d => (d.type === "responsive_substantive" ? "red" : "black"))
          .attr("stroke-opacity", d => d.score / 3);
        
        // toggleFirstNodeOpacity(nodes, paths, nodesGroup, pathsGroup, hideFirstSpeaker);

        firstNodesAndLinks.forEach(({ node, links, nodesGroup, pathsGroup }) => {
          toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, hideFirstSpeaker);
        });

        // Reset tooltip backgrounds and borders
        d3.selectAll('.tooltip')
          .style('background', 'white')
          .style('border', '1px solid #ccc');

        // Collapse all expanded text boxes
        d3.selectAll('.tooltip')
          .classed('expanded', false)
          .style('height', '60px'); // Example height for collapsed state

        d3.selectAll('.tooltip-content.collapsed').style('display', null);
        d3.selectAll('.tooltip-content.expanded').style('display', 'none');

        // Reposition all tooltips with uniform spacing
        let currentTop = 0;
        const baseHeight = 70;  // Height of collapsed tooltip
        const baseSpacing = 10; // Space between tooltips
        
        d3.selectAll('.tooltip')
          .each(function() {
            const tooltip = d3.select(this);
            tooltip.style('top', `${currentTop}px`);
            currentTop += baseHeight + baseSpacing;
          });

      }

      function showTooltip(sourceNode, targetNode, index) {
        const baseHeight = 70;  // Height of collapsed tooltip
        const baseSpacing = 10; // Space between tooltips
        const fullText = targetNode.words;
        const shortText = fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');
        
        const tooltipContent = `
          <div class="tooltip-header">
            <strong>${firstNodesAndLinks.some(({node}) => node === targetNode.speaker_name) ? '<span style="color: #FF8C00">[Facilitator]</span> ' : ''}${targetNode.speaker_name}</strong> 
            <span class="turn-number">(Turn ${targetNode.speaker_turn})</span>
          </div>
          <div class="tooltip-content collapsed">
            ${shortText}
          </div>
          <div class="tooltip-content expanded" style="display: none">
            ${fullText}
          </div>`;

        const tooltip = d3.select('#tooltip-container')
          .append('div')
          .attr('class', `tooltip tooltip-${targetNode.speaker_turn}`)
          .style('background', 'white')
          .style('border', '1px solid #ccc')
          .style('border-radius', '4px')
          .style('padding', '8px')
          .style('margin', '0')
          .style('font-family', 'Monospace')
          .style('box-shadow', '2px 2px 6px rgba(0,0,0,0.1)')
          .style('cursor', 'pointer')
          .style('width', '450px')
          .style('position', 'absolute')
          .style('left', '8px')
          .style('top', `${index * (baseHeight + baseSpacing)}px`)
          .style('transition', 'all 0.2s ease')
          .style('word-wrap', 'break-word')
          .on('mouseover', () => {
            
            if (!selectedNode) {
              // const correspondingNode = Object.values(data.conversation)
              const correspondingNode = Object.values(data)
                .find(d => d.speaker_turn === targetNode.speaker_turn);
              
                if (correspondingNode) {
                  highlightConnected(correspondingNode);
              }
            }
          })
          .on('mouseout', () => {
            if (!selectedNode) {
              resetHighlights();
            }
          })
          // .on('click', function() {
          //   console.log("click", data.conversation)
          //   const correspondingNode = Object.values(data.conversation)
          //     .find(d => d.speaker_turn === targetNode.speaker_turn);
            
          //   if (correspondingNode) {
          //     if (selectedNode === correspondingNode) {
          //       selectedNode = null;
          //       resetHighlights();
          //     } else {
          //       selectedNode = correspondingNode;
          //       highlightConnected(correspondingNode, true);
          //     }
          //   }
          // });

        tooltip.html(tooltipContent)
          .style('visibility', 'visible')
          .on('click', function() {
            // const correspondingNode = Object.values(data.conversation)
            const correspondingNode = Object.values(data)
              .find(d => d.speaker_turn === targetNode.speaker_turn && 
                        d.conversation_id === targetNode.conversation_id);
            
            if (correspondingNode) {
              // Find the specific node in the visualization that matches both turn and conversation
              const matchingNode = d3.selectAll('.turn')
                .filter(d => d.speaker_turn === targetNode.speaker_turn && 
                            d.conversation_id === targetNode.conversation_id)
                .node();

              if (matchingNode) {
                matchingNode.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'center'
                });
              }
              
              handleClick(event, targetNode);
            }
          });

        // Add some CSS styles to the document head
        if (!document.getElementById('tooltip-styles')) {
          const styleSheet = document.createElement('style');
          styleSheet.id = 'tooltip-styles';
          styleSheet.textContent = `
            .tooltip {
              transition: all 0.2s ease;
              height: ${baseHeight}px;
              box-sizing: border-box;
            }
            .tooltip.expanded {
              height: auto;
            }
            .tooltip:hover {
              border-color: #666;
            }
            .tooltip-header {
              border-bottom: 1px solid #eee;
              padding-bottom: 4px;
              margin-bottom: 4px;
            }
            .turn-number {
              color: #666;
              font-size: 0.9em;
            }
            .tooltip.expanded {
              background: #f8f8f8;
              border-color: #666;
            }
            .tooltip-content {
              font-size: 0.9em;
              line-height: 1.4;
            }
            rect.turn.highlighted {
              stroke: red;
              stroke-width: 2px;
            }
          `;
          document.head.appendChild(styleSheet);
        }
      }

      // Add this variable at the top level to track currently faded speakers
      let fadedSpeakers = new Set();

      // Create and style the y-axis with clickable labels
      const yAxisGroup = conversationG.append("g")
        .call(yAxis)
        .style("font-size", "20px");  // Increase font size for speaker names

      // Make the speaker names clickable
      yAxisGroup.selectAll(".tick text")
        .style("cursor", "pointer")  // Change cursor to pointer on hover
        .on("click", function(event, speakerName) {
          // Toggle speaker in fadedSpeakers set
          if (fadedSpeakers.has(speakerName)) {
            fadedSpeakers.delete(speakerName);
          } else {
            fadedSpeakers.add(speakerName);
          }

          // Update opacity for nodes
          nodes
            .style("opacity", d => 
              fadedSpeakers.has(d.speaker_name) ? 0.2 : 1
            );

          // Update opacity for paths/links
          paths
            .style("opacity", d => 
              fadedSpeakers.has(d.source.speaker_name) || 
              fadedSpeakers.has(d.target.speaker_name) 
                ? 0.1 
                : (d.type === "responsive_substantive" ? 1 : 0.2)
            );

          // Update the speaker name opacity
          d3.select(this)
            .style("opacity", fadedSpeakers.has(speakerName) ? 0.2 : 1);
        })
        .on("mouseover", function() {
          d3.select(this)
            .style("text-decoration", "underline");
        })
        .on("mouseout", function() {
          d3.select(this)
            .style("text-decoration", "none");
        });
    });
  }

  // Add event listener for dropdown
  conversationSelector.on("change", function() {
    const selectedConvo = this.value;
    updateVisualization(selectedConvo);
  });

  // Initial visualization with all conversations
  updateVisualization('all');

  // Add this function to dynamically set the container height
  function updateContainerHeight() {
    const windowHeight = window.innerHeight;
    const controlPanelHeight = document.getElementById('control-panel').offsetHeight;
    const padding = 20; // Space from bottom of viewport
    
    // Calculate available height (viewport height minus control panel and padding)
    const availableHeight = windowHeight - controlPanelHeight - padding - 20;
    
    d3.select('#tooltip-container')
      .style('position', 'fixed')
      .style('top', `${controlPanelHeight + 20}px`)
      .style('height', `${availableHeight}px`)  // Use full available height
      .style('min-height', `${availableHeight}px`); // Add min-height to prevent shrinking
  }
  // First, remove the static header from index.html
  // Then add this to the updateVisualization function, right before creating the text boxes:

  // Add legend to control panel after the existing elements
  const legend = d3.select("#control-panel")
    .append("div")
    .style("padding", "5px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px");

  // Add mechanical response legend item
  const mechanicalItem = legend.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "5px");

  mechanicalItem.append("div")
    .style("width", "20px")
    .style("height", "2px")
    .style("background", "black")
    .style("margin-right", "8px");

  mechanicalItem.append("span")
    .text("Mechanical Response");

  // Add substantive response legend item
  const substantiveItem = legend.append("div")
    .style("display", "flex")
    .style("align-items", "center");

  substantiveItem.append("div")
    .style("width", "20px")
    .style("height", "2px")
    .style("background", "red")
    .style("margin-right", "8px");

  substantiveItem.append("span")
    .text("Substantive Response");

  // Call it initially
  updateContainerHeight();

  // Add window resize listener
  window.addEventListener('resize', updateContainerHeight);

  // Update the tooltip container CSS
  d3.select('#tooltip-container')
    .style('position', 'fixed')
    .style('width', '500px')
    .style('scrollbar-width', 'none')
    .style('overflow-y', 'auto')
    .style('padding-right', '10px');  // Add some padding for the scrollbar

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 3])  // Limit zoom scale
    .on('zoom', (event) => {
      zoomG.attr('transform', event.transform);
    });

  // Enable zoom on SVG
  svg.call(zoom)
    .call(zoom.transform, d3.zoomIdentity);  // Start at identity transform

  // Disable zoom on double-click (prevents default d3 double-click zoom behavior)
  svg.on("dblclick.zoom", null);

  // Move facilitator filter section up - add this before tooltip container setup
  const filterContainer = d3.select("#control-panel")
    .append("div")
    .style("display", "inline-block")  // Make it display inline
    .style("margin-left", "20px")      // Add some spacing from zoom buttons
    .style("margin-bottom", "10px")    // Add some bottom margin for buffer
    .style("padding", "5px");          // Add padding for buffer

  // Create facilitator dropdown
  const facilitatorSelect = filterContainer
    .append("select")
    .attr("id", "facilitator-select")
    .style("width", "150px")           // Fixed width
    .style("margin-right", "5px")
    .style("padding", "5px");          // Match other controls' padding

  // Get unique facilitators (first speakers) from conversations
  const facilitators = Array.from(new Set(
    Object.values(conversations).map(conv => 
      Object.values(conv)[0].speaker_name
    )
  ));

  // Populate facilitator dropdown
  facilitatorSelect
    .selectAll("option")
    .data(["All Facilitators"].concat(facilitators))
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  // Add event listener to dropdown for automatic filtering
  facilitatorSelect.on("change", function() {
    const selectedFacilitator = this.value;
    if (selectedFacilitator === "All Facilitators") {
      updateVisualization("all");
    } else {
      // Filter conversations where first speaker matches selected facilitator
      const filteredConvos = {};
      Object.entries(conversations).forEach(([key, conv]) => {
        if (Object.values(conv)[0].speaker_name === selectedFacilitator) {
          filteredConvos[key] = conv;
        }
      });
      // Pass the filtered conversations object directly
      updateVisualization(filteredConvos);
    }
  });

  // Add frontline filter checkbox after the facilitator filter
  const frontlineContainer = d3.select("#control-panel")
    .append("div")
    .style("display", "inline-block")
    .style("margin-left", "20px")
    .style("margin-bottom", "10px")
    .style("padding", "5px");

  // Add checkbox and label
  frontlineContainer
    .append("input")
    .attr("type", "checkbox")
    .attr("id", "hide-frontline")
    .style("margin-right", "5px");

  frontlineContainer
    .append("label")
    .attr("for", "hide-frontline")
    .text("Hide Documentary");

  // Add event listener for the frontline checkbox
  d3.select("#hide-frontline").on("change", function() {
    const hideFrontline = d3.select(this).property("checked");
    if (hideFrontline) {
      // Create a filtered copy of conversations without frontline workers
      const filteredConvos = {};
      Object.entries(conversations).forEach(([key, conv]) => {
        // Filter out turns where speaker name includes "FRONTLINE"
        const filteredTurns = {};
        Object.entries(conv).forEach(([turnId, turn]) => {
          if (!turn.speaker_name || !turn.speaker_name.toUpperCase().includes("FRONTLINE")) {
            filteredTurns[turnId] = turn;
          }
        });
        // Only include conversation if it still has turns after filtering
        if (Object.keys(filteredTurns).length > 0) {
          filteredConvos[key] = filteredTurns;
        }
      });
      updateVisualization(filteredConvos);
    } else {
      // Show all participants
      updateVisualization("all");
    }
  });

  // Then continue with tooltip container setup...
  updateContainerHeight();

  // Update the SVG container div
  d3.select("#conversation-viz")
    .style("height", "100vh")  // Make container full viewport height
    .style("width", "100%")    // Make container full width
    .style("overflow", "auto"); // Add scrolling if needed
});
