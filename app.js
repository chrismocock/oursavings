const STORAGE_KEY = "income-tracker-state";

const SUPABASE_URL = "https://nbnprbrjoacripodygru.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibnByYnJqb2Fjcmlwb2R5Z3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzUyOTUsImV4cCI6MjA4NDI1MTI5NX0.TV9un-JTUbh9JJwg3R0j5i8Cqc4jV-xxVOkZEEPk370";
const SUPABASE_TABLE = "savings_state";
const SUPABASE_ROW_ID = "shared";

const monthPicker = document.getElementById("monthPicker");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const monthlyBillsInput = document.getElementById("monthlyBills");
const holidayPaidToggle = document.getElementById("holidayPaid");
const calendarGrid = document.getElementById("calendarGrid");
const calendarTitle = document.getElementById("calendarTitle");
const weeklyTitle = document.getElementById("weeklyTitle");
const weeklyList = document.getElementById("weeklyList");
const monthlyList = document.getElementById("monthlyList");
const savingsMonth = document.getElementById("savingsMonth");
const summaryTitle = document.getElementById("summaryTitle");
const savingsToDate = document.getElementById("savingsToDate");
const owedTotal = document.getElementById("owedTotal");
const owedLabel = document.getElementById("owedLabel");
const owedWeeks = document.getElementById("owedWeeks");
const lastSync = document.getElementById("lastSync");
const spendingItem0 = document.getElementById("spendingItem0");
const spendingDate0 = document.getElementById("spendingDate0");
const spendingNote0 = document.getElementById("spendingNote0");
const addSpending = document.getElementById("addSpending");
const removeSpending0 = document.getElementById("removeSpending0");
const spendingList = document.getElementById("spendingList");
const spendingTotal = document.getElementById("spendingTotal");
const spendingToast = document.getElementById("spendingToast");
const adjustmentDate0 = document.getElementById("adjustmentDate0");
const adjustmentAmount0 = document.getElementById("adjustmentAmount0");
const addAdjustment = document.getElementById("addAdjustment");
const removeAdjustment0 = document.getElementById("removeAdjustment0");
const adjustmentList = document.getElementById("adjustmentList");
const adjustmentTotal = document.getElementById("adjustmentTotal");

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_CYCLE = ["off", "worked", "holiday"];
const BANK_HOLIDAYS = new Set([
  // 2025
  "2025-01-01",
  "2025-04-18",
  "2025-04-21",
  "2025-05-05",
  "2025-05-26",
  "2025-08-25",
  "2025-12-25",
  "2025-12-26",
  // 2026
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-04",
  "2026-05-25",
  "2026-08-31",
  "2026-12-25",
  "2026-12-28",
  // 2027
  "2027-01-01",
  "2027-03-26",
  "2027-03-29",
  "2027-05-03",
  "2027-05-31",
  "2027-08-30",
  "2027-12-27",
  "2027-12-28",
]);

const UNPAID_CUTOFF_DATE = new Date(2025, 10, 1);
const PAY_ARREARS_MONTHS = 1;

const state = loadState();
const supabaseClient = createSupabaseClient();
const syncRemoteState = debounce(saveRemoteState, 800);
let isApplyingRemote = false;
let lastSyncTime = null;

init();

function init() {
  const now = new Date();
  const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  monthPicker.value = state.selectedMonth || monthValue;
  refreshFromState();

  monthPicker.addEventListener("change", () => {
    state.selectedMonth = monthPicker.value;
    const selected = parseMonth(monthPicker.value);
    seedWorkedDaysFromJanuary(selected.year);
    saveState();
    render();
  });

  window.addEventListener("resize", () => {
    render();
  });

  prevMonth.addEventListener("click", () => {
    const { year, monthIndex } = parseMonth(monthPicker.value);
    const target = shiftMonth(year, monthIndex, -1);
    monthPicker.value = formatMonthValue(target.year, target.monthIndex);
    state.selectedMonth = monthPicker.value;
    seedWorkedDaysFromJanuary(target.year);
    saveState();
    render();
  });

  nextMonth.addEventListener("click", () => {
    const { year, monthIndex } = parseMonth(monthPicker.value);
    const target = shiftMonth(year, monthIndex, 1);
    monthPicker.value = formatMonthValue(target.year, target.monthIndex);
    state.selectedMonth = monthPicker.value;
    seedWorkedDaysFromJanuary(target.year);
    saveState();
    render();
  });


  monthlyBillsInput.addEventListener("input", () => {
    state.monthlyBills = Number(monthlyBillsInput.value || 0);
    saveState();
    render();
  });

  holidayPaidToggle.addEventListener("change", () => {
    state.holidayPaid = holidayPaidToggle.checked;
    saveState();
    render();
  });

  addSpending.addEventListener("click", () => {
    state.spendingItems.push({ amount: 0, note: "", date: getDefaultSpendingDate() });
    saveState();
    renderSpendingInputs();
    const selected = parseMonth(monthPicker.value);
    renderSummaries(selected.year, selected.monthIndex);
  });

  removeSpending0.addEventListener("click", () => {
    removeSpendingAtIndex(0);
  });

  addAdjustment.addEventListener("click", () => {
    state.adjustments.push({ date: "", amount: 0 });
    saveState();
    renderAdjustmentInputs();
    const selected = parseMonth(monthPicker.value);
    renderSummaries(selected.year, selected.monthIndex);
    renderMonthlyOutlook(selected.year, selected.monthIndex);
  });

  removeAdjustment0.addEventListener("click", () => {
    removeAdjustmentAtIndex(0);
  });

  render();
  loadRemoteState().then(() => {
    refreshFromState();
    render();
  });

  setInterval(() => {
    if (lastSyncTime) {
      updateLastSync(lastSyncTime);
    }
  }, 10000);
}

