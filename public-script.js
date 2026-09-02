// ============================================================
// PUBLIC READ-ONLY CALENDAR
// This connects to the SAME Firebase project as your main
// booking site, but only ever READS data. It never signs
// anyone in and never writes to the database.
// ============================================================

// Firebase Configuration — use the SAME values as your main site's script.js
const firebaseConfig = {
  apiKey: "AIzaSyCIm7uCVfADnOx-AgMkNKs1nfKYEB0kbRs",
  authDomain: "sprint-sign-up.firebaseapp.com",
  databaseURL: "https://sprint-sign-up-default-rtdb.firebaseio.com",
  projectId: "sprint-sign-up",
  storageBucket: "sprint-sign-up.firebasestorage.app",
  messagingSenderId: "422000960325",
  appId: "1:422000960325:web:0c04c82e5d3d5cc8cf942c",
  measurementId: "G-YPQC9GB1GJ"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ============================================================
// VIEW LOCK — edit this per event
// Set enabled: true and fill in a start/end date to restrict
// what the public can navigate to. Set enabled: false to let
// people browse the whole calendar with no restriction.
// Dates are inclusive, format: 'YYYY-MM-DD'
// ============================================================
const VIEW_LOCK = {
  enabled: true,
  startDate: '2026-08-30',
  endDate: '2026-10-01'
};

const lockStart = VIEW_LOCK.enabled ? new Date(VIEW_LOCK.startDate + 'T00:00:00') : null;
const lockEnd = VIEW_LOCK.enabled ? new Date(VIEW_LOCK.endDate + 'T23:59:59') : null;

function isDateAllowed(date) {
  if (!VIEW_LOCK.enabled) return true;
  return date >= lockStart && date <= lockEnd;
}

function isMonthAllowed(year, month) {
  if (!VIEW_LOCK.enabled) return true;
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
  return lastOfMonth >= lockStart && firstOfMonth <= lockEnd;
}

function isWeekAllowed(weekStart) {
  if (!VIEW_LOCK.enabled) return true;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd >= lockStart && weekStart <= lockEnd;
}

let currentWeekStart = null;
let currentMonthDate = null;
let currentView = 'month';
let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let allBookings = [];
let userProfiles = {};
let highlightedColumn = null;

const commonTimezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland'
];

function init() {
  populateTimezoneDropdown();

  const startingDate = (VIEW_LOCK.enabled && !isDateAllowed(new Date()))
    ? new Date(lockStart)
    : new Date();

  currentMonthDate = new Date(startingDate);
  setCurrentWeek(startingDate);
  loadBookingsFromStorage();
  loadProfilesFromStorage();
}

function populateTimezoneDropdown() {
  const select = document.getElementById('timezoneSelect');
  select.innerHTML = '';

  commonTimezones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz;
    option.textContent = tz.replace(/_/g, ' ');
    if (tz === userTimezone) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  if (!commonTimezones.includes(userTimezone)) {
    const option = document.createElement('option');
    option.value = userTimezone;
    option.textContent = userTimezone.replace(/_/g, ' ') + ' (Detected)';
    option.selected = true;
    select.insertBefore(option, select.firstChild);
  }
}

function handleTimezoneChange() {
  userTimezone = document.getElementById('timezoneSelect').value;
  if (currentView === 'month') {
    renderMonthView();
  } else {
    renderCalendar();
  }
}

function switchToMonthView() {
  currentView = 'month';
  document.getElementById('monthView').classList.add('active');
  document.getElementById('weekView').classList.remove('active');
  document.getElementById('monthViewBtn').classList.add('active');
  document.getElementById('weekViewBtn').classList.remove('active');
  renderMonthView();
}

function switchToWeekView() {
  currentView = 'week';
  document.getElementById('monthView').classList.remove('active');
  document.getElementById('weekView').classList.add('active');
  document.getElementById('monthViewBtn').classList.remove('active');
  document.getElementById('weekViewBtn').classList.add('active');
  renderCalendar();
}

