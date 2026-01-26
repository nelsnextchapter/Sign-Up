// Firebase Configuration
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentUser = null;
let currentWeekStart = null;
let currentMonthDate = null;
let currentView = 'month';
let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let isSelecting = false;
let selectionStart = null;
let selectedSlots = new Set();
let allBookings = [];
let userProfiles = {};
let bookingToDelete = null;
let currentBookingGroup = null;
let pendingBookingSlots = null;
let currentViewingBooking = null;
let tooltipElement = null;
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
  loadBookingsFromStorage();
  loadProfilesFromStorage();
  populateTimezoneDropdown();
  currentMonthDate = new Date();
  setCurrentWeek(new Date());
  createTooltip();
}

function createTooltip() {
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'booking-tooltip';
  tooltipElement.style.display = 'none';
  document.body.appendChild(tooltipElement);
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      currentUser = {
        id: user.uid,
        name: user.displayName,
        email: user.email,
        picture: user.photoURL
      };
      
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('appSection').style.display = 'block';
      
      document.getElementById('userEmail').textContent = currentUser.email;
      document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
      
      // Check if owner - do this FIRST so button shows immediately
      checkIfOwner();
      
      // Check if user has a profile
      if (!userProfiles[currentUser.id]) {
        // First time user - show profile setup
        document.getElementById('profileModalTitle').textContent = 'Complete Your Profile';
        document.getElementById('profileCancelBtn').style.display = 'none';
        openProfileModal();
      } else {
        // Existing user - load their profile
        document.getElementById('userNameText').textContent = userProfiles[currentUser.id].name;
        currentMonthDate = new Date();
        setCurrentWeek(new Date());
        renderMonthView();
        
        // Show tutorial if they haven't disabled it (with slight delay to ensure DOM is ready)
        setTimeout(() => {
          shouldShowTutorial().then(shouldShow => {
            if (shouldShow) {
              showTutorial();
            }
          });
        }, 100);
      }
    })
    .catch((error) => {
      console.error('Error signing in:', error);
      alert('Sign in failed. Please try again.');
    });
}

function logout() {
  currentUser = null;
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('appSection').style.display = 'none';
}

function openProfileModal() {
  const profile = userProfiles[currentUser.id];
  if (profile) {
    document.getElementById('profileModalTitle').textContent = 'Edit Your Profile';
    document.getElementById('profileCancelBtn').style.display = 'block';
    document.getElementById('profileName').value = profile.name;
    document.getElementById('profileYoutubeHandle').value = profile.youtubeHandle;
    document.getElementById('profileYoutubeUrl').value = profile.youtubeUrl;
  } else {
    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profileYoutubeHandle').value = '';
    document.getElementById('profileYoutubeUrl').value = '';
  }
  document.getElementById('profileModal').classList.add('active');
}

function cancelProfile() {
  if (userProfiles[currentUser.id]) {
    document.getElementById('profileModal').classList.remove('active');
  }
}

function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const youtubeHandle = document.getElementById('profileYoutubeHandle').value.trim();
  const youtubeUrl = document.getElementById('profileYoutubeUrl').value.trim();

  if (!name || !youtubeHandle || !youtubeUrl) {
    alert('Please fill in all required fields');
    return;
  }

  userProfiles[currentUser.id] = {
    name: name,
    youtubeHandle: youtubeHandle,
    youtubeUrl: youtubeUrl
  };

  saveProfilesToStorage();
  document.getElementById('userNameText').textContent = name;
  document.getElementById('profileModal').classList.remove('active');

  // Initialize dates if first time saving profile
  if (!currentMonthDate) {
    currentMonthDate = new Date();
  }
  if (!currentWeekStart) {
    setCurrentWeek(new Date());
  }

  if (currentView === 'month') {
    renderMonthView();
  } else {
    renderCalendar();
  }
  
  // Show tutorial if it's the user's first time and they haven't disabled it
  shouldShowTutorial().then(shouldShow => {
    if (shouldShow) {
      showTutorial();
    }
  });
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
  currentMonthDate.setMonth(currentMonthDate.getMonth() + direction);
  renderMonthView();
}