function render() {
  const { year, monthIndex } = parseMonth(monthPicker.value);
  const displayDate = new Date(year, monthIndex, 1);

  calendarTitle.textContent = displayDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  summaryTitle.textContent = `${displayDate.toLocaleDateString("en-GB", {
    month: "long",
  })} Summary`;

  weeklyTitle.textContent = `Weekly totals for ${displayDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })}`;

  renderCalendar(year, monthIndex);
  renderWeeklyTotals(year, monthIndex);
  renderMonthlyOutlook(year, monthIndex);
  renderSummaries(year, monthIndex);
  renderOwedSummary();
}

function renderCalendar(year, monthIndex) {
  calendarGrid.innerHTML = "";
  const isCompact = window.matchMedia("(max-width: 768px)").matches;
  calendarGrid.style.gridTemplateColumns = isCompact ? "repeat(5, minmax(0, 1fr))" : "";

  const weekdayLabels = isCompact ? WEEKDAYS.slice(0, 5) : WEEKDAYS;
  weekdayLabels.forEach((label) => {
    const weekday = document.createElement("div");
    weekday.className = "weekday";
    weekday.textContent = label;
    calendarGrid.appendChild(weekday);
  });

  const firstDay = new Date(year, monthIndex, 1);
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let startOffset = getMondayIndex(firstDay);
  if (isCompact && startOffset > 4) {
    startOffset = 0;
  }

  for (let i = 0; i < startOffset; i += 1) {
    const filler = document.createElement("div");
    filler.className = "day disabled";
    calendarGrid.appendChild(filler);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const dateKey = toDateKey(date);
    const isBankHoliday = isBankHolidayDate(dateKey);
    const status = getDayStatus(dateKey);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (isCompact && isWeekend) {
      continue;
    }

    const cell = document.createElement("div");
    const isLocked = isWeekend || isBankHoliday;
    cell.className = `day ${status}${isWeekend ? " disabled" : ""}${isBankHoliday ? " bank locked" : ""}`;
    cell.dataset.date = dateKey;

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;

    const statusLabel = document.createElement("span");
    statusLabel.className = "day-status";
    statusLabel.textContent = getStatusLabel(status, isCompact, isBankHoliday);

    cell.appendChild(number);
    cell.appendChild(statusLabel);

    if (!isLocked) {
      cell.addEventListener("click", () => {
        const nextStatus = getNextStatus(getDayStatus(dateKey));
        state.days[dateKey] = nextStatus;
        saveState();
        render();
      });
    }

    calendarGrid.appendChild(cell);
  }
}