function changeMonth(direction) {
  if (!currentMonthDate) {
    currentMonthDate = new Date();
  }
  const candidate = new Date(currentMonthDate);
  candidate.setMonth(candidate.getMonth() + direction);

  if (!isMonthAllowed(candidate.getFullYear(), candidate.getMonth())) {
    return; // blocked by VIEW_LOCK — do nothing
  }

  currentMonthDate = candidate;
  renderMonthView();
}

function renderMonthView() {
  if (!currentMonthDate) {
    currentMonthDate = new Date();
  }

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('monthDisplay').textContent = `${monthNames[month]} ${year}`;
  updateMonthNavButtons(year, month);

  const monthCalendar = document.getElementById('monthCalendar');
  monthCalendar.innerHTML = '';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days.forEach(day => {
    const header = document.createElement('div');
    header.className = 'month-day-header';
    header.textContent = day;
    monthCalendar.appendChild(header);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dayDiv = document.createElement('div');
    dayDiv.className = 'month-day other-month';
    dayDiv.innerHTML = `<div class="month-day-number">${day}</div>`;
    monthCalendar.appendChild(dayDiv);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const dayDiv = document.createElement('div');
    dayDiv.className = 'month-day';

    if (date.getTime() === today.getTime()) {
      dayDiv.classList.add('today');
    }

    const bookingsOnDay = getBookingsForDay(date);

    let bookingHTML = '';
    if (bookingsOnDay.length > 0) {
      bookingHTML = `<div class="month-day-bookings">
        <span class="booking-indicator has-bookings"></span>
        ${bookingsOnDay.length} sprint${bookingsOnDay.length > 1 ? 's' : ''}
      </div>`;
    }

    dayDiv.innerHTML = `
      <div class="month-day-number">${day}</div>
      ${bookingHTML}
    `;

    if (isDateAllowed(date)) {
      dayDiv.onclick = () => jumpToWeek(date);
    } else {
      dayDiv.classList.add('locked-day');
    }
    monthCalendar.appendChild(dayDiv);
  }

  const totalCells = monthCalendar.children.length - 7;
  const remainingCells = 35 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'month-day other-month';
    dayDiv.innerHTML = `<div class="month-day-number">${day}</div>`;
    monthCalendar.appendChild(dayDiv);
  }
}

function updateMonthNavButtons(year, month) {
  const prevBtn = document.querySelector('#monthView .calendar-nav button:first-child');
  const nextBtn = document.querySelector('#monthView .calendar-nav button:last-child');
  if (!prevBtn || !nextBtn) return;

  const prevDate = new Date(year, month - 1, 1);
  const nextDate = new Date(year, month + 1, 1);
  prevBtn.disabled = !isMonthAllowed(prevDate.getFullYear(), prevDate.getMonth());
  nextBtn.disabled = !isMonthAllowed(nextDate.getFullYear(), nextDate.getMonth());
}

function updateWeekNavButtons() {
  const prevBtn = document.querySelector('#weekView .calendar-nav button:first-child');
  const nextBtn = document.querySelector('#weekView .calendar-nav button:last-child');
  if (!prevBtn || !nextBtn) return;

  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  prevBtn.disabled = !isWeekAllowed(prevWeekStart);
  nextBtn.disabled = !isWeekAllowed(nextWeekStart);
}

function getBookingsForDay(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const startUTC = localDateToUTC(startOfDay, userTimezone);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const endUTC = localDateToUTC(endOfDay, userTimezone);

  const uniqueBookings = {};
  allBookings.forEach(booking => {
    if (!booking || !booking.dateTimeUTC) {
      return;
    }
    const bookingTime = new Date(booking.dateTimeUTC).getTime();
    if (bookingTime >= new Date(startUTC).getTime() &&
        bookingTime <= new Date(endUTC).getTime()) {
      if (!uniqueBookings[booking.groupId]) {
        uniqueBookings[booking.groupId] = booking;
      }
    }
  });

  return Object.values(uniqueBookings);
}

