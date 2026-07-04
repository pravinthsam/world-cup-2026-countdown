// World Cup 2026 Dashboard Application

// Team name to ISO 3166-1 alpha-2 code mapping (lowercase)
// Includes UK subdivisions (gb-eng, gb-sct, gb-wls) supported by FlagCDN
const countryToIso = {
  "Algeria": "dz",
  "Argentina": "ar",
  "Australia": "au",
  "Austria": "at",
  "Belgium": "be",
  "Bosnia & Herzegovina": "ba",
  "Brazil": "br",
  "Canada": "ca",
  "Cape Verde": "cv",
  "Colombia": "co",
  "Croatia": "hr",
  "Curaçao": "cw",
  "Czech Republic": "cz",
  "DR Congo": "cd",
  "Ecuador": "ec",
  "Egypt": "eg",
  "England": "gb-eng",
  "France": "fr",
  "Germany": "de",
  "Ghana": "gh",
  "Haiti": "ht",
  "Iran": "ir",
  "Iraq": "iq",
  "Ivory Coast": "ci",
  "Japan": "jp",
  "Jordan": "jo",
  "Mexico": "mx",
  "Morocco": "ma",
  "Netherlands": "nl",
  "New Zealand": "nz",
  "Norway": "no",
  "Panama": "pa",
  "Paraguay": "py",
  "Portugal": "pt",
  "Qatar": "qa",
  "Saudi Arabia": "sa",
  "Scotland": "gb-sct",
  "Senegal": "sn",
  "South Africa": "za",
  "South Korea": "kr",
  "Spain": "es",
  "Sweden": "se",
  "Switzerland": "ch",
  "Tunisia": "tn",
  "Turkey": "tr",
  "USA": "us",
  "Uruguay": "uy",
  "Uzbekistan": "uz"
};

// Curated list of timezones shown in the header dropdown
const curatedTimezones = [
  { value: 'local', label: 'Local Time (Auto-Detect)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST - UAE, UTC+4)' },
  { value: 'America/New_York', label: 'Eastern Time (ET - US/Canada, UTC-4/5)' },
  { value: 'America/Chicago', label: 'Central Time (CT - US/Mexico, UTC-5/6)' },
  { value: 'America/Denver', label: 'Mountain Time (MT - US/Canada, UTC-6/7)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT - US/Canada, UTC-7/8)' },
  { value: 'Europe/London', label: 'British Time (BST/GMT - UK, UTC+1/0)' },
  { value: 'Europe/Paris', label: 'Central European Time (CEST/CET, UTC+2/1)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST, UTC+5:30)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET, UTC+10/11)' }
];

// State variables
let matchesData = [];
let currentSelectedTimezone = 'local';
let currentActiveTab = 'upcoming';
let countdownIntervalId = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupTimezoneDropdown();
  setupTabNavigation();
  setupFilterListeners();
  setupReloadButton();
  setupBracketControls();
  fetchMatches();
  updateCurrentTimeLabel();
  
  // Update the header clock every second
  setInterval(updateCurrentTimeLabel, 1000);
});

