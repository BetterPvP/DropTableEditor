import { useState, useMemo, useCallback } from 'react'
import { runAdvancedSimulation, calculateCumulativeProbability } from '../utils/lootSimulator'
import './DropSimulator.css'

function DropSimulator({ data }) {
  const [simResults, setSimResults] = useState([])
  const [numSimulations, setNumSimulations] = useState(1000)
  const [simulatePity, setSimulatePity] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const runSimulation = useCallback(() => {
    const results = runAdvancedSimulation(data, numSimulations, {
      trackProgress: true,
      simulatePity: simulatePity
    })

    results.sort((a, b) => b.dropRate - a.dropRate)
    setSimResults(results)
    if (results.length > 0) {
      setSelectedItem(results[0].itemId)
    }
  }, [data, numSimulations, simulatePity])

  const cumulativeData = useMemo(() => {
    if (!selectedItem) return []
    const result = simResults.find(r => r.itemId === selectedItem)
    if (!result) return []
    return calculateCumulativeProbability(result.dropRate, 100)
  }, [selectedItem, simResults])

  return (
    <div className="drop-simulator-fullscreen">
      <div className="simulator-header-fullscreen">
        <div className="header-left">
          <h3>🎲 Drop Simulator</h3>
          <div className="simulator-controls">
            <div className="control-group">
              <label>Simulations:</label>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                className="sim-input"
              />
            </div>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={simulatePity}
                onChange={(e) => setSimulatePity(e.target.checked)}
              />
              <span>Simulate Pity</span>
            </label>
            <button onClick={runSimulation} className="btn btn-primary">
              Run Simulation
            </button>
          </div>
        </div>
      </div>

      {simResults.length > 0 && (
        <div className="sim-results">
          <div className="results-summary">
            <div className="summary-card">
              <span className="summary-label">Total Simulations</span>
              <span className="summary-value">{numSimulations.toLocaleString()}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Unique Items</span>
              <span className="summary-value">{simResults.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Avg Drop Rate</span>
              <span className="summary-value">
                {(simResults.reduce((sum, r) => sum + r.dropRate, 0) / simResults.length).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="results-grid">
            {simResults.map(result => (
              <div
                key={result.itemId}
                className={`result-card ${selectedItem === result.itemId ? 'selected' : ''}`}
                onClick={() => setSelectedItem(result.itemId)}
              >
                <div className="result-header">
                  <span className="result-item-name">{result.itemId}</span>
                  <span className="result-drop-rate">{result.dropRate.toFixed(2)}%</span>
                </div>

                <div className="result-bar-container">
                  <div
                    className="result-bar"
                    style={{ width: `${Math.min(result.dropRate, 100)}%` }}
                  />
                </div>

                <div className="result-stats">
                  <div className="result-stat">
                    <span className="result-stat-label">Received</span>
                    <span className="result-stat-value">{result.timesReceived}×</span>
                  </div>
                  <div className="result-stat">
                    <span className="result-stat-label">First at</span>
                    <span className="result-stat-value">
                      {result.rollsToGet || 'N/A'}
                    </span>
                  </div>
                  {result.stdDeviation > 0 && (
                    <div className="result-stat">
                      <span className="result-stat-label">Std Dev</span>
                      <span className="result-stat-value">{result.stdDeviation.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedItem && (
            <div className="cumulative-section">
              <h4>Cumulative Probability: <span className="highlight">{selectedItem}</span></h4>
              <div className="chart-wrapper">
                <svg viewBox="0 0 600 250" className="chart-svg">
                  {/* Grid */}
                  {[0, 25, 50, 75, 100].map(y => (
                    <g key={y}>
                      <line
                        x1="50"
                        y1={220 - y * 2}
                        x2="580"
                        y2={220 - y * 2}
                        stroke="rgba(0, 212, 255, 0.1)"
                        strokeWidth="1"
                      />
                      <text
                        x="40"
                        y={225 - y * 2}
                        fill="#9BA8BD"
                        fontSize="12"
                        textAnchor="end"
                      >
                        {y}%
                      </text>
                    </g>
                  ))}

                  {/* Curve */}
                  <polyline
                    points={cumulativeData.map((d, i) =>
                      `${50 + (i * 530 / cumulativeData.length)},${220 - d.probability * 2}`
                    ).join(' ')}
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="3"
                  />

                  {/* Gradient */}
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00D4FF" />
                      <stop offset="100%" stopColor="#A277FF" />
                    </linearGradient>
                  </defs>

                  {/* X-axis */}
                  {[0, 20, 40, 60, 80, 100].map(x => (
                    <text
                      key={x}
                      x={50 + (x * 530 / 100)}
                      y="240"
                      fill="#9BA8BD"
                      fontSize="12"
                      textAnchor="middle"
                    >
                      {x}
                    </text>
                  ))}
                </svg>
                <div className="chart-label">Rolls →</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DropSimulator
