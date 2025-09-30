import { useState, useMemo, useCallback } from 'react'
import { runAdvancedSimulation, calculateCumulativeProbability } from '../utils/lootSimulator'
import { Button } from './ui/button'
import './DropSimulator.css'

function DropSimulator({ data }) {
  const [simResults, setSimResults] = useState([])
  const [numSimulations, setNumSimulations] = useState(1000)
  const [simulatePity, setSimulatePity] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const runSimulation = useCallback(() => {
    try {
      console.log('Running simulation with data:', data)
      console.log('Data has items:', !!data.items, 'Count:', data.items?.length)
      console.log('Data has categories:', !!data.categories, 'Count:', data.categories?.length)
      
      const results = runAdvancedSimulation(data, numSimulations, {
        trackProgress: true,
        simulatePity: simulatePity
      })

      console.log('Simulation results:', results)
      results.sort((a, b) => b.dropRate - a.dropRate)
      setSimResults(results)
      if (results.length > 0) {
        setSelectedItem(results[0].itemId)
      }
    } catch (error) {
      console.error('Simulation error:', error)
    }
  }, [data, numSimulations, simulatePity])

  const cumulativeData = useMemo(() => {
    if (!selectedItem) return []
    const result = simResults.find(r => r.itemId === selectedItem)
    if (!result) return []
    return calculateCumulativeProbability(result.dropRate, 100)
  }, [selectedItem, simResults])

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex flex-col space-y-4 border-b border-slate-700 pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Simulations:</label>
            <input
              type="number"
              min="100"
              max="100000"
              step="100"
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              className="w-24 h-8 rounded border border-slate-700 bg-slate-900/50 px-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={simulatePity}
              onChange={(e) => setSimulatePity(e.target.checked)}
              className="rounded"
            />
            <span>Simulate Pity</span>
          </label>
          <Button onClick={runSimulation} variant="default">
            Run Simulation
          </Button>
        </div>
      </div>

      {simResults.length > 0 && (
        <div className="flex-1 space-y-4 overflow-auto">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">Total Simulations</div>
              <div className="text-lg font-bold text-cyan-400">{numSimulations.toLocaleString()}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">Unique Items</div>
              <div className="text-lg font-bold text-purple-400">{simResults.length}</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">Avg Drop Rate</div>
              <div className="text-lg font-bold text-green-400">
                {(simResults.reduce((sum, r) => sum + r.dropRate, 0) / simResults.length).toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {simResults.map(result => (
              <div
                key={result.itemId}
                className={`bg-slate-900/50 border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedItem === result.itemId 
                    ? 'border-cyan-500 bg-cyan-500/10' 
                    : 'border-slate-700 hover:border-cyan-500/50'
                }`}
                onClick={() => setSelectedItem(result.itemId)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-cyan-300 truncate">{result.itemId}</span>
                  <span className="text-sm font-bold text-purple-400">{result.dropRate.toFixed(2)}%</span>
                </div>

                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${Math.min(result.dropRate, 100)}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-slate-500">Received</div>
                    <div className="font-semibold text-slate-300">{result.timesReceived}×</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-500">First at</div>
                    <div className="font-semibold text-slate-300">
                      {result.rollsToGet || 'N/A'}
                    </div>
                  </div>
                  {result.stdDeviation > 0 && (
                    <div className="text-center">
                      <div className="text-slate-500">Std Dev</div>
                      <div className="font-semibold text-slate-300">{result.stdDeviation.toFixed(1)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedItem && (
            <div className="mt-6 bg-slate-800/30 border border-slate-700 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-cyan-400 mb-4">
                Cumulative Probability: <span className="text-purple-400">{selectedItem}</span>
              </h4>
              <div className="w-full h-64 bg-slate-900/50 rounded-lg p-4">
                <svg viewBox="0 0 600 250" className="w-full h-full">
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
                <div className="text-center text-xs text-slate-400 mt-2">Rolls →</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DropSimulator