function jumpToWeek(date) {
  setCurrentWeek(date);
  switchToWeekView();
  const dayOfWeek = date.getDay();
  highlightColumnFn(dayOfWeek);
}

function setCurrentWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  currentWeekStart = new Date(d.setDate(diff));
  currentWeekStart.setHours(0, 0, 0, 0);
  if (currentView === 'week') {
    renderCalendar();
  }
}

function changeWeek(direction) {
  const newDate = new Date(currentWeekStart);
  newDate.setDate(newDate.getDate() + (direction * 7));

  const candidateStart = new Date(newDate);
  const day = candidateStart.getDay();
  candidateStart.setDate(candidateStart.getDate() - day);
  candidateStart.setHours(0, 0, 0, 0);

  if (!isWeekAllowed(candidateStart)) {
    return; // blocked by VIEW_LOCK — do nothing
  }

  setCurrentWeek(newDate);
  highlightColumnFn(null);
}

function renderCalendar() {
  if (!currentWeekStart) {
    setCurrentWeek(new Date());
    return;
  }

  const calendar = document.getElementById('calendar');
  calendar.innerHTML = '';

  const endDate = new Date(currentWeekStart);
  endDate.setDate(endDate.getDate() + 6);
  document.getElementById('weekDisplay').textContent =
    `${formatDate(currentWeekStart)} - ${formatDate(endDate)}`;
  updateWeekNavButtons();

  const emptyHeader = document.createElement('div');
  emptyHeader.className = 'calendar-header';
  emptyHeader.textContent = 'Time';
  calendar.appendChild(emptyHeader);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = `${days[i]} ${date.getMonth() + 1}/${date.getDate()}`;
    header.dataset.dayIndex = i;

    const dayIsAllowed = isDateAllowed(date);
    if (dayIsAllowed) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        if (highlightedColumn === i) {
          highlightColumnFn(null);
        } else {
          highlightColumnFn(i);
        }
      });
    } else {
      header.classList.add('locked-day');
    }

    if (highlightedColumn === i) {
      header.classList.add('highlighted-column');
    }

    calendar.appendChild(header);
  }

  for (let hour = 0; hour < 24; hour++) {
    const timeLabel = document.createElement('div');
    timeLabel.className = 'time-label';
    timeLabel.textContent = formatHour(hour);
    calendar.appendChild(timeLabel);

    for (let day = 0; day < 7; day++) {
      const slot = document.createElement('div');
      slot.className = 'calendar-slot';

      const localDate = new Date(currentWeekStart);
      localDate.setDate(localDate.getDate() + day);
      localDate.setHours(hour, 0, 0, 0);

      const slotDateUTC = localDateToUTC(localDate, userTimezone);

      const slotId = `${day}-${hour}`;
      slot.dataset.slotId = slotId;
      slot.dataset.dayIndex = day;

      if (highlightedColumn === day) {
        slot.classList.add('highlighted-column');
      }

      const slotIsAllowed = isDateAllowed(localDate);
      if (!slotIsAllowed) {
        slot.classList.add('locked-day');
      }

      const booking = getBookingForSlot(slotDateUTC);

      if (booking) {
        slot.classList.add('booked');

        const groupBookings = allBookings.filter(b => b.groupId === booking.groupId)
          .sort((a, b) => new Date(a.dateTimeUTC) - new Date(b.dateTimeUTC));

        const bookingIndex = groupBookings.findIndex(b =>
          Math.abs(new Date(b.dateTimeUTC).getTime() - new Date(booking.dateTimeUTC).getTime()) < 60000
        );

        if (bookingIndex === 0) {
          slot.classList.add('booking-start');
          const profile = userProfiles[booking.userId];
          slot.innerHTML = `<span class="slot-name">${profile ? profile.name : booking.userName}</span>`;
        } else if (bookingIndex === groupBookings.length - 1) {
          slot.classList.add('booking-end');
          slot.classList.add('booking-middle');
        } else {
          slot.classList.add('booking-middle');
        }

        if (slotIsAllowed) {
          slot.addEventListener('click', () => showBookingInfo(booking));
        }
      }
      // No handlers attached to empty slots — this is view-only

      calendar.appendChild(slot);
    }
  }
}

