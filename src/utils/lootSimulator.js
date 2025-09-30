/**
 * Advanced loot simulation utilities matching the Java model
 */

/**
 * Default values for extended loot table properties
 */
export const DEFAULT_LOOT_TABLE_CONFIG = {
  replacementStrategy: 'WITH_REPLACEMENT',
  rollCountFunction: { type: 'constant', value: 1 },
  guaranteedLoot: [],
  weightDistributionStrategy: 'STATIC',
  pityRules: [],
  progressiveWeightConfig: {
    maxShift: 5,
    shiftFactor: 0.5,
    enableVarianceScaling: true
  }
}

/**
 * Roll count function implementations
 */
export const rollCountFunctions = {
  constant: (config) => config.value || 1,

  progressive: (config, progress) => {
    if (!progress) return config.baseRolls || 1
    const additionalRolls = progress.historySize * (config.incrementPerProgress || 0)
    return Math.min((config.baseRolls || 1) + additionalRolls, config.maxRolls || 10)
  },

  random: (config) => {
    const min = config.minRolls || 1
    const max = config.maxRolls || 1
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}

/**
 * Apply weight distribution strategies
 */
export function applyWeightDistribution(candidates, weights, strategy, pityRules, progressiveConfig, progress) {
  switch (strategy) {
    case 'PITY':
      return applyPityRules(candidates, weights, pityRules, progress)

    case 'PROGRESSIVE':
      return applyProgressiveWeights(weights, progressiveConfig, progress)

    case 'STATIC':
    default:
      return weights
  }
}

/**
 * Apply pity rules to increase weights based on failed rolls
 */
function applyPityRules(candidates, weights, pityRules, progress) {
  if (!progress || !pityRules.length) return weights

  const adjustedWeights = [...weights]

  candidates.forEach((candidate, index) => {
    const rule = pityRules.find(r => r.lootItemId === candidate.itemId)
    if (rule) {
      const failedRolls = progress.getFailedRolls(candidate.itemId) || 0
      if (failedRolls > 0) {
        const increments = Math.floor(failedRolls / rule.maxAttempts)
        const extra = increments * rule.weightIncrement
        adjustedWeights[index] += extra
      }
    }
  })

  return adjustedWeights
}

/**
 * Apply progressive weight distribution (shift towards center)
 */
function applyProgressiveWeights(weights, config, progress) {
  if (!progress) return weights

  const adjustedWeights = [...weights]
  const center = weights.reduce((sum, w) => sum + w, 0) / weights.length
  const totalVariance = weights.reduce((sum, w) => sum + Math.abs(w - center), 0)

  if (totalVariance === 0) return weights

  adjustedWeights.forEach((weight, index) => {
    const variance = Math.abs(weight - center)
    const normalizedVariance = variance / totalVariance
    const shift = Math.floor(config.maxShift * normalizedVariance)

    if (weight < center) {
      adjustedWeights[index] = Math.min(center, weight + shift)
    } else if (weight > center) {
      adjustedWeights[index] = Math.max(center, weight - shift)
    }
  })

  return adjustedWeights
}

/**
 * Advanced simulation with full Java model support
 */
export function runAdvancedSimulation(dropTableData, numSimulations, options = {}) {
  const {
    trackProgress = false,
    simulatePity = false
  } = options

  const results = {}
  const progress = trackProgress ? createProgress() : null

  // Initialize tracking for all items
  // Handle both old categories structure and new items structure
  const allItems = []
  
  if (dropTableData.categories) {
    // Old structure
    dropTableData.categories.forEach(category => {
      category.items?.forEach(item => {
        allItems.push(item)
      })
    })
  } else if (dropTableData.items) {
    // New structure
    allItems.push(...dropTableData.items)
  }

  allItems.forEach(item => {
    results[item.itemId] = {
      itemId: item.itemId,
      timesReceived: 0,
      rollsToGet: null,
      failedRolls: 0,
      distribution: []
    }
  })

  // Run simulations
  for (let simNum = 0; simNum < numSimulations; simNum++) {
    const loot = generateLoot(dropTableData, progress)

    // Track results
    loot.forEach(item => {
      const result = results[item.itemId]
      if (!result) {
        console.warn(`Item ${item.itemId} not found in results tracking, skipping`)
        return
      }
      
      result.timesReceived++

      if (result.rollsToGet === null) {
        result.rollsToGet = simNum + 1
      }

      result.distribution.push(simNum + 1)
    })

    // Track failed rolls for pity system
    if (simulatePity && progress) {
      Object.keys(results).forEach(itemId => {
        if (!loot.find(l => l.itemId === itemId)) {
          results[itemId].failedRolls++
        }
      })
    }

    // Update progress
    if (progress) {
      progress.addRoll(loot)
    }
  }

  // Calculate statistics
  Object.keys(results).forEach(itemId => {
    const result = results[itemId]
    result.dropRate = (result.timesReceived / numSimulations) * 100
    result.avgRollsToGet = result.distribution.length > 0
      ? result.distribution.reduce((sum, val) => sum + val, 0) / result.distribution.length
      : null

    // Calculate standard deviation
    if (result.distribution.length > 1) {
      const mean = result.avgRollsToGet
      const squaredDiffs = result.distribution.map(val => Math.pow(val - mean, 2))
      const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length
      result.stdDeviation = Math.sqrt(avgSquaredDiff)
    } else {
      result.stdDeviation = 0
    }
  })

  return Object.values(results)
}

/**
 * Generate loot based on current drop table data with advanced features
 */
function generateLoot(dropTableData, progress = null) {
  const loot = []
  const config = { ...DEFAULT_LOOT_TABLE_CONFIG, ...dropTableData }

  // 1. Add guaranteed loot
  if (config.guaranteedLoot && config.guaranteedLoot.length > 0) {
    config.guaranteedLoot.forEach(item => {
      const amount = Math.floor(Math.random() * (item.maxAmount - item.minAmount + 1)) + item.minAmount
      for (let i = 0; i < amount; i++) {
        loot.push({ itemId: item.itemId, amount: 1 })
      }
    })
  }

  // 2. Determine roll count
  const rolls = rollCountFunctions[config.rollCountFunction.type](config.rollCountFunction, progress)

  // 3. Get items from either flat structure or old category structure
  let candidates = []
  let weights = []

  if (config.items && config.items.length > 0) {
    // New flat structure
    candidates = config.items
    weights = config.items.map(item => item.itemWeight || 1)
  } else if (config.categories && config.categories.length > 0) {
    // Old category structure (migration support)
    config.categories.forEach(category => {
      category.items?.forEach(item => {
        candidates.push(item)
        weights.push((category.categoryWeight || 1) * (item.itemWeight || 1))
      })
    })
  }

  if (rolls <= 0 || candidates.length === 0) {
    return loot
  }

  // 4. Apply weight distribution strategy
  const adjustedWeights = applyWeightDistribution(
    candidates,
    weights,
    config.weightDistributionStrategy,
    config.pityRules || [],
    config.progressiveWeightConfig || DEFAULT_LOOT_TABLE_CONFIG.progressiveWeightConfig,
    progress
  )

  // 5. Perform rolls
  const availableCandidates = [...candidates]
  const availableWeights = [...adjustedWeights]

  for (let i = 0; i < rolls; i++) {
    if (availableCandidates.length === 0) break

    const totalWeight = availableWeights.reduce((sum, w) => sum + w, 0)
    if (totalWeight <= 0) break

    let roll = Math.random() * totalWeight
    let selectedIndex = -1

    for (let j = 0; j < availableWeights.length; j++) {
      roll -= availableWeights[j]
      if (roll <= 0) {
        selectedIndex = j
        break
      }
    }

    if (selectedIndex >= 0) {
      const selectedItem = availableCandidates[selectedIndex]
      const amount = Math.floor(Math.random() * (selectedItem.maxYield - selectedItem.minYield + 1)) + selectedItem.minYield

      loot.push({
        itemId: selectedItem.itemId,
        amount
      })

      // Handle replacement strategy
      const itemStrategy = selectedItem.replacementStrategy || config.replacementStrategy
      if (itemStrategy === 'WITHOUT_REPLACEMENT') {
        availableCandidates.splice(selectedIndex, 1)
        availableWeights.splice(selectedIndex, 1)
      }
    }
  }

  return loot
}

/**
 * Create a progress tracker for pity/progressive systems
 */
function createProgress() {
  return {
    history: [],
    historySize: 0,
    failedRollsMap: {},

    addRoll(loot) {
      this.history.push(loot)
      this.historySize++
    },

    getFailedRolls(itemId) {
      // Count rolls since last time this item was received
      for (let i = this.history.length - 1; i >= 0; i--) {
        if (this.history[i].find(l => l.itemId === itemId)) {
          return this.history.length - i - 1
        }
      }
      return this.history.length
    }
  }
}

/**
 * Calculate cumulative probability distribution
 */
export function calculateCumulativeProbability(dropRate, maxRolls = 100) {
  const distribution = []
  const p = dropRate / 100

  for (let n = 1; n <= maxRolls; n++) {
    const cumulativeProb = 1 - Math.pow(1 - p, n)
    distribution.push({
      rolls: n,
      probability: cumulativeProb * 100
    })
  }

  return distribution
}