// Matches functionality
function saveMatchesToLocalStorage(matches) {
    localStorage.setItem('footballMatches_v2', JSON.stringify(matches)); // _v2 eklendi
}

function getMatchesFromLocalStorage() {
    return JSON.parse(localStorage.getItem('footballMatches_v2')); // _v2 eklendi
}

function saveSelectedMatchday(matchday) {
    localStorage.setItem('selectedMatchday_v2', matchday); // _v2 eklendi
}

function getSelectedMatchday() {
    return localStorage.getItem('selectedMatchday_v2') || '1'; // _v2 eklendi
}

// Standings functionality
function setLoading(isLoading) {
    const loader = document.getElementById('loader');
    const button = document.getElementById('fetchStandings');
    loader.style.display = isLoading ? 'block' : 'none';
    button.disabled = isLoading;
}

function updateTimestamp() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = 
        `Last updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
}

function parseCSV(csvString) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)
            .map(val => val.replace(/^"(.*)"$/, '$1').trim());
        
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
        }, {});
    });
}

function displayStandings(data) {
    const tbody = document.getElementById('standingsBody');
    tbody.innerHTML = '';

    let rows = typeof data === 'string' ? 
        parseCSV(data) : 
        data;

    rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.team_name}</td>
            <td class="stats-cell">${row.total_games}</td>
            <td class="stats-cell">${row.wins}</td>
            <td class="stats-cell">${row.draws}</td>
            <td class="stats-cell">${row.losses}</td>
            <td class="stats-cell">${row.goals_scored}</td>
            <td class="stats-cell">${row.goals_conceded}</td>
            <td class="stats-cell">${row.points}</td>
        `;
        tbody.appendChild(tr);
    });
}

function populateMatchesData(data) {
    const matchdaySelect = document.getElementById('matchday');
    const matchesList = document.getElementById('matches');
    
    // Clear existing options
    matchdaySelect.innerHTML = '';

    const sortedMatchdays = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    sortedMatchdays.forEach(matchday => {
        const option = document.createElement('option');
        option.value = matchday;
        option.textContent = `Matchday ${matchday}`;
        matchdaySelect.appendChild(option);
    });


    let selectedMatchday = getSelectedMatchday();
    if (!data[selectedMatchday]) {
        selectedMatchday = sortedMatchdays[0];
    }
    matchdaySelect.value = selectedMatchday;

    // Update matches display
    function updateMatchesDisplay() {
        const currentMatchday = matchdaySelect.value;
        const matches = data[currentMatchday];
        matchesList.innerHTML = '';

        if (matches) {
            matches.forEach(match => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <div class="match-info">${match["Home Team"]} ${match["Score"]} ${match["Away Team"]}</div>
                    <div class="match-date">Date: ${new Date(match["Date"]).toLocaleString()}</div>
                `;
                matchesList.appendChild(listItem);
            });
        } else {
            matchesList.innerHTML = '<li>No matches found for this matchday.</li>';
        }

        // Save selected matchday to local storage
        saveSelectedMatchday(currentMatchday);
    }

    // Add change event listener
    matchdaySelect.addEventListener('change', updateMatchesDisplay);

    // Initial display
    updateMatchesDisplay();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // Sayfa açılır açılmaz Standings verisini S3'ten çek
    document.getElementById('fetchStandings').click();
    
    // Fetch matches from Local Storage first for instant loading
    const cachedMatches = getMatchesFromLocalStorage();
    if (cachedMatches) {
        populateMatchesData(cachedMatches);
    }

    // Then fetch fresh matches from S3 in the background
    const matchesUrl = 'https://new-pl.s3.us-east-1.amazonaws.com/matches.json';
    

    fetch(`${matchesUrl}?t=${new Date().getTime()}`)
            .then(response => response.json())
            .then(data => {
                
                if (data && Object.keys(data).length > 0) {
                    saveMatchesToLocalStorage(data);
                    populateMatchesData(data);
                } else {
                    console.warn("S3'ten boş veri geldi. Mevcut maç listesi korunuyor.");
                }
            })
            .catch(error => console.error('Error fetching matches:', error));
});

document.getElementById('fetchStandings').addEventListener('click', async () => {
    setLoading(true);
    try {
        const s3Url = 'https://new-pl.s3.us-east-1.amazonaws.com/league_standings.csv'; 
        
        const response = await fetch(`${s3Url}?t=${new Date().getTime()}`);
        
        if (response.ok) {
            const csvData = await response.text(); 
            
            updateTimestamp();
            displayStandings(csvData);
        } else {
            console.error('Response not ok. Status:', response.status);
            alert('Error fetching standings data from S3.');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('Data Error: Tablo yüklenirken bir hata oluştu.');
    } finally {
        setLoading(false);
    }
});