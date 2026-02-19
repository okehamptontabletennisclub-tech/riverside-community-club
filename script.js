// ====================================
// CONFIGURATION
// ====================================

// IMPORTANT: Replace the URL below (line 10) with your published Public Calendar CSV link
// To get it: File → Share → Publish to web → Select "Public Calendar" tab → CSV format
// The URL should end with: &output=csv

// Global state for current week offset
let currentWeekOffset = 0;

// ====================================
// MAIN FUNCTIONS
// ====================================

async function fetchScheduleData() {
    try {
        // Use the published CSV URL directly
        const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQss-tRShihUJUQbVxBXY60U4B3PqXO8ZmWMFb1PHyELW7XkbIDyk4XtJDpsl3ezoC6Ro8VtuMZozUM/pub?gid=659243841&single=true&output=csv';
        
        const response = await fetch(url);
        const text = await response.text();
        
        return parseCSVData(text);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        showError('Unable to load schedule. Please check your internet connection.');
        return null;
    }
}

function parseCSVData(csvText) {
    const sessions = [];
    const lines = csvText.split('\n');
    
    // Skip header row (index 0), start from row 1
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV line (handling quoted fields)
        const cells = parseCSVLine(line);
        
        // New column positions:
        // A=Date(0), B=Day(1), C=Start(2), D=End(3), E=Room(4), F=Hirer(5), G=Contact(6), 
        // H=Session Type(7), I=Public Name(8), J=Show Online(9), K=Contact Email(10)
        
        // Skip if not enough columns or Show Online is not "Yes"
        // Treat blank/empty as "No"
        if (cells.length < 10 || cells[9].trim() !== 'Yes') {
            continue;
        }
        
        // Extract data
        const dateStr = cells[0];
        const day = cells[1];
        const startTime = cells[2];
        const endTime = cells[3];
        const room = cells[4];
        const publicName = cells[8];  // Column I
        const sessionType = cells[7];  // Column H
        const contactEmail = cells[10] || '';  // Column K
        
        // Skip if essential data is missing
        if (!dateStr || !day || !publicName) {
            continue;
        }
        
        // Parse the date
        let date = parseDate(dateStr);
        
        if (!date || isNaN(date.getTime())) {
            continue;
        }
        
        const session = {
            date: date,
            day: day,
            startTime: startTime || '',
            endTime: endTime || '',
            room: room || '',
            publicName: publicName,
            sessionType: sessionType || '',
            contactEmail: contactEmail
        };
        
        sessions.push(session);
    }
    
    return sessions;
}

function parseCSVLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of cell
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last cell
    cells.push(current.trim());
    
    return cells;
}

function parseDate(dateStr) {
    // Try various date formats
    
    // Format: D/M/YY or DD/MM/YY (e.g., "1/9/25" or "16/2/26")
    let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (match) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]) - 1; // JS months are 0-indexed
        let year = parseInt(match[3]);
        // Convert 2-digit year to 4-digit (25 = 2025, 26 = 2026)
        year = year < 50 ? 2000 + year : 1900 + year;
        return new Date(year, month, day);
    }
    
    // Format: DD/MM/YYYY or D/M/YYYY
    match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    }
    
    // Format: YYYY-MM-DD
    match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    // Format: Month DD, YYYY (e.g., "February 16, 2026")
    const monthDate = new Date(dateStr);
    if (!isNaN(monthDate.getTime())) {
        return monthDate;
    }
    
    return null;
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
    if (!timeStr || timeStr === '' || timeStr === 'Day') {
        return 'FULL_DAY';
    }
    
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
        // Include AM sessions and full-day events
        const amSessions = daySessions.filter(session => {
            const timeOfDay = getTimeOfDay(session.startTime);
            return timeOfDay === 'AM' || timeOfDay === 'FULL_DAY';
        });
        
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
        // Include PM sessions (full-day events already shown in AM)
        const pmSessions = daySessions.filter(session => {
            const timeOfDay = getTimeOfDay(session.startTime);
            return timeOfDay === 'PM';
        });
        
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
    
    // Determine activity class based on Public Name
    const publicName = session.publicName.toLowerCase();
    
    if (publicName.includes('table tennis') || publicName.includes('tt ')) {
        sessionBlock.classList.add('table-tennis');
    } else if (publicName.includes('pickleball')) {
        sessionBlock.classList.add('pickleball');
    } else if (publicName.includes('yoga')) {
        sessionBlock.classList.add('yoga');
    } else if (publicName.includes('taekwondo')) {
        sessionBlock.classList.add('taekwondo');
    } else if (publicName.includes('cheerleading')) {
        sessionBlock.classList.add('cheerleading');
    } else if (publicName.includes('footsteps')) {
        sessionBlock.classList.add('footsteps');
    } else if (publicName.includes('tournament') || publicName.includes('edttl') || publicName.includes('tte ')) {
        sessionBlock.classList.add('tournament');
    }
    
    // Add session type class for styling
    const sessionType = session.sessionType.toLowerCase();
    if (sessionType.includes('private')) {
        sessionBlock.classList.add('private-session');
    } else if (sessionType.includes('members')) {
        sessionBlock.classList.add('members-only');
    }
    
    // Check if it's a full-day event
    const isFullDay = session.startTime === 'Day' || session.startTime === '';
    if (isFullDay) {
        sessionBlock.classList.add('full-day');
    }
    
    const sessionName = document.createElement('div');
    sessionName.className = 'session-name';
    sessionName.textContent = session.publicName;
    
    // Add session type badge if it's private or members only
    if (sessionType.includes('private') || sessionType.includes('members')) {
        const badge = document.createElement('span');
        badge.className = 'session-badge';
        badge.textContent = sessionType.includes('private') ? 'Private' : 'Members';
        sessionName.appendChild(badge);
    }
    
    const sessionTime = document.createElement('div');
    sessionTime.className = 'session-time';
    
    if (isFullDay) {
        sessionTime.textContent = 'All Day';
    } else {
        sessionTime.textContent = session.startTime && session.endTime 
            ? `${session.startTime} - ${session.endTime}` 
            : session.startTime || '';
    }
    
    const sessionRoom = document.createElement('div');
    sessionRoom.className = 'session-room';
    sessionRoom.textContent = session.room;
    
    sessionBlock.appendChild(sessionName);
    sessionBlock.appendChild(sessionTime);
    if (session.room) {
        sessionBlock.appendChild(sessionRoom);
    }
    
    // Optionally add contact email (uncomment if you want to show it)
    // if (session.contactEmail && session.contactEmail.trim()) {
    //     const contactDiv = document.createElement('div');
    //     contactDiv.className = 'session-contact';
    //     contactDiv.textContent = session.contactEmail;
    //     sessionBlock.appendChild(contactDiv);
    // }
    
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