function renderWeeklyTotals(year, monthIndex) {
  ensureWeeklyPaid();
  const weeks = buildWeeks(year, monthIndex);
  const monthStats = computeMonthStats(year, monthIndex, weeks.length);

  weeklyList.innerHTML = "";

  weeks.forEach((week) => {
    const missedDays = Math.max(0, week.expectedDays - week.workedDays);
    const netSavings = week.savings - monthStats.billsPerDay * missedDays;
    const weekKey = toDateKey(week.start);
    const isPaid = Boolean(state.weeklyPaid?.[weekKey]);

    const row = document.createElement("div");
    row.className = "weekly-row";

    const label = document.createElement("span");
    label.textContent = `${formatShortDate(week.start)} - ${formatShortDate(week.end)}`;

    const days = document.createElement("span");
    days.textContent = `${week.workedDays} worked day${week.workedDays === 1 ? "" : "s"}`;

    const savingsTotal = document.createElement("span");
    savingsTotal.className = "weekly-total";
    savingsTotal.textContent = currency.format(week.savings);

    const savings = document.createElement("span");
    savings.className = "weekly-savings";
    savings.textContent = `Bills target ${currency.format(monthStats.billsPerWeek)}`;

    const daily = document.createElement("span");
    daily.className = "weekly-daily";
    daily.textContent = `Bills/day ${currency.format(monthStats.billsPerDay)}`;

    const netSpan = document.createElement("span");
    netSpan.className = "weekly-net";
    netSpan.textContent = `Net ${currency.format(netSavings)}`;

    const paidToggle = document.createElement("button");
    paidToggle.type = "button";
    paidToggle.className = `weekly-paid-toggle${isPaid ? " is-paid" : ""}`;
    paidToggle.textContent = isPaid ? "Paid" : "Not paid";
    paidToggle.addEventListener("click", () => {
      const next = !state.weeklyPaid[weekKey];
      state.weeklyPaid[weekKey] = next;
      saveState();
      paidToggle.classList.toggle("is-paid", next);
      paidToggle.textContent = next ? "Paid" : "Not paid";
      renderOwedSummary();
    });

    row.appendChild(label);
    row.appendChild(days);
    row.appendChild(savingsTotal);
    row.appendChild(savings);
    row.appendChild(daily);
    row.appendChild(netSpan);
    row.appendChild(paidToggle);

    weeklyList.appendChild(row);
  });

  const summaryRow = document.createElement("div");
  summaryRow.className = "weekly-row summary";

  const summaryLabel = document.createElement("span");
  summaryLabel.textContent = "Month total";

  const summaryDays = document.createElement("span");
  summaryDays.textContent = `${monthStats.workedDays} worked day${monthStats.workedDays === 1 ? "" : "s"}`;

  const summarySavings = document.createElement("span");
  summarySavings.className = "weekly-total";
  summarySavings.textContent = currency.format(monthStats.savings);

  const summaryBills = document.createElement("span");
  summaryBills.className = "weekly-savings";
  summaryBills.textContent = `Bills target ${currency.format(state.monthlyBills || 0)}`;

  const summaryDaily = document.createElement("span");
  summaryDaily.className = "weekly-daily";
  summaryDaily.textContent = `Bills/day ${currency.format(monthStats.billsPerDay)}`;

  const summaryNet = document.createElement("span");
  summaryNet.className = "weekly-net";
  summaryNet.textContent = `Net ${currency.format(monthStats.netSavings)}`;

  summaryRow.appendChild(summaryLabel);
  summaryRow.appendChild(summaryDays);
  summaryRow.appendChild(summarySavings);
  summaryRow.appendChild(summaryBills);
  summaryRow.appendChild(summaryDaily);
  summaryRow.appendChild(summaryNet);

  weeklyList.appendChild(summaryRow);
}

function renderSummaries(year, monthIndex) {
  const weekCount = buildWeeks(year, monthIndex).length;
  const monthStats = computeMonthStats(year, monthIndex, weekCount);
  const monthDeductions = getDeductionsForMonth(year, monthIndex);

  savingsMonth.textContent = currency.format(monthStats.netSavings - monthDeductions);
  const totalSavings = computeAdjustedSavingsToDate(year, monthIndex);
  savingsToDate.textContent = currency.format(totalSavings);
  spendingTotal.textContent = currency.format(monthDeductions);
  adjustmentTotal.textContent = currency.format(getLatestAdjustmentAmount());
}

function renderOwedSummary() {
  if (!owedTotal) {
    return;
  }
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const nextFriday = getNextFriday(new Date());
  const owed = computeOwedForRecentMonths(currentYear, currentMonthIndex, 1, 1, nextFriday);
  owedTotal.textContent = currency.format(owed);
  if (owedLabel) {
    const formatted = nextFriday.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    owedLabel.textContent = `Unpaid due by next Friday (${formatted})`;
  }
  renderOwedWeeksList(currentYear, currentMonthIndex, nextFriday);
}

function computeOwedForRecentMonths(year, monthIndex, monthsBack, arrearsMonths = 0, referenceDate) {
  ensureWeeklyPaid();
  const weekKeys = new Set();
  const nextFriday = getNextFriday(referenceDate || new Date());
  let total = 0;
  for (let offset = arrearsMonths; offset <= monthsBack + arrearsMonths; offset += 1) {
    const target = shiftMonth(year, monthIndex, -offset);
    const weeks = buildWeeks(target.year, target.monthIndex);
    weeks.forEach((week) => {
      const weekKey = toDateKey(week.start);
      if (weekKeys.has(weekKey)) {
        return;
      }
      weekKeys.add(weekKey);
      if (week.workedDays <= 0) {
        return;
      }
      if (state.weeklyPaid?.[weekKey]) {
        return;
      }
      const payDate = getWeekPayDate(week.start);
      const dueDate = addMonths(payDate, PAY_ARREARS_MONTHS);
      if (dueDate > nextFriday) {
        return;
      }
      if (!isOnOrAfterCutoff(week.end, UNPAID_CUTOFF_DATE)) {
        return;
      }
      total += week.savings;
    });
  }
  return total;
}

