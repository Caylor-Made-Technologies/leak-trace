import { CATEGORY_MAP, isValidCategory } from './categories.js'

// Turns a bank description into a stable merchant key, so "SQ *SONIC DRIVE IN #4421
// HEREFORD TX" and "SONIC DRIVE-IN 0032" both become "sonic drive in".
const PREFIXES = [
  /^(pos|debit|dbt|chk|checkcard|check card|visa|mc|purchase|recurring|preauth|pre-auth|ach|web|online|card)\b[\s:*-]*/,
  /^(debit card purchase|pos purchase|pos debit|purchase authorized on \d{1,2}\/\d{1,2})\b[\s:*-]*/,
  /^(sq|tst|sp|pp|paypal|py|ckc|dd|in|fs|pmt|pos)\s*\*\s*/,
]
const STATES = /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)$/

export function merchantKey(description) {
  let s = String(description || '').toLowerCase()
  s = s.replace(/•+\d*/g, ' ')
  for (let i = 0; i < 3; i++) for (const p of PREFIXES) s = s.replace(p, '')
  s = s
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\.com\b/g, '')
    .replace(/[#*]\s*\d+/g, ' ')
    .replace(/\b(store|str|no|nbr)\s*\d+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z&'+ ]+/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Drop a trailing state code and the town before it ("hereford tx").
  const words = s.split(' ').filter(Boolean)
  if (words.length > 2 && STATES.test(words[words.length - 1])) words.splice(-2, 2)
  return words.slice(0, 3).join(' ') || 'unknown'
}

// Pretty merchant name for display: "sonic drive in" → "Sonic Drive In"
export function prettyMerchant(key) {
  return key.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

const STATIONS = /\b(7[- ]?eleven|circle k|loves|love s|allsups|allsup s|toot n totum|toot'?n totum|stripes|maverik|quiktrip|qt|wawa|sheetz|speedway|caseys|casey s|kum ?& ?go|pilot|flying j|racetrac|raceway|murphy (usa|express)|shell|exxon|mobil|chevron|valero|phillips ?66|conoco|sinclair|citgo|sunoco|marathon|bp|texaco|holiday station|kwik|on the run|fina|town ?& ?country)s?\b/

const RULES = [
  ['fees', /\b(overdraft|od fee|nsf|insufficient funds|returned item|atm fee|atm surcharge|non-?network atm|late fee|late charge|interest charge|finance charge|service charge|monthly (service|maintenance) fee|maintenance fee|foreign transaction|paper statement fee|account fee|cash advance fee|annual fee|wire fee|stop payment)s?\b/],
  ['subscriptions', /\b(netflix|spotify|hulu|disney|max\.com|hbo|paramount|peacock|apple\.com|apple com bill|itunes|icloud|youtube|google (one|storage|play)|amazon prime|prime video|audible|kindle unlimited|xbox|playstation|psn|nintendo|siriusxm|sirius|patreon|onlyfans|twitch|crunchyroll|espn|fubo|sling|dazn|planet fitness|anytime fitness|gym|onlinefitness|duolingo|chatgpt|openai|adobe|microsoft 365|dropbox|canva|norton|mcafee|ring\.com|ring plan|nordvpn|expressvpn|match\.com|tinder|bumble|hinge|subscription|membership)s?\b/],
  ['coffee', /\b(starbucks|dutch bros|dunkin|scooters|human bean|coffee|espresso|tea shop|boba|sonic drink|swig)s?\b/],
  ['eating_out', /\b(mcdonald|mc donald|sonic|whataburger|taco bell|wendy|burger king|chick ?fil|braums|braum s|subway|domino|pizza|papa john|little caesars|kfc|popeyes|arby|jack in the box|carl s jr|dairy queen|dq|culver|raising cane|canes|jimmy john|jersey mike|panda express|chipotle|qdoba|panera|five guys|in n out|wingstop|buffalo wild|applebee|chili s|chilis|olive garden|ihop|denny|waffle house|cracker barrel|texas roadhouse|outback|red lobster|golden corral|cotton patch|whataburger|taco|burrito|bbq|barbecue|grill|cafe|diner|restaurant|steakhouse|sushi|doordash|uber ?eats|grubhub|postmates|eat|kitchen|bistro|cantina|tacos|wings|food truck)s?\b/],
  ['groceries', /\b(united supermarket|market street|amigos|albertsons|kroger|h e b|heb|aldi|walmart neighborhood|walmart supercenter|wal-mart|walmart|wm supercenter|sam s club|sams club|costco|safeway|publix|winco|lidl|trader joe|whole foods|sprouts|food lion|piggly|grocery|supermarket|market|instacart|toot n totum market)s?\b/],
  ['housing', /\b(rent|apartment|apartments|property management|property mgmt|leasing|mortgage|hoa|landlord|realty|storage unit|public storage)s?\b/],
  ['utilities', /\b(xcel|atmos|energy|electric|electricity|power|water|sewer|trash|waste|utility|utilities|city of|gas company|propane|txu|reliant|oncor|sps)s?\b/],
  ['phone', /\b(verizon|at&t|at t|att|t-?mobile|tmobile|cricket|metro ?pcs|boost|mint mobile|visible|straight talk|tracfone|spectrum|suddenlink|optimum|xfinity|comcast|cox|frontier|centurylink|starlink|hughesnet|viasat|internet|wireless)s?\b/],
  ['insurance', /\b(progressive|geico|state farm|allstate|farmers ins|liberty mutual|usaa ins|nationwide|insurance|ins prem|lemonade|root ins)s?\b/],
  ['car', /\b(autozone|o ?reilly|napa|advance auto|jiffy lube|valvoline|take 5|firestone|discount tire|les schwab|goodyear|tire|car wash|carwash|auto parts|auto repair|mechanic|dmv|vehicle registration|toyota financial|gm financial|ford credit|ally auto|santander consumer|carmax|car payment|auto loan|smog|oil change|parts)s?\b/],
  ['health', /\b(cvs|walgreens|pharmacy|rx|hospital|clinic|medical|dental|dentist|orthodont|vision|optometr|urgent care|doctor|physician|labcorp|quest diag|health)s?\b/],
  ['childcare', /\b(daycare|day care|childcare|child care|school|tuition|kids|pediatric|toys r us|carter s|baby)s?\b/],
  ['personal', /\b(barber|salon|great clips|supercuts|sport clips|nails|spa|beauty|ulta|sephora|massage)s?\b/],
  ['entertainment', /\b(cinemark|amc|regal|movie|theater|theatre|steam|epic games|ticketmaster|stubhub|bowling|golf|arcade|concert|bar & grill|bar and grill|brewery|tavern|saloon|liquor|casino|lottery|game|games)s?\b/],
  ['debt', /\b(credit card payment|card payment|capital one|discover|amex|american express|synchrony|chase card|citi card|affirm|klarna|afterpay|sezzle|student loan|nelnet|navient|mohela|sallie mae|loan payment|personal loan|oneMain|onemain)s?\b/],
  ['savings', /\b(to savings|savings transfer|transfer to sav|robinhood|acorns|stash|fidelity|vanguard|schwab|webull|betterment|wealthfront|coinbase|401k|roth|ira|invest)s?\b/],
  ['transfer', /\b(zelle|venmo|cash app|cashapp|square cash|paypal transfer|apple cash|transfer)s?\b/],
  ['gifts', /\b(gift|donation|church|tithe|charity|gofundme|flowers|florist)s?\b/],
  ['shopping', /\b(amazon|amzn|target|best buy|ebay|temu|shein|etsy|wish|academy|tractor supply|home depot|lowe s|lowes|menards|harbor freight|dollar general|family dollar|dollar tree|five below|tj ?maxx|ross|marshalls|kohl|old navy|walmart\.com|bath & body|bed bath|ikea|wayfair|nike|shop|store|boutique|outlet|mall)s?\b/],
]

const INCOME_RULES = [
  ['paycheck', /\b(payroll|paycheck|pay check|direct dep|dir dep|salary|wages|net pay|employer|adp|paychex|gusto|ppd)s?\b/],
]

// Picks a category. Order: the user's saved correction for this merchant →
// keyword rules → a safe default.
export function categorize({ description, amount, type }, merchantRules = {}) {
  const key = merchantKey(description)
  const saved = merchantRules[key]
  if (saved && isValidCategory(saved, type)) return saved

  const text = ' ' + String(description || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9&.\- ]+/g, ' ') + ' '
  if (type === 'income') {
    for (const [id, re] of INCOME_RULES) if (re.test(text)) return id
    return 'income_other'
  }
  // Fees beat everything ("ATM FEE - CIRCLE K").
  if (RULES[0][1].test(text)) return 'fees'
  // Gas stations: a small charge is usually snacks/drinks, a bigger one is fuel.
  if (STATIONS.test(text)) return Math.abs(amount) < 2000 ? 'convenience' : 'gas'
  if (/\b(fuel|gasoline|gas station|diesel)\b/.test(text)) return 'gas'
  for (const [id, re] of RULES.slice(1)) if (re.test(text)) return id
  return 'other'
}

export function categoryLabel(id) {
  return (CATEGORY_MAP[id] || CATEGORY_MAP.other).label
}

// Maps a free-text hint from screenshot reading ("fast food", "fuel") to a category.
export function categoryFromHint(hint, type) {
  if (!hint) return null
  const h = String(hint).toLowerCase().replace(/[^a-z_ ]/g, '').trim()
  if (CATEGORY_MAP[h] && isValidCategory(h, type)) return h
  const aliases = {
    fast_food: 'eating_out', restaurant: 'eating_out', dining: 'eating_out', food: 'eating_out',
    grocery: 'groceries', fuel: 'gas', gasoline: 'gas', rent: 'housing', mortgage: 'housing',
    subscription: 'subscriptions', streaming: 'subscriptions', fee: 'fees', interest: 'fees',
    auto: 'car', vehicle: 'car', snacks: 'convenience', convenience_store: 'convenience',
    salary: 'paycheck', pay: 'paycheck', payroll: 'paycheck', wages: 'paycheck',
    medical: 'health', pharmacy: 'health', bills: 'utilities', internet: 'phone',
  }
  const a = aliases[h.replace(/ /g, '_')]
  return a && isValidCategory(a, type) ? a : null
}
