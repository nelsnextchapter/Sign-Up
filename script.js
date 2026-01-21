document.addEventListener('DOMContentLoaded', function () {
    // === Your real Firebase config goes here ===
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
  const timeZoneSelect = document.getElementById('timeZone'); // Uncommented for use

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    editable: false,
    selectable: true,
    selectAllow: function(selectInfo) {
      // Only allow selection in views with time slots (not month)
      return selectInfo.view.type.startsWith('timeGrid');
    },
    select: function(info) {
      const userName = userNameInput.value.trim();
      if (!userName) {
        alert('Please enter your name.');
        return;
      }
      const start = info.start.toISOString();
      const end = info.end.toISOString();

      checkForOverlap(start, end).then(isAvailable => {
        if (isAvailable) {
          bookSlot(userName, start, end);
        } else {
          alert('Slot is already booked or overlaps with an existing booking.');
        }
      });
    },
    eventClick: function(info) {
      const userName = userNameInput.value.trim();
      if (!userName) {
        alert('Please enter your name to manage bookings.');
        return;
      }
      const booking = info.event;
      if (booking.title !== userName) {
        alert('You can only delete your own bookings.');
        return;
      }
      if (confirm(`Delete booking for ${booking.title} from ${booking.start.toLocaleString()} to ${booking.end.toLocaleString()}?`)) {
        deleteBooking(booking.extendedProps.dbPath); // We'll add dbPath when loading events
        info.event.remove(); // Remove from calendar immediately
      }
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const month = fetchInfo.start.toISOString().slice(0, 7);
      loadBookings(month, successCallback);
    },
    timeZone: 'local'
  });
  calendar.render();

  // Auto-detect browser time zone
  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Populate time zone dropdown dynamically
  if (timeZoneSelect) {
    const timeZones = Intl.supportedValuesOf('timeZone');
    
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
      if (tz === detectedTimeZone) {
        option.selected = true;
      }
      timeZoneSelect.appendChild(option);
    });

    // Optional: Sort alphabetically by display text
    const options = Array.from(timeZoneSelect.options);
    options.sort((a, b) => a.textContent.localeCompare(b.textContent));
    timeZoneSelect.innerHTML = '';
    options.forEach(opt => timeZoneSelect.appendChild(opt));
  }

  // Enter key on name input for convenience
  userNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (userNameInput.value.trim()) {
        alert('Name saved! Now select time slots on the calendar.');
        calendarEl.scrollIntoView({ behavior: 'smooth' });
      } else {
        alert('Please enter your name first.');
      }
    }
  });

  // Global real-time listener to refetch events on any DB change (for visibility)
  let currentMonthListener;
  calendar.on('datesSet', function(info) {
    const month = info.start.toISOString().slice(0, 7);
    if (currentMonthListener) currentMonthListener.off(); // Remove old listener
    currentMonthListener = db.ref('bookings/' + month).on('value', () => {
      calendar.refetchEvents(); // Refetch and re-render on change
    });
  });

  // Load bookings (updated to include dbPath for deletion)
  function loadBookings(month, successCallback) {
    db.ref('bookings/' + month).once('value').then(snapshot => { // Use once for initial load, on for real-time
      const events = [];
      if (snapshot.exists()) {
        snapshot.forEach(daySnap => {
          daySnap.forEach(hourSnap => {
            const booking = hourSnap.val();
            events.push({
              title: booking.name,
              start: booking.start,
              end: booking.end,
              color: 'red',
              extendedProps: { dbPath: hourSnap.ref.path } // Store path for deletion
            });
          });
        });
      }
      successCallback(events);
    });
  }

  // Check for overlap (unchanged)
  async function checkForOverlap(start, end) {
    const month = start.slice(0, 7);
    const snapshot = await db.ref('bookings/' + month).once('value');
    if (snapshot.exists()) {
      let overlap = false;
      snapshot.forEach(daySnap => {
        daySnap.forEach(hourSnap => {
          const booking = hourSnap.val();
          if (start < booking.end && end > booking.start) {
            overlap = true;
          }
        });
      });
      return !overlap;
    }
    return true;
  }

  // Book slot (add refetch after save)
  function bookSlot(name, start, end) {
    const month = start.slice(0, 7);
    const day = start.slice(0, 10);
    const hourKey = start.replace(/[:.-]/g, '');
    db.ref(`bookings/${month}/${day}/${hourKey}`).set({ name, start, end })
      .then(() => {
        alert('Slot booked successfully!');
        calendar.refetchEvents(); // Refresh calendar immediately
      })
      .catch(err => alert('Error booking slot: ' + err.message));
  }

  // New: Delete booking
  function deleteBooking(dbPath) {
    db.ref(dbPath).remove()
      .then(() => {
        alert('Booking deleted successfully!');
        calendar.refetchEvents();
      })
      .catch(err => alert('Error deleting booking: ' + err.message));
  }
});