function renderOwedWeeksList(year, monthIndex, cutoffDate) {
  if (!owedWeeks) {
    return;
  }
  const weeks = getUnpaidWeeksForRecentMonths(year, monthIndex, 1, 1, cutoffDate);
  owedWeeks.innerHTML = "";
  if (!weeks.length) {
    const empty = document.createElement("div");
    empty.className = "owed-weeks-item";
    empty.textContent = "No unpaid weeks";
    owedWeeks.appendChild(empty);
    return;
  }
  weeks.forEach((week) => {
    const item = document.createElement("div");
    item.className = "owed-weeks-item";

    const label = document.createElement("span");
    label.textContent = `${formatShortDate(week.start)} - ${formatShortDate(week.end)}`;

    const amount = document.createElement("strong");
    amount.textContent = currency.format(week.amount);

    item.appendChild(label);
    item.appendChild(amount);
    owedWeeks.appendChild(item);
  });
}

function getUnpaidWeeksForRecentMonths(year, monthIndex, monthsBack, arrearsMonths = 0, referenceDate) {
  ensureWeeklyPaid();
  const weekKeys = new Set();
  const nextFriday = getNextFriday(referenceDate || new Date());
  const matches = [];
  for (let offset = arrearsMonths; offset <= monthsBack + arrearsMonths; offset += 1) {
    const target = shiftMonth(year, monthIndex, -offset);
    const weeks = buildWeeks(target.year, target.monthIndex);
    weeks.forEach((week) => {
      const weekKey = toDateKey(week.start);
      if (weekKeys.has(weekKey)) {
        return;
      }
      weekKeys.add(weekKey);
      if (week.workedDays <= 0) {
        return;
      }
      if (state.weeklyPaid?.[weekKey]) {
        return;
      }
      const payDate = getWeekPayDate(week.start);
      const dueDate = addMonths(payDate, PAY_ARREARS_MONTHS);
      if (dueDate > nextFriday) {
        return;
      }
      if (!isOnOrAfterCutoff(week.end, UNPAID_CUTOFF_DATE)) {
        return;
      }
      matches.push({ start: week.start, end: week.end, amount: week.savings });
    });
  }
  return matches;
}

function getNextFriday(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  copy.setDate(copy.getDate() + daysUntilFriday);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekPayDate(weekStart) {
  const payDate = new Date(weekStart);
  payDate.setDate(payDate.getDate() + 4);
  payDate.setHours(0, 0, 0, 0);
  return payDate;
}

function addMonths(date, months) {
  const copy = new Date(date);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const daysInMonth = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, daysInMonth));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isOnOrAfterCutoff(date, cutoff) {
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  const limit = new Date(cutoff);
  limit.setHours(0, 0, 0, 0);
  return compare >= limit;
}