function renderMonthView() {
  if (!currentUser) return;
  
  if (!currentMonthDate) {
    currentMonthDate = new Date();
  }
  
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  document.getElementById('monthDisplay').textContent = `${monthNames[month]} ${year}`;
  
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
    const hasMyBookings = bookingsOnDay.some(b => b.userId === currentUser.id);
    
    let bookingHTML = '';
    if (bookingsOnDay.length > 0) {
      const indicator = hasMyBookings ? 'has-my-bookings' : 'has-bookings';
      bookingHTML = `<div class="month-day-bookings">
        <span class="booking-indicator ${indicator}"></span>
        ${bookingsOnDay.length} booking${bookingsOnDay.length > 1 ? 's' : ''}
      </div>`;
    }
    
    dayDiv.innerHTML = `
      <div class="month-day-number">${day}</div>
      ${bookingHTML}
    `;
    
    dayDiv.onclick = () => jumpToWeek(date);
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

function getBookingsForDay(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const startUTC = localDateToUTC(startOfDay, userTimezone);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const endUTC = localDateToUTC(endOfDay, userTimezone);
  
  const uniqueBookings = {};
  allBookings.forEach(booking => {
    // ADD THIS CHECK - Skip undefined/null bookings
    if (!booking || !booking.dateTimeUTC) {
      return;
    }
    
    // KEEP EVERYTHING BELOW THIS
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
  // Highlight the clicked day's column
  const dayOfWeek = date.getDay();
  highlightColumn(dayOfWeek);
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
  setCurrentWeek(newDate);
  // Clear highlight when changing weeks
  highlightColumn(null);
}

function renderCalendar() {
  if (!currentUser) return;
  
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
    header.style.cursor = 'pointer';
    
    // Add click handler to toggle highlight
    header.addEventListener('click', () => {
      if (highlightedColumn === i) {
        highlightColumn(null); // Remove highlight if clicking same column
      } else {
        highlightColumn(i);
      }
    });
    
    // Apply highlight if this is the highlighted column
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
      slot.dataset.dateUtc = slotDateUTC;
      slot.dataset.dayIndex = day;
      
      // Apply highlight if this is the highlighted column
      if (highlightedColumn === day) {
        slot.classList.add('highlighted-column');
      }
      
      const booking = getBookingForSlot(slotDateUTC);
      
      if (booking) {
        slot.classList.add('booked');
        const isMyBooking = booking.userId === currentUser.id;
        if (isMyBooking) {
          slot.classList.add('my-booking');
        }
        
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
        
        slot.dataset.bookingId = booking.id;
        slot.dataset.groupId = booking.groupId;
        
        slot.addEventListener('mouseenter', (e) => showTooltip(e, booking));
        slot.addEventListener('mouseleave', hideTooltip);
        slot.addEventListener('click', (e) => showBookingInfo(booking));
      } else {
        slot.addEventListener('mousedown', (e) => startSelection(e, slotId));
        slot.addEventListener('mouseenter', () => continueSelection(slotId));
        slot.addEventListener('mouseup', () => endSelection());
      }
      
      calendar.appendChild(slot);
    }
  }
}

function highlightColumn(dayIndex) {
  highlightedColumn = dayIndex;
  
  // Update all calendar slots and headers
  document.querySelectorAll('.calendar-header, .calendar-slot').forEach(element => {
    element.classList.remove('highlighted-column');
    
    if (dayIndex !== null && element.dataset.dayIndex == dayIndex) {
      element.classList.add('highlighted-column');
    }
  });
}

function showTooltip(e, booking) {
  const profile = userProfiles[booking.userId];
  if (!profile) return;
  
  let content = `<strong>${profile.name}</strong><br>`;
  
  // Ensure YouTube URL has protocol
  const youtubeUrl = profile.youtubeUrl.startsWith('http') ? profile.youtubeUrl : `https://${profile.youtubeUrl}`;
  content += `YouTube: <a href="${youtubeUrl}" target="_blank">${profile.youtubeHandle}</a><br>`;
  
  if (booking.streamLink) {
    // Ensure stream link has protocol
    const streamUrl = booking.streamLink.startsWith('http') ? booking.streamLink : `https://${booking.streamLink}`;
    content += `Stream: <a href="${streamUrl}" target="_blank">Watch Live</a>`;
  }
  
  tooltipElement.innerHTML = content;
  tooltipElement.style.display = 'block';
  
  const rect = e.target.getBoundingClientRect();
  tooltipElement.style.left = rect.left + 'px';
  tooltipElement.style.top = (rect.top - tooltipElement.offsetHeight - 10) + 'px';
}

function hideTooltip() {
  tooltipElement.style.display = 'none';
}

function showBookingInfo(booking) {
  currentViewingBooking = booking;
  const profile = userProfiles[booking.userId];
  
  let content = '<div class="booking-info-display">';
  if (profile) {
    content += `<p><strong>Name:</strong> ${profile.name}</p>`;
    
    // Ensure YouTube URL has protocol
    const youtubeUrl = profile.youtubeUrl.startsWith('http') ? profile.youtubeUrl : `https://${profile.youtubeUrl}`;
    content += `<p><strong>YouTube:</strong> <a href="${youtubeUrl}" target="_blank">${profile.youtubeHandle}</a></p>`;
  } else {
    content += `<p><strong>Name:</strong> ${booking.userName}</p>`;
  }
  
  if (booking.streamLink) {
    // Ensure stream link has protocol
    const streamUrl = booking.streamLink.startsWith('http') ? booking.streamLink : `https://${booking.streamLink}`;
    content += `<p><strong>Stream:</strong> <a href="${streamUrl}" target="_blank">Watch Live</a></p>`;
  } else if (booking.userId === currentUser.id) {
    content += `<p><em>No join link added yet</em></p>`;
  }
  content += '</div>';
  
  if (booking.userId === currentUser.id) {
    content += '<button class="modal-btn primary" onclick="editStreamLink()" style="margin-bottom: 10px; width: 100%;">Edit Guest Join Link</button>';
    document.getElementById('deleteBookingBtn').style.display = 'block';
  } else {
    document.getElementById('deleteBookingBtn').style.display = 'none';
  }
  
  document.getElementById('bookingInfoContent').innerHTML = content;
  document.getElementById('bookingInfoModal').classList.add('active');
}

function editStreamLink() {
  document.getElementById('bookingInfoModal').classList.remove('active');
  document.getElementById('streamLinkModalTitle').textContent = 'Edit Guest Join Link';
  document.getElementById('streamLinkModalDescription').textContent = 'Update your guest join link for this booking.';
  document.getElementById('streamLinkInput').value = currentViewingBooking.streamLink || '';
  currentBookingGroup = currentViewingBooking.groupId;
  document.getElementById('streamLinkModal').classList.add('active');
}

function closeStreamLinkModal() {
  document.getElementById('streamLinkModal').classList.remove('active');
  currentBookingGroup = null;
  pendingBookingSlots = null;
  // Reset modal text to default
  document.getElementById('streamLinkModalTitle').textContent = 'Add Guest Join Link (Optional)';
  document.getElementById('streamLinkModalDescription').textContent = 'You can add your link for guests to join you on screen now or come back later to add it.';
}

function closeBookingInfoModal() {
  document.getElementById('bookingInfoModal').classList.remove('active');
  currentViewingBooking = null;
}

function deleteCurrentBooking() {
  if (currentViewingBooking) {
    showDeleteModal(currentViewingBooking.groupId);
    closeBookingInfoModal();
  }
}

function localDateToUTC(localDate, timezone) {
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();
  const hour = localDate.getHours();
  const min = localDate.getMinutes();
  
  // Build a date string
  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  
  // The trick: construct a Date assuming the time is in UTC, 
  // then ask what that moment looks like in the target timezone,
  // then calculate the difference
  const utcDate = new Date(dateString + 'Z'); // Treat input as UTC
  
  // See what this UTC time looks like in the target timezone
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
  
  // Calculate the offset: difference between what we wanted and what we got
  const offsetMs = (year - tzYear) * 365 * 24 * 60 * 60 * 1000 +
                   (month - tzMonth) * 30 * 24 * 60 * 60 * 1000 +
                   (day - tzDay) * 24 * 60 * 60 * 1000 +
                   (hour - tzHour) * 60 * 60 * 1000 +
                   (min - tzMinute) * 60 * 1000;
  
  // Adjust the UTC date by this offset
  const correctUTC = new Date(utcDate.getTime() + offsetMs);
  
  return correctUTC.toISOString();
}

function testConversion() {
  // Test: 6am EST should become 11am UTC
  const testDate = new Date(2026, 0, 25, 6, 0, 0); // Jan 25, 2026, 6:00 AM
  const result = localDateToUTC(testDate, 'America/New_York');
  console.log('Input: 6am EST on Jan 25, 2026');
  console.log('Output UTC:', result);
  console.log('Expected: Should show 11:00:00.000Z');
  
  const parsedBack = new Date(result);
  console.log('Parsed back:', parsedBack.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function getBookingForSlot(utcString) {
  const slotTime = new Date(utcString).getTime();
  
  return allBookings.find(booking => {
    // Skip undefined/null bookings
    if (!booking || !booking.dateTimeUTC) {
      return false;
    }
    const bookingTime = new Date(booking.dateTimeUTC).getTime();
    return Math.abs(bookingTime - slotTime) < 60000;
  });
}

function showDeleteModal(groupId) {
  const groupBookings = allBookings.filter(b => b.groupId === groupId);
  bookingToDelete = groupId;
  document.getElementById('deleteMessage').textContent = 
    `Are you sure you want to delete this booking? (${groupBookings.length} time slot${groupBookings.length > 1 ? 's' : ''})`;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  bookingToDelete = null;
  document.getElementById('deleteModal').classList.remove('active');
}

function confirmDelete() {
  if (bookingToDelete) {
    // Get all bookings in this group
    const bookingsToDelete = allBookings.filter(b => b.groupId === bookingToDelete);
    
    // Find the index of each booking in the array and delete them individually
    // We delete in reverse order to avoid index shifting issues
    const indices = [];
    allBookings.forEach((booking, index) => {
      if (booking.groupId === bookingToDelete) {
        indices.push(index);
      }
    });
    
    // Delete each booking individually from Firebase (in reverse order)
    // This triggers onDelete for each one, but only the FIRST sends an email
    indices.reverse().forEach(index => {
      database.ref(`bookings/${index}`).remove();
    });
    
    // Update local array immediately for UI
    allBookings = allBookings.filter(b => b.groupId !== bookingToDelete);
    
    closeDeleteModal();
    if (currentView === 'month') {
      renderMonthView();
    } else {
      renderCalendar();
    }
  }
}

function startSelection(e, slotId) {
  e.preventDefault();
  isSelecting = true;
  selectionStart = slotId;
  selectedSlots.clear();
  selectedSlots.add(slotId);
  updateSelectionDisplay();
}

function continueSelection(slotId) {
  if (!isSelecting) return;
  
  const [startDay, startHour] = selectionStart.split('-').map(Number);
  const [currentDay, currentHour] = slotId.split('-').map(Number);
  
  if (startDay !== currentDay) return;
  
  selectedSlots.clear();
  const minHour = Math.min(startHour, currentHour);
  const maxHour = Math.max(startHour, currentHour);
  
  for (let h = minHour; h <= maxHour; h++) {
    selectedSlots.add(`${startDay}-${h}`);
  }
  
  updateSelectionDisplay();
}

function endSelection() {
  if (!isSelecting) return;
  isSelecting = false;
  
  if (selectedSlots.size > 0) {
    pendingBookingSlots = Array.from(selectedSlots);
    document.getElementById('streamLinkModalTitle').textContent = 'Add Guest Join Link (Optional)';
    document.getElementById('streamLinkModalDescription').textContent = 'You can add your link for guests to join you on screen now or come back later to add it.';
    document.getElementById('streamLinkInput').value = '';
    document.getElementById('streamLinkModal').classList.add('active');
  }
  
  selectedSlots.clear();
  updateSelectionDisplay();
}

function updateSelectionDisplay() {
  document.querySelectorAll('.calendar-slot').forEach(slot => {
    slot.classList.remove('selecting');
    if (selectedSlots.has(slot.dataset.slotId) && !slot.classList.contains('booked')) {
      slot.classList.add('selecting');
    }
  });
}

function saveStreamLink() {
  const streamLink = document.getElementById('streamLinkInput').value.trim();
  
  if (currentBookingGroup) {
    // Editing existing booking
    allBookings.forEach(booking => {
      if (booking.groupId === currentBookingGroup) {
        booking.streamLink = streamLink;
      }
    });
    saveBookingsToStorage();
    closeStreamLinkModal();
    renderCalendar();
  } else if (pendingBookingSlots) {
    // Creating new booking
    createBookings(streamLink);
    closeStreamLinkModal();
  }
}

function createBookings(streamLink) {
  const groupId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  // Get the first and last slot for time range calculation
  const sortedSlots = Array.from(pendingBookingSlots).sort();
  const firstSlotId = sortedSlots[0];
  const lastSlotId = sortedSlots[sortedSlots.length - 1];
  
  const firstSlot = document.querySelector(`[data-slot-id="${firstSlotId}"]`);
  const lastSlot = document.querySelector(`[data-slot-id="${lastSlotId}"]`);
  
  const startTimeUTC = firstSlot ? firstSlot.dataset.dateUtc : null;
  const lastSlotTimeUTC = lastSlot ? lastSlot.dataset.dateUtc : null;
  
  // Calculate end time (last slot + 1 hour)
  const endTimeUTC = lastSlotTimeUTC ? 
    new Date(new Date(lastSlotTimeUTC).getTime() + 60 * 60 * 1000).toISOString() : 
    null;
  
  pendingBookingSlots.forEach(slotId => {
    const slot = document.querySelector(`[data-slot-id="${slotId}"]`);
    if (slot && !slot.classList.contains('booked')) {
      const utcString = slot.dataset.dateUtc;
      
      const booking = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        groupId: groupId,
        userId: currentUser.id,
        userName: userProfiles[currentUser.id]?.name || currentUser.name,
        userEmail: currentUser.email,
        dateTimeUTC: utcString,
        timezone: userTimezone,
        streamLink: streamLink,
        createdAt: new Date().toISOString(),
        // ADDED: Store full block info for deletion emails
        groupSize: pendingBookingSlots.length,
        groupStartTimeUTC: startTimeUTC,
        groupEndTimeUTC: endTimeUTC
      };
      
      allBookings.push(booking);
    }
  });
  
  saveBookingsToStorage();
  renderCalendar();
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${displayHour}:00 ${period}`;
}

function formatDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatDateTime(date) {
  const hour = date.getHours();
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${date.getMonth() + 1}/${date.getDate()} ${displayHour}:00 ${period}`;
}

function saveBookingsToStorage() {
  database.ref('bookings').set(allBookings);
}

function loadBookingsFromStorage() {
  database.ref('bookings').on('value', (snapshot) => {
    const data = snapshot.val();
    
    // Handle all cases: null, array, or object
    if (!data) {
      // No bookings exist - set to empty array
      allBookings = [];
    } else if (Array.isArray(data)) {
      // Already an array
      allBookings = data;
    } else if (typeof data === 'object') {
      // Convert object to array
      allBookings = Object.values(data);
    } else {
      // Fallback to empty array
      allBookings = [];
    }
    
    // Always render, even if empty
    if (currentView === 'month') {
      renderMonthView();
    } else {
      renderCalendar();
    }
  });
}

function saveProfilesToStorage() {
  database.ref('profiles').set(userProfiles);
}

function loadProfilesFromStorage() {
  database.ref('profiles').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      userProfiles = data;
    }
  });
}

