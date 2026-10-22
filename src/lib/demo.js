import { addMonths, currentMonth, daysInMonth, todayISO } from './dates.js'

// Three months of realistic sample data so people can explore before adding their own.
// Uses a seeded random so the sample looks the same every time.
export function demoTransactions(now = new Date()) {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const today = todayISO(now)
  const out = []
  const add = (month, day, description, dollars, type = 'expense') => {
    const dim = daysInMonth(month)
    const date = `${month}-${String(Math.min(day, dim)).padStart(2, '0')}`
    if (date > today) return
    out.push({ date, description, amount: Math.round(dollars * 100), type, source: 'demo' })
  }
  const cm = currentMonth(now)
  for (let i = 2; i >= 0; i--) {
    const m = addMonths(cm, -i)
    const heavy = i === 0
    add(m, 1, 'PAYROLL DIRECT DEP', 1685.4, 'income')
    add(m, 15, 'PAYROLL DIRECT DEP', 1685.4, 'income')
    if (i === 1) add(m, 20, 'CASH APP *SOLD TOOLBOX', 120, 'income')
    add(m, 1, 'RENT - SUNSET APARTMENTS', 925)
    add(m, 4, 'XCEL ENERGY', 92 + rand() * 30)
    add(m, 6, 'ATMOS ENERGY', 38 + rand() * 12)
    add(m, 8, 'VERIZON WIRELESS', 85)
    add(m, 9, 'PROGRESSIVE INSURANCE', 142)
    add(m, 12, 'GM FINANCIAL AUTO PMT', 488)
    add(m, 3, 'NETFLIX.COM', 15.49)
    add(m, 5, 'SPOTIFY USA', 11.99)
    add(m, 11, 'PLANET FITNESS', 24.99)
    add(m, 17, 'APPLE.COM/BILL', 2.99)
    if (i < 2) add(m, 19, 'PARAMOUNT+', 7.99)
    if (i === 0) add(m, 20, 'PARAMOUNT+', 7.99)
    for (let w = 0; w < 4; w++) {
      add(m, 2 + w * 7, pick(['UNITED SUPERMARKETS', 'WALMART SUPERCENTER', 'ALDI']), 70 + rand() * 60)
      add(m, 3 + w * 7, pick(["ALLSUP'S #312", 'LOVES TRAVEL #455', 'SHELL OIL']), 55 + rand() * 25)
    }
    const fast = heavy ? 14 : 8
    for (let k = 0; k < fast; k++) add(m, 1 + Math.floor(rand() * 28), pick(['SONIC DRIVE IN', 'WHATABURGER', "MCDONALD'S", 'TACO BELL', 'CHICK-FIL-A']), 7 + rand() * 9)
    const snacks = heavy ? 11 : 6
    for (let k = 0; k < snacks; k++) add(m, 1 + Math.floor(rand() * 28), pick(["ALLSUP'S #312", 'TOOT N TOTUM', '7-ELEVEN']), 3 + rand() * 7)
    for (let k = 0; k < 4; k++) add(m, 2 + Math.floor(rand() * 26), 'DUTCH BROS COFFEE', 5.5 + rand() * 2)
    add(m, 22, 'AMAZON MKTPLACE', heavy ? 164 : 48 + rand() * 20)
    add(m, 25, 'CINEMARK THEATRES', 32)
    add(m, 26, 'TRANSFER TO SAVINGS', 100)
    if (heavy) {
      add(m, 14, 'OVERDRAFT FEE', 35)
      add(m, 18, 'NON-NETWORK ATM FEE', 3.5)
      add(m, 21, 'AUTOZONE #1182', 64.2)
    }
    if (i === 1) add(m, 28, 'CREDIT CARD INTEREST CHARGE', 18.4)
  }
  return out
}