function renderMonthlyOutlook(year, monthIndex) {
  const pastMonths = [];
  for (let offset = 3; offset >= 1; offset -= 1) {
    pastMonths.push(shiftMonth(year, monthIndex, -offset));
  }

  const forecastMonths = [];
  for (let offset = 0; offset <= 12; offset += 1) {
    forecastMonths.push(shiftMonth(year, monthIndex, offset));
  }

  monthlyList.innerHTML = "";

  const allMonths = [...pastMonths, ...forecastMonths];
  let runningTotal = 0;
  allMonths.forEach((month) => {
    const prevMonth = shiftMonth(month.year, month.monthIndex, -1);
    const prevOffset = month.offset - 1;
    const prevStats = computeMonthStats(prevMonth.year, prevMonth.monthIndex, null);
    const useForecast = prevOffset > 0;
    const recordedDays = countRecordedDays(prevMonth.year, prevMonth.monthIndex);
    const expectedDays = expectedWorkedDays(prevMonth.year, prevMonth.monthIndex);
    const workedDays = useForecast && recordedDays === 0 ? expectedDays : prevStats.workedDays;
    const savings = workedDays * (state.savingsPerDay || 0);
    const billsPerDay = expectedDays ? (state.monthlyBills || 0) / expectedDays : 0;
    const missedDays = Math.max(0, expectedDays - workedDays);
    const billsShortfall = billsPerDay * missedDays;
    const netForMonth = savings - billsShortfall;
    const deductions = getDeductionsForMonth(month.year, month.monthIndex);
    const startBalance = runningTotal;
    const afterNet = startBalance + netForMonth;
    const adjustment = getLatestAdjustmentForMonth(month.year, month.monthIndex);
    const afterAdjustment = adjustment ? Number(adjustment.amount) || 0 : afterNet;
    const finalBalance = afterAdjustment - deductions;
    runningTotal = finalBalance;
    const totalForMonth = netForMonth;

    const row = document.createElement("div");
    row.className = "monthly-row";
    if (month.offset === 0) {
      row.classList.add("current");
    }

    const label = document.createElement("span");
    label.textContent = month.label;

    const days = document.createElement("span");
    days.textContent = `${workedDays} worked day${workedDays === 1 ? "" : "s"} in ${prevMonth.label}`;

    const total = document.createElement("span");
    total.className = "monthly-total";
    total.textContent = `Savings ${currency.format(totalForMonth)}`;

    const accumulated = document.createElement("span");
    accumulated.className = "monthly-accumulated";
    accumulated.textContent = `Balance ${currency.format(finalBalance)}`;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "monthly-toggle";
    toggle.textContent = ">";
    const breakdownId = `monthly-breakdown-${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}`;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", breakdownId);
    toggle.setAttribute("aria-label", `Show balance breakdown for ${month.label}`);

    row.appendChild(label);
    row.appendChild(days);
    row.appendChild(total);
    row.appendChild(accumulated);
    row.appendChild(toggle);

    monthlyList.appendChild(row);

    const breakdown = document.createElement("div");
    breakdown.className = "monthly-breakdown";
    breakdown.id = breakdownId;

    const breakdownItems = [
      { label: "Start balance", value: currency.format(startBalance) },
      { label: "Worked income", value: currency.format(savings) },
      { label: "Bills shortfall", value: currency.format(-billsShortfall) },
      { label: "Net savings", value: currency.format(netForMonth) },
      {
        label: adjustment
          ? `Adjustment set (${formatShortDate(adjustment.date)})`
          : "Adjustment",
        value: adjustment ? currency.format(Number(adjustment.amount) || 0) : "None",
      },
      { label: "Deductions", value: currency.format(-deductions) },
      { label: "End balance", value: currency.format(finalBalance) },
    ];

    breakdownItems.forEach((item) => {
      const entry = document.createElement("div");
      entry.className = "monthly-breakdown-item";

      const entryLabel = document.createElement("span");
      entryLabel.textContent = item.label;

      const entryValue = document.createElement("strong");
      entryValue.textContent = item.value;

      entry.appendChild(entryLabel);
      entry.appendChild(entryValue);
      breakdown.appendChild(entry);
    });

    toggle.addEventListener("click", () => {
      const isOpen = breakdown.classList.toggle("open");
      toggle.textContent = isOpen ? "v" : ">";
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    monthlyList.appendChild(breakdown);
  });
}

function buildWeeks(year, monthIndex) {
  const weeks = [];
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  let currentWeek = null;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const weekStart = startOfWeek(date);

    if (!currentWeek || weekStart.getTime() !== currentWeek.start.getTime()) {
      if (currentWeek) {
        currentWeek.end = endOfWeek(currentWeek.start);
        currentWeek.savings = currentWeek.workedDays * (state.savingsPerDay || 0);
        weeks.push(currentWeek);
      }
      currentWeek = {
        start: weekStart,
        end: null,
        paidDays: 0,
        workedDays: 0,
        holidayDays: 0,
        expectedDays: 0,
      };
    }

    const status = getDayStatus(toDateKey(date));
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday) {
      currentWeek.expectedDays += 1;
    }
    if (status === "worked") {
      currentWeek.paidDays += 1;
      currentWeek.workedDays += 1;
    } else if (status === "holiday" && state.holidayPaid) {
      currentWeek.paidDays += 1;
      currentWeek.holidayDays += 1;
    } else if (status === "holiday") {
      currentWeek.holidayDays += 1;
    }
  }

  if (currentWeek) {
    currentWeek.end = endOfWeek(currentWeek.start);
    currentWeek.savings = currentWeek.workedDays * (state.savingsPerDay || 0);
    weeks.push(currentWeek);
  }

  return weeks;
}

function computeMonthStats(year, monthIndex, weekCount) {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let paidDays = 0;
  let workedDays = 0;
  let holidayDays = 0;
  const safeWeekCount = weekCount || buildWeeks(year, monthIndex).length;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const status = getDayStatus(toDateKey(date));
    if (status === "worked") {
      paidDays += 1;
      workedDays += 1;
    } else if (status === "holiday" && state.holidayPaid) {
      paidDays += 1;
      holidayDays += 1;
    } else if (status === "holiday") {
      holidayDays += 1;
    }
  }

  const expectedDays = expectedWorkedDays(year, monthIndex);
  const billsPerDay = expectedDays ? (state.monthlyBills || 0) / expectedDays : 0;
  const missedDays = Math.max(0, expectedDays - workedDays);
  const savings = workedDays * (state.savingsPerDay || 0);

  return {
    paidDays,
    workedDays,
    holidayDays,
    expectedDays,
    missedDays,
    savings,
    billsPerWeek: safeWeekCount ? (state.monthlyBills || 0) / safeWeekCount : 0,
    billsPerDay,
    netSavings: savings - billsPerDay * missedDays,
  };
}

