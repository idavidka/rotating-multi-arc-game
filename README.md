# Rotating Multi-Arc Game

An interactive physics-based game built with React and TypeScript featuring bouncing balls navigating through multiple rotating circular arcs with gaps. Watch as balls bounce off rotating barriers, collide with each other, and escape through the gaps!

![Game Screenshot](https://github.com/user-attachments/assets/5af6d6b5-5030-4aa9-98f3-08bc89736624)

## 🎮 Features

- **Dynamic Rotating Arcs**: Multiple concentric circular arcs that rotate independently at configurable speeds and directions
- **Physics Simulation**: Realistic ball physics including:
  - Elastic collisions between balls
  - Reflections from rotating surfaces with tangential velocity transfer
  - Speed normalization for consistent gameplay
- **Interactive Controls**: Real-time configuration of all game parameters
- **Escape & Respawn Mechanics**: Balls that escape through gaps trigger spawning of new balls
- **Responsive Canvas**: Automatically adjusts to accommodate the configured number and size of circles

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/idavidka/rotating-multi-arc-game.git
cd rotating-multi-arc-game
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The game will open automatically in your default browser at `http://localhost:5173`.

## 🛠️ Available Scripts

- **`npm run dev`** - Start the development server with hot reload
- **`npm run build`** - Build the production-ready application
- **`npm run preview`** - Preview the production build locally
- **`npm run lint`** - Run ESLint to check code quality

## 🎯 How to Play

1. **Start/Stop**: Use the "Stop" button to pause the simulation, "Start" to resume
2. **Control Rotation**: Toggle arc rotation on/off with the "Stop Rotation"/"Start Rotation" button
3. **Restart**: Reset the simulation with the "Restart" button
4. **Adjust Settings**: Use the sliders and controls to modify game parameters in real-time

### Game Mechanics

- Balls spawn at the center and move outward
- Each rotating arc has a gap where balls can pass through
- Balls bounce off the arcs and each other with realistic physics
- When a ball escapes the play area, new balls are spawned based on the "Balls on escape" setting
- Rotating arcs impart tangential velocity to balls they collide with

## ⚙️ Configuration Options

### Global Settings

| Parameter | Range | Description |
|-----------|-------|-------------|
| **Inner circle diameter** | 200-800px | Size of the innermost circle |
| **Initial balls** | 1-30 | Number of balls at the start |
| **Circle count** | 1-10 | Number of rotating arc barriers |
| **Gap (°)** | 10-120° | Angular width of the gap in each arc |
| **Balls on escape** | 0-5 | Number of new balls spawned when one escapes |
| **Ball radius** | 2-20px | Size of each ball |
| **Ball speed** | 50-600 px/s | Constant speed maintained by balls |
| **Circle thickness** | 2-30px | Thickness of the rotating arcs |

### Per-Circle Settings

Each rotating arc can be individually configured:

- **Rotation Speed** (0-3): How fast the arc rotates
- **Direction**: Clockwise (↻) or Counter-clockwise (↺)
- **Add/Remove**: Dynamically add or remove arcs

## 🏗️ Technical Details

### Built With

- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Canvas API** - 2D rendering for game graphics

### Project Structure

```
rotating-multi-arc-game/
├── src/
│   ├── App.tsx          # Main game component and physics logic
│   ├── App.css          # Styling
│   ├── main.tsx         # Application entry point
│   └── vite-env.d.ts    # Vite type definitions
├── public/              # Static assets
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── eslint.config.js     # ESLint configuration
```

### Physics Implementation

The game implements several physics concepts:

1. **Collision Detection**: Checks distance between ball centers and circle edges
2. **Elastic Collisions**: Momentum and energy conservation between balls
3. **Surface Reflection**: Normal and tangential velocity components calculated for rotating surfaces
4. **Velocity Normalization**: Maintains constant ball speed throughout the game
5. **Gap Detection**: Angular calculations to determine if balls can pass through gaps

### Key Algorithms

- **`reflectFromCircle`**: Handles ball reflection from rotating arc surfaces, including velocity transfer
- **`collideBalls`**: Implements elastic collision between two balls
- **`isInGap`**: Determines if a ball's position is within an arc's gap
- **`normalizeSpeed`**: Ensures all balls maintain the configured constant speed

## 🎨 Customization

You can modify the default configuration in `src/App.tsx`:

```typescript
const defaultConfig: Config = {
  baseDiameter: 400,
  initialBalls: 2,
  circleCount: 3,
  gapDegrees: 40,
  ballsOnEscape: 2,
  ballRadius: 6,
  ballSpeed: 250,
  circleThickness: 10,
  circles: [
    { rotationSpeed: 1.2, direction: 1 },
    { rotationSpeed: 0.8, direction: -1 },
    { rotationSpeed: 1.5, direction: 1 },
  ],
};
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the MIT License.

## 🐛 Known Issues

- TypeScript may report unused React import warnings (can be safely ignored with modern React)
- Some ESLint warnings for React Hook dependencies (non-breaking)

## 💡 Future Ideas

- Sound effects for collisions and escapes
- Score tracking and high scores
- Different ball types with varying properties
- Power-ups and special effects
- Mobile touch controls
- Preset difficulty levels
- Color themes and visual customization