// Populate the timezone selector and set default to user local timezone
function setupTimezoneDropdown() {
  const select = document.getElementById('timezone-select');
  select.innerHTML = '';
  
  // Detect local IANA timezone
  let localTzName = 'UTC';
  try {
    localTzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    console.warn("Failed to detect local timezone. Defaulting to UTC.", e);
  }

  curatedTimezones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz.value;
    
    if (tz.value === 'local') {
      option.textContent = `Local Time (${localTzName})`;
    } else {
      option.textContent = tz.label;
    }
    
    select.appendChild(option);
  });

  // Event listener for timezone change
  select.addEventListener('change', (e) => {
    currentSelectedTimezone = e.target.value;
    renderMatches();
    renderMatchResults();
    renderBracket();
    updateCurrentTimeLabel();
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fetch matches from live GitHub repo only (with retries and exponential backoff)
async function fetchMatches() {
  const loader = document.getElementById('matches-loader');
  const grid = document.getElementById('matches-grid');
  
  const isInitial = matchesData.length === 0;
  
  const maxAttempts = 3;
  let dataFetched = false;
  let fetchedData = null;
  let fetchError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (isInitial && loader) {
      loader.classList.remove('hidden');
      grid.classList.add('hidden');
      loader.innerHTML = `
        <div class="spinner"></div>
        <p>Loading tournament schedule... ${attempt > 1 ? `(Attempt ${attempt}/${maxAttempts})` : ''}</p>
      `;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout per attempt

    try {
      const response = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        fetchedData = await response.json();
        dataFetched = true;
        console.log(`Successfully fetched live data from GitHub on attempt ${attempt}.`);
        break;
      } else {
        throw new Error(`Failed to load live data (Status: ${response.status})`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error);
      fetchError = error;
      
      if (attempt < maxAttempts) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1000ms, then 2000ms
        console.log(`Waiting ${backoffMs}ms before next attempt...`);
        await sleep(backoffMs);
      }
    }
  }
  
  if (dataFetched && fetchedData) {
    try {
      clearConfirmedStandingsCache();
      matchesData = parseMatches(fetchedData.matches);
      
      // Sort chronologically by parsed Date
      matchesData.sort((a, b) => a.parsedDateTime - b.parsedDateTime);
      
      if (loader) loader.classList.add('hidden');
      if (grid) grid.classList.remove('hidden');
      
      renderMatches();
      renderMatchResults();
      renderStandings();
      renderScorers();
      renderBracket();
      startCountdownTimer();
      updateCountLabel();
    } catch (parseError) {
      console.error("Error parsing match data:", parseError);
      fetchError = parseError;
      dataFetched = false;
    }
  }
  
  if (!dataFetched) {
    if (isInitial && loader) {
      loader.innerHTML = `
        <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--accent-red)"></i>
        <h3 style="margin-top: 1rem;">Failed to load schedule</h3>
        <p style="color: var(--text-muted); text-align: center; margin-bottom: 1rem;">${fetchError ? fetchError.message : 'Unknown error'}</p>
        <button id="retry-fetch-btn" class="retry-button">
          <i data-lucide="refresh-cw" style="width: 16px; height: 16px;"></i>
          <span>Try Again</span>
        </button>
      `;
      lucide.createIcons();
      const retryBtn = document.getElementById('retry-fetch-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => fetchMatches());
      }
    }
  }
}

// Helper to determine the winner of a match (1 for team1, 2 for team2, null if draw/unfinished)
function getWinnerOfMatch(match) {
  if (!match || !match.score) return null;
  if (match.score.p) {
    if (match.score.p[0] > match.score.p[1]) return 1;
    if (match.score.p[1] > match.score.p[0]) return 2;
  }
  if (match.score.et) {
    if (match.score.et[0] > match.score.et[1]) return 1;
    if (match.score.et[1] > match.score.et[0]) return 2;
  }
  if (match.score.ft) {
    if (match.score.ft[0] > match.score.ft[1]) return 1;
    if (match.score.ft[1] > match.score.ft[0]) return 2;
  }
  return null;
}

// Parse dates and times from worldcup.json structure
function parseMatches(matchesList) {
  return matchesList.map(match => {
    const parsedDateTime = parseMatchDateTime(match.date, match.time);
    return {
      ...match,
      parsedDateTime: parsedDateTime
    };
  });
}

// Helper to parse date string "YYYY-MM-DD" and time string "HH:MM UTC-X" or "HH:MM UTC"
function parseMatchDateTime(dateStr, timeStr) {
  const cleanTime = timeStr.trim();
  const parts = cleanTime.split(/\s+/);
  const timePart = parts[0]; // e.g. "13:00"
  const tzPart = parts[1] || 'UTC'; // e.g. "UTC-6" or "UTC"
  
  const [hh, mm] = timePart.split(':');
  let isoString = `${dateStr}T${hh}:${mm}:00`;
  
  if (tzPart === 'UTC') {
    isoString += 'Z';
  } else {
    const match = tzPart.match(/UTC([+-])(\d+)(?::(\d+))?/);
    if (match) {
      const sign = match[1];
      const hours = match[2].padStart(2, '0');
      const minutes = (match[3] || '00').padStart(2, '0');
      isoString += `${sign}${hours}:${minutes}`;
    } else {
      isoString += 'Z'; // Fallback to UTC
    }
  }
  return new Date(isoString);
}

// Map placeholder text strings to clean team names
function formatPlaceholderTeamName(teamStr) {
  if (!teamStr) return '';
  const clean = teamStr.trim();
  
  // Format Winner of Group stage, e.g. "1B" -> "Winner Group B"
  const groupWinnerMatch = clean.match(/^1([A-L])$/);
  if (groupWinnerMatch) return `Winner Group ${groupWinnerMatch[1]}`;

  // Format Runner up of Group stage, e.g. "2A" -> "Runner-up Group A"
  const groupRunnerMatch = clean.match(/^2([A-L])$/);
  if (groupRunnerMatch) return `Runner-up Group ${groupRunnerMatch[1]}`;
  
  // Format 3rd place team placeholders, e.g. "3A/B/C/D/F" -> "3rd Place Group A/B/C/D/F"
  const thirdPlaceMatch = clean.match(/^3([A-L].*)$/);
  if (thirdPlaceMatch) return `3rd Place Group ${thirdPlaceMatch[1]}`;
  
  // Format Winner of Match X, e.g. "W73" -> "Winner Match 73"
  const winnerOfMatch = clean.match(/^W(\d+)$/);
  if (winnerOfMatch) return `Winner Match ${winnerOfMatch[1]}`;

  // Format Loser of Match X, e.g. "L101" -> "Loser Match 101"
  const loserOfMatch = clean.match(/^L(\d+)$/);
  if (loserOfMatch) return `Loser Match ${loserOfMatch[1]}`;

  return clean;
}

// Global error handler for flag image load failures
function handleFlagError(img) {
  img.parentElement.innerHTML = '<div class="placeholder-flag"><i data-lucide="shield"></i></div>';
  lucide.createIcons();
}

// Get flag HTML block using FlagCDN (if real country) or a custom vector placeholder icon
function getFlagHtml(teamName) {
  const cleanName = teamName.trim();
  const isoCode = countryToIso[cleanName];
  
  if (isoCode) {
    return `
      <div class="flag-container">
        <img src="https://flagcdn.com/${isoCode}.svg" alt="${cleanName} flag" onerror="handleFlagError(this)">
      </div>
    `;
  } else {
    // Return a neat placeholder shield for group/knockout placeholders
    return `
      <div class="flag-container">
        <div class="placeholder-flag">
          <i data-lucide="shield"></i>
        </div>
      </div>
    `;
  }
}

// Render the filtered matches onto the grid layout
function renderMatches() {
  const grid = document.getElementById('matches-grid');
  const emptyState = document.getElementById('no-matches-message');
  
  // Clear the existing matches grid
  grid.innerHTML = '';
  
  const now = new Date();
  
  // Match is over if current time is more than 2.5 hours past start time (150 minutes)
  const isOverCutoffMs = 150 * 60 * 1000;
  
  // Filter matches: Keep if it is not completed (no score data AND start time + 2.5 hours is in the future)
  const upcomingMatches = matchesData.filter(match => {
    const hasScore = match.score && match.score.ft;
    if (hasScore) return false;
    return (match.parsedDateTime.getTime() + isOverCutoffMs) > now.getTime();
  });
  
  // Update matches remaining count badge
  updateCountLabel();

  if (upcomingMatches.length === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  
  grid.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  // Render match cards
  upcomingMatches.forEach((match, index) => {
    const card = document.createElement('div');
    card.className = 'match-card';
    card.id = `match-card-${index}`;
    card.setAttribute('data-timestamp', match.parsedDateTime.getTime());
    card.setAttribute('data-match-index', matchesData.indexOf(match));
    
    // Resolve timezone
    const tz = currentSelectedTimezone === 'local' ? undefined : currentSelectedTimezone;
    
    // Format date and time
    const matchDateStr = getFormattedDate(match.parsedDateTime, tz);
    const matchTimeStr = getFormattedTime(match.parsedDateTime, tz);
    
    const formattedTeam1 = formatPlaceholderTeamName(match.team1);
    const formattedTeam2 = formatPlaceholderTeamName(match.team2);
    
    const team1FlagHtml = getFlagHtml(match.team1);
    const team2FlagHtml = getFlagHtml(match.team2);
    
    card.innerHTML = `
      <div class="card-header">
        <span class="card-round">${match.round}</span>
        <span class="card-group">${match.group || 'Knockout Stage'}</span>
      </div>
      <div class="card-body">
        <div class="team-row">
          ${team1FlagHtml}
          <span class="team-name" title="${formattedTeam1}">${formattedTeam1}</span>
        </div>
        <div class="team-row">
          ${team2FlagHtml}
          <span class="team-name" title="${formattedTeam2}">${formattedTeam2}</span>
        </div>
      </div>
      <div class="card-details">
        <div class="detail-line">
          <i data-lucide="map-pin"></i>
          <span>${match.ground}</span>
        </div>
        <div class="detail-line">
          <i data-lucide="calendar"></i>
          <span class="highlight">${matchDateStr}</span>
        </div>
        <div class="detail-line">
          <i data-lucide="clock"></i>
          <span class="highlight">${matchTimeStr} (${getSelectedTimezoneAbbr()})</span>
        </div>
      </div>
      <div class="card-countdown-bar" id="countdown-bar-${index}">
        <span class="countdown-label">Starts In</span>
        <div class="countdown-digits" id="countdown-digits-${index}">
          <div class="countdown-segment">
            <span class="countdown-number" id="days-${index}">--</span>
            <span class="countdown-unit">d</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-number" id="hours-${index}">--</span>
            <span class="countdown-unit">h</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-number" id="mins-${index}">--</span>
            <span class="countdown-unit">m</span>
          </div>
          <div class="countdown-segment">
            <span class="countdown-number" id="secs-${index}">--</span>
            <span class="countdown-unit">s</span>
          </div>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  // Initialize Lucide icons on newly rendered elements
  lucide.createIcons();
  
  // Immediately run a tick to populate the countdown timers
  updateAllCountdowns();
}

// Date formatter helpers
function getFormattedDate(date, timeZone) {
  const options = {
    timeZone: timeZone,
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function getFormattedTime(date, timeZone) {
  const options = {
    timeZone: timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Get short abbreviation of selected timezone for display
function getSelectedTimezoneAbbr() {
  if (currentSelectedTimezone === 'local') {
    try {
      // Formats short timezone code, e.g. "GMT+4" or "EST"
      const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      return tzPart ? tzPart.value : 'Local';
    } catch (e) {
      return 'Local';
    }
  }
  
  // Fetch abbreviation by mapping or let Intl format it
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: currentSelectedTimezone, timeZoneName: 'short' }).formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : currentSelectedTimezone;
  } catch (e) {
    // Fallback if abbreviation lookup fails
    const found = curatedTimezones.find(tz => tz.value === currentSelectedTimezone);
    return found ? found.label.split(' ')[0] : currentSelectedTimezone;
  }
}

// Update the header current time label
function updateCurrentTimeLabel() {
  const label = document.getElementById('current-time-label');
  const now = new Date();
  
  const tz = currentSelectedTimezone === 'local' ? undefined : currentSelectedTimezone;
  
  const options = {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  try {
    const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
    label.textContent = `Current Time: ${timeStr} (${getSelectedTimezoneAbbr()})`;
  } catch (e) {
    label.textContent = `Current Time: ${now.toLocaleTimeString()}`;
  }
}

// Start the ticker interval that updates all countdowns once per second
function startCountdownTimer() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
  }
  countdownIntervalId = setInterval(updateAllCountdowns, 1000);
}

// Update countdown numbers for all cards in grid
function updateAllCountdowns() {
  const cards = document.querySelectorAll('.match-card');
  const now = new Date().getTime();
  let matchesOverCount = 0;
  
  if (cards.length > 0) {
    cards.forEach(card => {
      const timestamp = parseInt(card.getAttribute('data-timestamp'), 10);
      const matchIndex = parseInt(card.getAttribute('data-match-index'), 10);
      const idSuffix = card.id.split('-').pop();
      const diff = timestamp - now;
      
      // Look up score data in the match dictionary
      const match = matchesData[matchIndex];
      const hasScore = match && match.score && match.score.ft;
      
      const countdownBar = document.getElementById(`countdown-bar-${idSuffix}`);
      const digitsContainer = document.getElementById(`countdown-digits-${idSuffix}`);
      
      // Match in future
      if (diff > 0) {
        // Restore default structure if live state was set
        card.classList.remove('live');
        if (countdownBar) {
          countdownBar.innerHTML = `
            <span class="countdown-label">Starts In</span>
            <div class="countdown-digits" id="countdown-digits-${idSuffix}">
              <div class="countdown-segment">
                <span class="countdown-number" id="days-${idSuffix}">--</span>
                <span class="countdown-unit">d</span>
              </div>
              <div class="countdown-segment">
                <span class="countdown-number" id="hours-${idSuffix}">--</span>
                <span class="countdown-unit">h</span>
              </div>
              <div class="countdown-segment">
                <span class="countdown-number" id="mins-${idSuffix}">--</span>
                <span class="countdown-unit">m</span>
              </div>
              <div class="countdown-segment">
                <span class="countdown-number" id="secs-${idSuffix}">--</span>
                <span class="countdown-unit">s</span>
              </div>
            </div>
          `;
        }
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById(`days-${idSuffix}`);
        const hoursEl = document.getElementById(`hours-${idSuffix}`);
        const minsEl = document.getElementById(`mins-${idSuffix}`);
        const secsEl = document.getElementById(`secs-${idSuffix}`);
        
        if (daysEl) daysEl.textContent = d.toString().padStart(2, '0');
        if (hoursEl) hoursEl.textContent = h.toString().padStart(2, '0');
        if (minsEl) minsEl.textContent = m.toString().padStart(2, '0');
        if (secsEl) secsEl.textContent = s.toString().padStart(2, '0');
      } 
      // Match in progress (started less than 2.5 hours ago AND doesn't have score data yet)
      else if (diff <= 0 && Math.abs(diff) <= 150 * 60 * 1000 && !hasScore) {
        card.classList.add('live');
        
        if (countdownBar) {
          countdownBar.innerHTML = `
            <span class="countdown-label" style="color: var(--accent-green); font-weight: 700;">Status</span>
            <div class="live-badge">
              <span class="live-dot"></span>
              <span>LIVE / IN PROGRESS</span>
            </div>
          `;
        }
      } 
      // Match completely over (concluded due to time cutoff OR has score data)
      else {
        // Hide card
        card.classList.add('hidden');
        matchesOverCount++;
      }
    });
  }
  
  // Also update bracket countdowns
  updateBracketCountdowns();
  
  // If some matches completed since last render, trigger a full re-render
  if (matchesOverCount > 0) {
    renderMatches();
    renderMatchResults();
    renderStandings();
    renderScorers();
    renderBracket();
  }
}

// ==========================================
// NEW TAB NAVIGATION, RESULTS, AND STANDINGS FUNCTIONS
// ==========================================

// Set up navigation tab buttons
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = tab.getAttribute('data-tab');
      if (targetTab === currentActiveTab) return;
      
      // Update UI tabs state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Toggle tab views with view transitions if supported
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          switchTab(targetTab);
        });
      } else {
        switchTab(targetTab);
      }
    });
  });
}

function switchTab(tabId) {
  currentActiveTab = tabId;
  const views = document.querySelectorAll('.tab-view');
  views.forEach(view => {
    if (view.id === `${tabId}-view`) {
      view.classList.add('active');
      view.classList.remove('hidden');
    } else {
      view.classList.remove('active');
      view.classList.add('hidden');
    }
  });
  
  // Update header count label based on active tab
  updateCountLabel();
}

function updateCountLabel() {
  const label = document.getElementById('matches-count-label');
  if (!label) return;
  
  if (currentActiveTab === 'upcoming') {
    const upcomingCount = getUpcomingMatches().length;
    label.textContent = `${upcomingCount} Match${upcomingCount === 1 ? '' : 'es'} Remaining`;
  } else if (currentActiveTab === 'results') {
    const resultsCount = getFilteredResults().length;
    label.textContent = `${resultsCount} Result${resultsCount === 1 ? '' : 's'} Concluded`;
  } else if (currentActiveTab === 'standings') {
    label.textContent = `12 Groups Standings`;
  } else if (currentActiveTab === 'scorers') {
    const scorersCount = getFilteredScorers().length;
    label.textContent = `${scorersCount} Goalscorer${scorersCount === 1 ? '' : 's'} Tallied`;
  } else if (currentActiveTab === 'bracket') {
    label.textContent = `32 Knockout Matches`;
  }
}

function setupFilterListeners() {
  // No filters remaining
}

function getUpcomingMatches() {
  const now = new Date();
  const isOverCutoffMs = 150 * 60 * 1000;
  return matchesData.filter(match => {
    const hasScore = match.score && match.score.ft;
    if (hasScore) return false;
    return (match.parsedDateTime.getTime() + isOverCutoffMs) > now.getTime();
  });
}

function getMatchResults() {
  return matchesData.filter(match => match.score && match.score.ft);
}

function getFilteredResults() {
  const results = getMatchResults();
  
  // Chronologically descending (newest results first)
  return [...results].sort((a, b) => b.parsedDateTime - a.parsedDateTime);
}

// Render completed match results
function renderMatchResults() {
  const resultsList = document.getElementById('results-list');
  const emptyState = document.getElementById('no-results-message');
  if (!resultsList || !emptyState) return;
  
  resultsList.innerHTML = '';
  
  const filtered = getFilteredResults();
  
  // Update count label if on results tab
  if (currentActiveTab === 'results') {
    updateCountLabel();
  }
  
  if (filtered.length === 0) {
    resultsList.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  
  resultsList.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  filtered.forEach(match => {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // Resolve timezone
    const tz = currentSelectedTimezone === 'local' ? undefined : currentSelectedTimezone;
    
    // Format date and time
    const matchDateStr = getFormattedDate(match.parsedDateTime, tz);
    const matchTimeStr = getFormattedTime(match.parsedDateTime, tz);
    
    const formattedTeam1 = formatPlaceholderTeamName(match.team1);
    const formattedTeam2 = formatPlaceholderTeamName(match.team2);
    
    const team1FlagHtml = getFlagHtml(match.team1);
    const team2FlagHtml = getFlagHtml(match.team2);
    
    // Goals content
    let goalsHtml = '';
    const hasGoals = (match.goals1 && match.goals1.length > 0) || (match.goals2 && match.goals2.length > 0);
    
    if (hasGoals) {
      const goals1Items = (match.goals1 || []).map(g => {
        const typeIcon = g.owngoal ? ' (OG)' : g.penalty ? ' (P)' : '';
        return `<div class="goalscorer-item"><i data-lucide="circle-play"></i><span>${g.name} ${g.minute}'${typeIcon}</span></div>`;
      }).join('');
      
      const goals2Items = (match.goals2 || []).map(g => {
        const typeIcon = g.owngoal ? ' (OG)' : g.penalty ? ' (P)' : '';
        return `<div class="goalscorer-item"><i data-lucide="circle-play"></i><span>${g.name} ${g.minute}'${typeIcon}</span></div>`;
      }).join('');
      
      goalsHtml = `
        <div class="result-goals-container">
          <div class="team-goals team-1-goals">
            ${goals1Items}
          </div>
          <div class="team-goals team-2-goals">
            ${goals2Items}
          </div>
        </div>
      `;
    }
    
    const mainScore1 = match.score.et ? match.score.et[0] : match.score.ft[0];
    const mainScore2 = match.score.et ? match.score.et[1] : match.score.ft[1];
    
    let subScoreHtml = '';
    let badgeHtml = '';
    const extraLines = [];
    
    if (match.score.ht) {
      extraLines.push(`HT: ${match.score.ht[0]}-${match.score.ht[1]}`);
    }
    if (match.score.et) {
      if (match.score.ft && (match.score.ft[0] !== match.score.et[0] || match.score.ft[1] !== match.score.et[1])) {
        extraLines.push(`FT: ${match.score.ft[0]}-${match.score.ft[1]}`);
      }
      extraLines.push(`ET: ${match.score.et[0]}-${match.score.et[1]}`);
    }
    
    if (match.score.p) {
      badgeHtml = `<div class="result-penalty-badge"><i data-lucide="award" style="width:12px; height:12px;"></i>Pens: ${match.score.p[0]}-${match.score.p[1]}</div>`;
    }
    
    if (extraLines.length > 0 || badgeHtml) {
      subScoreHtml = `
        <div class="result-details-block">
          ${badgeHtml}
          ${extraLines.length > 0 ? `<div class="result-extra-scores">${extraLines.map(line => `<div>${line}</div>`).join('')}</div>` : ''}
        </div>
      `;
    }
    
    const winnerIndex = getWinnerOfMatch(match);
    const t1WinnerClass = winnerIndex === 1 ? 'winner' : '';
    const t2WinnerClass = winnerIndex === 2 ? 'winner' : '';
    
    card.innerHTML = `
      <div class="result-card-header">
        <span class="round">${match.round}</span>
        <span class="group">${match.group || 'Knockout Stage'}</span>
      </div>
      <div class="result-match-body">
        <div class="result-team team-1 ${t1WinnerClass}">
          <span class="team-name" title="${formattedTeam1}">${formattedTeam1}</span>
          ${team1FlagHtml}
        </div>
        
        <div class="result-score-block">
          <div class="result-scores">
            <span class="${t1WinnerClass}">${mainScore1}</span>
            <span class="score-dash">-</span>
            <span class="${t2WinnerClass}">${mainScore2}</span>
          </div>
          ${subScoreHtml}
        </div>
        
        <div class="result-team team-2 ${t2WinnerClass}">
          ${team2FlagHtml}
          <span class="team-name" title="${formattedTeam2}">${formattedTeam2}</span>
        </div>
      </div>
      
      ${goalsHtml}
      
      <div class="result-card-footer">
        <div class="footer-item">
          <i data-lucide="map-pin"></i>
          <span>${match.ground}</span>
        </div>
        <div class="footer-item">
          <i data-lucide="calendar"></i>
          <span>${matchDateStr} @ ${matchTimeStr} (${getSelectedTimezoneAbbr()})</span>
        </div>
      </div>
    `;
    
    resultsList.appendChild(card);
  });
  
  lucide.createIcons();
}