function getNextStatus(current) {
  const index = STATUS_CYCLE.indexOf(current);
  const nextIndex = (index + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
}

function getStatusLabel(status, compact, isBankHoliday) {
  if (isBankHoliday) {
    return "BANK";
  }
  if (!compact) {
    return status === "off" ? "off" : status;
  }
  if (status === "worked") {
    return "WORK";
  }
  if (status === "holiday") {
    return "HOL";
  }
  return "OFF";
}

function getDayStatus(dateKey) {
  if (isBankHolidayDate(dateKey)) {
    return "holiday";
  }
  if (dateKey in state.days) {
    return state.days[dateKey];
  }
  return "off";
}

function isBankHolidayDate(dateKey) {
  return BANK_HOLIDAYS.has(dateKey);
}

function parseMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function getMondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const offset = getMondayIndex(copy);
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(weekStart) {
  const copy = new Date(weekStart);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonth(year, monthIndex, offset) {
  const date = new Date(year, monthIndex + offset, 1);
  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    label: date.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    offset,
  };
}

function formatMonthValue(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getDefaultSpendingDate() {
  const fallback = new Date();
  const monthValue = monthPicker?.value;
  if (!monthValue) {
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const { year, monthIndex } = parseMonth(monthValue);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function countRecordedDays(year, monthIndex) {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let recorded = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const dateKey = toDateKey(date);
    if (dateKey in state.days) {
      recorded += 1;
    }
  }
  return recorded;
}

function computeSavingsToDate(year, monthIndex) {
  let total = 0;
  for (let i = 0; i <= monthIndex; i += 1) {
    const stats = computeMonthStats(year, i, null);
    total += stats.savings;
  }
  return total;
}

function expectedWorkedDays(year, monthIndex) {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  let worked = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday) {
      worked += 1;
    }
  }
  return worked;
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      savingsPerDay: stored?.savingsPerDay ?? 100,
      monthlyBills: stored?.monthlyBills ?? 3000,
      spendingItems: stored?.spendingItems ?? null,
      spendingToDate: stored?.spendingToDate ?? 0,
      adjustments: stored?.adjustments ?? null,
      weeklyPaid: stored?.weeklyPaid ?? {},
      holidayPaid: stored?.holidayPaid ?? false,
      days: stored?.days ?? {},
      selectedMonth: stored?.selectedMonth,
    };
  } catch (error) {
    return {
      savingsPerDay: 100,
      monthlyBills: 3000,
      spendingItems: null,
      spendingToDate: 0,
      adjustments: null,
      weeklyPaid: {},
      holidayPaid: false,
      days: {},
      selectedMonth: null,
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!isApplyingRemote) {
    syncRemoteState();
  }
}

function refreshFromState() {
  monthlyBillsInput.value = state.monthlyBills ?? 3000;
  holidayPaidToggle.checked = Boolean(state.holidayPaid);
  if (state.selectedMonth) {
    monthPicker.value = state.selectedMonth;
  }
  ensureSpendingItems();
  renderSpendingInputs();
  ensureAdjustments();
  renderAdjustmentInputs();
  const { year } = parseMonth(monthPicker.value);
  seedWorkedDaysFromJanuary(year);
}