document.addEventListener('mouseup', () => {
  if (isSelecting) {
    endSelection();
  }
});

// Tutorial System Variables
let currentTutorialStep = 0;
let tutorialSteps = [
  {
    title: "📅 Welcome to the Sprint Sign-Up System!",
    text: "This tutorial will guide you through all the features. You can skip anytime or restart the tutorial later using the yellow 'Help' button."
  },
  {
    title: "👤 Edit Your Profile",
    text: "Click 'Edit Profile' in the upper left to update your name, YouTube handle, and channel URL. This information is shown to others when they view your reservations."
  },
   {
    title: "🕐 Time Zone Selection",
    text: "You can easily select your time zone using the drop down at the top to view and create reservations in your local time."
  },
  {
    title: "🗓️ Month View",
    text: "This view shows the entire month at a glance. Days with existing reservations show colored dots - green for reservations you've made and blue for everyone else's. Click on any day to jump to that week."
  },
  {
    title: "📊 Week View",
    text: "Switch to Week View to see hourly time slots and sign up for sprints. You can toggle between the Month and Week views at any time."
  },
  {
    title: "✨ Column Highlighting",
    text: "Click on any date header in Week View to highlight that column in yellow. This helps you make sure you're reserving for the right day. Click the date header again to remove the highlight."
  },
  {
    title: "📝 How To Reserve Sprint Times",
    text: "In Week View: Click and drag to select consecutive time slots (do not individually select consective hours). After releasing, you'll be prompted to add an optional guest link. Click 'Save'. Now the reservation is created and you should receive a confirmation email! \n\nIMPORTANT: You cannot drag across different days. If you want to reserve time that crosses midnight (e.g., 10pm-3am), you must create two separate reservations: one for the hours on the first day and one for the hours on the next day."
  },
  {
    title: "🔗 Adding 'Join' Links for Guests",
    text: "Once you select your sprint time, you'll be prompted to add an optional guest link for others to join you on screen during your sprint. The guest's 'Join' link can be added when you reserve your sprint time OR at a later time by clicking on your reservation (green) and selecting 'Edit Guest Join Link'."
  },
  {
    title: "✏️ Viewing & Editing Bookings",
    text: "Your reservations appear in green, everyone else's is purple. Hover over any reservation to see quick info (name, YouTube channel, guest join link). Click on any reservation to see full details."
  },
  {
    title: "🗑️ Deleting Reservations",
    text: "Click on your reservation (green), then click 'Delete Reservation' in the popup. This will delete the entire reservation group (all consecutive hours you reserved together)."
  },
  {
    title: "🎉 You're All Set!",
    text: "That's everything! Remember, you can restart this tutorial anytime by clicking the 'Help' button. Happy Sprinting!"
  }
];

