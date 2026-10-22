// Future value of investing the same amount every month, compounded monthly.
// Educational only: real returns go up and down and are never guaranteed.

export const RATES = [0.04, 0.07, 0.1]
export const YEARS = [5, 10, 20, 30]

export function futureValue(monthlyCents, annualRate, years) {
  const n = years * 12
  const r = annualRate / 12
  if (monthlyCents <= 0) return 0
  if (r === 0) return monthlyCents * n
  return Math.round(monthlyCents * ((Math.pow(1 + r, n) - 1) / r))
}

export function growthTable(monthlyCents, rates = RATES, years = YEARS) {
  return years.map((y) => ({
    years: y,
    contributed: monthlyCents * y * 12,
    values: rates.map((rate) => ({ rate, value: futureValue(monthlyCents, rate, y) })),
  }))
}

// Year-by-year curve for the chart.
export function growthCurve(monthlyCents, rates = RATES, maxYears = 30) {
  const rows = []
  for (let y = 0; y <= maxYears; y++) {
    const row = { year: y, contributed: monthlyCents * 12 * y }
    for (const rate of rates) row[`r${Math.round(rate * 100)}`] = futureValue(monthlyCents, rate, y)
    rows.push(row)
  }
  return rows
}