function createSupabaseClient() {
  if (!window.supabase) {
    return null;
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadRemoteState() {
  if (!supabaseClient) {
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .select("data")
      .eq("id", SUPABASE_ROW_ID)
      .single();
    if (error || !data?.data) {
      updateLastSync("Not synced");
      return;
    }
    isApplyingRemote = true;
    applyRemoteState(data.data);
    saveState();
    isApplyingRemote = false;
    updateLastSync(new Date());
  } catch (error) {
    console.warn("Supabase load failed", error);
    updateLastSync("Sync failed");
  }
}

async function saveRemoteState() {
  if (!supabaseClient) {
    return;
  }
  try {
    const payload = {
      id: SUPABASE_ROW_ID,
      data: { ...state },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .upsert(payload, { onConflict: "id" });
    if (error) {
      updateLastSync("Sync failed");
      return;
    }
    updateLastSync(new Date());
  } catch (error) {
    console.warn("Supabase save failed", error);
    updateLastSync("Sync failed");
  }
}

function applyRemoteState(remote) {
  const defaults = loadState();
  Object.keys(defaults).forEach((key) => {
    state[key] = remote[key] ?? defaults[key];
  });
}

function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

function updateLastSync(value) {
  if (!lastSync) {
    return;
  }
  if (value instanceof Date) {
    lastSyncTime = value;
    lastSync.textContent = `Synced ${formatRelativeTime(value)}`;
    return;
  }
  lastSync.textContent = value;
}

function formatRelativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 30000) {
    return "just now";
  }
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function parseNumber(value) {
  const cleaned = value.replace(/[^0-9]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB", {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(value);
}

function ensureSpendingItems() {
  const defaultDate = getDefaultSpendingDate();
  if (Array.isArray(state.spendingItems) && state.spendingItems.length) {
    const needsNormalize = state.spendingItems.some(
      (item) => typeof item === "number" || !item || !item.date
    );
    if (!needsNormalize) {
      return;
    }
    state.spendingItems = state.spendingItems.map((item) => normalizeSpendingItem(item, defaultDate));
    saveState();
    return;
  }
  const legacyValue = Number(state.spendingToDate || 0);
  state.spendingItems = [{ amount: legacyValue, note: "", date: defaultDate }];
  saveState();
}

function ensureWeeklyPaid() {
  if (!state.weeklyPaid || typeof state.weeklyPaid !== "object") {
    state.weeklyPaid = {};
    saveState();
  }
}

function normalizeSpendingItem(item, defaultDate) {
  if (typeof item === "number") {
    return { amount: item, note: "", date: defaultDate };
  }
  const safeAmount = Number(item?.amount) || 0;
  const safeNote = item?.note || "";
  const candidateDate = item?.date;
  const parsed = candidateDate ? new Date(candidateDate) : null;
  const safeDate =
    parsed && !Number.isNaN(parsed.getTime()) ? candidateDate : defaultDate;
  return { amount: safeAmount, note: safeNote, date: safeDate };
}

function renderSpendingInputs() {
  ensureSpendingItems();
  spendingItem0.value = formatNumber(state.spendingItems[0]?.amount || 0);
  spendingItem0.oninput = () => {
    const numeric = parseNumber(spendingItem0.value);
    state.spendingItems[0].amount = numeric;
    spendingItem0.value = formatNumber(numeric);
    saveState();
    const selected = parseMonth(monthPicker.value);
    renderSummaries(selected.year, selected.monthIndex);
    renderMonthlyOutlook(selected.year, selected.monthIndex);
  };
  spendingItem0.onchange = () => {
    showSpendingAlert();
  };
  spendingDate0.value = state.spendingItems[0]?.date || getDefaultSpendingDate();
  spendingDate0.oninput = () => {
    state.spendingItems[0].date = spendingDate0.value;
    saveState();
    const selected = parseMonth(monthPicker.value);
    renderSummaries(selected.year, selected.monthIndex);
    renderMonthlyOutlook(selected.year, selected.monthIndex);
  };
  spendingNote0.value = state.spendingItems[0]?.note || "";
  spendingNote0.oninput = () => {
    state.spendingItems[0].note = spendingNote0.value;
    saveState();
  };

  spendingList.innerHTML = "";
  state.spendingItems.slice(1).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "input-row";

    const wrapper = document.createElement("div");
    wrapper.className = "input-with-prefix";

    const prefix = document.createElement("span");
    prefix.textContent = "£";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.value = formatNumber(item?.amount || 0);
    input.oninput = () => {
      const numeric = parseNumber(input.value);
      state.spendingItems[index + 1].amount = numeric;
      input.value = formatNumber(numeric);
      saveState();
      const selected = parseMonth(monthPicker.value);
      renderSummaries(selected.year, selected.monthIndex);
      renderMonthlyOutlook(selected.year, selected.monthIndex);
    };
    input.onchange = () => {
      showSpendingAlert();
    };

    const note = document.createElement("input");
    note.type = "text";
    note.className = "spending-note";
    note.placeholder = "What for?";
    note.value = item?.note || "";
    note.oninput = () => {
      state.spendingItems[index + 1].note = note.value;
      saveState();
    };

    const date = document.createElement("input");
    date.type = "date";
    date.className = "date-input";
    date.value = item?.date || getDefaultSpendingDate();
    date.oninput = () => {
      state.spendingItems[index + 1].date = date.value;
      saveState();
      const selected = parseMonth(monthPicker.value);
      renderSummaries(selected.year, selected.monthIndex);
      renderMonthlyOutlook(selected.year, selected.monthIndex);
    };

    wrapper.appendChild(prefix);
    wrapper.appendChild(input);
    row.appendChild(wrapper);
    row.appendChild(date);
    row.appendChild(note);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.onclick = () => removeSpendingAtIndex(index + 1);
    row.appendChild(remove);

    spendingList.appendChild(row);
  });
}

function getDeductionsForMonth(year, monthIndex) {
  ensureSpendingItems();
  return state.spendingItems.reduce((sum, item) => {
    if (!item?.date) {
      return sum;
    }
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) {
      return sum;
    }
    if (date.getFullYear() === year && date.getMonth() === monthIndex) {
      return sum + (Number(item.amount) || 0);
    }
    return sum;
  }, 0);
}

function removeSpendingAtIndex(index) {
  if (state.spendingItems.length <= 1) {
    state.spendingItems[0].amount = 0;
    state.spendingItems[0].note = "";
  } else {
    state.spendingItems.splice(index, 1);
  }
  saveState();
  renderSpendingInputs();
  const selected = parseMonth(monthPicker.value);
  renderSummaries(selected.year, selected.monthIndex);
}

function showSpendingAlert() {
  if (!spendingToast) {
    return;
  }
  spendingToast.textContent = "WTF Hols!! spending again";
  spendingToast.classList.add("show");
  clearTimeout(spendingToast.dismissTimer);
  spendingToast.dismissTimer = setTimeout(() => {
    spendingToast.classList.remove("show");
  }, 2200);
}