// Compute group standings dynamically and render
function renderStandings() {
  const grid = document.getElementById('standings-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const qualifiedTeams = getQualifiedTeams();
  const standings = getGroupStandings();
  
  Object.keys(standings).sort().forEach(groupName => {
    const sortedTeams = standings[groupName];
    
    // Create Group Card
    const card = document.createElement('div');
    card.className = 'group-card';
    
    // Table Header
    let tableRows = '';
    sortedTeams.forEach((team, idx) => {
      const pos = idx + 1;
      const isQualifying = pos <= 2;
      const rowClass = isQualifying ? 'qualify-row' : '';
      const cleanTeamName = formatPlaceholderTeamName(team.name);
      const flagHtml = getFlagHtml(team.name);
      
      const isQualified = qualifiedTeams.has(team.name.trim());
      const badgeHtml = isQualified ? `<span class="qualified-badge" title="Qualified for Round of 32">Q</span>` : '';
      
      tableRows += `
        <tr class="${rowClass}">
          <td class="pos-cell">${pos}</td>
          <td class="align-left">
            <div class="standings-team-name">
              ${flagHtml}
              <span title="${cleanTeamName}">${cleanTeamName}</span>
              ${badgeHtml}
            </div>
          </td>
          <td>${team.played}</td>
          <td>${team.won}</td>
          <td>${team.drawn}</td>
          <td>${team.lost}</td>
          <td>${team.gf}:${team.ga}</td>
          <td>${team.gd > 0 ? '+' : ''}${team.gd}</td>
          <td class="pts-cell">${team.pts}</td>
        </tr>
      `;
    });
    
    card.innerHTML = `
      <div class="group-title">
        <span>${groupName}</span>
      </div>
      <table class="standings-table">
        <thead>
          <tr>
            <th style="width: 8%;">#</th>
            <th class="align-left" style="width: 42%;">Team</th>
            <th style="width: 7%;">P</th>
            <th style="width: 7%;">W</th>
            <th style="width: 7%;">D</th>
            <th style="width: 7%;">L</th>
            <th style="width: 12%;">G</th>
            <th style="width: 8%;">GD</th>
            <th class="pts-header" style="width: 10%;">PTS</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
    
    grid.appendChild(card);
  });
  
  lucide.createIcons();
}

// ==========================================
// KNOCKOUT BRACKET HELPER AND RENDER LOGIC
// ==========================================

// Global state for bracket view
let bracketZoomLevel = 1.0;
let activeBracketRound = 'round-32';

// Tournament bracket pairing tree structure mapping
const bracketStructure = {
  r32: [
    [74, 77],
    [73, 75],
    [83, 84],
    [81, 82],
    [76, 78],
    [79, 80],
    [86, 88],
    [85, 87]
  ],
  r16: [
    [89, 90],
    [93, 94],
    [91, 92],
    [95, 96]
  ],
  qf: [
    [97, 98],
    [99, 100]
  ],
  sf: [
    [101, 102]
  ]
};

// Bracket path tracking mapping for hovered cards (matchNum -> next match in path)
const forwardBracketMap = {
  74: { next: 89, pos: 'top' },
  77: { next: 89, pos: 'bottom' },
  73: { next: 90, pos: 'top' },
  75: { next: 90, pos: 'bottom' },
  83: { next: 93, pos: 'top' },
  84: { next: 93, pos: 'bottom' },
  81: { next: 94, pos: 'top' },
  82: { next: 94, pos: 'bottom' },
  76: { next: 91, pos: 'top' },
  78: { next: 91, pos: 'bottom' },
  79: { next: 92, pos: 'top' },
  80: { next: 92, pos: 'bottom' },
  86: { next: 95, pos: 'top' },
  88: { next: 95, pos: 'bottom' },
  85: { next: 96, pos: 'top' },
  87: { next: 96, pos: 'bottom' },
  
  89: { next: 97, pos: 'top' },
  90: { next: 97, pos: 'bottom' },
  93: { next: 98, pos: 'top' },
  94: { next: 98, pos: 'bottom' },
  91: { next: 99, pos: 'top' },
  92: { next: 99, pos: 'bottom' },
  95: { next: 100, pos: 'top' },
  96: { next: 100, pos: 'bottom' },
  
  97: { next: 101, pos: 'top' },
  98: { next: 101, pos: 'bottom' },
  99: { next: 102, pos: 'top' },
  100: { next: 102, pos: 'bottom' },
  
  101: { next: 104, pos: 'top' },
  102: { next: 104, pos: 'bottom' }
};

// Standings simulation cache to avoid duplicate computations
const confirmedStandingsCache = {};

function clearConfirmedStandingsCache() {
  for (const key in confirmedStandingsCache) {
    delete confirmedStandingsCache[key];
  }
}

// Standings simulator using 3^R outcomes of remaining matches to check if a group position is mathematically finalized
function getConfirmedGroupPosition(groupLetter, positionIndex) {
  const cacheKey = `${groupLetter}-${positionIndex}`;
  if (confirmedStandingsCache[cacheKey] !== undefined) {
    return confirmedStandingsCache[cacheKey];
  }

  const groupName = `Group ${groupLetter}`;
  const groupMatches = matchesData.filter(m => m.group === groupName);
  
  const teamsSet = new Set();
  groupMatches.forEach(m => {
    if (m.team1) teamsSet.add(m.team1.trim());
    if (m.team2) teamsSet.add(m.team2.trim());
  });
  const teams = Array.from(teamsSet);
  
  if (teams.length === 0) {
    confirmedStandingsCache[cacheKey] = null;
    return null;
  }
  
  const completedMatches = groupMatches.filter(m => m.score && m.score.ft);
  const remainingMatches = groupMatches.filter(m => !m.score || !m.score.ft);
  
  if (remainingMatches.length === 0) {
    const standings = computeStandingsForMatches(teams, completedMatches);
    const teamName = standings[positionIndex] ? standings[positionIndex].name : null;
    confirmedStandingsCache[cacheKey] = teamName;
    return teamName;
  }
  
  const allOutcomesStandings = [];
  
  function simulate(matchIndex, simulatedMatches) {
    if (matchIndex === remainingMatches.length) {
      const standings = computeStandingsForMatches(teams, simulatedMatches);
      allOutcomesStandings.push(standings);
      return;
    }
    
    const match = remainingMatches[matchIndex];
    
    // Win team 1
    simulate(matchIndex + 1, [...simulatedMatches, {
      ...match,
      score: { ft: [1, 0] }
    }]);
    
    // Draw
    simulate(matchIndex + 1, [...simulatedMatches, {
      ...match,
      score: { ft: [0, 0] }
    }]);
    
    // Win team 2
    simulate(matchIndex + 1, [...simulatedMatches, {
      ...match,
      score: { ft: [0, 1] }
    }]);
  }
  
  simulate(0, completedMatches);
  
  const firstOutcomeTeam = allOutcomesStandings[0][positionIndex] ? allOutcomesStandings[0][positionIndex].name : null;
  if (!firstOutcomeTeam) {
    confirmedStandingsCache[cacheKey] = null;
    return null;
  }
  
  const isInvariant = allOutcomesStandings.every(standing => {
    return standing[positionIndex] && standing[positionIndex].name === firstOutcomeTeam;
  });
  
  const confirmedTeam = isInvariant ? firstOutcomeTeam : null;
  confirmedStandingsCache[cacheKey] = confirmedTeam;
  return confirmedTeam;
}

function computeStandingsForMatches(teams, matches) {
  const stats = {};
  teams.forEach(t => {
    stats[t] = { name: t, pts: 0, gd: 0, gf: 0, ga: 0 };
  });
  
  matches.forEach(m => {
    const t1 = m.team1.trim();
    const t2 = m.team2.trim();
    if (m.score && m.score.ft) {
      const g1 = m.score.ft[0];
      const g2 = m.score.ft[1];
      
      stats[t1].gf += g1;
      stats[t1].ga += g2;
      stats[t2].gf += g2;
      stats[t2].ga += g1;
      
      if (g1 > g2) {
        stats[t1].pts += 3;
      } else if (g2 > g1) {
        stats[t2].pts += 3;
      } else {
        stats[t1].pts += 1;
        stats[t2].pts += 1;
      }
    }
  });
  
  teams.forEach(t => {
    stats[t].gd = stats[t].gf - stats[t].ga;
  });
  
  return [...teams].map(t => stats[t]).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}

// Compute group standings dynamically
function getGroupStandings() {
  const groupMatches = matchesData.filter(m => m.group && m.group.startsWith('Group'));
  const groupsSet = new Set();
  groupMatches.forEach(m => groupsSet.add(m.group));
  const groupsList = Array.from(groupsSet).sort();
  
  const standings = {};
  
  groupsList.forEach(groupName => {
    const matchesInGroup = groupMatches.filter(m => m.group === groupName);
    const teamsInGroupSet = new Set();
    matchesInGroup.forEach(m => {
      if (m.team1) teamsInGroupSet.add(m.team1);
      if (m.team2) teamsInGroupSet.add(m.team2);
    });
    const teamsList = Array.from(teamsInGroupSet);
    
    const stats = {};
    teamsList.forEach(team => {
      stats[team] = {
        name: team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0
      };
    });
    
    const resultsInGroup = matchesInGroup.filter(m => m.score && m.score.ft);
    resultsInGroup.forEach(match => {
      const t1 = match.team1;
      const t2 = match.team2;
      const g1 = match.score.ft[0];
      const g2 = match.score.ft[1];
      
      if (stats[t1] && stats[t2]) {
        stats[t1].played++;
        stats[t2].played++;
        stats[t1].gf += g1;
        stats[t1].ga += g2;
        stats[t2].gf += g2;
        stats[t2].ga += g1;
        
        if (g1 > g2) {
          stats[t1].won++;
          stats[t1].pts += 3;
          stats[t2].lost++;
        } else if (g1 < g2) {
          stats[t2].won++;
          stats[t2].pts += 3;
          stats[t1].lost++;
        } else {
          stats[t1].drawn++;
          stats[t1].pts += 1;
          stats[t2].drawn++;
          stats[t2].pts += 1;
        }
      }
    });
    
    teamsList.forEach(team => {
      stats[team].gd = stats[team].gf - stats[team].ga;
    });
    
    standings[groupName] = teamsList.map(t => stats[t]).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });
  });
  
  return standings;
}

// Identify top 8 third-place teams based on current standings
function getTop8ThirdPlaceTeams(standings) {
  const thirdPlaceTeams = [];
  Object.keys(standings).sort().forEach(groupName => {
    const sortedTeams = standings[groupName];
    if (sortedTeams.length >= 3) {
      const teamStats = sortedTeams[2];
      
      // Calculate wins count
      const groupMatches = matchesData.filter(m => m.group === groupName);
      const completed = groupMatches.filter(m => m.score && m.score.ft);
      let won = 0;
      completed.forEach(m => {
        if (m.team1 === teamStats.name && m.score.ft[0] > m.score.ft[1]) won++;
        if (m.team2 === teamStats.name && m.score.ft[1] > m.score.ft[0]) won++;
      });
      
      thirdPlaceTeams.push({
        groupName: groupName,
        groupLetter: groupName.replace('Group ', ''),
        name: teamStats.name,
        pts: teamStats.pts,
        gd: teamStats.gd,
        gf: teamStats.gf,
        won: won
      });
    }
  });
  
  // Sort: Points -> GD -> GF -> Wins -> Alphabetical by groupName
  thirdPlaceTeams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.won !== a.won) return b.won - a.won;
    return a.groupLetter.localeCompare(b.groupLetter);
  });
  
  return thirdPlaceTeams.slice(0, 8);
}

// Bipartite Matching for Third-Place Allocation in Round of 32
function resolveThirdPlaceSlots(top8Thirds) {
  const slots = [
    { id: '74', label: '3A/B/C/D/F', allowed: new Set(['A', 'B', 'C', 'D', 'F']) },
    { id: '77', label: '3C/D/F/G/H', allowed: new Set(['C', 'D', 'F', 'G', 'H']) },
    { id: '79', label: '3C/E/F/H/I', allowed: new Set(['C', 'E', 'F', 'H', 'I']) },
    { id: '80', label: '3E/H/I/J/K', allowed: new Set(['E', 'H', 'I', 'J', 'K']) },
    { id: '81', label: '3B/E/F/I/J', allowed: new Set(['B', 'E', 'F', 'I', 'J']) },
    { id: '82', label: '3A/E/H/I/J', allowed: new Set(['A', 'E', 'H', 'I', 'J']) },
    { id: '85', label: '3E/F/G/I/J', allowed: new Set(['E', 'F', 'G', 'I', 'J']) },
    { id: '87', label: '3D/E/I/J/L', allowed: new Set(['D', 'E', 'I', 'J', 'L']) }
  ];
  
  const assignment = {};
  const usedTeams = new Set();
  
  function dfs(slotIndex) {
    if (slotIndex === slots.length) return true;
    const slot = slots[slotIndex];
    for (let i = 0; i < top8Thirds.length; i++) {
      if (usedTeams.has(i)) continue;
      const team = top8Thirds[i];
      if (slot.allowed.has(team.groupLetter)) {
        usedTeams.add(i);
        assignment[slot.id] = team.name;
        if (dfs(slotIndex + 1)) return true;
        usedTeams.delete(i);
        delete assignment[slot.id];
      }
    }
    return false;
  }
  
  const matched = dfs(0);
  
  if (!matched) {
    console.warn("Bipartite matching failed. Using greedy fallback.");
    const used = new Set();
    slots.forEach(slot => {
      const team = top8Thirds.find((t, idx) => !used.has(idx) && slot.allowed.has(t.groupLetter));
      if (team) {
        const idx = top8Thirds.indexOf(team);
        used.add(idx);
        assignment[slot.id] = team.name;
      } else {
        const fallbackTeam = top8Thirds.find((t, idx) => !used.has(idx));
        if (fallbackTeam) {
          const idx = top8Thirds.indexOf(fallbackTeam);
          used.add(idx);
          assignment[slot.id] = fallbackTeam.name;
        } else {
          assignment[slot.id] = slot.label;
        }
      }
    });
  }
  
  return assignment;
}

// Trace and resolve all teams in the bracket view
function resolveBracketTeams() {
  const standings = getGroupStandings();
  const groupMatches = matchesData.filter(m => m.group && m.group.startsWith('Group'));
  const allGroupMatchesCompleted = groupMatches.every(m => m.score && m.score.ft);
  
  let thirdPlaceAssignments = {};
  if (allGroupMatchesCompleted) {
    const top8Thirds = getTop8ThirdPlaceTeams(standings);
    thirdPlaceAssignments = resolveThirdPlaceSlots(top8Thirds);
  }
  
  const resolved = {};
  const knockoutMatches = matchesData.filter(m => !m.group || !m.group.startsWith('Group'));
  knockoutMatches.sort((a, b) => a.num - b.num);
  
  knockoutMatches.forEach(match => {
    const num = match.num.toString();
    
    const resolveTeam = (teamStr) => {
      if (!teamStr) return { name: '', isPlaceholder: true };
      const clean = teamStr.trim();
      
      // 1. Group Winner "1A"
      const groupWinnerMatch = clean.match(/^1([A-L])$/);
      if (groupWinnerMatch) {
        const groupLetter = groupWinnerMatch[1];
        const confirmedTeamName = getConfirmedGroupPosition(groupLetter, 0);
        if (confirmedTeamName) {
          return { name: confirmedTeamName, resolvedFrom: clean, isPlaceholder: false };
        }
        return { name: `Winner Group ${groupLetter}`, resolvedFrom: clean, isPlaceholder: true };
      }
      
      // 2. Group Runner-up "2A"
      const groupRunnerMatch = clean.match(/^2([A-L])$/);
      if (groupRunnerMatch) {
        const groupLetter = groupRunnerMatch[1];
        const confirmedTeamName = getConfirmedGroupPosition(groupLetter, 1);
        if (confirmedTeamName) {
          return { name: confirmedTeamName, resolvedFrom: clean, isPlaceholder: false };
        }
        return { name: `Runner-up Group ${groupLetter}`, resolvedFrom: clean, isPlaceholder: true };
      }
      
      // 3. Third place slot "3A/B/C/D/F"
      const isThirdPlace = clean.startsWith('3') && clean.includes('/');
      if (isThirdPlace) {
        const resolvedName = thirdPlaceAssignments[num];
        if (resolvedName) {
          const isReal = countryToIso[resolvedName] !== undefined;
          return { name: resolvedName, resolvedFrom: clean, isPlaceholder: !isReal };
        }
        return { name: `3rd Place ${clean.substring(1)}`, resolvedFrom: clean, isPlaceholder: true };
      }
      
      // 4. Mapped Literal Pre-Assigned Hosts (Mexico -> 1A, Germany -> 1E, USA -> 1D)
      let mappedPlaceholder = null;
      if (clean === 'Germany' && num === '74') mappedPlaceholder = '1E';
      if (clean === 'Mexico' && num === '79') mappedPlaceholder = '1A';
      if (clean === 'USA' && num === '81') mappedPlaceholder = '1D';
      
      if (mappedPlaceholder) {
        const resolvedVal = resolveTeam(mappedPlaceholder);
        if (!resolvedVal.isPlaceholder) {
          return resolvedVal;
        }
      }
      
      // 5. Match Winner "W73"
      const winnerOfMatch = clean.match(/^W(\d+)$/);
      if (winnerOfMatch) {
        const sourceNum = winnerOfMatch[1];
        const sourceMatch = matchesData.find(m => m.num !== undefined && m.num.toString() === sourceNum);
        
        if (sourceMatch && sourceMatch.score) {
          const winnerIndex = getWinnerOfMatch(sourceMatch);
          if (winnerIndex === 1) return { name: sourceMatch.team1, resolvedFrom: clean, isPlaceholder: false };
          if (winnerIndex === 2) return { name: sourceMatch.team2, resolvedFrom: clean, isPlaceholder: false };
        }
        
        const sourceResolved = resolved[sourceNum];
        if (sourceResolved) {
          const t1 = sourceResolved.team1.name;
          const t2 = sourceResolved.team2.name;
          const label = `Winner Match ${sourceNum}`;
          const hint = `${t1} / ${t2}`;
          return { name: label, hint: hint, resolvedFrom: clean, isPlaceholder: true };
        }
        
        return { name: `Winner Match ${sourceNum}`, resolvedFrom: clean, isPlaceholder: true };
      }
      
      // 6. Match Loser "L101"
      const loserOfMatch = clean.match(/^L(\d+)$/);
      if (loserOfMatch) {
        const sourceNum = loserOfMatch[1];
        const sourceMatch = matchesData.find(m => m.num !== undefined && m.num.toString() === sourceNum);
        
        if (sourceMatch && sourceMatch.score) {
          const winnerIndex = getWinnerOfMatch(sourceMatch);
          if (winnerIndex === 1) return { name: sourceMatch.team2, resolvedFrom: clean, isPlaceholder: false };
          if (winnerIndex === 2) return { name: sourceMatch.team1, resolvedFrom: clean, isPlaceholder: false };
        }
        
        const sourceResolved = resolved[sourceNum];
        if (sourceResolved) {
          const t1 = sourceResolved.team1.name;
          const t2 = sourceResolved.team2.name;
          const label = `Loser Match ${sourceNum}`;
          const hint = `${t1} / ${t2}`;
          return { name: label, hint: hint, resolvedFrom: clean, isPlaceholder: true };
        }
        
        return { name: `Loser Match ${sourceNum}`, resolvedFrom: clean, isPlaceholder: true };
      }
      
      const isReal = countryToIso[clean] !== undefined;
      return { name: clean, resolvedFrom: clean, isPlaceholder: !isReal };
    };
    
    resolved[num] = {
      match: match,
      team1: resolveTeam(match.team1),
      team2: resolveTeam(match.team2)
    };
  });
  
  return resolved;
}

// Helper to check if a round is completely finished
function isRoundComplete(colSpec) {
  const matchNums = colSpec.type === 'pairs' ? colSpec.matches.flat() : colSpec.matches;
  if (!matchNums || matchNums.length === 0) return false;
  
  return matchNums.every(num => {
    const match = matchesData.find(m => m.num !== undefined && m.num.toString() === num.toString());
    return match && match.score && match.score.ft;
  });
}

// Render dynamic bracket layout
function renderBracket() {
  const container = document.getElementById('bracket-tree-container');
  if (!container) return;
  container.innerHTML = '';
  
  const resolved = resolveBracketTeams();
  
  const createMatchCardHtml = (matchNum, label) => {
    const data = resolved[matchNum];
    if (!data) return '';
    const match = data.match;
    const team1 = data.team1;
    const team2 = data.team2;
    
    const isLive = match.score && !match.score.ft && (new Date() - match.parsedDateTime >= 0);
    const hasFinished = match.score && match.score.ft;
    
    const cleanTeam1 = formatPlaceholderTeamName(team1.name);
    const cleanTeam2 = formatPlaceholderTeamName(team2.name);
    
    const flag1Html = getFlagHtml(team1.name);
    const flag2Html = getFlagHtml(team2.name);
    
    let statusHtml = '';
    let score1Html = '';
    let score2Html = '';
    
    if (hasFinished) {
      if (match.score.p) {
        const scoreBase = match.score.et || match.score.ft;
        score1Html = `<span class="bracket-team-score">${scoreBase[0]} <span class="bracket-penalty-score">(${match.score.p[0]})</span></span>`;
        score2Html = `<span class="bracket-team-score">${scoreBase[1]} <span class="bracket-penalty-score">(${match.score.p[1]})</span></span>`;
        statusHtml = `<span class="bracket-card-status">PEN</span>`;
      } else if (match.score.et) {
        score1Html = `<span class="bracket-team-score">${match.score.et[0]}</span>`;
        score2Html = `<span class="bracket-team-score">${match.score.et[1]}</span>`;
        statusHtml = `<span class="bracket-card-status">AET</span>`;
      } else {
        score1Html = `<span class="bracket-team-score">${match.score.ft[0]}</span>`;
        score2Html = `<span class="bracket-team-score">${match.score.ft[1]}</span>`;
        statusHtml = `<span class="bracket-card-status">FT</span>`;
      }
    } else if (isLive) {
      statusHtml = `<span class="bracket-card-status live">LIVE</span>`;
    }
    
    const winnerIndex = getWinnerOfMatch(match);
    const t1WinnerClass = hasFinished && winnerIndex === 1 ? 'winner' : '';
    const t2WinnerClass = hasFinished && winnerIndex === 2 ? 'winner' : '';
    
    const t1HintHtml = team1.hint ? `<span class="bracket-team-name font-small" style="font-size:0.75rem; color:var(--text-muted);" title="${team1.hint}">(${team1.hint})</span>` : '';
    const t2HintHtml = team2.hint ? `<span class="bracket-team-name font-small" style="font-size:0.75rem; color:var(--text-muted);" title="${team2.hint}">(${team2.hint})</span>` : '';
    
    const cardClass = isLive ? 'bracket-card live-card' : 'bracket-card';
    
    return `
      <div class="${cardClass}" data-match-num="${matchNum}">
        <div class="bracket-card-header">
          <span class="bracket-card-matchnum">Match ${matchNum}</span>
          ${statusHtml}
        </div>
        <div class="bracket-card-teams">
          <div class="bracket-team-row ${t1WinnerClass}">
            <div class="bracket-team-info">
              ${flag1Html}
              <div class="bracket-team-name-group" style="display:flex; flex-direction:column; min-width:0;">
                <span class="bracket-team-name" title="${cleanTeam1}">${cleanTeam1}</span>
                ${t1HintHtml}
              </div>
            </div>
            ${score1Html}
          </div>
          <div class="bracket-team-row ${t2WinnerClass}">
            <div class="bracket-team-info">
              ${flag2Html}
              <div class="bracket-team-name-group" style="display:flex; flex-direction:column; min-width:0;">
                <span class="bracket-team-name" title="${cleanTeam2}">${cleanTeam2}</span>
                ${t2HintHtml}
              </div>
            </div>
            ${score2Html}
          </div>
        </div>
      </div>
    `;
  };
  
  const bracketColumns = [
    {
      id: 'left-r32',
      name: 'Round of 32',
      side: 'left',
      type: 'pairs',
      roundName: 'R32',
      matches: [[74, 77], [73, 75], [83, 84], [81, 82]],
      isFirstRound: true
    },
    {
      id: 'left-r16',
      name: 'Round of 16',
      side: 'left',
      type: 'pairs',
      roundName: 'R16',
      matches: [[89, 90], [93, 94]]
    },
    {
      id: 'left-qf',
      name: 'Quarter-finals',
      side: 'left',
      type: 'pairs',
      roundName: 'QF',
      matches: [[97, 98]]
    },
    {
      id: 'left-sf',
      name: 'Semi-finals',
      side: 'left',
      type: 'single',
      roundName: 'SF',
      matches: [101],
      isLastRound: true
    },
    {
      id: 'center-finals',
      name: 'Finals',
      side: 'center',
      type: 'center',
      matches: [104, 103]
    },
    {
      id: 'right-sf',
      name: 'Semi-finals',
      side: 'right',
      type: 'single',
      roundName: 'SF',
      matches: [102],
      isLastRound: true
    },
    {
      id: 'right-qf',
      name: 'Quarter-finals',
      side: 'right',
      type: 'pairs',
      roundName: 'QF',
      matches: [[99, 100]]
    },
    {
      id: 'right-r16',
      name: 'Round of 16',
      side: 'right',
      type: 'pairs',
      roundName: 'R16',
      matches: [[91, 92], [95, 96]]
    },
    {
      id: 'right-r32',
      name: 'Round of 32',
      side: 'right',
      type: 'pairs',
      roundName: 'R32',
      matches: [[76, 78], [79, 80], [86, 88], [85, 87]],
      isFirstRound: true
    }
  ];
  
  bracketColumns.forEach(colSpec => {
    const col = document.createElement('div');
    col.className = 'bracket-round';
    col.setAttribute('data-round-id', colSpec.id);
    
    // Add layout modifiers
    if (colSpec.side === 'left') {
      col.classList.add('left-side');
    } else if (colSpec.side === 'right') {
      col.classList.add('right-side');
    } else {
      col.classList.add('center-side');
    }
    
    if (colSpec.isFirstRound) col.classList.add('first-round');
    if (colSpec.isLastRound) col.classList.add('last-round');
    
    // Default collapse the round if it's collapsible and all matches are finished
    const isCollapsible = colSpec.roundName === 'R32' || colSpec.roundName === 'R16';
    if (isCollapsible && isRoundComplete(colSpec)) {
      col.classList.add('collapsed');
    }
    
    // Header
    let subtitle = '';
    if (colSpec.type === 'pairs') {
      subtitle = `${colSpec.matches.length * 2} Matches`;
    } else if (colSpec.type === 'single') {
      subtitle = `1 Match`;
    } else {
      subtitle = `Champions & 3rd Place`;
    }
    
    if (isCollapsible) {
      const isLeft = colSpec.side === 'left';
      col.innerHTML = `
        <div class="bracket-round-header">
          <div class="header-expanded-content">
            <h3>
              ${colSpec.name}
              <span class="bracket-round-subtitle">(${subtitle})</span>
            </h3>
            <button class="collapse-toggle-btn" title="Collapse Column">
              <i data-lucide="${isLeft ? 'chevron-left' : 'chevron-right'}"></i>
            </button>
          </div>
          <div class="header-collapsed-content">
            <button class="collapse-toggle-btn" title="Expand Column">
              <i data-lucide="${isLeft ? 'chevron-right' : 'chevron-left'}"></i>
            </button>
            <div class="vertical-title">${colSpec.name}</div>
          </div>
        </div>
      `;
    } else {
      col.innerHTML = `<div class="bracket-round-header"><h3>${colSpec.name} <span class="bracket-round-subtitle">(${subtitle})</span></h3></div>`;
    }
    
    // Matches
    if (colSpec.type === 'pairs') {
      colSpec.matches.forEach(pair => {
        const pairContainer = document.createElement('div');
        pairContainer.className = 'bracket-match-pair';
        
        const m1Wrapper = document.createElement('div');
        m1Wrapper.className = 'bracket-match';
        m1Wrapper.innerHTML = createMatchCardHtml(pair[0], colSpec.roundName);
        
        const m2Wrapper = document.createElement('div');
        m2Wrapper.className = 'bracket-match';
        m2Wrapper.innerHTML = createMatchCardHtml(pair[1], colSpec.roundName);
        
        pairContainer.appendChild(m1Wrapper);
        pairContainer.appendChild(m2Wrapper);
        col.appendChild(pairContainer);
      });
    } else if (colSpec.type === 'single') {
      colSpec.matches.forEach(matchNum => {
        const pairContainer = document.createElement('div');
        pairContainer.className = 'bracket-match-pair';
        
        const mWrapper = document.createElement('div');
        mWrapper.className = 'bracket-match';
        mWrapper.innerHTML = createMatchCardHtml(matchNum, colSpec.roundName);
        
        pairContainer.appendChild(mWrapper);
        col.appendChild(pairContainer);
      });
    } else if (colSpec.type === 'center') {
      const pairContainer = document.createElement('div');
      pairContainer.className = 'bracket-match-pair';
      
      const finalWrapper = document.createElement('div');
      finalWrapper.className = 'bracket-match';
      finalWrapper.innerHTML = createMatchCardHtml(colSpec.matches[0], 'Final');
      pairContainer.appendChild(finalWrapper);
      col.appendChild(pairContainer);
      
      const thirdPlacePlayoff = document.createElement('div');
      thirdPlacePlayoff.className = 'third-place-container';
      thirdPlacePlayoff.innerHTML = `<div class="third-place-title">Third Place Playoff</div>`;
      
      const tpWrapper = document.createElement('div');
      tpWrapper.className = 'bracket-match';
      tpWrapper.innerHTML = createMatchCardHtml(colSpec.matches[1], '3rd Place');
      thirdPlacePlayoff.appendChild(tpWrapper);
      
      col.appendChild(thirdPlacePlayoff);
    }
    
    container.appendChild(col);
  });
  
  // Wire up collapse toggle buttons
  container.querySelectorAll('.collapse-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const roundCol = btn.closest('.bracket-round');
      if (roundCol) {
        roundCol.classList.toggle('collapsed');
      }
    });
  });
  
  lucide.createIcons();
  setupBracketHighlighting();
}

// Tick all countdowns in the bracket view
function updateBracketCountdowns() {
  const elements = document.querySelectorAll('[id^="bracket-countdown-"]');
  if (elements.length === 0) return;
  
  const now = new Date().getTime();
  
  elements.forEach(el => {
    const matchNum = el.id.split('-').pop();
    const match = matchesData.find(m => m.num !== undefined && m.num.toString() === matchNum);
    if (!match) return;
    
    const diff = match.parsedDateTime.getTime() - now;
    
    if (diff > 0) {
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      el.textContent = `${d}d ${h}h ${m}m ${s}s`;
      el.className = 'bracket-card-countdown';
    } else if (diff <= 0 && Math.abs(diff) <= 150 * 60 * 1000 && !(match.score && match.score.ft)) {
      el.textContent = 'LIVE';
      el.className = 'bracket-card-countdown live';
    } else {
      el.textContent = 'FT';
      el.className = 'bracket-card-time';
    }
  });
}

// Bind Zoom, Scrolling, and Column Shortcuts
function setupBracketControls() {
  const scroller = document.getElementById('bracket-scroller');
  const tree = document.getElementById('bracket-tree-container');
  
  // Drag to scroll
  let isDown = false;
  let startX, startY;
  let scrollLeft, scrollTop;
  
  if (scroller) {
    scroller.addEventListener('mousedown', (e) => {
      if (e.target.closest('.bracket-card') || e.target.closest('button')) return;
      isDown = true;
      scroller.classList.add('grabbing');
      startX = e.pageX - scroller.offsetLeft;
      startY = e.pageY - scroller.offsetTop;
      scrollLeft = scroller.scrollLeft;
      scrollTop = scroller.scrollTop;
    });
    
    scroller.addEventListener('mouseleave', () => {
      isDown = false;
      scroller.classList.remove('grabbing');
    });
    
    scroller.addEventListener('mouseup', () => {
      isDown = false;
      scroller.classList.remove('grabbing');
    });
    
    scroller.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scroller.offsetLeft;
      const y = e.pageY - scroller.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      scroller.scrollLeft = scrollLeft - walkX;
      scroller.scrollTop = scrollTop - walkY;
    });
  }
  
  // Zooming
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomResetBtn = document.getElementById('zoom-reset-btn');
  
  const updateZoom = () => {
    if (tree) {
      tree.style.transform = `scale(${bracketZoomLevel})`;
      if (zoomResetBtn) {
        zoomResetBtn.textContent = `${Math.round(bracketZoomLevel * 100)}%`;
      }
    }
  };
  
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (bracketZoomLevel < 1.4) {
        bracketZoomLevel = Math.min(1.4, bracketZoomLevel + 0.1);
        updateZoom();
      }
    });
  }
  
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (bracketZoomLevel > 0.6) {
        bracketZoomLevel = Math.max(0.6, bracketZoomLevel - 0.1);
        updateZoom();
      }
    });
  }
  
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      bracketZoomLevel = 1.0;
      updateZoom();
    });
  }
}

// Hover event listeners for path tracing
function setupBracketHighlighting() {
  const container = document.getElementById('bracket-tree-container');
  if (!container) return;
  
  container.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.bracket-card');
    if (!card) return;
    
    // Performance and flickering optimization: Only highlight if entering a new card from outside it
    const relatedCard = e.relatedTarget ? e.relatedTarget.closest('.bracket-card') : null;
    if (card === relatedCard) return;
    
    const matchNum = parseInt(card.getAttribute('data-match-num'), 10);
    highlightPath(matchNum, true);
  }, true);
  
  container.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.bracket-card');
    if (!card) return;
    
    // Performance and flickering optimization: Only remove highlight if leaving the card entirely
    const relatedCard = e.relatedTarget ? e.relatedTarget.closest('.bracket-card') : null;
    if (card === relatedCard) return;
    
    const matchNum = parseInt(card.getAttribute('data-match-num'), 10);
    highlightPath(matchNum, false);
  }, true);
}

// Highlight bracket lines recursively to show tournament paths on hover
function highlightPath(startMatchNum, active) {
  let currentNum = startMatchNum;
  
  while (currentNum && forwardBracketMap[currentNum]) {
    const step = forwardBracketMap[currentNum];
    const nextNum = step.next;
    const pos = step.pos;
    
    const currentCard = document.querySelector(`.bracket-card[data-match-num="${currentNum}"]`);
    const currentWrapper = currentCard ? currentCard.closest('.bracket-match') : null;
    const pairContainer = currentWrapper ? currentWrapper.closest('.bracket-match-pair') : null;
    const nextCard = document.querySelector(`.bracket-card[data-match-num="${nextNum}"]`);
    const nextWrapper = nextCard ? nextCard.closest('.bracket-match') : null;
    
    if (active) {
      if (currentCard) currentCard.classList.add('highlight-card');
      if (currentWrapper) currentWrapper.classList.add('path-highlighted-win');
      if (pairContainer) {
        if (pos === 'top') pairContainer.classList.add('path-highlighted-top');
        if (pos === 'bottom') pairContainer.classList.add('path-highlighted-bottom');
      }
      if (nextWrapper) nextWrapper.classList.add('path-highlighted-entry');
      if (nextCard) nextCard.classList.add('highlight-card');
    } else {
      if (currentCard) currentCard.classList.remove('highlight-card');
      if (currentWrapper) currentWrapper.classList.remove('path-highlighted-win');
      if (pairContainer) {
        pairContainer.classList.remove('path-highlighted-top');
        pairContainer.classList.remove('path-highlighted-bottom');
      }
      if (nextWrapper) nextWrapper.classList.remove('path-highlighted-entry');
      if (nextCard) nextCard.classList.remove('highlight-card');
    }
    
    currentNum = nextNum;
  }
}

// Compute all goalscorers dynamically from match data
function getMatchScorers() {
  const scorers = {};
  
  // Only tally goals from completed matches with final score data
  const completedMatches = matchesData.filter(m => m.score && m.score.ft);
  
  completedMatches.forEach(match => {
    // Process team 1 scorers
    if (match.goals1 && match.goals1.length > 0) {
      match.goals1.forEach(goal => {
        if (goal.owngoal) return; // Skip own goals
        
        const playerName = goal.name.trim();
        const playerTeam = match.team1;
        
        if (!scorers[playerName]) {
          scorers[playerName] = {
            name: playerName,
            team: playerTeam,
            goals: 0,
            penalties: 0
          };
        }
        scorers[playerName].goals++;
        if (goal.penalty) {
          scorers[playerName].penalties++;
        }
      });
    }
    
    // Process team 2 scorers
    if (match.goals2 && match.goals2.length > 0) {
      match.goals2.forEach(goal => {
        if (goal.owngoal) return; // Skip own goals
        
        const playerName = goal.name.trim();
        const playerTeam = match.team2;
        
        if (!scorers[playerName]) {
          scorers[playerName] = {
            name: playerName,
            team: playerTeam,
            goals: 0,
            penalties: 0
          };
        }
        scorers[playerName].goals++;
        if (goal.penalty) {
          scorers[playerName].penalties++;
        }
      });
    }
  });
  
  // Convert object map to sorted array
  // Sort: Total Goals (descending) -> Penalties (ascending) -> Player Name (alphabetical)
  return Object.values(scorers).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (a.penalties !== b.penalties) return a.penalties - b.penalties;
    return a.name.localeCompare(b.name);
  });
}

// Filter scorers list based on search criteria
function getFilteredScorers() {
  return getMatchScorers();
}

// Render podium for top 3 scorers and table leaderboard for 4+ ranks
function renderScorers() {
  const podiumContainer = document.getElementById('scorers-podium');
  const listContainer = document.getElementById('scorers-list');
  const emptyState = document.getElementById('no-scorers-message');
  const tableContainer = document.querySelector('.scorers-leaderboard-container');
  
  if (!podiumContainer || !listContainer || !emptyState || !tableContainer) return;
  
  podiumContainer.innerHTML = '';
  listContainer.innerHTML = '';
  
  const filtered = getFilteredScorers();
  
  if (currentActiveTab === 'scorers') {
    updateCountLabel();
  }
  
  if (filtered.length === 0) {
    podiumContainer.classList.add('hidden');
    tableContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  
  podiumContainer.classList.remove('hidden');
  tableContainer.classList.remove('hidden');
  emptyState.classList.add('hidden');
  
  // Podium top 3 partition
  const top3 = filtered.slice(0, 3);
  const remaining = filtered.slice(3);
  
  const placesClasses = ['first-place', 'second-place', 'third-place'];
  const medalsText = ['1st', '2nd', '3rd'];
  
  top3.forEach((scorer, idx) => {
    const card = document.createElement('div');
    card.className = `podium-card ${placesClasses[idx]}`;
    
    const cleanTeam = formatPlaceholderTeamName(scorer.team);
    const flagHtml = getFlagHtml(scorer.team);
    const penaltyText = scorer.penalties > 0 ? `<span class="podium-penalties">(${scorer.penalties} Pen)</span>` : '';
    const avatarIcon = idx === 0 ? 'trophy' : 'user';
    
    card.innerHTML = `
      <div class="podium-badge">${medalsText[idx]}</div>
      <div class="podium-avatar">
        <i data-lucide="${avatarIcon}"></i>
      </div>
      <div class="podium-player-name">${scorer.name}</div>
      <div class="podium-player-team">
        ${flagHtml}
        <span>${cleanTeam}</span>
      </div>
      <div class="podium-goals-count">
        <span>${scorer.goals}</span>
        <span class="podium-goals-label">Goals</span>
        ${penaltyText}
      </div>
    `;
    podiumContainer.appendChild(card);
  });
  
  // Leaderboard table for rank 4+
  if (remaining.length === 0) {
    tableContainer.style.display = 'none';
  } else {
    tableContainer.style.display = 'block';
    
    remaining.forEach((scorer, idx) => {
      const rank = idx + 4;
      const row = document.createElement('tr');
      
      const cleanTeam = formatPlaceholderTeamName(scorer.team);
      const flagHtml = getFlagHtml(scorer.team);
      const penaltyText = scorer.penalties > 0 ? `<span class="scorers-penalties-label">(${scorer.penalties} pen)</span>` : '';
      
      row.innerHTML = `
        <td class="pos-cell">${rank}</td>
        <td class="align-left" style="font-weight: 600; color: var(--text-white);">${scorer.name}</td>
        <td class="align-left">
          <div class="standings-team-name">
            ${flagHtml}
            <span>${cleanTeam}</span>
          </div>
        </td>
        <td class="pts-cell">${scorer.goals}${penaltyText}</td>
      `;
      listContainer.appendChild(row);
    });
  }
  
  lucide.createIcons();
}

// Set up reload button event listener
function setupReloadButton() {
  const reloadBtn = document.getElementById('reload-btn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.classList.add('reloading');
      try {
        await fetchMatches();
      } catch (error) {
        console.error("Error during manual refresh:", error);
      } finally {
        // Enforce a small delay for visual feedback on the spin animation
        setTimeout(() => {
          reloadBtn.classList.remove('reloading');
        }, 600);
      }
    });
  }
}

// Compute dynamically which teams have qualified beyond the group stage
function getQualifiedTeams() {
  const qualified = new Set();
  
  // 1. Teams that are explicitly named in the knockout stage matches
  matchesData.forEach(match => {
    const isKnockout = !match.group || !match.group.startsWith('Group');
    if (isKnockout) {
      if (match.team1 && countryToIso[match.team1.trim()]) {
        qualified.add(match.team1.trim());
      }
      if (match.team2 && countryToIso[match.team2.trim()]) {
        qualified.add(match.team2.trim());
      }
    }
  });

  const groupMatches = matchesData.filter(m => m.group && m.group.startsWith('Group'));
  if (groupMatches.length === 0) return qualified;

  // Extract all unique groups
  const groupsMap = {};
  groupMatches.forEach(m => {
    if (!groupsMap[m.group]) groupsMap[m.group] = [];
    groupsMap[m.group].push(m);
  });

  // Check guaranteed top 2 for each group
  Object.keys(groupsMap).forEach(groupName => {
    const matchesInGroup = groupsMap[groupName];
    // Get unique teams in this group
    const teamsSet = new Set();
    matchesInGroup.forEach(m => {
      if (m.team1) teamsSet.add(m.team1.trim());
      if (m.team2) teamsSet.add(m.team2.trim());
    });
    const teamsList = Array.from(teamsSet);

    const completed = matchesInGroup.filter(m => m.score && m.score.ft);
    const remaining = matchesInGroup.filter(m => !m.score || !m.score.ft);

    // If there are remaining matches, simulate all possible outcomes
    if (remaining.length > 0) {
      // 3^R outcomes, where R = remaining.length
      const outcomesCount = Math.pow(3, remaining.length);
      const guaranteed = new Set(teamsList);

      for (let i = 0; i < outcomesCount; i++) {
        const stats = {};
        teamsList.forEach(t => {
          stats[t] = { name: t, pts: 0, gd: 0, gf: 0, ga: 0 };
        });

        // Add completed matches stats
        completed.forEach(m => {
          const t1 = m.team1.trim();
          const t2 = m.team2.trim();
          const g1 = m.score.ft[0];
          const g2 = m.score.ft[1];
          stats[t1].gf += g1;
          stats[t1].ga += g2;
          stats[t2].gf += g2;
          stats[t2].ga += g1;

          if (g1 > g2) {
            stats[t1].pts += 3;
          } else if (g2 > g1) {
            stats[t2].pts += 3;
          } else {
            stats[t1].pts += 1;
            stats[t2].pts += 1;
          }
        });

        // Simulate remaining matches using base-3 representation of i
        let temp = i;
        remaining.forEach(m => {
          const t1 = m.team1.trim();
          const t2 = m.team2.trim();
          const outcome = temp % 3; // 0: t1 wins, 1: draw, 2: t2 wins
          temp = Math.floor(temp / 3);

          if (outcome === 0) {
            stats[t1].pts += 3;
            stats[t1].gf += 1;
            stats[t2].ga += 1;
          } else if (outcome === 2) {
            stats[t2].pts += 3;
            stats[t2].gf += 1;
            stats[t1].ga += 1;
          } else {
            stats[t1].pts += 1;
            stats[t2].pts += 1;
          }
        });

        // Calculate Goal Difference
        teamsList.forEach(t => {
          stats[t].gd = stats[t].gf - stats[t].ga;
        });

        // Sort teams in this outcome
        const sorted = [...teamsList].sort((a, b) => {
          if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
          if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
          if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
          return a.localeCompare(b);
        });

        const top2 = sorted.slice(0, 2);
        teamsList.forEach(t => {
          if (!top2.includes(t)) {
            guaranteed.delete(t);
          }
        });

        if (guaranteed.size === 0) break;
      }

      guaranteed.forEach(t => qualified.add(t));
    } else {
      // All matches completed for this group. Top 2 are qualified.
      const stats = {};
      teamsList.forEach(t => {
        stats[t] = { name: t, pts: 0, gd: 0, gf: 0, ga: 0 };
      });
      completed.forEach(m => {
        const t1 = m.team1.trim();
        const t2 = m.team2.trim();
        const g1 = m.score.ft[0];
        const g2 = m.score.ft[1];
        stats[t1].gf += g1;
        stats[t1].ga += g2;
        stats[t2].gf += g2;
        stats[t2].ga += g1;

        if (g1 > g2) {
          stats[t1].pts += 3;
        } else if (g2 > g1) {
          stats[t2].pts += 3;
        } else {
          stats[t1].pts += 1;
          stats[t2].pts += 1;
        }
      });
      teamsList.forEach(t => {
        stats[t].gd = stats[t].gf - stats[t].ga;
      });
      const sorted = [...teamsList].sort((a, b) => {
        if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
        if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
        if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
        return a.localeCompare(b);
      });
      qualified.add(sorted[0]);
      qualified.add(sorted[1]);
    }
  });

  // 3. Check for third-place qualification if ALL group matches in the tournament are completed
  const allGroupMatchesCompleted = groupMatches.every(m => m.score && m.score.ft);
  if (allGroupMatchesCompleted) {
    const thirdPlaceTeams = [];
    Object.keys(groupsMap).forEach(groupName => {
      const matchesInGroup = groupsMap[groupName];
      const teamsSet = new Set();
      matchesInGroup.forEach(m => {
        if (m.team1) teamsSet.add(m.team1.trim());
        if (m.team2) teamsSet.add(m.team2.trim());
      });
      const teamsList = Array.from(teamsSet);

      const stats = {};
      teamsList.forEach(t => {
        stats[t] = { name: t, pts: 0, gd: 0, gf: 0, ga: 0, won: 0 };
      });
      matchesInGroup.forEach(m => {
        const t1 = m.team1.trim();
        const t2 = m.team2.trim();
        const g1 = m.score.ft[0];
        const g2 = m.score.ft[1];
        stats[t1].gf += g1;
        stats[t1].ga += g2;
        stats[t2].gf += g2;
        stats[t2].ga += g1;

        if (g1 > g2) {
          stats[t1].pts += 3;
          stats[t1].won += 1;
        } else if (g2 > g1) {
          stats[t2].pts += 3;
          stats[t2].won += 1;
        } else {
          stats[t1].pts += 1;
          stats[t2].pts += 1;
        }
      });
      teamsList.forEach(t => {
        stats[t].gd = stats[t].gf - stats[t].ga;
      });

      const sorted = [...teamsList].sort((a, b) => {
        if (stats[b].pts !== stats[a].pts) return stats[b].pts - stats[a].pts;
        if (stats[b].gd !== stats[a].gd) return stats[b].gd - stats[a].gd;
        if (stats[b].gf !== stats[a].gf) return stats[b].gf - stats[a].gf;
        return a.localeCompare(b);
      });

      thirdPlaceTeams.push(stats[sorted[2]]);
    });

    // Sort third-place teams: Points -> Goal Difference -> Goals For -> Wins -> Alphabetical
    thirdPlaceTeams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (b.won !== a.won) return b.won - a.won;
      return a.name.localeCompare(b.name);
    });

    // Top 8 third-place teams qualify
    for (let j = 0; j < 8; j++) {
      if (thirdPlaceTeams[j]) {
        qualified.add(thirdPlaceTeams[j].name);
      }
    }
  }

  return qualified;
}
