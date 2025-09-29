# Minecraft Drop Table Editor

A web application for managing Minecraft dungeon drop tables stored as JSON files.

## Features

- **Registered Items Management**: Add/remove items that can be used across all drop tables
- **Multiple Drop Tables**: Load and manage multiple dungeon drop tables
- **Variation Support**: Each dungeon can have multiple variations (basic mobs, boss, chest, etc.)
- **Real-time Probability Calculation**: Shows exact probability and "1 in X" odds for each item
- **Full Editing**: Change category weights, item weights, item IDs, add/remove categories or items
- **Export**: Export individual variations or all variations for a dungeon

## Installation

```bash
npm install
```

## Running the App

```bash
npm run dev
```

Then open your browser to `http://localhost:5173`

## Usage

### 1. Register Items

First, go to the "Registered Items" tab and add all Minecraft item IDs you want to use in your drop tables. Only registered items can be added to drop tables.

Example items:
- `minecraft:diamond`
- `minecraft:iron_ingot`
- `minecraft:gold_ingot`
- `minecraft:emerald`
- `minecraft:netherite_scrap`

### 2. Load Drop Tables

Click "Load Drop Table(s)" and select one or more JSON files containing your drop table data.

Sample JSON structure:
```json
{
  "basic_mobs": {
    "categories": [
      {
        "categoryWeight": 10,
        "items": [
          {
            "itemId": "minecraft:iron_ingot",
            "itemWeight": 5
          },
          {
            "itemId": "minecraft:gold_ingot",
            "itemWeight": 3
          }
        ]
      }
    ]
  },
  "boss": {
    "categories": [
      {
        "categoryWeight": 20,
        "items": [
          {
            "itemId": "minecraft:diamond",
            "itemWeight": 10
          }
        ]
      }
    ]
  }
}
```

### 3. Edit Drop Tables

- Click on category weights or item weights to edit them
- Click on item IDs to select from registered items
- Add/remove categories and items using the buttons
- Probabilities update in real-time

### 4. Manage Variations

- Click "+ Add Variation" to create new variations for a dungeon
- Click the "✕" next to a variation name to remove it
- Each variation is saved independently

### 5. Export

- Click "Export JSON" to export the current variation
- Click "⬇ All" next to a dungeon name to export all variations

## Probability Formula

The probability for each item is calculated as:

```
probability = (categoryWeight / sum of distinct categoryWeights) * (itemWeight / sum of itemWeights in that category)
```

Odds formatting:
- ≥1,000,000: `1 in 2.3M`
- ≥1,000: `1 in 12,345`
- else: `1 in 37.5`

## Sample Data

Sample drop table files are included in the `sample_data/` directory:
- `dungeon_temple.json`
- `dungeon_fortress.json`

Load these files to see example drop tables with multiple variations.