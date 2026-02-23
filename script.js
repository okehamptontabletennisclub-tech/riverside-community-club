// ====================================
// CONFIGURATION
// ====================================

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQss-tRShihUJUQbVxBXY60U4B3PqXO8ZmWMFb1PHyELW7XkbIDyk4XtJDpsl3ezoC6Ro8VtuMZozUM/pub?gid=659243841&single=true&output=csv';

let currentWeekOffset = 0;

// ====================================
// FETCH AND PARSE DATA
// ====================================

async function fetchScheduleData() {
    try {
        console.log('Fetching from:', SHEET_URL);
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        console.log('CSV fetched, length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        
        return parseCSV(text);
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const sessions = [];
    
    console.log('Total lines:', lines.length);
    console.log('Header:', lines[0]);
    
    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cells = splitCSVLine(line);
        
        // Log first few rows for debugging
        if (i <= 3) {
            console.log(`Row ${i}:`, cells);
        }
        
        // Expected columns:
        // 0=Date, 1=Day, 2=Start, 3=End, 4=Room, 5=Hirer, 6=Contact,
        // 7=Session Type, 8=Public Name, 9=Show Online, 10=Contact Email, 11=Notes
        
        if (cells.length < 10) continue;
        
        const showOnline = (cells[9] || '').trim().toLowerCase();
        if (showOnline !== 'yes') continue;
        
        const room = (cells[4] || '').trim().toLowerCase();
        const validRooms = ['hall', 'half hall', 'practice room'];
        if (!validRooms.includes(room)) continue;
        
        const dateStr = cells[0];
        const date = parseDate(dateStr);
        if (!date) continue;
        
        const publicName = cells[8];
        if (!publicName || !publicName.trim()) continue;
        
        sessions.push({
            date: date,
            day: cells[1] || '',
            startTime: cells[2] || '',
            endTime: cells[3] || '',
            room: cells[4] || '',
            publicName: publicName,
            sessionType: cells[7] || '',
            contactEmail: cells[10] || '',
            notes: cells[11] || ''
        });
    }
    
    console.log('Sessions found:', sessions.length);
    if (sessions.length > 0) {
        console.log('First session:', sessions[0]);
    }
    
    return sessions;
}

function splitCSVLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    cells.push(current);
    return cells;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try D/M/YY format
    let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        let year = parseInt(match[3]);
        year = year < 50 ? 2000 + year : 1900 + year;
        return new Date(year, month, day);
    }
    
    // Try D/M/YYYY format
    match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const year = parseInt(match[3]);
        return new Date(year, month, day);
    }
    
    // Try parsing directly
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

// ====================================
// DISPLAY FUNCTIONS
// ====================================

function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    const dayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + dayOffset);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + (weekOffset * 7));
    
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
    
    document.getElementById('weekDisplay').innerHTML = `
        <button class="week-nav-btn" onclick="changeWeek(-1)">←</button>
        <span class="week-text">Week of ${start} - ${end}</span>
        <button class="week-nav-btn" onclick="changeWeek(1)">→</button>
    `;
}

function formatDateShort(date) {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    return `${day} ${month}`;
}

function buildTimetable(sessions, weekDates) {
    const sessionsByDay = {};
    weekDates.forEach((date, index) => {
        sessionsByDay[index] = sessions.filter(s => 
            s.date.toDateString() === date.toDateString()
        );
    });
    
    const container = document.getElementById('timetableContainer');
    container.innerHTML = '';
    
    const table = document.createElement('div');
    table.className = 'timetable';
    
    // Headers
    table.appendChild(createHeader('Time', 'time-col'));
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    weekDates.forEach((date, i) => {
        const header = document.createElement('div');
        header.className = 'timetable-header day-header';
        header.innerHTML = `
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-date">${formatDateShort(date)}</div>
        `;
        table.appendChild(header);
    });
    
    // AM Row
    table.appendChild(createTimeLabel('AM'));
    weekDates.forEach((date, dayIndex) => {
        const cell = createCell(sessionsByDay[dayIndex], 'AM');
        table.appendChild(cell);
    });
    
    // PM Row
    table.appendChild(createTimeLabel('PM'));
    weekDates.forEach((date, dayIndex) => {
        const cell = createCell(sessionsByDay[dayIndex], 'PM');
        table.appendChild(cell);
    });
    
    container.appendChild(table);
    container.style.display = 'block';
}

function createHeader(text, className = '') {
    const div = document.createElement('div');
    div.className = `timetable-header ${className}`;
    div.textContent = text;
    return div;
}

function createTimeLabel(text) {
    const div = document.createElement('div');
    div.className = 'time-slot';
    div.textContent = text;
    return div;
}

