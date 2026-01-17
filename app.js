const STORAGE_KEY = "income-tracker-state";

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
const spendingItem0 = document.getElementById("spendingItem0");
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

const state = loadState();

init();

function init() {
  const now = new Date();
  const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  monthPicker.value = state.selectedMonth || monthValue;
  monthlyBillsInput.value = state.monthlyBills ?? 3000;
  holidayPaidToggle.checked = Boolean(state.holidayPaid);
  ensureSpendingItems();
  renderSpendingInputs();
  ensureAdjustments();
  renderAdjustmentInputs();

  const { year } = parseMonth(monthPicker.value);
  seedWorkedDaysFromJanuary(year);

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
    state.spendingItems.push({ amount: 0, note: "" });
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
    const status = getDayStatus(dateKey);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    if (isCompact && isWeekend) {
      continue;
    }

    const cell = document.createElement("div");
    cell.className = `day ${status}${isWeekend ? " disabled" : ""}`;
    cell.dataset.date = dateKey;

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;

    const statusLabel = document.createElement("span");
    statusLabel.className = "day-status";
    statusLabel.textContent = getStatusLabel(status, isCompact);

    cell.appendChild(number);
    cell.appendChild(statusLabel);

    if (!isWeekend) {
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
  const weeks = buildWeeks(year, monthIndex);
  const monthStats = computeMonthStats(year, monthIndex, weeks.length);

  weeklyList.innerHTML = "";

  weeks.forEach((week) => {
    const holidayDeduction = monthStats.billsPerDay * week.holidayDays;
    const netSavings = week.savings - holidayDeduction;

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

    row.appendChild(label);
    row.appendChild(days);
    row.appendChild(savingsTotal);
    row.appendChild(savings);
    row.appendChild(daily);
    row.appendChild(netSpan);

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

  savingsMonth.textContent = currency.format(monthStats.savings);
  const totalSavings = computeAdjustedSavingsToDate(year, monthIndex);
  const deductions = getTotalDeductions();
  const netSavings = totalSavings - deductions;
  savingsToDate.textContent = currency.format(netSavings);
  spendingTotal.textContent = currency.format(deductions);
  adjustmentTotal.textContent = currency.format(getLatestAdjustmentAmount());
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
    runningTotal += savings;
    runningTotal = applyAdjustmentForMonth(runningTotal, month.year, month.monthIndex);
    const totalForMonth = savings;

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
    accumulated.textContent = `Balance ${currency.format(runningTotal)}`;

    row.appendChild(label);
    row.appendChild(days);
    row.appendChild(total);
    row.appendChild(accumulated);

    monthlyList.appendChild(row);
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
      };
    }

    const status = getDayStatus(toDateKey(date));
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

  const billsPerDay = workedDays ? (state.monthlyBills || 0) / workedDays : 0;
  const savings = workedDays * (state.savingsPerDay || 0);

  return {
    paidDays,
    workedDays,
    holidayDays,
    savings,
    billsPerWeek: safeWeekCount ? (state.monthlyBills || 0) / safeWeekCount : 0,
    billsPerDay,
    netSavings: savings - billsPerDay * holidayDays,
  };
}

function getNextStatus(current) {
  const index = STATUS_CYCLE.indexOf(current);
  const nextIndex = (index + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
}

function getStatusLabel(status, compact) {
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
  if (dateKey in state.days) {
    return state.days[dateKey];
  }
  return BANK_HOLIDAYS.has(dateKey) ? "holiday" : "off";
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
    const dateKey = toDateKey(date);
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (isWeekday && !BANK_HOLIDAYS.has(dateKey)) {
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
      holidayPaid: false,
      days: {},
      selectedMonth: null,
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  if (Array.isArray(state.spendingItems) && state.spendingItems.length) {
    const needsNormalize = state.spendingItems.some((item) => typeof item === "number");
    if (!needsNormalize) {
      return;
    }
    state.spendingItems = state.spendingItems.map((item) =>
      typeof item === "number" ? { amount: item, note: "" } : item
    );
    saveState();
    return;
  }
  const legacyValue = Number(state.spendingToDate || 0);
  state.spendingItems = [{ amount: legacyValue, note: "" }];
  saveState();
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
  };
  spendingItem0.onchange = () => {
    showSpendingAlert();
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

    wrapper.appendChild(prefix);
    wrapper.appendChild(input);
    row.appendChild(wrapper);
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

function getTotalDeductions() {
  ensureSpendingItems();
  return state.spendingItems.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
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
  if (!latest) {
    return currentTotal;
  }
  return Number(latest.amount) || 0;
}

function computeAdjustedSavingsToDate(year, monthIndex) {
  let total = 0;
  for (let i = 0; i <= monthIndex; i += 1) {
    const stats = computeMonthStats(year, i, null);
    total += stats.savings;
    total = applyAdjustmentForMonth(total, year, i);
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
