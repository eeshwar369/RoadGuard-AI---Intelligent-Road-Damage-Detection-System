# Contributing

Thank you for your interest in contributing to RoadGuard AI!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

### Prerequisites
- Node.js 14 or higher
- npm or yarn
- Git

### Installation Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-username/roadguard-ai.git
cd roadguard-ai
```

2. **Install server dependencies**
```bash
cd server
npm install
```

3. **Configure environment**

Create `server/.env` file:
```env
EDGE_IMPULSE_API_KEY=your_api_key_here
EDGE_IMPULSE_PROJECT_ID=your_project_id_here
PORT=3000
```

Get your API credentials from [Edge Impulse Studio](https://studio.edgeimpulse.com) → Dashboard → Keys

4. **Start the server**
```bash
npm start
```

5. **Open the application**

Open `ui/index.html` in your web browser or use a local server:
```bash
cd ui
npx live-server
```

### Project Structure

```
roadguard-ai/
├── server/          # Backend API (Node.js + Express)
├── ui/              # Frontend (HTML/CSS/JS)
├── evaluation/      # Model evaluation scripts
├── images/          # Screenshots and demo images
├── README.md        # Project documentation
└── LICENSE          # MIT License
```

## Code Style

- Use consistent indentation (2 spaces)
- Add comments for complex logic
- Follow existing code patterns
- Test your changes before submitting

## Reporting Issues

Please use the GitHub issue tracker to report bugs or suggest features.

Include:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
