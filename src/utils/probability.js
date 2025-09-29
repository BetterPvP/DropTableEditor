/**
 * Calculate the probability of an item dropping
 * Formula: (categoryWeight / totalDistinctCategoryWeight) * (itemWeight / totalItemWeightInCategory)
 */
export function calculateProbability(categoryWeight, totalDistinctCategoryWeight, itemWeight, totalItemWeightInCategory) {
  if (totalDistinctCategoryWeight === 0 || totalItemWeightInCategory === 0) {
    return 0
  }

  const categoryChance = categoryWeight / totalDistinctCategoryWeight
  const itemChance = itemWeight / totalItemWeightInCategory

  return categoryChance * itemChance
}

/**
 * Format odds as "1 in X" with appropriate number formatting
 * - ≥1,000,000: "1 in 2.3M"
 * - ≥1,000: "1 in 12,345"
 * - else: "1 in 37.5"
 */
export function formatOdds(odds) {
  if (odds === 0 || !isFinite(odds)) {
    return '1 in ∞'
  }

  if (odds >= 1000000) {
    // Format as millions with 1 decimal place
    const millions = odds / 1000000
    return `1 in ${millions.toFixed(1)}M`
  } else if (odds >= 1000) {
    // Format with comma separators, no decimals
    return `1 in ${Math.round(odds).toLocaleString('en-US')}`
  } else {
    // Format with 1 decimal place
    return `1 in ${odds.toFixed(1)}`
  }
}