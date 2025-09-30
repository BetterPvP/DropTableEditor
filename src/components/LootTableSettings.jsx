import { useState } from 'react'
import './LootTableSettings.css'

function LootTableSettings({ data, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Initialize with defaults if not present
  const config = {
    replacementStrategy: data.replacementStrategy || 'WITH_REPLACEMENT',
    rollCountFunction: data.rollCountFunction || { type: 'constant', value: 1 },
    weightDistributionStrategy: data.weightDistributionStrategy || 'STATIC',
    progressiveWeightConfig: data.progressiveWeightConfig || {
      maxShift: 5,
      shiftFactor: 0.5,
      enableVarianceScaling: true
    }
  }

  const updateConfig = (field, value) => {
    const newData = { ...data, [field]: value }
    onChange(newData)
  }

  const updateRollCountFunction = (field, value) => {
    const newRollCountFunction = { ...config.rollCountFunction, [field]: value }
    updateConfig('rollCountFunction', newRollCountFunction)
  }

  const updateProgressiveConfig = (field, value) => {
    const newProgressiveConfig = { ...config.progressiveWeightConfig, [field]: value }
    updateConfig('progressiveWeightConfig', newProgressiveConfig)
  }

  return (
    <div className="loot-table-settings">
      <div className="settings-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>⚙️ Advanced Settings</h3>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="settings-content">
          {/* Global Replacement Strategy */}
          <div className="setting-group">
            <label className="setting-label">
              <span className="label-text">Replacement Strategy</span>
              <span className="label-hint">Global setting for how items are replaced after selection</span>
            </label>
            <select
              value={config.replacementStrategy}
              onChange={(e) => updateConfig('replacementStrategy', e.target.value)}
              className="setting-select"
            >
              <option value="WITH_REPLACEMENT">With Replacement (item can drop multiple times)</option>
              <option value="WITHOUT_REPLACEMENT">Without Replacement (item removed after drop)</option>
            </select>
          </div>

          {/* Roll Count Function */}
          <div className="setting-group">
            <label className="setting-label">
              <span className="label-text">Roll Count Function</span>
              <span className="label-hint">Determines how many items to generate per loot roll</span>
            </label>
            <select
              value={config.rollCountFunction.type}
              onChange={(e) => updateRollCountFunction('type', e.target.value)}
              className="setting-select"
            >
              <option value="constant">Constant (fixed number)</option>
              <option value="progressive">Progressive (increases with attempts)</option>
              <option value="random">Random (range-based)</option>
            </select>

            {/* Constant config */}
            {config.rollCountFunction.type === 'constant' && (
              <div className="sub-setting">
                <label>Rolls:</label>
                <input
                  type="number"
                  min="1"
                  value={config.rollCountFunction.value || 1}
                  onChange={(e) => updateRollCountFunction('value', Number(e.target.value))}
                  className="setting-input"
                />
              </div>
            )}

            {/* Progressive config */}
            {config.rollCountFunction.type === 'progressive' && (
              <div className="sub-settings-grid">
                <div className="sub-setting">
                  <label>Base Rolls:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.rollCountFunction.baseRolls || 1}
                    onChange={(e) => updateRollCountFunction('baseRolls', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
                <div className="sub-setting">
                  <label>Increment Per Progress:</label>
                  <input
                    type="number"
                    min="0"
                    value={config.rollCountFunction.incrementPerProgress || 0}
                    onChange={(e) => updateRollCountFunction('incrementPerProgress', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
                <div className="sub-setting">
                  <label>Max Rolls:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.rollCountFunction.maxRolls || 10}
                    onChange={(e) => updateRollCountFunction('maxRolls', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
              </div>
            )}

            {/* Random config */}
            {config.rollCountFunction.type === 'random' && (
              <div className="sub-settings-grid">
                <div className="sub-setting">
                  <label>Min Rolls:</label>
                  <input
                    type="number"
                    min="0"
                    value={config.rollCountFunction.minRolls || 0}
                    onChange={(e) => updateRollCountFunction('minRolls', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
                <div className="sub-setting">
                  <label>Max Rolls:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.rollCountFunction.maxRolls || 1}
                    onChange={(e) => updateRollCountFunction('maxRolls', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Weight Distribution Strategy */}
          <div className="setting-group">
            <label className="setting-label">
              <span className="label-text">Weight Distribution Strategy</span>
              <span className="label-hint">How weights are adjusted across multiple rolls</span>
            </label>
            <select
              value={config.weightDistributionStrategy}
              onChange={(e) => updateConfig('weightDistributionStrategy', e.target.value)}
              className="setting-select"
            >
              <option value="STATIC">Static (no adjustments)</option>
              <option value="PITY">Pity (increase weight on failures)</option>
              <option value="PROGRESSIVE">Progressive (shift towards center)</option>
            </select>
          </div>

          {/* Progressive Weight Config */}
          {config.weightDistributionStrategy === 'PROGRESSIVE' && (
            <div className="setting-group progressive-config">
              <label className="setting-label">
                <span className="label-text">Progressive Weight Configuration</span>
                <span className="label-hint">Fine-tune how weights shift towards average</span>
              </label>

              <div className="sub-settings-grid">
                <div className="sub-setting">
                  <label>Max Shift:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.progressiveWeightConfig.maxShift}
                    onChange={(e) => updateProgressiveConfig('maxShift', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
                <div className="sub-setting">
                  <label>Shift Factor:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.progressiveWeightConfig.shiftFactor}
                    onChange={(e) => updateProgressiveConfig('shiftFactor', Number(e.target.value))}
                    className="setting-input"
                  />
                </div>
                <div className="sub-setting checkbox-setting">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.progressiveWeightConfig.enableVarianceScaling}
                      onChange={(e) => updateProgressiveConfig('enableVarianceScaling', e.target.checked)}
                    />
                    Enable Variance Scaling
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LootTableSettings