d3.json('combined.json').then(function (conversations) {
  // Load the features data
  d3.json('conv_chains_features.json').then(function(features) {
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

    // Initialize state variables
    let hideFirstSpeaker = false;
    let showMaps = true;
    let showSubstantive = true;
    let showMechanical = true;
    
    // Add facilitator reference
    let facilitatorRef = null;
    
    // Track current scale
    let currentScale = 1;
    const scaleStep = 0.5;  // Amount to change scale by each click
    const minScale = 0.3;   // Minimum scale allowed
    const maxScale = 1.5;    // Maximum scale allowed

    // Initialize arrays for tracking nodes and links
    let firstNodesAndLinks = [];
    let nonFirstNodesAndLinks = [];

    // Create and initialize conversation selector first
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

    // Style the control panel container
    const controlPanel = d3.select("#control-panel")
      .style("background-color", "#ffffff")
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("border-radius", "8px")
      .style("padding", "16px")
      .style("margin-bottom", "20px")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "20px");

    // Add title as the first element
    controlPanel.insert("div", "*")  // Insert at the beginning
      .style("width", "100%")
      .style("text-align", "center")
      .style("padding-bottom", "16px")
      .style("border-bottom", "1px solid #eee")
      .style("font-size", "28px")
      .style("font-weight", "bold")
      .style("color", "#333")
      .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
      .text("Conversation Health");

    // Create a container for controls below the title
    const controlsContainer = controlPanel.append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("gap", "20px");

    // Create sections for different controls
    const viewSection = controlsContainer.append("div")
      .attr("class", "control-section")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "12px");

    const filterSection = controlsContainer.append("div")
      .attr("class", "control-section")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "12px");

    const legendSection = controlsContainer.append("div")
      .attr("class", "control-section")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "12px");

    // Style zoom buttons
    const zoomButtonContainer = viewSection.append("div")
      .style("display", "flex")
      .style("gap", "8px")
      .style("background", "#f5f5f5")
      .style("border-radius", "4px")
      .style("padding", "4px");

    // Add minus button with updated styling
    zoomButtonContainer.append("button")
      .attr("id", "zoom-out")
      .text("−")
      .style("width", "32px")
      .style("height", "32px")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("font-size", "18px")
      .style("color", "#333")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)")
      .style("transition", "all 0.2s ease")
      .on("mouseover", function() {
        d3.select(this).style("background", "#f0f0f0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "white");
      })
      .on("click", function() {
        currentScale = Math.max(minScale, currentScale - scaleStep);
        mainG.transition()
          .duration(750)
          .attr("transform", `translate(${margin.left},${margin.top}) scale(${currentScale})`);
      });

    // Add plus button with updated styling
    zoomButtonContainer.append("button")
      .attr("id", "zoom-in")
      .text("+")
      .style("width", "32px")
      .style("height", "32px")
      .style("border", "none")
      .style("border-radius", "4px")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("font-size", "18px")
      .style("color", "#333")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)")
      .style("transition", "all 0.2s ease")
      .on("mouseover", function() {
        d3.select(this).style("background", "#f0f0f0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "white");
      })
      .on("click", function() {
        currentScale = Math.min(maxScale, currentScale + scaleStep);
        mainG.transition()
          .duration(750)
          .attr("transform", `translate(${margin.left},${margin.top}) scale(${currentScale})`);
      });

    // Style conversation selector container and move selector into it
    const conversationContainer = filterSection.append("div")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "4px");

    // Move the existing conversation selector into the container and style it
    conversationSelector
      .style("min-width", "200px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease");

    // Create facilitator filter directly after conversation selector
    const facilitatorContainer = filterSection.append("div")
      .style("display", "flex")
      .style("flex-direction", "column")  // Changed from row to column
      .style("gap", "10px")
      .style("align-items", "flex-start");  // Changed from center to flex-start

    // Add facilitator dropdown row
    const facilitatorRow = facilitatorContainer.append("div")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("gap", "10px")
      .style("align-items", "center")
      .style("width", "100%");
      
    // Add label for facilitator dropdown
    facilitatorRow.append("label")
      .attr("for", "facilitator-select")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("margin-right", "8px")
      .style("min-width", "80px")  // Fixed width for alignment
      .text("Facilitator:");

    // Create facilitator dropdown
    const facilitatorSelect = facilitatorRow
      .append("select")
      .attr("id", "facilitator-select")
      .style("min-width", "200px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease");

    // Get unique facilitators from conversations
    const facilitators = Array.from(new Set(
      Object.values(conversations).map(conv => {
        // First try to find a turn with explicit facilitator field
        const facilitatorTurn = Object.values(conv).find(turn => turn.facilitator);
        if (facilitatorTurn && facilitatorTurn.facilitator) {
          return facilitatorTurn.facilitator;
        }
        
        // If no explicit facilitator, use the first speaker
        const sortedTurns = Object.values(conv).sort((a, b) => 
          (a.speaker_turn || 0) - (b.speaker_turn || 0)
        );
        
        if (sortedTurns.length > 0 && sortedTurns[0].speaker_name) {
          return sortedTurns[0].speaker_name; // No label, just use the name
        }
        
        return "Unknown";
      })
    )).filter(Boolean).sort(); // Remove any undefined/null values and sort alphabetically

    // Populate facilitator dropdown
    facilitatorSelect
      .selectAll("option")
      .data(["All Facilitators"].concat(facilitators))
      .join("option")
      .attr("value", d => d)
      .text(d => d);
      
    // Add group dropdown row directly below facilitator dropdown
    const groupRow = facilitatorContainer.append("div")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("gap", "10px")
      .style("align-items", "center")
      .style("width", "100%");
      
    // Add label for group dropdown
    groupRow.append("label")
      .attr("for", "group-select")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("margin-right", "8px")
      .style("min-width", "80px")  // Fixed width for alignment
      .text("Group:");
      
    // Create group dropdown
    const groupSelect = groupRow
      .append("select")
      .attr("id", "group-select")
      .style("min-width", "200px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease");
      
    // Get unique groups from conversations
    const groups = Array.from(new Set(
      Object.values(conversations).map(conv => {
        // Check if any turn has a group value
        const groupTurn = Object.values(conv).find(turn => turn.group);
        if (groupTurn && groupTurn.group) {
          return groupTurn.group;
        }
        
        // If no group found, assign to "General Fora"
        return "General Fora";
      })
    )).filter(Boolean).sort(); // Remove any undefined/null values and sort alphabetically
    
    // Populate group dropdown
    groupSelect
      .selectAll("option")
      .data(["All Groups"].concat(groups))
      .join("option")
      .attr("value", d => d)
      .text(d => d);
      
    // Add sort dropdown row below group dropdown
    const sortRow = facilitatorContainer.append("div")
      .style("display", "flex")
      .style("flex-direction", "row")
      .style("gap", "10px")
      .style("align-items", "center")
      .style("width", "100%");
      
    // Add label for sort dropdown
    sortRow.append("label")
      .attr("for", "sort-select")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("margin-right", "8px")
      .style("min-width", "80px")  // Fixed width for alignment
      .text("Sort By:");
      
    // Create sort dropdown
    const sortSelect = sortRow
      .append("select")
      .attr("id", "sort-select")
      .style("min-width", "200px")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("font-size", "14px")
      .style("color", "#333")
      .style("background", "white")
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease");
      
    // Define sort options
    const sortOptions = [
      { value: "none", label: "No Sorting" },
      { value: "subst_nonself", label: "Substantive Responsivity ↑" },
      { value: "subst_nonself_desc", label: "Substantive Responsivity ↓" },
      { value: "entropy", label: "Entropy ↑" },
      { value: "entropy_desc", label: "Entropy ↓" },
      { value: "gini", label: "Gini Coefficient ↑" },
      { value: "gini_desc", label: "Gini Coefficient ↓" },
      { value: "fac_speaking", label: "Facilitator % ↑" },
      { value: "fac_speaking_desc", label: "Facilitator % ↓" }
    ];
    
    // Populate sort dropdown
    sortSelect
      .selectAll("option")
      .data(sortOptions)
      .join("option")
      .attr("value", d => d.value)
      .text(d => d.label);

    // Style legend
    const legendContainer = legendSection.append("div")
      .attr("id", "legend")
      .style("display", "flex")
      .style("gap", "16px")
      .style("padding", "8px")
      .style("background", "#f5f5f5")
      .style("border-radius", "4px");

    // Create substantive response legend item
    const newSubstantiveItem = legendContainer.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("cursor", "pointer")
      .style("padding", "4px 8px")
      .style("border-radius", "4px")
      .style("transition", "all 0.2s ease")
      .on("mouseover", function() {
        d3.select(this).style("background", "#e0e0e0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "none");
      })
      .on("click", function() {
        showSubstantive = !showSubstantive;
        d3.selectAll(".link")
          .filter(d => d.type === "responsive_substantive")
          .style("visibility", showSubstantive ? "visible" : "hidden");
        d3.select(this).style("opacity", showSubstantive ? 1 : 0.5);
      });

    newSubstantiveItem.append("div")
      .style("width", "20px")
      .style("height", "2px")
      .style("background", "#FF0000");

    newSubstantiveItem.append("span")
      .text("Substansive")
      .style("font-size", "14px")
      .style("color", "#333");

    // Create mechanical response legend item
    const newMechanicalItem = legendContainer.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("cursor", "pointer")
      .style("padding", "4px 8px")
      .style("border-radius", "4px")
      .style("transition", "all 0.2s ease")
      .on("mouseover", function() {
        d3.select(this).style("background", "#e0e0e0");
      })
      .on("mouseout", function() {
        d3.select(this).style("background", "none");
      })
      .on("click", function() {
        showMechanical = !showMechanical;
        d3.selectAll(".link")
          .filter(d => d.type !== "responsive_substantive")
          .style("visibility", showMechanical ? "visible" : "hidden");
        d3.select(this).style("opacity", showMechanical ? 1 : 0.5);
      });

    // Replace div with SVG for dashed line
    newMechanicalItem.append("svg")
      .attr("width", "20")
      .attr("height", "14") // Increased height to match text height
      .style("display", "flex")
      .style("align-items", "center")
      .append("line")
      .attr("x1", "0")
      .attr("y1", "7") // Centered vertically (half of height)
      .attr("x2", "20")
      .attr("y2", "7") // Centered vertically (half of height)
      .attr("stroke", "#000")
      .attr("stroke-width", "2")
      .attr("stroke-dasharray", "2,2");

    newMechanicalItem.append("span")
      .text("Mechanical")
      .style("font-size", "14px")
      .style("color", "#333");

    // Add CSS for hover effects
    const style = document.createElement('style');
    style.textContent = `
      select:hover, input[type="checkbox"]:hover + label {
        opacity: 0.8;
      }
      select:focus {
        outline: none;
        border-color: #666;
      }
      .control-section {
        position: relative;
      }
    `;
    document.head.appendChild(style);

    // Initialize metric ranges to track min/max values for each metric type
    const metricRanges = {
      "subst_nonself": { min: Infinity, max: -Infinity, values: [] },
      "mech": { min: Infinity, max: -Infinity, values: [] },
      "fac_speaking": { min: Infinity, max: -Infinity, values: [] },
      "gini": { min: Infinity, max: -Infinity, values: [] },
      "entropy": { min: Infinity, max: -Infinity, values: [] }
    };

    // First pass: collect all metric values to determine ranges
    Object.values(conversations).forEach(conv => {
      // Find the conversation ID
      const firstTurn = Object.values(conv)[0];
      if (!firstTurn) return;
      
      const conv_id = firstTurn.conversation_id;
      
      // Find matching features
      let conversationFeatures = null;
      Object.entries(features).forEach(([featureId, featureData]) => {
        if (featureData.conv_id === conv_id) {
          conversationFeatures = featureData;
        }
      });
      
      if (!conversationFeatures) return;
      
      // Update ranges for each metric
      if (conversationFeatures.avg_subst_responded_rate_nonself !== undefined) {
        const value = Number(conversationFeatures.avg_subst_responded_rate_nonself);
        if (!isNaN(value)) {
          metricRanges.subst_nonself.min = Math.min(metricRanges.subst_nonself.min, value);
          metricRanges.subst_nonself.max = Math.max(metricRanges.subst_nonself.max, value);
          metricRanges.subst_nonself.values.push(value);
        }
      }
      
      if (conversationFeatures.avg_mech_responded_rate !== undefined) {
        const value = Number(conversationFeatures.avg_mech_responded_rate);
        if (!isNaN(value)) {
          metricRanges.mech.min = Math.min(metricRanges.mech.min, value);
          metricRanges.mech.max = Math.max(metricRanges.mech.max, value);
          metricRanges.mech.values.push(value);
        }
      }
      
      if (conversationFeatures.facilitator_speaking_percentage !== undefined) {
        const value = Number(conversationFeatures.facilitator_speaking_percentage);
        if (!isNaN(value)) {
          metricRanges.fac_speaking.min = Math.min(metricRanges.fac_speaking.min, value);
          metricRanges.fac_speaking.max = Math.max(metricRanges.fac_speaking.max, value);
          metricRanges.fac_speaking.values.push(value);
        }
      }
      
      if (conversationFeatures.speaking_time_gini_coefficient !== undefined) {
        const value = Number(conversationFeatures.speaking_time_gini_coefficient);
        if (!isNaN(value)) {
          metricRanges.gini.min = Math.min(metricRanges.gini.min, value);
          metricRanges.gini.max = Math.max(metricRanges.gini.max, value);
          metricRanges.gini.values.push(value);
        }
      }
      
      if (conversationFeatures.turn_sequence_entropy !== undefined) {
        const value = Number(conversationFeatures.turn_sequence_entropy);
        if (!isNaN(value)) {
          metricRanges.entropy.min = Math.min(metricRanges.entropy.min, value);
          metricRanges.entropy.max = Math.max(metricRanges.entropy.max, value);
          metricRanges.entropy.values.push(value);
        }
      }
    });
    
    // Function to get color based on percentile
    const getPercentileColor = (value, type) => {
      if (value === undefined || value === null) return "#999"; // Gray for N/A
      
      const numValue = Number(value);
      if (isNaN(numValue)) return "#999";
      
      const range = metricRanges[type];
      if (!range || range.min === Infinity) return "#999";
      
      // Calculate percentile (0 to 1)
      let percentile = (numValue - range.min) / (range.max - range.min);
      
      // For some metrics, higher is worse (like Gini coefficient)
      if (type === "gini" || type === "fac_speaking") {
        percentile = 1 - percentile; // Invert so high values are red
      }
      
      // Create color gradient from red to yellow to green
      if (percentile < 0.5) {
        // Red to yellow (0 to 0.5)
        const r = 255;
        const g = Math.round(255 * (percentile * 2));
        return `rgb(${r},${g},0)`;
      } else {
        // Yellow to green (0.5 to 1)
        const r = Math.round(255 * (1 - (percentile - 0.5) * 2));
        const g = 255;
        return `rgb(${r},${g},0)`;
      }
    };

    // Function to update visualization based on selected conversation
    function updateVisualization(selectedConvo) {
      // Store the current conversation data for the metrics dropdown callback
      currentConvoData = selectedConvo;
      
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
      
      // Get the current sort option
      const sortOption = sortSelect.property("value");
      console.log("Sort option:", sortOption);
      
      // Store the order of conversations for rendering
      let orderedConvoKeys = Object.keys(convoData);
      
      // Sort conversations if a sort option is selected
      if (sortOption !== "none") {
        console.log("Sorting conversations by:", sortOption);
        
        // Extract conversation IDs and their features
        const convoFeatures = [];
        
        Object.keys(convoData).forEach(key => {
          // Find the conversation ID from the first turn
          const firstTurn = Object.values(convoData[key])[0];
          if (!firstTurn) {
            console.log("No turns found for conversation:", key);
            return;
          }
          
          const conv_id = firstTurn.conversation_id;
          console.log("Processing conversation:", key, "with ID:", conv_id);
          
          // Find matching features
          let feature = null;
          Object.entries(features).forEach(([featureId, featureData]) => {
            if (featureData.conv_id === conv_id) {
              feature = featureData;
            }
          });
          
          if (!feature) {
            console.log("No features found for conversation:", conv_id);
          } else {
            console.log("Found features for conversation:", conv_id, feature);
          }
          
          convoFeatures.push({ key, feature });
        });
        
        console.log("Conversations with features:", convoFeatures);
        
        // Sort based on selected option
        convoFeatures.sort((a, b) => {
          // Handle missing features
          if (!a.feature) return 1;
          if (!b.feature) return -1;
          
          // Determine which metric to sort by
          let metricA, metricB;
          const isDescending = sortOption.endsWith("_desc");
          const metric = isDescending ? sortOption.replace("_desc", "") : sortOption;
          
          switch(metric) {
            case "subst_nonself":
              metricA = a.feature.avg_subst_responded_rate_nonself || 0;
              metricB = b.feature.avg_subst_responded_rate_nonself || 0;
              break;
            case "entropy":
              metricA = a.feature.turn_sequence_entropy || 0;
              metricB = b.feature.turn_sequence_entropy || 0;
              break;
            case "gini":
              metricA = a.feature.speaking_time_gini_coefficient || 0;
              metricB = b.feature.speaking_time_gini_coefficient || 0;
              break;
            case "fac_speaking":
              metricA = a.feature.facilitator_speaking_percentage || 0;
              metricB = b.feature.facilitator_speaking_percentage || 0;
              break;
            default:
              return 0;
          }
          
          console.log(`Comparing ${a.key} (${metricA}) with ${b.key} (${metricB})`);
          
          // Sort ascending or descending
          return isDescending ? metricB - metricA : metricA - metricB;
        });
        
        // Update the order of conversation keys for rendering
        orderedConvoKeys = convoFeatures.map(item => item.key);
        console.log("Sorted conversation order:", orderedConvoKeys);
      }

      // Update SVG height based on filtered data
      const conversationCount = orderedConvoKeys.length;
      const perConversationHeight = 300; // Restore original height per conversation
      const conversationSpacing = 50; // Add spacing between conversations
      const totalHeight = (perConversationHeight + conversationSpacing) * conversationCount;
      svg.attr("height", totalHeight);

      // Reset arrays for first nodes and links
      firstNodesAndLinks.length = 0;
      nonFirstNodesAndLinks.length = 0;

      // Render conversations in the sorted order
      orderedConvoKeys.forEach((conversationKey, index) => {
        const data = convoData[conversationKey];
        console.log(`Rendering conversation #${index + 1}: ${conversationKey}`);
        let selectedNode = null; // Track the selected node

        const width = svg.attr("width") - margin.left - margin.right;
        const height = perConversationHeight - margin.top - margin.bottom;
        
        // Create a group for each conversation's visualization
        const conversationG = mainG.append("g")
          .attr("transform", `translate(0,${index * (perConversationHeight + conversationSpacing)})`);

        // Create a group for the visualization elements
        const visualizationGroup = conversationG.append("g");

        // Calculate square size as 80% of conversation height
        const squareSize = height * 0.8;

        // Add bright red square box at the start with border
        visualizationGroup.append("rect")
          .attr("x", -400)  // Moved 50px left from -350
          .attr("y", height/2 - squareSize/2)
          .attr("width", squareSize)
          .attr("height", squareSize)
          .attr("fill", "white")
          .style("z-index", 1000);

        // Calculate metrics
        // Get the conversation ID from the first turn in the data
        const firstTurn = Object.values(data)[0];
        const conv_id = firstTurn.conversation_id;
        console.log("Looking up features for conversation:", conv_id);
        console.log("Available features:", features);
        
        // Search through all features to find matching conversation
        let conversationFeatures = null;
        Object.entries(features).forEach(([featureId, featureData]) => {
          if (featureData.conv_id === conv_id) {
            conversationFeatures = featureData;
            console.log("Found matching features:", conversationFeatures);
          }
        });
        
        if (!conversationFeatures) {
          console.log("No matching features found for conversation:", conv_id);
          conversationFeatures = {};
        }
        
        // Define metrics data with values from features
        const metricsData = [
          { type: "subst_nonself", label: "Substansive", value: conversationFeatures.avg_subst_responded_rate_nonself, definition: "Percentage of turns that received a substantive response from other participants." },
          { type: "mech", label: "Mechanical", value: conversationFeatures.avg_mech_responded_rate, definition: "Percentage of turns that received a mechanical or procedural response." },
          { type: "fac_speaking", label: "Faciliator", value: conversationFeatures.facilitator_speaking_percentage, definition: "Percentage of total conversation turns taken by the facilitator." },
          { type: "gini", label: "Gini", value: conversationFeatures.speaking_time_gini_coefficient, definition: "Measure of inequality in speaking time distribution (0 = equal, 1 = unequal)." },
          { type: "entropy", label: "Entropy", value: conversationFeatures.turn_sequence_entropy, definition: "Measure of unpredictability in turn-taking patterns (0 = certain/predictable, 1 = random/unpredictable)." }
        ];

        // Update the formatMetric function to handle the new metrics
        const formatMetric = (value, type) => {
          if (value === undefined || value === null) return "N/A";
          const numValue = Number(value);
          if (isNaN(numValue)) return "N/A";
          
          switch(type) {
            case "subst_nonself":
            case "mech":
              return (numValue * 100).toFixed(1) + "%";
            case "fac_speaking":
              return numValue.toFixed(1) + "%";
            case "gini":
            case "entropy":
              return numValue.toFixed(3);
            default:
              return Math.round(numValue).toString();
          }
        };

        // Add metrics box
        const metricsGroup = visualizationGroup.append("g")
          .attr("transform", `translate(${-620}, ${height/2 - squareSize/2 + 10})`);  // Added 10px to y-coordinate

        // Add border around metrics
        metricsGroup.append("rect")
          .attr("x", -10)
          .attr("y", -10)
          .attr("width", squareSize)  // Match network box size
          .attr("height", squareSize)  // Match network box size
          .attr("fill", "white");

        // Filter metrics based on selection
        const displayMetrics = "all" 
          ? metricsData 
          : metricsData.filter(m => m.type === "all");
          
        // Get conversation ID
        const conversationId = conv_id || conversationKey;

        // Add table header with conversation ID
        const headerGroup = metricsGroup.append("g")
          .attr("class", "metrics-header");
        
        // Create a single text element centered in the metrics box
        const headerText = headerGroup.append("text")
          .attr("y", 10)
          .attr("x", squareSize / 2) // Center of the metrics box
          .attr("text-anchor", "middle") // Center the text
          .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
          .style("font-size", "18px")
          .style("font-weight", "bold");
          
        // Add ID as first tspan (clickable)
        const idTspan = headerText.append("tspan")
          .attr("fill", "#0066cc")
          .style("text-decoration", "underline")
          .style("cursor", "pointer")
          .text(conversationId);
          
        // Make the ID clickable
        idTspan.on("click", function() {
          window.open(`https://app.fora.io/conversation/${conversationId}`, "_blank");
        });
        
        // Add "Metrics" as second tspan
        headerText.append("tspan")
          .attr("fill", "#333")
          .text(" Metrics");

        // Add table column headers
        metricsGroup.append("text")
          .attr("y", 35)
          .attr("x", 10)
          .attr("fill", "#333")
          .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
          .style("font-size", "14px")
          .style("font-weight", "bold")
          .text("Metric");

        metricsGroup.append("text")
          .attr("y", 35)
          .attr("x", squareSize - 80)
          .attr("fill", "#333")
          .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
          .style("font-size", "14px")
          .style("font-weight", "bold")
          .text("Value");

        // Add separator line
        metricsGroup.append("line")
          .attr("x1", 0)
          .attr("y1", 40)
          .attr("x2", squareSize - 20)
          .attr("y2", 40)
          .attr("stroke", "#ccc")
          .attr("stroke-width", 1);

        // Add metrics in table format
        displayMetrics.forEach((metric, i) => {
          // Create a group for each metric row for easier tooltip handling
          const metricRow = metricsGroup.append("g")
            .attr("class", "metric-row")
            .style("cursor", "help");
          
          // Metric name
          metricRow.append("text")
            .attr("y", 60 + i * 25)
            .attr("x", 10)
            .attr("fill", "#333")
            .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
            .style("font-size", "14px")
            .text(metric.label);
          
          // Get color based on percentile
          const metricColor = getPercentileColor(metric.value, metric.type);
          
          // Background for metric value
          metricRow.append("rect")
            .attr("x", squareSize - 85)
            .attr("y", 60 + i * 25 - 15)
            .attr("width", 70)
            .attr("height", 20)
            .attr("rx", 3)
            .attr("fill", metricColor)
            .attr("fill-opacity", 0.2)
            .attr("stroke", metricColor)
            .attr("stroke-width", 1);
          
          // Metric value
          metricRow.append("text")
            .attr("y", 60 + i * 25)
            .attr("x", squareSize - 80)
            .attr("fill", "#333")
            .style("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .text(formatMetric(metric.value, metric.type));
            
          // Add invisible rectangle for better hover area
          metricRow.append("rect")
            .attr("x", 0)
            .attr("y", 60 + i * 25 - 15)
            .attr("width", squareSize - 20)
            .attr("height", 20)
            .attr("fill", "transparent")
            .on("mouseover", function(event) {
              // Create tooltip div if it doesn't exist
              if (d3.select("#metric-tooltip").empty()) {
                d3.select("body").append("div")
                  .attr("id", "metric-tooltip")
                  .style("position", "absolute")
                  .style("background", "rgba(0,0,0,0.8)")
                  .style("color", "white")
                  .style("padding", "8px 12px")
                  .style("border-radius", "4px")
                  .style("font-size", "14px")
                  .style("pointer-events", "none")
                  .style("z-index", "1000")
                  .style("max-width", "300px")
                  .style("box-shadow", "0 2px 10px rgba(0,0,0,0.2)")
                  .html(metric.definition);
              }
              
              // Position the tooltip near the mouse
              const tooltip = d3.select("#metric-tooltip");
              tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px")
                .style("opacity", 1);
            })
            .on("mousemove", function(event) {
              // Update tooltip position as mouse moves
              d3.select("#metric-tooltip")
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
              // Hide tooltip when mouse leaves
              d3.select("#metric-tooltip").remove();
            });
        });

        // Get the first node (facilitator) before creating participant nodes
        const firstNode = Object.values(data)[0].speaker_name;

        // Add participant nodes inside the square
        const nodeRadius = 10;  // Size of each participant node
        const speakers = Array.from(new Set(Object.values(data).map(d => d.speaker_name)));
        
        // Calculate positions for nodes in a circular arrangement
        const centerX = -400 + squareSize/2;  // Center of the square
        const centerY = height/2;  // Center of the square
        const radius = squareSize/3;  // Radius of the circle arrangement (1/3 of square size)
        
        // Define edges first
        const edges = Object.values(data)
          .flatMap(d => {
            if (!d.link_turn_id || d.link_turn_id == ["NA"]) return [];
            const source = d;
            if (!Object.keys(d).includes("segments")) {
              d.segments = {};
            }
            return Object.keys(d.segments).map(segmentKey => {
              const linkId = d.segments[segmentKey];
              const target = data[linkId.link_turn_id];
              const type = d.segments[segmentKey]["majority_label"];
              const seg_words = d.segments[segmentKey]["segment_words"];
              const score = d.segments[segmentKey]["score"];
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

        // Calculate total words per speaker
        const speakerWordCounts = {};
        Object.values(data).forEach(d => {
          if (!speakerWordCounts[d.speaker_name]) {
            speakerWordCounts[d.speaker_name] = 0;
          }
          speakerWordCounts[d.speaker_name] += d.words.length;
        });

        // Create scale for node sizes
        const minRadius = 5;
        const maxRadius = 20;
        const nodeSizeScale = d3.scaleLinear()
          .domain([0, Math.max(...Object.values(speakerWordCounts))])
          .range([minRadius, maxRadius]);

        // Calculate substantive responsivity rates for each speaker
        const speakerResponsivity = {};
        speakers.forEach(speaker => {
          const speakerTurns = Object.values(data).filter(d => d.speaker_name === speaker);
          const substantiveResponses = edges.filter(e => 
            e.source.speaker_name === speaker && 
            e.type === "responsive_substantive"
          ).length;
          speakerResponsivity[speaker] = substantiveResponses / speakerTurns.length;
        });

        // Create grayscale for responsivity
        const responsivityScale = d3.scaleLinear()
          .domain([0, d3.max(Object.values(speakerResponsivity))])
          .range(["white", "#333333"]);  // From white to dark gray

        // Create nodes for each speaker
        speakers.forEach((speaker, i) => {
          const angle = (i / speakers.length) * 2 * Math.PI;  // Evenly space around circle
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          visualizationGroup.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", nodeSizeScale(speakerWordCounts[speaker]))  // Scale radius by word count
            .attr("fill", responsivityScale(speakerResponsivity[speaker]))  // Fill based on responsivity
            .attr("stroke", speaker === firstNode ? "red" : "black")  // Red outline for facilitator
            .attr("stroke-width", 2)
            .attr("class", "participant-node")
            .on("mouseover", () => {
              // Highlight this speaker's contributions in the conversation strip
              nodes.style("opacity", d => d.speaker_name === speaker ? 1 : 0.2)
                   .style("stroke", d => d.speaker_name === speaker ? "red" : "black")
                   .style("stroke-width", d => d.speaker_name === speaker ? 2 : 0.2);

              // Get all connected edges for this speaker
              const connectedEdges = edges.filter(e => 
                e.source.speaker_name === speaker || e.target.speaker_name === speaker
              );

              // Reduce opacity of unconnected network edges
              visualizationGroup.selectAll("line")
                .style("opacity", d => {
                  const isConnected = connectedEdges.some(e => 
                    (e.source.speaker_name === d.source.speaker_name && e.target.speaker_name === d.target.speaker_name) ||
                    (e.source.speaker_name === d.target.speaker_name && e.target.speaker_name === d.source.speaker_name)
                  );
                  return isConnected ? 1 : 0.1;
                });

              // Reduce opacity of unconnected conversation paths
              paths.style("opacity", d => {
                const isConnected = connectedEdges.some(e => 
                  (e.source.speaker_name === d.source.speaker_name && e.target.speaker_name === d.target.speaker_name) ||
                  (e.source.speaker_name === d.target.speaker_name && e.target.speaker_name === d.source.speaker_name)
                );
                return isConnected ? 1 : 0.1;
              });

              // Highlight connected nodes
              visualizationGroup.selectAll(".participant-node")
                .style("opacity", d => d === speaker ? 1 : 0.2);
            })
            .on("mouseout", () => {
              // Reset the highlighting
              nodes.style("opacity", 1)
                   .style("stroke", "black")
                   .style("stroke-width", 0.2);

              // Reset network edges opacity
              visualizationGroup.selectAll("line")
                .style("opacity", 0.6);

              // Reset conversation paths opacity
              paths.style("opacity", 0.8);

              // Reset node opacity
              visualizationGroup.selectAll(".participant-node")
                .style("opacity", 1);
            })
            .append("title")  // Add tooltip with speaker name and word count
            .text(`${speaker}\n${speakerWordCounts[speaker]} words`);
        });

        // Create a map of speaker positions
        const speakerPositions = {};
        speakers.forEach((speaker, i) => {
          const angle = (i / speakers.length) * 2 * Math.PI;
          speakerPositions[speaker] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          };
        });

        // Create edges between speakers based on their interactions
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
                .datum(edge)  // Bind the edge data to the line element
                .attr("x1", sourcePos.x)
                .attr("y1", sourcePos.y)
                .attr("x2", targetPos.x)
                .attr("y2", targetPos.y)
                .attr("stroke", edge.type === "responsive_substantive" ? "red" : "#000000")
                .attr("stroke-width", edge.score * 5) // Scale the stroke width based on score
                .attr("stroke-opacity", 0.6)
                .attr("stroke-dasharray", edge.type === "responsive_substantive" ? "none" : "3,3");
            }
          }
        });

        // const speakers = Array.from(new Set(Object.values(data.conversation).map(d => d.speaker_name)));
        // const timeExtent = d3.extent(Object.values(data.conversation), d => d.speaker_turn);
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
        xScale.domain([0, totalWords]).range([0, totalWords/40]); // Adjust xScale based on total words, changed from /20 to /40
        
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

        // Create paths first
        const paths = conversationG.selectAll(".link")
          .data(edges)
          .enter()
          .append("path")
          .attr("class", "link")
          .attr("d", d => curvedPath(d.source, d.target, xScale, yScale))
          .attr("stroke", d => d.type === "responsive_substantive" ? "red" : "black")
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
          // Reset all nodes to full opacity
          nodes.style("opacity", 1);
          
          // Reset all paths to normal opacity
          paths.style("opacity", 0.8);
          
          // Reset stroke width to normal
          paths.style("stroke-width", d => scoreScale(d.score));
          
          // Reset stroke color to normal
          paths.style("stroke", d => d.type === "responsive_substantive" ? "red" : "#999999");
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
          // Filter edges to only those directly connected to the hovered node
          const connectedLinks = edges.filter(e => {
            if (hideFirstSpeaker) {
              const firstSpeaker = Object.values(data)[0].speaker_name;
              if (e.source.speaker_name === firstSpeaker || e.target.speaker_name === firstSpeaker) {
                return false;
              }
            }
            // Only include edges where either the source or target is the hovered node
            return e.source.speaker_turn === node.speaker_turn || e.target.speaker_turn === node.speaker_turn;
          });

          // Create a Set of connected edge IDs for faster lookup
          const connectedEdgeIds = new Set(
            connectedLinks.map(e => `${e.source.speaker_turn}-${e.target.speaker_turn}`)
          );

          // Update paths opacity based on direct connection to the hovered node
          paths.style("opacity", d => {
            if (hideFirstSpeaker) {
              const firstSpeaker = Object.values(data)[0].speaker_name;
              if (d.source.speaker_name === firstSpeaker || d.target.speaker_name === firstSpeaker) {
                return 0;
              }
            }
            // Only show edges that are directly connected to the hovered node
            const edgeId = `${d.source.speaker_turn}-${d.target.speaker_turn}`;
            return connectedEdgeIds.has(edgeId) ? 1 : 0.1;
          })
          .attr("stroke", d => d.type === "responsive_substantive" ? "red" : "black")
          .attr("stroke-dasharray", d => d.type === "responsive_substantive" ? "none" : "3,5");

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
          paths.attr("stroke", d => d.type === "responsive_substantive" ? "red" : "black")
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
              <strong>${firstNodesAndLinks.some(({node}) => node === targetNode.speaker_name) ? '<span style="color: red">[Facilitator]</span> ' : ''}${targetNode.speaker_name}</strong> 
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

    // Add event listener for facilitator dropdown
    facilitatorSelect.on("change", function() {
      const selectedFacilitator = this.value;
      let filteredConvos;
      
      if (selectedFacilitator === "All Facilitators") {
        filteredConvos = conversations;
      } else {
        filteredConvos = {};
        Object.entries(conversations).forEach(([key, conv]) => {
          // Check if any turn has the selected facilitator
          const hasFacilitator = Object.values(conv).some(turn => 
            turn.facilitator === selectedFacilitator
          );
          
          // If explicit facilitator found, add the conversation
          if (hasFacilitator) {
            filteredConvos[key] = conv;
            return;
          }
          
          // If no explicit facilitator, check if first speaker matches
          const sortedTurns = Object.values(conv).sort((a, b) => 
            (a.speaker_turn || 0) - (b.speaker_turn || 0)
          );
          
          // If the first speaker matches the selected facilitator, add the conversation
          if (sortedTurns.length > 0 && sortedTurns[0].speaker_name === selectedFacilitator) {
            filteredConvos[key] = conv;
          }
        });
      }
      
      // Apply group filter if active
      const selectedGroup = groupSelect.property("value");
      if (selectedGroup !== "All Groups") {
        const groupFiltered = {};
        Object.entries(filteredConvos).forEach(([key, conv]) => {
          // Check if any turn has the selected group
          const hasGroup = Object.values(conv).some(turn => 
            turn.group === selectedGroup
          );
          
          if (hasGroup) {
            groupFiltered[key] = conv;
          }
        });
        filteredConvos = groupFiltered;
      }
      
      updateVisualization(filteredConvos);
    });

    // Add event listener for group dropdown
    groupSelect.on("change", function() {
      const selectedGroup = this.value;
      let filteredConvos;
      
      if (selectedGroup === "All Groups") {
        filteredConvos = conversations;
      } else {
        filteredConvos = {};
        Object.entries(conversations).forEach(([key, conv]) => {
          // Check if any turn has the selected group
          const hasGroup = Object.values(conv).some(turn => 
            turn.group === selectedGroup
          );
          
          // If explicit group found, add the conversation
          if (hasGroup) {
            filteredConvos[key] = conv;
            return;
          }
          
          // If selected group is "General Fora" and conversation has no group, add it
          if (selectedGroup === "General Fora") {
            // Check if conversation has no group
            const hasNoGroup = !Object.values(conv).some(turn => turn.group);
            if (hasNoGroup) {
              filteredConvos[key] = conv;
            }
          }
        });
      }
      
      // Apply facilitator filter if active
      const selectedFacilitator = facilitatorSelect.property("value");
      if (selectedFacilitator !== "All Facilitators") {
        const facilitatorFiltered = {};
        Object.entries(filteredConvos).forEach(([key, conv]) => {
          // Check if any turn has the selected facilitator
          const hasFacilitator = Object.values(conv).some(turn => 
            turn.facilitator === selectedFacilitator
          );
          
          if (hasFacilitator) {
            facilitatorFiltered[key] = conv;
          }
        });
        filteredConvos = facilitatorFiltered;
      }
      
      updateVisualization(filteredConvos);
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

    // substantiveLineContainer.append("div")
    //   .style("height", "2px")
    //   .style("background", "#FF0000");  // Changed to red

    // substantiveItem.append("span")
    //   .text("Substantive Response");

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
    // mechanicalLineContainer.append("svg")
    //   .attr("width", "20")
    //   .attr("height", "2")
    //   .append("line")
    //   .attr("x1", "0")
    //   .attr("y1", "1")
    //   .attr("x2", "20")
    //   .attr("y2", "1")
    //   .attr("stroke", "#000000")  // Changed to black
    //   .attr("stroke-width", "2")
    //   .attr("stroke-dasharray", "3,5");

    // mechanicalItem.append("span")
    //   .text("Mechanical Response");

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
      .call(zoom.transform, d3.zoomIdentity.translate(550, -100));  // Start translated 400px right and 300px up

    // Disable zoom on double-click (prevents default d3 double-click zoom behavior)
    svg.on("dblclick.zoom", null);

    // Then continue with tooltip container setup...
    updateContainerHeight();

    // Update the SVG container div
    d3.select("#conversation-viz")
      .style("height", "100vh")  // Make container full viewport height
      .style("width", "100%")    // Make container full width
      .style("overflow", "auto"); // Add scrolling if needed

    // Update the CSS for both buttons
    const buttonStyle = document.createElement('style');
    buttonStyle.textContent = `
      #show-maps-toggle:hover, #flip-order:hover {
        background: #f5f5f5 !important;
      }
      #show-maps-toggle.active {
        border-color: #999;
      }
    `;
    document.head.appendChild(buttonStyle);

    // Add event listener for sort dropdown
    sortSelect.on("change", function() {
      console.log("Sort option changed to:", this.value);
      
      // Get current filters
      const selectedFacilitator = facilitatorSelect.property("value");
      const selectedGroup = groupSelect.property("value");
      
      console.log("Current filters - Facilitator:", selectedFacilitator, "Group:", selectedGroup);
      
      // Apply filters to get current filtered data
      let filteredConvos = {};
      
      // Start with all conversations
      if (selectedFacilitator === "All Facilitators" && selectedGroup === "All Groups") {
        filteredConvos = conversations;
      } else {
        // Apply facilitator filter
        if (selectedFacilitator !== "All Facilitators") {
          Object.entries(conversations).forEach(([key, conv]) => {
            // Check if any turn has the selected facilitator
            const hasFacilitator = Object.values(conv).some(turn => 
              turn.facilitator === selectedFacilitator
            );
            
            // If explicit facilitator found, add the conversation
            if (hasFacilitator) {
              filteredConvos[key] = conv;
              return;
            }
            
            // If no explicit facilitator, check if first speaker matches
            const sortedTurns = Object.values(conv).sort((a, b) => 
              (a.speaker_turn || 0) - (b.speaker_turn || 0)
            );
            
            // If the first speaker matches the selected facilitator, add the conversation
            if (sortedTurns.length > 0 && sortedTurns[0].speaker_name === selectedFacilitator) {
              filteredConvos[key] = conv;
            }
          });
        } else {
          filteredConvos = conversations;
        }
        
        // Apply group filter
        if (selectedGroup !== "All Groups") {
          const groupFiltered = {};
          Object.entries(filteredConvos).forEach(([key, conv]) => {
            // Check if any turn has the selected group
            const hasGroup = Object.values(conv).some(turn => 
              turn.group === selectedGroup
            );
            
            // If explicit group found, add the conversation
            if (hasGroup) {
              groupFiltered[key] = conv;
              return;
            }
            
            // If selected group is "General Fora" and conversation has no group, add it
            if (selectedGroup === "General Fora") {
              // Check if conversation has no group
              const hasNoGroup = !Object.values(conv).some(turn => turn.group);
              if (hasNoGroup) {
                groupFiltered[key] = conv;
              }
            }
          });
          filteredConvos = groupFiltered;
        }
      }
      
      console.log("Filtered conversations before sorting:", Object.keys(filteredConvos).length);
      
      // Update visualization with filtered and sorted data
      updateVisualization(filteredConvos);
    });
  });
});
