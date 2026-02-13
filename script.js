// ====================================
// CONFIGURATION
// ====================================

// Replace this with your Google Sheet ID
// To find it: Open your sheet, look at the URL
// https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
const SHEET_ID = '1mqqQIZvbGAO4546OGMPx4FoD2elEfLzmSbaZSFti3E8';

// The name of your sheet tab (default is "Booking Calendar")
const SHEET_NAME = 'Booking Calendar';

// Global state for current week offset
let currentWeekOffset = 0;

// ====================================
// MAIN FUNCTIONS
// ====================================

async function fetchScheduleData() {
    try {
        // Google Sheets API endpoint (no API key needed for public sheets)
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
        
        const response = await fetch(url);
        const text = await response.text();
        
        // Google returns JSONP, need to extract the JSON
        const jsonString = text.substring(47).slice(0, -2);
        const data = JSON.parse(jsonString);
        
        return parseSheetData(data);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        showError('Unable to load schedule. Please check your internet connection.');
        return null;
    }
}

function parseSheetData(data) {
    const rows = data.table.rows;
    const sessions = [];
    
    // Skip header row (index 0), start from row 1
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.c;
        
        // Skip if row is empty or Show Online is not "Yes"
        if (!cells || !cells[13] || cells[13].v !== 'Yes') {
            continue;
        }
        
        // Extract data from columns
        // A=Date, B=Day, C=Start, D=End, E=Room, N=Show Online, O=Public Name
        const dateCell = cells[0];
        const dayCell = cells[1];
        const startCell = cells[2];
        const endCell = cells[3];
        const roomCell = cells[4];
        const publicNameCell = cells[14]; // Column O (index 14)
        
        // Skip if essential data is missing
        if (!dateCell || !dayCell || !publicNameCell) {
            continue;
        }
        
        // Parse the date
        let date;
        if (dateCell.v) {
            // Google Sheets dates are in format "Date(2026,1,16)" or as formatted string
            if (typeof dateCell.v === 'string' && dateCell.v.startsWith('Date(')) {
                const match = dateCell.v.match(/Date\((\d+),(\d+),(\d+)\)/);
                if (match) {
                    date = new Date(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
                }
            } else if (dateCell.f) {
                // Try formatted value
                date = new Date(dateCell.f);
            }
        }
        
        if (!date || isNaN(date.getTime())) {
            continue;
        }
        
        // Parse time (can be decimal or formatted)
        let startTime = '';
        let endTime = '';
        
        if (startCell && startCell.v !== null) {
            startTime = formatTime(startCell.v, startCell.f);
        }
        
        if (endCell && endCell.v !== null) {
            endTime = formatTime(endCell.v, endCell.f);
        }
        
        const session = {
            date: date,
            day: dayCell.v || '',
            startTime: startTime,
            endTime: endTime,
            room: roomCell ? roomCell.v : '',
            publicName: publicNameCell ? publicNameCell.v : ''
        };
        
        sessions.push(session);
    }
    
    return sessions;
}

function formatTime(value, formatted) {
    // If we have formatted value, use it
    if (formatted && formatted.includes(':')) {
        return formatted;
    }
    
    // If value is decimal (e.g., 0.4375 for 10:30)
    if (typeof value === 'number') {
        const hours = Math.floor(value * 24);
        const minutes = Math.round((value * 24 - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    return value ? value.toString() : '';
}

function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const monday = new Date(today);
    const dayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + dayOffset);
    monday.setHours(0, 0, 0, 0);
    
    // Add week offset
    monday.setDate(monday.getDate() + (weekOffset * 7));
    
    // Generate all 7 days
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        weekDates.push(date);
    }
    
    return weekDates;
}

function displayWeek(weekDates) {
    const start = formatDateShort(weekDates[0]);
    const end = formatDateShort(weekDates[6]);
    
    const weekDisplay = document.getElementById('weekDisplay');
    weekDisplay.innerHTML = `
        <button class="week-nav-btn" id="prevWeek" onclick="changeWeek(-1)">←</button>
        <span class="week-text">Week of ${start} - ${end}</span>
        <button class="week-nav-btn" id="nextWeek" onclick="changeWeek(1)">→</button>
    `;
}

function formatDateShort(date) {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    return `${day} ${month}`;
}

function getTimeOfDay(timeStr) {
    if (!timeStr) return null;
    
    const hour = parseInt(timeStr.split(':')[0]);
    
    if (hour < 12) {
        return 'AM';
    } else {
        return 'PM';
    }
}

