# Income Calculator - AI Coding Instructions

## Project Overview
A personal financial tracking app for monitoring monthly savings, work days, and spending deductions. Built as a single-page application using vanilla JS with localStorage persistence and Supabase cloud sync.

**Key files**: [app.js](../../app.js) (core logic, 1133 lines), [index.html](../../index.html) (UI structure), [styles.css](../../styles.css) (responsive design)

## Architecture & Data Flow

### State Management
- **Central state object** (`state`) loaded from localStorage on init via `loadState()`, contains:
  - `days` (object keyed by ISO date strings, values: "off"|"worked"|"holiday")
  - `savingsPerDay`, `monthlyBills`, `holidayPaid` (user preferences)
  - `spendingItems`, `adjustments` (arrays for deductions and forecast adjustments)
  - `selectedMonth` (user-selected month for display)
- **Persistence**: `saveState()` → localStorage, automatically debounced to Supabase via `syncRemoteState()` (800ms delay to batch updates)
- **Remote sync**: `loadRemoteState()` fetches from Supabase, `applyRemoteState()` merges with defaults, respects `isApplyingRemote` flag to prevent ping-pong loops

### Rendering Pipeline
1. `init()` sets up event listeners and calls `render()`
2. `render()` parses selected month, then calls all render functions in sequence:
   - `renderCalendar()` - day grid with click handlers
   - `renderWeeklyTotals()` - aggregated per-week metrics
   - `renderMonthlyOutlook()` - month-by-month accumulated view
   - `renderSummaries()` - header metrics (savings, bills, spending deductions)
3. Each render function recalculates from state; no intermediate mutation

### Key Calculations
- **Weekly totals**: Built by `buildWeeks()` → maps days to week objects, tracks `workedDays`, `holidayDays`, `paidDays` (respects `holidayPaid` toggle), computes `savings = workedDays × savingsPerDay`
- **Month stats**: `computeMonthStats()` sums all days, calculates `billsPerDay = monthlyBills / workedDays`, adjusts for paid holidays
- **Savings to date**: `computeSavingsToDate()` iterates all prior months cumulatively
- **Spending deductions**: Auto-summed in `renderSummaries()`, deducted from monthly savings

## Project-Specific Patterns

### Day Status Cycling
- Click any day to cycle: "off" → "worked" → "holiday" → "off" (defined in `STATUS_CYCLE`)
- Status stored keyed by ISO date string (`toDateKey()` converts Date to "YYYY-MM-DD")
- Bank holidays (hardcoded in `BANK_HOLIDAYS` Set) default to "off" on first load via `seedWorkedDaysFromJanuary()`

### Month Navigation
- Input value format: "YYYY-MM" (HTML month picker)
- Helper: `parseMonth()` extracts `{year, monthIndex}`, `formatMonthValue()` rebuilds string
- Prev/next buttons use `shiftMonth()` to increment/decrement months across year boundaries

### Input Handling
- Spending items & adjustments stored in parallel arrays (matching indices per UI row)
- `renderSpendingInputs()`, `renderAdjustmentInputs()` regenerate DOM rows with event listeners
- Remove button triggers `removeSpendingAtIndex()`, `removeAdjustmentAtIndex()` (splices from array)
- Input values sync to state on blur/change, then `saveState()` → debounced sync

### Supabase Integration
- Client created via `createSupabaseClient()` if `window.supabase` library loaded
- Table: `savings_state`, row ID: "shared" (single shared doc model)
- Data column stores entire `state` object; sync timestamps in `updated_at`
- Debounced to prevent per-keystroke writes; status displayed in header ("Synced X ago", "Sync failed")

## Common Workflows

### Adding a New Calculation
1. Add to `computeMonthStats()` if monthly aggregate, or week loop in `buildWeeks()` if per-week
2. Use existing helpers: `getDayStatus(dateKey)`, `startOfWeek(date)`, `toDateKey(date)`
3. Return new field in stats object, use in render functions
4. Trigger full `render()` after state changes

### Adding UI Control
1. Get DOM element ref in init (e.g., `monthlyBillsInput = document.getElementById(...)`)
2. Add event listener in `init()`, update `state.field`, call `saveState()`, then `render()`
3. In `refreshFromState()`, sync input value from state (for app reload)
4. Style in styles.css using existing color vars (`--worked`, `--holiday`, `--off`, `--accent`)

### Modifying Day Status Logic
1. Edit `STATUS_CYCLE` array order if changing cycle
2. Update `BANK_HOLIDAYS` for year changes
3. Adjust `computeMonthStats()` condition blocks if changing paid holiday rules
4. Always rebuild render after state logic changes

## Style System
- **Color palette**: Defined in CSS custom properties (`:root`)
  - Status colors: `--worked` (green), `--holiday` (gold), `--off` (gray)
  - Accent: `--accent` (rust), `--accent-2` (teal)
- **Responsive layout**: Hero section uses CSS Grid (2-col desktop, respects viewport)
- **Interactive states**: Buttons/inputs inherit font, shadow effects in panels

## Testing Notes
- No test framework; manual testing via UI
- Sync behavior testable by opening app in two tabs (Supabase should reconcile)
- Bank holidays hardcoded—extend `BANK_HOLIDAYS` Set for future years
