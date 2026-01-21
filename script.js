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

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Get DOM elements
    const calendarEl = document.getElementById('calendar');
    const userNameInput = document.getElementById('userName');
    const timeZoneSelect = document.getElementById('timeZone');

    // Initialize FullCalendar
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: false,
        selectable: true,
        select: function (info) {
            const userName = userNameInput.value.trim();
            if (!userName) {
                alert('Please enter your name.');
                return;
            }
            const start = info.start.toISOString(); // UTC
            const end = info.end.toISOString();     // UTC

            checkForOverlap(start, end).then(isAvailable => {
                if (isAvailable) {
                    bookSlot(userName, start, end);
                } else {
                    alert('Slot is already booked or overlaps with an existing booking.');
                }
            });
        },
        events: function (fetchInfo, successCallback) {
            loadBookings(fetchInfo.start.toISOString().slice(0, 7), successCallback);
        },
        timeZone: 'local'
    });

    calendar.render();

    // Populate time zone dropdown
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (timeZoneSelect) {
        console.log('Detected timezone:', detectedTimeZone);

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

                // Put detected timezone at the top
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

    // ─────────────────────────────────────────────────────────────
    // Booking functions
    // ─────────────────────────────────────────────────────────────

    function loadBookings(month, successCallback) {
        db.ref('bookings/' + month).on('value', snapshot => {
            const events = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    child.forEach(hourSnapshot => {
                        const booking = hourSnapshot.val();
                        events.push({
                            title: booking.name,
                            start: booking.start,
                            end: booking.end,
                            color: 'red'
                        });
                    });
                });
            }
            successCallback(events);
        });
    }

    async function checkForOverlap(start, end) {
        const month = start.slice(0, 7);
        const snapshot = await db.ref('bookings/' + month).once('value');
        if (snapshot.exists()) {
            let overlap = false;
            snapshot.forEach(child => {
                child.forEach(hourSnapshot => {
                    const booking = hourSnapshot.val();
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
            .then(() => alert('Slot booked successfully!'))
            .catch(err => alert('Error booking slot: ' + err.message));
    }
});
