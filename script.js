document.addEventListener('DOMContentLoaded', function() {
  const firebaseConfig = {
    // Your Firebase config here
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
  const db = firebase.database();

  const calendarEl = document.getElementById('calendar');
  const userNameInput = document.getElementById('userName');
  // const timeZoneSelect = document.getElementById('timeZone'); // If using manual TZ select

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek', // Or 'dayGridMonth' for month view; switchable
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    editable: false, // No drag-resize for now
    selectable: true, // Allow drag-select for booking
    select: function(info) { // On select range
      const userName = userNameInput.value.trim();
      if (!userName) {
        alert('Please enter your name.');
        return;
      }
      const start = info.start.toISOString(); // UTC
      const end = info.end.toISOString(); // UTC

      // Check for overlaps
      checkForOverlap(start, end).then(isAvailable => {
        if (isAvailable) {
          bookSlot(userName, start, end);
        } else {
          alert('Slot is already booked or overlaps with an existing booking.');
        }
      });
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      loadBookings(fetchInfo.start.toISOString().slice(0, 7), successCallback); // Load by month (YYYY-MM)
    },
    timeZone: 'local' // Display in user's local time zone
  });
  calendar.render();

// Auto-detect and populate time zone dropdown
const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const timeZoneSelect = document.getElementById('timeZone');

if (timeZoneSelect) {
  console.log('Detected timezone:', detectedTimeZone); // Check console to confirm

  try {
    const timeZones = Intl.supportedValuesOf('timeZone') || [];
    if (timeZones.length === 0) {
      console.warn('No time zones available from Intl');
      timeZoneSelect.innerHTML = '<option value="UTC">UTC (fallback)</option>';
    } else {
      timeZones.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz;
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'shortOffset'
        });
        const parts = formatter.formatToParts(now);
        const offset = parts.find(p => p.type === 'timeZoneName')?.value || '';
        option.textContent = `${tz.replace(/_/g, ' ')} ${offset}`;
        if (tz === detectedTimeZone) option.selected = true;
        timeZoneSelect.appendChild(option);
      });

      // Sort alphabetically
      const options = Array.from(timeZoneSelect.options);
      options.sort((a, b) => a.textContent.localeCompare(b.textContent));
      timeZoneSelect.innerHTML = '';
      options.forEach(opt => timeZoneSelect.appendChild(opt));

      // Add fallback at top if needed
      const fallback = document.createElement('option');
      fallback.value = detectedTimeZone;
      fallback.textContent = `Detected: ${detectedTimeZone}`;
      fallback.selected = true;
      timeZoneSelect.insertBefore(fallback, timeZoneSelect.firstChild);
    }
  } catch (err) {
    console.error('Error populating time zones:', err);
    timeZoneSelect.innerHTML = '<option value="UTC">UTC (error loading list)</option>';
  }
} else {
  console.error('Time zone select element not found in DOM');
}
  // Function to load bookings from Firebase for the current month
  function loadBookings(month, successCallback) {
    db.ref('bookings/' + month).on('value', snapshot => { // Real-time listener
      const events = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          child.forEach(hourSnapshot => {
            const booking = hourSnapshot.val();
            events.push({
              title: booking.name,
              start: booking.start,
              end: booking.end,
              color: 'red' // Booked color
            });
          });
        });
      }
      successCallback(events);
    });
  }

  // Check for overlapping bookings
  async function checkForOverlap(start, end) {
    const month = start.slice(0, 7);
    const snapshot = await db.ref('bookings/' + month).once('value');
    if (snapshot.exists()) {
      let overlap = false;
      snapshot.forEach(child => {
        child.forEach(hourSnapshot => {
          const booking = hourSnapshot.val();
          if ((start < booking.end && end > booking.start)) {
            overlap = true;
          }
        });
      });
      return !overlap;
    }
    return true;
  }

  // Book the slot
  function bookSlot(name, start, end) {
    const month = start.slice(0, 7);
    const day = start.slice(0, 10);
    const hourKey = start.replace(/[:.-]/g, ''); // Unique key for path
    db.ref(`bookings/${month}/${day}/${hourKey}`).set({ name, start, end })
      .then(() => alert('Slot booked successfully!'))
      .catch(err => alert('Error booking slot: ' + err.message));
  }
});