function ensureAdjustments() {
  if (Array.isArray(state.adjustments) && state.adjustments.length) {
    return;
  }
  state.adjustments = [{ date: "", amount: 0 }];
  saveState();
}

function renderAdjustmentInputs() {
  ensureAdjustments();
  adjustmentDate0.value = state.adjustments[0]?.date || "";
  adjustmentAmount0.value = formatNumber(state.adjustments[0]?.amount || 0);
  adjustmentDate0.oninput = () => {
    state.adjustments[0].date = adjustmentDate0.value;
    saveState();
    const selected = parseMonth(monthPicker.value);
    renderMonthlyOutlook(selected.year, selected.monthIndex);
  };
  adjustmentAmount0.oninput = () => {
    const numeric = parseNumber(adjustmentAmount0.value);
    state.adjustments[0].amount = numeric;
    adjustmentAmount0.value = formatNumber(numeric);
    saveState();
    const selected = parseMonth(monthPicker.value);
    renderSummaries(selected.year, selected.monthIndex);
    renderMonthlyOutlook(selected.year, selected.monthIndex);
  };

  adjustmentList.innerHTML = "";
  state.adjustments.slice(1).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "adjustment-row";

    const date = document.createElement("input");
    date.type = "date";
    date.className = "date-input";
    date.value = item?.date || "";
    date.oninput = () => {
      state.adjustments[index + 1].date = date.value;
      saveState();
      const selected = parseMonth(monthPicker.value);
      renderMonthlyOutlook(selected.year, selected.monthIndex);
    };

    const wrapper = document.createElement("div");
    wrapper.className = "input-with-prefix";

    const prefix = document.createElement("span");
    prefix.textContent = "£";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.value = formatNumber(item?.amount || 0);
    input.oninput = () => {
      const numeric = parseNumber(input.value);
      state.adjustments[index + 1].amount = numeric;
      input.value = formatNumber(numeric);
      saveState();
      const selected = parseMonth(monthPicker.value);
      renderSummaries(selected.year, selected.monthIndex);
      renderMonthlyOutlook(selected.year, selected.monthIndex);
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.onclick = () => removeAdjustmentAtIndex(index + 1);

    wrapper.appendChild(prefix);
    wrapper.appendChild(input);
    row.appendChild(date);
    row.appendChild(wrapper);
    row.appendChild(remove);
    adjustmentList.appendChild(row);
  });
}

function getTotalAdjustments() {
  ensureAdjustments();
  return state.adjustments.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
}

function getLatestAdjustmentAmount() {
  const latest = getLatestAdjustmentOverall();
  return latest ? Number(latest.amount) || 0 : 0;
}

function getLatestAdjustmentForMonth(year, monthIndex) {
  ensureAdjustments();
  let latest = null;
  state.adjustments.forEach((item) => {
    if (!item?.date) {
      return;
    }
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    if (date.getFullYear() === year && date.getMonth() === monthIndex) {
      if (!latest || date > latest.date) {
        latest = { date, amount: item.amount };
      }
    }
  });
  return latest;
}

function getLatestAdjustmentOverall() {
  ensureAdjustments();
  let latest = null;
  state.adjustments.forEach((item) => {
    if (!item?.date) {
      return;
    }
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    if (!latest || date > latest.date) {
      latest = { date, amount: item.amount };
    }
  });
  return latest;
}

function applyAdjustmentForMonth(currentTotal, year, monthIndex) {
  const latest = getLatestAdjustmentForMonth(year, monthIndex);
  if (!latest) {
    return currentTotal;
  }
  return Number(latest.amount) || 0;
}

function computeAdjustedSavingsToDate(year, monthIndex) {
  let total = 0;
  for (let i = 0; i <= monthIndex; i += 1) {
    const stats = computeMonthStats(year, i, null);
    total += stats.netSavings;
    total = applyAdjustmentForMonth(total, year, i);
    total -= getDeductionsForMonth(year, i);
  }
  return total;
}

function removeAdjustmentAtIndex(index) {
  if (state.adjustments.length <= 1) {
    state.adjustments[0].amount = 0;
    state.adjustments[0].date = "";
  } else {
    state.adjustments.splice(index, 1);
  }
  saveState();
  renderAdjustmentInputs();
  const selected = parseMonth(monthPicker.value);
  renderSummaries(selected.year, selected.monthIndex);
  renderMonthlyOutlook(selected.year, selected.monthIndex);
}

function seedWorkedDaysFromJanuary(year) {
  if (!state.seededYears) {
    state.seededYears = [];
  }
  if (state.seededYears.includes(year)) {
    return;
  }

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const date = new Date(start);

  while (date <= end) {
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const dateKey = toDateKey(date);
    if (isWeekday && !BANK_HOLIDAYS.has(dateKey) && !(dateKey in state.days)) {
      state.days[dateKey] = "worked";
    }
    date.setDate(date.getDate() + 1);
  }

  state.seededYears.push(year);
  saveState();
}
