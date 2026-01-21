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
  const timeZoneSelect = document.getElementById('timeZone');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    editable: false,
    selectable: true, // Start true; we'll toggle per view
    viewDidMount: function(view) {
      // Dynamically toggle selectable based on view to avoid selection in month view
      try {
        const isTimeGrid = view.view.type.startsWith('timeGrid');
        calendar.setOption('selectable', isTimeGrid);
        console.log('View mounted:', view.view.type, 'Selectable:', isTimeGrid); // Temp debug log
      } catch (err) {
        console.error('Error in viewDidMount:', err);
      }
    },
    select: function(info) {
      try {
        console.log('Select triggered:', info.startStr, 'to', info.endStr); // Temp debug log
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
      } catch (err) {
        console.error('Error in select:', err);
        alert('An error occurred during selection. Please try again.');
      }
    },
    eventClick: function(info) {
      try {
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
          deleteBooking(booking.extendedProps.dbPath);
          info.event.remove();
        }
      } catch (err) {
        console.error('Error in eventClick:', err);
      }
    },
    events: function(fetchInfo, successCallback) {
      try {
        const month = fetchInfo.start.toISOString().slice(0, 7);
        loadBookings(month, successCallback);
      } catch (err) {
        console.error('Error fetching events:', err);
      }
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

  // Global real-time listener to refetch events on any DB change
  let currentMonthListener;
  calendar.on('datesSet', function(info) {
    try {
      const month = info.start.toISOString().slice(0, 7);
      if (currentMonthListener) {
        currentMonthListener.off();
        console.log('Removed old listener for month:', month); // Temp debug
      }
      currentMonthListener = db.ref('bookings/' + month).on('value', () => {
        calendar.refetchEvents();
      });
    } catch (err) {
      console.error('Error in datesSet:', err);
    }
  });

  // Load bookings
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

  // Check for overlap
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

  // Book slot
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

  // Delete booking
  function deleteBooking(dbPath) {
    db.ref(dbPath).remove()
      .then(() => {
        alert('Booking deleted successfully!');
        calendar.refetchEvents();
      })
      .catch(err => alert('Error deleting booking: ' + err.message));
  }
});
