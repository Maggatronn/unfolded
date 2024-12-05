d3.json('convo_dict copy.json').then(function (conversations) {
  // Define margins first
  const margin = {top: 20, right: 30, bottom: 30, left: 100};
  
  // Select the SVG element
  const svg = d3.select("#conversation-viz");
  const mainG = svg.append("g")
    .attr("class", "main-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // Add zoom buttons to the control panel
  const zoomButtonContainer = d3.select("#button-container")
    .append("div")
    .style("margin-left", "20px")
    .style("display", "inline-block");

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
    const convoData = selectedConvo === 'all' 
      ? conversations 
      : { [selectedConvo]: conversations[selectedConvo] };

    // Update SVG height based on filtered data
    const conversationCount = Object.keys(convoData).length;
    const perConversationHeight = 300;
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

      const speakers = Array.from(new Set(Object.values(data.conversation).map(d => d.speaker_name)));
      const timeExtent = d3.extent(Object.values(data.conversation), d => d.speaker_turn);

      const yScale = d3.scalePoint().domain(speakers).range([0, height]).padding(0.5);
      const xScale = d3.scaleLinear().domain(timeExtent).range([0, Object.keys(data).length]);
      const scoreScale = d3.scaleLinear().domain([0, 1]).range([0, 10]);

      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3.axisLeft(yScale)
        .tickSize(0);  // Optional: removes tick marks

      const buffer = 20;
      // Compute cumulative word count for each data point
      let cumulativeWordCount = 0;
      Object.values(data.conversation).forEach((d) => {

        d.cumulativeWords = cumulativeWordCount;
        cumulativeWordCount += d.words.length * 2 + buffer;
      });
      
      const totalWords = cumulativeWordCount;
      xScale.domain([0, totalWords]).range([0, totalWords/20]); // Adjust xScale based on total words
      
      conversationG.append("g").attr("transform", `translate(0,${height})`).call(xAxis);
      conversationG.append("g")
        .call(yAxis)
        .style("font-size", "20px")  // Increase font size for speaker names

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

      const edges = Object.values(data.conversation)
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
            const target = data.conversation[linkId.link_turn_id];
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

      Object.values(data.conversation).forEach(d => {
        if (!inDegreeMap[d.speaker_turn]) {
          inDegreeMap[d.speaker_turn] = 0;
        }
      });
    console.log(edges)
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
          .data(Object.values(data.conversation))
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
          })
          .on('click', (event, d) => handleClick(event, d));
      
      // Select the first node and its links for each conversation
      const firstNode = Object.values(data.conversation)[0].speaker_name;
      const firstNodeLinks = edges.filter(e => e.source.speaker_name === firstNode);
      firstNodesAndLinks.push({ node: firstNode, links: firstNodeLinks, nodesGroup: nodes, pathsGroup: paths });

      // // Select the first node and its links for each conversation
      // const nonFirstNodeLinks = edges.filter(e => e.source.speaker_name != firstNode);
      // nonFirstNodesAndLinks.push({ node: firstNode, links: nonFirstNodeLinks, nodesGroup: nodes, pathsGroup: paths });

      // Event listener for single checkbox
      d3.select("#toggle-opacity").on("change", function () {
        const isChecked = d3.select(this).property("checked");
        firstNodesAndLinks.forEach(({ node, links, nodesGroup, pathsGroup }) => {
          toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, isChecked);
        });
      });

      // // Event listener for single checkbox
      // d3.select("#toggle-opacity-non-fac").on("change", function () {
      //   const isChecked = d3.select(this).property("checked");
      //   firstNodesAndLinks.forEach(({ node, links, nodesGroup, pathsGroup }) => {
      //     toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, isChecked);
      //   });
      // });

      function toggleFirstNodeOpacity(node, links, nodesGroup, pathsGroup, hide) {
        // Hide facilitator nodes
        nodesGroup.filter(d => d.speaker_name === node)
          .attr("fill-opacity", hide ? 0 : (d => (inDegreeMap[d.speaker_turn] || 0) / 5));

        // Hide edges connected to facilitator (both from and to)
        pathsGroup.filter(d => d.source.speaker_name === node || d.target.speaker_name === node)
          .attr("stroke-opacity", hide ? 0 : (d => d.type === "responsive_substantive" ? 1 : 0.2));
      }

      // function toggleNonFirstNodeOpacity(node, links, nodesGroup, pathsGroup, hide) {
      //   nodesGroup.filter(d => d === node)
      //     .attr("fill-opacity", hide ? 0 : 1);

      //   pathsGroup.filter(d => links.includes(d))
          // .attr("stroke-opacity", hide ? 0 : 1);
      // }

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
        const allNodes = Object.values(data.conversation)
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
        const connectedLinks = edges.filter(e => e.source === node || e.target === node);
        const connectedNodes = new Set(connectedLinks.flatMap(e => [e.source, e.target]));

        // Highlight nodes in visualization
        nodes.attr("fill", n => (connectedNodes.has(n) ? "red" : "#ccc"))
            .attr("stroke", n => (n === node ? "red" : "none"))
            .attr("stroke-width", n => (n === node ? 2 : 0));

        // Show connected paths and their colors
        paths
          .attr("stroke-opacity", e => (connectedLinks.includes(e) ? 1 : 0))
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

        // Reset tooltip backgrounds and borders
        d3.selectAll('.tooltip')
          .style('background', 'white')
          .style('border', '1px solid #ccc');
      }

      function showTooltip(sourceNode, targetNode, index) {
        const baseHeight = 70;  // Height of collapsed tooltip
        const baseSpacing = 10; // Space between tooltips
        const fullText = targetNode.words;
        const shortText = fullText.slice(0, 50) + (fullText.length > 50 ? '...' : '');
        
        const tooltipContent = `
          <div class="tooltip-header">
            <strong>${targetNode.speaker_name}</strong> 
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
              const correspondingNode = Object.values(data.conversation)
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
          .on('click', function() {
            const correspondingNode = Object.values(data.conversation)
              .find(d => d.speaker_turn === targetNode.speaker_turn);
            if (correspondingNode) {
              if (selectedNode === correspondingNode) {
                selectedNode = null;
                resetHighlights();
              } else {
                selectedNode = correspondingNode;
                highlightConnected(correspondingNode, true);
              }
            }
          });

        tooltip.html(tooltipContent)
          .style('visibility', 'visible')
          .on('click', function() {
            const isExpanded = this.classList.contains('expanded');
            const thisTooltip = d3.select(this);
            
            // First, toggle the content visibility
            thisTooltip.select('.tooltip-content.collapsed')
              .style('display', isExpanded ? null : 'none');
            thisTooltip.select('.tooltip-content.expanded')
              .style('display', isExpanded ? 'none' : null);
            
            // Then toggle expanded class and adjust height
            thisTooltip
              .classed('expanded', !isExpanded)
              .style('height', !isExpanded ? 'auto' : `${baseHeight}px`);
            
            // Immediately get the new height after expansion
            const newHeight = this.offsetHeight;
            
            // Adjust subsequent tooltips in the same click
            d3.selectAll('.tooltip')
              .filter((d, i) => i > index)
              .each(function(d, i) {
                const subsequentIndex = index + i + 1;
                const newTop = !isExpanded
                  ? (index * (baseHeight + baseSpacing)) + newHeight + baseSpacing + (i * (baseHeight + baseSpacing))
                  : subsequentIndex * (baseHeight + baseSpacing);
                
                d3.select(this)
                  .style('top', `${newTop}px`);
              });

            // Highlight and scroll to corresponding node in visualization
            const correspondingNode = d3.select(`rect.turn[data-turn="${targetNode.speaker_turn}"]`);
            
            // Remove previous highlights
            d3.selectAll('rect.turn').classed('highlighted', false);
            
            // Add highlight to this node
            correspondingNode.classed('highlighted', true);
            
            // Scroll the node into view
            const nodeElement = correspondingNode.node();
            if (nodeElement) {
              nodeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
              });
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
    const containerTop = document.getElementById('tooltip-container').getBoundingClientRect().top;
    const controlPanelHeight = document.getElementById('control-panel').offsetHeight;
    const padding = 20; // Space from bottom of viewport
    
    d3.select('#tooltip-container')
      .style('position', 'fixed')
      .style('top', `${controlPanelHeight + 20}px`) // Add some spacing after control panel
      .style('height', `${windowHeight - controlPanelHeight - padding - 20}px`) // Adjust height calculation
  }
  // First, remove the static header from index.html
  // Then add this to the updateVisualization function, right before creating the text boxes:

  // Create header container
  const headerContainer = d3.select('#tooltip-container')
    .insert('div', ':first-child')  // Insert at the top
    .attr('class', 'tooltip-header')
    .style('font-weight', 'bold')
    .style('margin-bottom', '10px')
    .style('padding', '8px')
    .style('display', 'flex')
    .style('justify-content', 'space-between');

  // Add static "Transcript" text
  d3.select('#tooltip-header').append('span')
    .text('Transcript');

  // Add conversation info that will update on hover
  d3.select('#tooltip-header').append('span')
    .attr('class', 'conversation-info')
    .style('color', '#666')
    .text(''); // Empty by default

  // Style the control panel elements
  d3.select('#conversation-selector')
    .style('padding', '5px')
    .style('font-size', '14px');

  d3.select('#button-container')
    .style('padding', '5px');

  // Call it initially
  updateContainerHeight();

  // Add window resize listener
  window.addEventListener('resize', updateContainerHeight);

  // Update the tooltip container CSS
  d3.select('#tooltip-container')
    .style('position', 'fixed')
    .style('width', '500px')
    .style('overflow-y', 'auto')
    .style('padding-right', '10px');  // Add some padding for the scrollbar
});