// Check if tutorial should be shown
function shouldShowTutorial() {
  if (!currentUser) return false;
  return new Promise((resolve) => {
    database.ref(`tutorialPreferences/${currentUser.id}`).once('value', (snapshot) => {
      const dontShow = snapshot.val();
      resolve(dontShow !== true);
    });
  });
}

// Show tutorial
function showTutorial() {
  currentTutorialStep = 0;
  document.getElementById('dontShowAgain').checked = false;
  document.getElementById('tutorialOverlay').classList.add('active');
  renderTutorialStep();
}

// Render current tutorial step
function renderTutorialStep() {
  const step = tutorialSteps[currentTutorialStep];
  document.getElementById('tutorialTitle').textContent = step.title;
  document.getElementById('tutorialText').innerHTML = step.text.replace(/\n/g, '<br>');
  
  // Update progress dots
  const progressContainer = document.getElementById('tutorialProgress');
  progressContainer.innerHTML = '';
  tutorialSteps.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    if (index === currentTutorialStep) {
      dot.classList.add('active');
    }
    progressContainer.appendChild(dot);
  });
  
  // Update buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const finishBtn = document.getElementById('finishBtn');
  
  if (currentTutorialStep === 0) {
    prevBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'inline-block';
  }
  
  if (currentTutorialStep === tutorialSteps.length - 1) {
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    finishBtn.style.display = 'none';
  }
}