function createCell(daySessions, period) {
    const cell = document.createElement('div');
    cell.className = 'timetable-cell';
    
    const filtered = daySessions.filter(s => {
        if (!s.startTime || s.startTime === 'Day') return period === 'AM';
        const hour = parseInt(s.startTime.split(':')[0]);
        return period === 'AM' ? hour < 12 : hour >= 12;
    });
    
    filtered.forEach(session => {
        const block = createSessionBlock(session);
        cell.appendChild(block);
    });
    
    return cell;
}

function createSessionBlock(session) {
    const block = document.createElement('div');
    block.className = 'session-block';
    
    // Determine color
    const name = session.publicName.toLowerCase();
    if (name.includes('table tennis') || name.includes('tt ')) {
        block.classList.add('table-tennis');
    } else if (name.includes('pickleball')) {
        block.classList.add('pickleball');
    } else if (name.includes('yoga')) {
        block.classList.add('yoga');
    } else if (name.includes('taekwondo')) {
        block.classList.add('taekwondo');
    } else if (name.includes('cheerleading')) {
        block.classList.add('cheerleading');
    } else if (name.includes('footsteps')) {
        block.classList.add('footsteps');
    } else if (name.includes('smb')) {
        block.classList.add('smb');
    } else if (name.includes('tournament') || name.includes('edttl') || name.includes('tte')) {
        block.classList.add('tournament');
    }
    
    const sessionType = session.sessionType.toLowerCase();
    if (sessionType.includes('private')) {
        block.classList.add('private-session');
    } else if (sessionType.includes('members')) {
        block.classList.add('members-only');
    }
    
    if (!session.startTime || session.startTime === 'Day') {
        block.classList.add('full-day');
    }
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'session-name';
    nameDiv.textContent = session.publicName;
    
    if (sessionType.includes('private') || sessionType.includes('members')) {
        const badge = document.createElement('span');
        badge.className = 'session-badge';
        badge.textContent = sessionType.includes('private') ? 'Private' : 'Members';
        nameDiv.appendChild(badge);
    }
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'session-time';
    if (!session.startTime || session.startTime === 'Day') {
        timeDiv.textContent = 'All Day';
    } else {
        timeDiv.textContent = session.endTime 
            ? `${session.startTime} - ${session.endTime}`
            : session.startTime;
    }
    
    const roomDiv = document.createElement('div');
    roomDiv.className = 'session-room';
    roomDiv.textContent = session.room;
    
    block.appendChild(nameDiv);
    block.appendChild(timeDiv);
    block.appendChild(roomDiv);
    
    return block;
}

// ====================================
// NAVIGATION
// ====================================

async function changeWeek(offset) {
    currentWeekOffset += offset;
    
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('timetableContainer').style.display = 'none';
    
    const weekDates = getWeekDates(currentWeekOffset);
    displayWeek(weekDates);
    
    const sessions = await fetchScheduleData();
    
    document.getElementById('loadingState').style.display = 'none';
    
    if (!sessions) {
        document.getElementById('timetableContainer').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #e74c3c;">
                <h3>⚠️ Unable to load schedule</h3>
                <p>Please check your internet connection and try again.</p>
            </div>
        `;
        document.getElementById('timetableContainer').style.display = 'block';
        return;
    }
    
    if (sessions.length === 0) {
        document.getElementById('timetableContainer').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <p style="font-size: 1.2rem;">📅 No sessions scheduled for this week</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Try navigating to a different week.</p>
            </div>
        `;
        document.getElementById('timetableContainer').style.display = 'block';
        return;
    }
    
    buildTimetable(sessions, weekDates);
}

// ====================================
// INITIALIZATION
// ====================================

async function init() {
    console.log('Initializing calendar...');
    
    const weekDates = getWeekDates(currentWeekOffset);
    displayWeek(weekDates);
    
    const sessions = await fetchScheduleData();
    
    document.getElementById('loadingState').style.display = 'none';
    
    if (!sessions) {
        document.getElementById('timetableContainer').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #e74c3c;">
                <h3>⚠️ Unable to load schedule</h3>
                <p>Please check the browser console for details.</p>
            </div>
        `;
        document.getElementById('timetableContainer').style.display = 'block';
        return;
    }
    
    if (sessions.length === 0) {
        document.getElementById('timetableContainer').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <p style="font-size: 1.2rem;">📅 No sessions scheduled for this week</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Try navigating to a different week using the arrows above.</p>
            </div>
        `;
        document.getElementById('timetableContainer').style.display = 'block';
        return;
    }
    
    buildTimetable(sessions, weekDates);
    console.log('Calendar initialized successfully');
}

document.addEventListener('DOMContentLoaded', init);
