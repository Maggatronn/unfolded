d3.json('merged_conversations_oregon.json').then(function (conversations) {
  // Define margins first
  const margin = {top: 0, right: 30, bottom: 30, left: 100};
  
  // Select the SVG element
  const svg = d3.select("#conversation-viz")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${window.innerWidth} 1000`);
  const zoomG = svg.append('g');
  const mainG = zoomG.append('g')
    .attr('transform', `translate(${margin.left},0)`);

  // Add window resize handler to update SVG viewBox
  window.addEventListener('resize', function() {
    svg.attr("viewBox", `0 0 ${window.innerWidth} 1000`);
  });

  // Update the SVG container div styling
  d3.select("#container")
    .style("width", "100%")
    .style("height", "100vh")
    .style("display", "flex");

  // Update the visualization container and ensure it starts at the top
  d3.select("#visualization-container")
    .style("flex-grow", "1")
    .style("height", "100vh")
    .style("width", "100%")
    .style("overflow", "auto")
    .style("padding-top", "0");  // Ensure no top padding

  // Update the tooltip container position
  d3.select('#tooltip-container')
    .style('position', 'fixed')
    .style('left', '10px')
    .style('width', '450px')  // Increased from 400px
    .style('overflow-y', 'auto')
    .style('padding-right', '20px');  // Added padding

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
  Object.entries(conversations).sort().forEach(([convoId, convoData]) => {
    // Find the title from the conversation data
    const title = Object.values(convoData).find(turn => turn.title)?.title || `Conversation ${convoId}`;
    
    conversationSelector
      .append("option")
      .attr("value", convoId)
      .text(title);
  });

  // Function to update visualization based on selected conversation
  function updateVisualization(selectedConvo) {
    // Clear existing visualization
    mainG.selectAll("g").remove();
    d3.selectAll(".tooltip").remove();

    // Debug logging
    console.log("Selected conversation:", selectedConvo);
    console.log("All conversations:", conversations);

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

    // Debug logging
    console.log("Filtered conversation data:", convoData);

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
      console.log("Processing conversation:", conversationKey);
      console.log("Conversation data:", data);
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

      // Define scales at the beginning, after defining other scales
      const xScale = d3.scaleLinear().domain(timeExtent).range([0, Object.keys(data).length]);
      const yScale = d3.scalePoint().domain(speakers).range([0, height]).padding(0.5);
      const scoreScale = d3.scaleLinear().domain([0, 1]).range([0, 10]);

      // Add valence and arousal scales here
      const valenceColorScale = d3.scaleLinear()
        .domain([-1, 1])  // Valence typically ranges from -1 to 1
        .range(["blue", "red"]);  // Blue for negative, red for positive

      const arousalHeightScale = d3.scaleLinear()
        .domain([-1, 1])  // Arousal ranges from -1 to 1
        .range([5, 50]);  // Min and max heights in pixels

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

      // Store the initial inDegreeMap values
      const initialInDegreeMap = {};

      // Initialize and calculate inDegree values once
      Object.values(data).forEach(d => {
        initialInDegreeMap[d.speaker_turn] = 0;
      });

      edges.forEach(edge => {
        if (edge.type === 'responsive_substantive') {
          if (initialInDegreeMap[edge.target.speaker_turn]) {
            initialInDegreeMap[edge.target.speaker_turn] += 1;
          } else {
            initialInDegreeMap[edge.target.speaker_turn] = 1;
          }
        }
      });

      // Create opacity scale
      const opacityScale = d3.scaleLinear()
        .domain([0, Math.max(...Object.values(initialInDegreeMap))])
        .range([0.1, 1]);

      // Create paths first
      const paths = conversationG.selectAll(".link")
        .data(edges)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d => curvedPath(d.source, d.target, xScale, yScale))
        .attr("stroke", "#999")
        .attr("stroke-dasharray", d => d.type === "responsive_substantive" ? "none" : "3,5")
        .attr("stroke-opacity", 1)  // Changed from 0.4 to 1
        .attr("stroke-width", d => scoreScale(d.score))
        .attr("fill", "none");

      // Then create nodes
      const nodes = conversationG.selectAll(".turn")
        .data(Object.values(data))
        .enter()
        .append("rect")
        .attr("class", "turn")
        .attr("data-turn", d => d.speaker_turn)
        .attr("x", d => xScale(d.cumulativeWords))
        .attr("y", d => yScale(d.speaker_name) - 5)
        .attr("width", d => d.words.length / buffer)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("height", d => d.arousal ? arousalHeightScale(d.arousal) : 10)
        .attr("stroke", 'black')
        .attr("stroke-width", 0.2)
        // .attr("fill", d => d.valence ? valenceColorScale(d.valence) : "white")
        .attr("fill", 'black')
        .attr("fill-opacity", d => opacityScale(initialInDegreeMap[d.speaker_turn]))
        // Add back the event handlers
        .on('click', (event, d) => handleClick(event, d))
        .on('mouseover', (event, d) => {
          if (!selectedNode) {
            handleMouseOver(event, d);
            highlightConnected(d);
          }
        })
        .on('mouseout', (event, d) => {
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
        // Remove node opacity changes
        pathsGroup.filter(d => d.source.speaker_name === node || d.target.speaker_name === node)
          .attr("stroke-opacity", hide ? 0 : 0.4);
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
        if (selectedNode === d) {
          selectedNode = null;
          resetHighlights(d);
        } else {
          const currentConversation = d.conversation_id;
          const previousConversation = selectedNode?.conversation_id;
          
          if (selectedNode && currentConversation !== previousConversation) {
            resetHighlights(selectedNode);
          }
          
          selectedNode = d;
          highlightConnected(d, true);
        }
      }

      function highlightConnected(node, isSelected = false) {
        const connectedLinks = edges.filter(e => {
          if (hideFirstSpeaker) {
            const firstSpeaker = Object.values(data)[0].speaker_name;
            if (e.source.speaker_name === firstSpeaker || e.target.speaker_name === firstSpeaker) {
              return false;
            }
          }
          return e.source === node || e.target === node;
        });

        // Only modify paths opacity
        paths.attr("stroke-opacity", e => {
          if (hideFirstSpeaker) {
            const firstSpeaker = Object.values(data)[0].speaker_name;
            if (e.source.speaker_name === firstSpeaker || e.target.speaker_name === firstSpeaker) {
              return 0;
            }
          }
          return connectedLinks.includes(e) ? 1 : 0.1;
        })
        .attr("stroke", d => (d.type === "responsive_substantive" ? "red" : "black"));

        // Get connected nodes for tooltip highlighting
        const connectedNodes = new Set(connectedLinks.flatMap(e => [e.source, e.target]));

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
              tooltip
                .classed('expanded', true)
                .style('height', 'auto');
              
              tooltip.select('.tooltip-content.collapsed').style('display', 'none');
              tooltip.select('.tooltip-content.expanded').style('display', null);
            } else if (isSelected) {
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
        // Don't modify node appearance
        paths.attr("stroke", "#999")
          .attr("stroke-dasharray", d => d.type === "responsive_substantive" ? "none" : "3,5")
          .attr("stroke-opacity", 1);  // Changed from 0.4 to 1

        // Rest of resetHighlights function for tooltips stays the same
      }

      function showTooltip(sourceNode, targetNode, index) {
        const baseHeight = 70;  // Height of collapsed tooltip
        const baseSpacing = 10; // Space between tooltips
        const fullText = targetNode.words;
        const shortText = fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');
        
        const tooltipContent = `
          <div class="tooltip-header">
            <strong>${firstNodesAndLinks.some(({node}) => node === targetNode.speaker_name) ? '<span style="color: #983AEF">[Facilitator]</span> ' : ''}${targetNode.speaker_name}</strong> 
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
          .style('width', '430px')  // Adjusted to account for padding
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
                : (1)  // Changed from 0.4 to 1
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

      // Modify the existing nodes creation code (don't create a new one)
      nodes
        .attr("height", d => d.arousal ? arousalHeightScale(d.arousal) : 10)  // Default height if no arousal data
        // .attr("fill", d => d.valence ? valenceColorScale(d.valence) : "white");  // Default color if no valence data
        .attr("fill","black");  // Default color if no valence data
        // Keep existing event handlers
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

  // Add substantive response legend item (solid line)
  const substantiveItem = legend.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "5px")
    .style("cursor", "pointer")
    .on("click", function() {
      showSubstantive = !showSubstantive;
      // Update opacity of substantive lines
      d3.selectAll(".link")
        .filter(d => d.type === "responsive_substantive")
        .style("visibility", showSubstantive ? "visible" : "hidden");
      // Update legend item opacity
      d3.select(this).style("opacity", showSubstantive ? 1 : 0.5);
    });

  // Create line container for substantive
  const substantiveLineContainer = substantiveItem.append("div")
    .style("width", "20px")
    .style("margin-right", "8px")
    .style("flex-shrink", "0");

  substantiveLineContainer.append("div")
    .style("height", "2px")
    .style("background", "black");

  substantiveItem.append("span")
    .text("Substantive Response");

  // Add mechanical response legend item (dotted line)
  const mechanicalItem = legend.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("cursor", "pointer")
    .on("click", function() {
      showMechanical = !showMechanical;
      // Update opacity of mechanical lines
      d3.selectAll(".link")
        .filter(d => d.type !== "responsive_substantive")
        .style("visibility", showMechanical ? "visible" : "hidden");
      // Update legend item opacity
      d3.select(this).style("opacity", showMechanical ? 1 : 0.5);
    });

  // Create line container for mechanical
  const mechanicalLineContainer = mechanicalItem.append("div")
    .style("width", "20px")
    .style("margin-right", "8px")
    .style("flex-shrink", "0");

  // Create a mini SVG for the dashed line
  mechanicalLineContainer.append("svg")
    .attr("width", "20")
    .attr("height", "2")
    .append("line")
    .attr("x1", "0")
    .attr("y1", "1")
    .attr("x2", "20")
    .attr("y2", "1")
    .attr("stroke", "black")
    .attr("stroke-width", "2")
    .attr("stroke-dasharray", "3,5");

  mechanicalItem.append("span")
    .text("Mechanical Response");

  // Call it initially
  updateContainerHeight();

  // Add window resize listener
  window.addEventListener('resize', updateContainerHeight);

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 3])  // Limit zoom scale
    .on('zoom', (event) => {
      zoomG.attr('transform', event.transform);
    });

  // Enable zoom on SVG
  svg.call(zoom)
    .call(zoom.transform, d3.zoomIdentity.translate(100, -100));  // Start translated 100px right and 100px up

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

  // Get unique facilitators from conversations
  const facilitators = Array.from(new Set(
    Object.values(conversations).map(conv => {
      // Find the turn that has facilitator field
      const facilitatorTurn = Object.values(conv).find(turn => turn.facilitator);
      return facilitatorTurn ? facilitatorTurn.facilitator : "Unknown";
    })
  ));

  // Populate facilitator dropdown
  facilitatorSelect
    .selectAll("option")
    .data(["All Facilitators"].concat(facilitators))
    .join("option")
    .attr("value", d => d)
    .text(d => d);

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

  // Add these variables at the top level to track filter states
  let currentFacilitator = "All Facilitators";
  let hideFrontline = false;

  // Create a function to apply both filters
  function applyFilters() {
    let filteredConvos = {...conversations};  // Start with all conversations

    // Apply facilitator filter if needed
    if (currentFacilitator !== "All Facilitators") {
      const facilitatorFiltered = {};
      Object.entries(filteredConvos).forEach(([key, conv]) => {
        // Find the turn that has facilitator field
        const facilitatorTurn = Object.values(conv).find(turn => turn.facilitator);
        if (facilitatorTurn && facilitatorTurn.facilitator === currentFacilitator) {
          facilitatorFiltered[key] = conv;
        }
      });
      filteredConvos = facilitatorFiltered;
    }

    // Apply frontline filter if needed
    if (hideFrontline) {
      const frontlineFiltered = {};
      Object.entries(filteredConvos).forEach(([key, conv]) => {
        const filteredTurns = {};
        Object.entries(conv).forEach(([turnId, turn]) => {
          if (!turn.speaker_name || !turn.speaker_name.toUpperCase().includes("FRONTLINE")) {
            filteredTurns[turnId] = turn;
          }
        });
        if (Object.keys(filteredTurns).length > 0) {
          frontlineFiltered[key] = filteredTurns;
        }
      });
      filteredConvos = frontlineFiltered;
    }

    updateVisualization(filteredConvos);
  }

  // Update the facilitator dropdown event listener
  facilitatorSelect.on("change", function() {
    currentFacilitator = this.value;
    applyFilters();
  });

  // Update the frontline checkbox event listener
  d3.select("#hide-frontline").on("change", function() {
    hideFrontline = d3.select(this).property("checked");
    applyFilters();
  });

  // Then continue with tooltip container setup...
  updateContainerHeight();

  // Update the SVG container div
  d3.select("#conversation-viz")
    .style("height", "100vh")  // Make container full viewport height
    .style("width", "100%")    // Make container full width
    .style("overflow", "auto"); // Add scrolling if needed
});