function buildTimetable(sessions, weekDates) {
    // Group sessions by day
    const sessionsByDay = {};
    weekDates.forEach((date, index) => {
        const dateKey = date.toDateString();
        sessionsByDay[index] = sessions.filter(session => 
            session.date.toDateString() === dateKey
        );
    });
    
    const timetableContainer = document.getElementById('timetableContainer');
    timetableContainer.innerHTML = '';
    
    const timetable = document.createElement('div');
    timetable.className = 'timetable';
    
    // Header row
    // Time column header
    const timeHeader = document.createElement('div');
    timeHeader.className = 'timetable-header time-col';
    timeHeader.textContent = 'Time';
    timetable.appendChild(timeHeader);
    
    // Day headers
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    weekDates.forEach((date, index) => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'timetable-header day-header';
        
        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        dayName.textContent = dayNames[index];
        
        const dayDate = document.createElement('div');
        dayDate.className = 'day-date';
        dayDate.textContent = formatDateShort(date);
        
        dayHeader.appendChild(dayName);
        dayHeader.appendChild(dayDate);
        timetable.appendChild(dayHeader);
    });
    
    // AM Row
    const amLabel = document.createElement('div');
    amLabel.className = 'time-slot';
    amLabel.textContent = 'AM';
    timetable.appendChild(amLabel);
    
    weekDates.forEach((date, dayIndex) => {
        const cell = document.createElement('div');
        cell.className = 'timetable-cell';
        
        const daySessions = sessionsByDay[dayIndex] || [];
        const amSessions = daySessions.filter(session => getTimeOfDay(session.startTime) === 'AM');
        
        amSessions.forEach(session => {
            const sessionBlock = createSessionBlock(session);
            cell.appendChild(sessionBlock);
            cell.classList.add('has-session');
        });
        
        timetable.appendChild(cell);
    });
    
    // PM Row
    const pmLabel = document.createElement('div');
    pmLabel.className = 'time-slot';
    pmLabel.textContent = 'PM';
    timetable.appendChild(pmLabel);
    
    weekDates.forEach((date, dayIndex) => {
        const cell = document.createElement('div');
        cell.className = 'timetable-cell';
        
        const daySessions = sessionsByDay[dayIndex] || [];
        const pmSessions = daySessions.filter(session => getTimeOfDay(session.startTime) === 'PM');
        
        pmSessions.forEach(session => {
            const sessionBlock = createSessionBlock(session);
            cell.appendChild(sessionBlock);
            cell.classList.add('has-session');
        });
        
        timetable.appendChild(cell);
    });
    
    timetableContainer.appendChild(timetable);
    timetableContainer.style.display = 'block';
}

function createSessionBlock(session) {
    const sessionBlock = document.createElement('div');
    sessionBlock.className = 'session-block';
    
    // Determine room class
    const room = session.room.toLowerCase();
    if (room.includes('practice')) {
        sessionBlock.classList.add('practice-room');
    } else if (room.includes('half')) {
        sessionBlock.classList.add('half-hall');
    }
    
    const sessionName = document.createElement('div');
    sessionName.className = 'session-name';
    sessionName.textContent = session.publicName;
    
    const sessionTime = document.createElement('div');
    sessionTime.className = 'session-time';
    sessionTime.textContent = session.startTime && session.endTime 
        ? `${session.startTime} - ${session.endTime}` 
        : session.startTime || '';
    
    const sessionRoom = document.createElement('div');
    sessionRoom.className = 'session-room';
    sessionRoom.textContent = session.room;
    
    sessionBlock.appendChild(sessionName);
    sessionBlock.appendChild(sessionTime);
    sessionBlock.appendChild(sessionRoom);
    
    return sessionBlock;
}

function showError(message) {
    const loadingState = document.getElementById('loadingState');
    loadingState.innerHTML = `
        <div style="color: #e74c3c; padding: 2rem;">
            <h3>⚠️ Error Loading Schedule</h3>
            <p>${message}</p>
            <p style="margin-top: 1rem; font-size: 0.9rem;">
                Please ensure the Google Sheet is shared as "Anyone with the link can view"
            </p>
        </div>
    `;
}

// ====================================
// WEEK NAVIGATION
// ====================================

async function changeWeek(offset) {
    currentWeekOffset += offset;
    
    // Show loading state
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('timetableContainer').style.display = 'none';
    
    // Get new week dates
    const weekDates = getWeekDates(currentWeekOffset);
    displayWeek(weekDates);
    
    // Fetch and display schedule
    const sessions = await fetchScheduleData();
    
    if (sessions) {
        document.getElementById('loadingState').style.display = 'none';
        buildTimetable(sessions, weekDates);
    }
}

// ====================================
// INITIALIZATION
// ====================================

async function init() {
    // Check if Sheet ID is configured
    if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
        showError('Please configure your Google Sheet ID in script.js');
        return;
    }
    
    // Get current week
    const weekDates = getWeekDates(currentWeekOffset);
    displayWeek(weekDates);
    
    // Fetch and display schedule
    const sessions = await fetchScheduleData();
    
    if (sessions) {
        document.getElementById('loadingState').style.display = 'none';
        buildTimetable(sessions, weekDates);
    }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', init);

