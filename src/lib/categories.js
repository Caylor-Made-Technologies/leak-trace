// Categories. `group` drives the Needs / Wants / Saving split on the dashboard.
// `smallLeak` marks categories where many small purchases add up.

export const CATEGORIES = [
  { id: 'paycheck', label: 'Paycheck', emoji: '💵', group: 'income' },
  { id: 'income_other', label: 'Other income', emoji: '💰', group: 'income' },
  { id: 'housing', label: 'Rent & housing', emoji: '🏠', group: 'needs' },
  { id: 'utilities', label: 'Utilities', emoji: '💡', group: 'needs' },
  { id: 'phone', label: 'Phone & internet', emoji: '📱', group: 'needs' },
  { id: 'groceries', label: 'Groceries', emoji: '🛒', group: 'needs' },
  { id: 'gas', label: 'Gas & fuel', emoji: '⛽', group: 'needs' },
  { id: 'car', label: 'Car & truck', emoji: '🛻', group: 'needs' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️', group: 'needs' },
  { id: 'health', label: 'Health', emoji: '💊', group: 'needs' },
  { id: 'childcare', label: 'Kids & family', emoji: '🧸', group: 'needs' },
  { id: 'eating_out', label: 'Eating out', emoji: '🍔', group: 'wants', smallLeak: true },
  { id: 'convenience', label: 'Gas station snacks', emoji: '🥤', group: 'wants', smallLeak: true },
  { id: 'coffee', label: 'Coffee & drinks', emoji: '☕', group: 'wants', smallLeak: true },
  { id: 'subscriptions', label: 'Subscriptions', emoji: '🔁', group: 'wants' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎮', group: 'wants' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', group: 'wants' },
  { id: 'personal', label: 'Personal care', emoji: '💈', group: 'wants' },
  { id: 'gifts', label: 'Gifts & giving', emoji: '🎁', group: 'wants' },
  { id: 'fees', label: 'Fees & interest', emoji: '⚠️', group: 'wants' },
  { id: 'debt', label: 'Debt payments', emoji: '💳', group: 'saving' },
  { id: 'savings', label: 'Savings & investing', emoji: '🏦', group: 'saving' },
  { id: 'transfer', label: 'Transfers & P2P', emoji: '🔄', group: 'wants' },
  { id: 'other', label: 'Other', emoji: '📦', group: 'wants' },
]

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.group !== 'income')
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.group === 'income')

export function cat(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP.other
}

export function isValidCategory(id, type) {
  const c = CATEGORY_MAP[id]
  if (!c) return false
  return type === 'income' ? c.group === 'income' : c.group !== 'income'
}

export const GROUPS = {
  needs: { label: 'Needs', hint: 'Rent, bills, groceries, gas' },
  wants: { label: 'Wants', hint: 'Eating out, fun, shopping, fees' },
  saving: { label: 'Saving & debt', hint: 'Savings, investing, paying down debt' },
}