// Next step
function nextStep() {
  if (currentTutorialStep < tutorialSteps.length - 1) {
    currentTutorialStep++;
    renderTutorialStep();
  }
}

// Previous step
function previousStep() {
  if (currentTutorialStep > 0) {
    currentTutorialStep--;
    renderTutorialStep();
  }
}

// Skip tutorial
function skipTutorial() {
  const dontShow = document.getElementById('dontShowAgain').checked;
  if (dontShow && currentUser) {
    database.ref(`tutorialPreferences/${currentUser.id}`).set(true);
  }
  document.getElementById('tutorialOverlay').classList.remove('active');
}

// Finish tutorial
function finishTutorial() {
  const dontShow = document.getElementById('dontShowAgain').checked;
  if (dontShow && currentUser) {
    database.ref(`tutorialPreferences/${currentUser.id}`).set(true);
  }
  document.getElementById('tutorialOverlay').classList.remove('active');
}

// Open tutorial from Help button
function openTutorialHelp() {
  showTutorial();
}

// Owner User ID - REPLACE WITH YOUR ACTUAL FIREBASE USER ID
const OWNER_USER_ID = 'lbEzkPeUELTjgyZIHWxuLik0G3v2';

function checkIfOwner() {
  const settingsBtn = document.getElementById('settingsBtn');
  if (currentUser && currentUser.id === OWNER_USER_ID) {
    settingsBtn.style.display = 'inline-block';
  } else {
    settingsBtn.style.display = 'none';
  }
}

function openSettingsModal() {
  // Load current settings from Realtime Database
  database.ref('/adminSettings').once('value', (snapshot) => {
    const settings = snapshot.val() || {};
    document.getElementById('emailNotificationsToggle').checked = settings.emailNotifications || false;
    document.getElementById('ownerEmail').value = settings.ownerEmail || '';
  });
  
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings() {
  const emailNotifications = document.getElementById('emailNotificationsToggle').checked;
  const ownerEmail = document.getElementById('ownerEmail').value.trim();
  
  if (emailNotifications && !ownerEmail) {
    alert('Please enter your email address to receive notifications');
    return;
  }
  
  database.ref('/adminSettings').set({
    emailNotifications: emailNotifications,
    ownerEmail: ownerEmail
  }).then(() => {
    alert('Settings saved successfully!');
    closeSettingsModal();
  }).catch((error) => {
    console.error('Error saving settings:', error);
    alert('Failed to save settings. Please try again.');
  });
}

    init();
