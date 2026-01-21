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

  // DOM elements
  const calendarEl = document.getElementById('calendar');
  const userNameInput = document.getElementById('userName');
  const timeZoneSelect = document.getElementById('timeZone');

  let calendar;                 // Will hold the calendar instance
  let currentView = 'timeGridWeek';  // Track current view type when rebuilding

  // ────────────────────────────────────────────────
  // Function to (re)initialize the calendar with a specific time zone
  function initCalendar(tz) {
    if (calendar) {
      calendar.destroy();  // Clean up previous instance
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: currentView,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      editable: false,
      selectable: true,
      viewDidMount: function(view) {
        const isTimeGrid = view.view.type.startsWith('timeGrid');
        calendar.setOption('selectable', isTimeGrid);
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

        // Use the calendar's current time zone for display in confirmation
        const currentTz = calendar.getOption('timeZone');
        const formatter = new Intl.DateTimeFormat('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: currentTz
        });
        const startStr = formatter.format(booking.start);
        const endStr = formatter.format(booking.end);

        if (confirm(`Delete booking for ${booking.title} from ${startStr} to ${endStr}?`)) {
          deleteBooking(booking.extendedProps.dbPath);
          info.event.remove();
        }
      },
      events: function(fetchInfo, successCallback) {
        const month = fetchInfo.start.toISOString().slice(0, 7);
        loadBookings(month, successCallback);
      },
      timeZone: tz  // Explicitly set here
    });

    calendar.render();

    // Real-time listener for the current month
    let unsubscribeCurrentMonth = null;

    calendar.on('datesSet', function(info) {
      const month = info.start.toISOString().slice(0, 7);

      if (unsubscribeCurrentMonth) {
        unsubscribeCurrentMonth();
      }

      const ref = db.ref('bookings/' + month);
      unsubscribeCurrentMonth = ref.on('value', () => {
        calendar.refetchEvents();
      });
    });
  }

  // ────────────────────────────────────────────────
  // Detect initial time zone and populate dropdown
  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

    // Sort alphabetically
    const options = Array.from(timeZoneSelect.options);
    options.sort((a, b) => a.textContent.localeCompare(b.textContent));
    timeZoneSelect.innerHTML = '';
    options.forEach(opt => timeZoneSelect.appendChild(opt));
  }

  // Initial calendar load with detected time zone
  initCalendar(detectedTimeZone);

  // Time zone change → rebuild calendar with new TZ
  if (timeZoneSelect) {
    timeZoneSelect.addEventListener('change', function() {
      const newTz = timeZoneSelect.value;
      if (newTz) {
        currentView = calendar ? calendar.view.type : 'timeGridWeek';
        initCalendar(newTz);
        alert(`Calendar updated to ${newTz}. Times should now be adjusted.`);
      }
    });
  }

  // Enter key support for name field
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

  // ────────────────────────────────────────────────
  // Booking helper functions
  function loadBookings(month, successCallback) {
    db.ref('bookings/' + month).once('value').then(snapshot => {
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
              extendedProps: { dbPath: hourSnap.ref.path }
            });
          });
        });
      }
      successCallback(events);
    }).catch(err => console.error('Error loading bookings:', err));
  }

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

  function bookSlot(name, start, end) {
    const month = start.slice(0, 7);
    const day = start.slice(0, 10);
    const hourKey = start.replace(/[:.-]/g, '');
    db.ref(`bookings/${month}/${day}/${hourKey}`).set({ name, start, end })
      .then(() => {
        alert('Slot booked successfully!');
        calendar.refetchEvents();
      })
      .catch(err => alert('Error booking slot: ' + err.message));
  }

  function deleteBooking(dbPath) {
    db.ref(dbPath).remove()
      .then(() => {
        alert('Booking deleted successfully!');
        calendar.refetchEvents();
      })
      .catch(err => alert('Error deleting booking: ' + err.message));
  }

  // Cleanup on page leave (optional but good practice)
  window.addEventListener('beforeunload', () => {
    if (calendar) {
      calendar.destroy();
    }
  });
});
