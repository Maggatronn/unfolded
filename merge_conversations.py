import json
import glob
import os
import csv

# Read conversation metadata from CSV
conversation_metadata = {}
with open('Conversation Tracking.csv', 'r') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        conv_id = row['Conversation Number']
        if conv_id:  # Only add if conversation ID exists
            conversation_metadata[conv_id] = {
                'group': row['Group'] or "Unknown",
                'facilitator': row['Facilitator'] or "Unknown",
                'title': row['Title'] or f"Conversation {conv_id}"
            }

# Read existing merged_conversations_oregon.json
try:
    with open("merged_conversations_oregon.json", "r") as f:
        merged = json.load(f)
        print(f"Loaded {len(merged)} existing conversations")
        
        # Update metadata for conversations missing fields
        for conv_id, conv_data in merged.items():
            metadata = conversation_metadata.get(conv_id, {
                'group': "Unknown",
                'facilitator': "Unknown",
                'title': f"Conversation {conv_id}"
            })
            
            # Check first turn to see if metadata needs to be added
            first_turn = next(iter(conv_data.values()))
            needs_update = (
                'group' not in first_turn or
                'facilitator' not in first_turn or
                'title' not in first_turn
            )
            
            if needs_update:
                print(f"Adding metadata to conversation {conv_id}")
                for turn_data in conv_data.values():
                    # Only add fields that are missing
                    if 'group' not in turn_data:
                        turn_data['group'] = metadata['group']
                    if 'facilitator' not in turn_data:
                        turn_data['facilitator'] = metadata['facilitator']
                    if 'title' not in turn_data:
                        turn_data['title'] = metadata['title']

        # Write updated data back to file
        with open("merged_conversations_oregon.json", "w") as f:
            json.dump(merged, f, indent=2)
            
        print(f"Successfully updated conversations in merged_conversations_oregon.json")
        print(f"Total conversations: {len(merged)}")
        print(f"Metadata mappings found: {len(conversation_metadata)}")
        print("Groups:", sorted(set(m['group'] for m in conversation_metadata.values())))
            
except FileNotFoundError:
    print("No existing merged_conversations_oregon.json found")

# Get all JSON files from partial_results directory
files = glob.glob("partial_results/conv_*.json")

# Process each file
for file in files:
    # Extract conversation ID from filename (e.g., "4274" from "conv_4274_...")
    conv_id = os.path.basename(file).split("_")[1]
    
    # Skip if this conversation already exists in merged data
    if conv_id in merged:
        print(f"Skipping existing conversation {conv_id}")
        continue
    
    # Read and parse JSON file
    with open(file, "r") as f:
        try:
            data = json.load(f)
            # Get metadata for this conversation
            metadata = conversation_metadata.get(conv_id, {
                'group': "Unknown",
                'facilitator': "Unknown",
                'title': f"Conversation {conv_id}"
            })
            
            # Add metadata to each turn in the conversation
            for turn_data in data.values():
                turn_data["group"] = metadata['group']
                turn_data["facilitator"] = metadata['facilitator']
                turn_data["title"] = metadata['title']
            
            merged[conv_id] = data
        except json.JSONDecodeError as e:
            print(f"Error reading {file}: {e}")

# Write merged data to new file
with open("merged_conversations_oregon.json", "w") as f:
    json.dump(merged, f, indent=2)

print(f"Successfully merged conversations into merged_conversations_oregon.json")
print(f"Total conversations: {len(merged)}")
print(f"Metadata mappings found: {len(conversation_metadata)}")
print("Groups:", sorted(set(m['group'] for m in conversation_metadata.values()))) 