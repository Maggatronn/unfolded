import json
import glob
import os
import csv

# Read conversation group mappings from CSV
group_mappings = {}
with open('Conversation Tracking.csv', 'r') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        conv_id = row['Conversation Number']
        group = row['Group']
        if conv_id and group:  # Only add if both fields are non-empty
            group_mappings[conv_id] = group

# Get all JSON files from partial_results directory
files = glob.glob("partial_results/conv_*.json")

# Initialize merged dictionary
merged = {}

# Process each file
for file in files:
    # Extract conversation ID from filename (e.g., "4274" from "conv_4274_...")
    conv_id = os.path.basename(file).split("_")[1]
    
    # Read and parse JSON file
    with open(file, "r") as f:
        data = json.load(f)
        # Add group information to each speaker turn
        group = group_mappings.get(conv_id, "Unknown")
        for turn_data in data.values():
            turn_data["group"] = group
        merged[conv_id] = data

# Write merged data to new file
with open("merged_data.json", "w") as f:
    json.dump(merged, f, indent=2)

print(f"Successfully merged {len(files)} conversations into merged_data.json")
print(f"Group mappings found: {len(group_mappings)}")
print("Groups:", sorted(set(group_mappings.values()))) 