function highlightColumnFn(dayIndex) {
  highlightedColumn = dayIndex;

  document.querySelectorAll('.calendar-header, .calendar-slot').forEach(element => {
    element.classList.remove('highlighted-column');

    if (dayIndex !== null && element.dataset.dayIndex == dayIndex) {
      element.classList.add('highlighted-column');
    }
  });
}

function showBookingInfo(booking) {
  const profile = userProfiles[booking.userId];

  let content = '<div class="booking-info-display">';
  if (profile) {
    content += `<p><strong>Name:</strong> ${profile.name}</p>`;
    const youtubeUrl = profile.youtubeUrl.startsWith('http') ? profile.youtubeUrl : `https://${profile.youtubeUrl}`;
    content += `<p><strong>YouTube:</strong> <a href="${youtubeUrl}" target="_blank" rel="noopener">${profile.youtubeHandle}</a></p>`;
  } else {
    content += `<p><strong>Name:</strong> ${booking.userName}</p>`;
  }
  content += '</div>';
  // Note: streamLink (the guest "join" link) is intentionally never shown here

  document.getElementById('bookingInfoContent').innerHTML = content;
  document.getElementById('bookingInfoModal').classList.add('active');
}

function closeBookingInfoModal() {
  document.getElementById('bookingInfoModal').classList.remove('active');
}

function localDateToUTC(localDate, timezone) {
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();
  const hour = localDate.getHours();
  const min = localDate.getMinutes();

  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;

  const utcDate = new Date(dateString + 'Z');

  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = tzFormatter.formatToParts(utcDate);
  const tzYear = parseInt(parts.find(p => p.type === 'year').value);
  const tzMonth = parseInt(parts.find(p => p.type === 'month').value) - 1;
  const tzDay = parseInt(parts.find(p => p.type === 'day').value);
  const tzHour = parseInt(parts.find(p => p.type === 'hour').value);
  const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);

  const offsetMs = (year - tzYear) * 365 * 24 * 60 * 60 * 1000 +
                   (month - tzMonth) * 30 * 24 * 60 * 60 * 1000 +
                   (day - tzDay) * 24 * 60 * 60 * 1000 +
                   (hour - tzHour) * 60 * 60 * 1000 +
                   (min - tzMinute) * 60 * 1000;

  const correctUTC = new Date(utcDate.getTime() + offsetMs);

  return correctUTC.toISOString();
}

function getBookingForSlot(utcString) {
  const slotTime = new Date(utcString).getTime();

  return allBookings.find(booking => {
    if (!booking || !booking.dateTimeUTC) {
      return false;
    }
    const bookingTime = new Date(booking.dateTimeUTC).getTime();
    return Math.abs(bookingTime - slotTime) < 60000;
  });
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${displayHour}:00 ${period}`;
}

function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// ---- READ-ONLY Firebase listeners ----
// These use .on('value') so the page updates live, exactly like the
// main site, but nothing here ever calls .set(), .push(), or .remove().

function loadBookingsFromStorage() {
  database.ref('bookings').on('value', (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      allBookings = [];
    } else if (Array.isArray(data)) {
      allBookings = data;
    } else if (typeof data === 'object') {
      allBookings = Object.values(data);
    } else {
      allBookings = [];
    }

    if (currentView === 'month') {
      renderMonthView();
    } else {
      renderCalendar();
    }
  });
}

function loadProfilesFromStorage() {
  database.ref('profiles').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      userProfiles = data;
    }
    // Re-render so names that load in after bookings still show up
    if (currentView === 'month') {
      renderMonthView();
    } else {
      renderCalendar();
    }
  });
}

init();
