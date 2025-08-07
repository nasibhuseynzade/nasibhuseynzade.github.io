// Matches functionality
function saveMatchesToLocalStorage(matches) {
    localStorage.setItem('footballMatches', JSON.stringify(matches));
}

function getMatchesFromLocalStorage() {
    return JSON.parse(localStorage.getItem('footballMatches'));
}

function saveSelectedMatchday(matchday) {
    localStorage.setItem('selectedMatchday', matchday);
}

function getSelectedMatchday() {
    return localStorage.getItem('selectedMatchday') || '1'; // Default to matchday 1
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

function saveToLocalStorage(data) {
    const saveData = {
        timestamp: new Date().toISOString(),
        standings: data
    };
    localStorage.setItem('footballStandings', JSON.stringify(saveData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('footballStandings');
    if (saved) {
        const data = JSON.parse(saved);
        displayStandings(data.standings);
        const date = new Date(data.timestamp);
        document.getElementById('lastUpdated').textContent = 
            `Last updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
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

    // Populate matchday options
    Object.keys(data).forEach(matchday => {
        const option = document.createElement('option');
        option.value = matchday;
        option.textContent = `Matchday ${matchday}`;
        matchdaySelect.appendChild(option);
    });

    // Set the selected matchday from local storage
    const selectedMatchday = getSelectedMatchday();
    matchdaySelect.value = selectedMatchday;

    // Update matches display
    function updateMatchesDisplay() {
        const selectedMatchday = matchdaySelect.value;
        const matches = data[selectedMatchday];
        matchesList.innerHTML = '';

        matches.forEach(match => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="match-info">${match["Home Team"]} ${match["Score"]} ${match["Away Team"]}</div>
                <div class="match-date">Date: ${new Date(match["Date"]).toLocaleString()}</div>
            `;
            matchesList.appendChild(listItem);
        });

        // Save selected matchday to local storage
        saveSelectedMatchday(selectedMatchday);
    }

    // Add change event listener
    matchdaySelect.addEventListener('change', updateMatchesDisplay);

    // Initial display
    updateMatchesDisplay();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage(); // Original standings local storage functionality

    // Fetch matches
    const cachedMatches = getMatchesFromLocalStorage();
    if (cachedMatches) {
        populateMatchesData(cachedMatches);
    }

    fetch('https://l3fg918l69.execute-api.us-east-1.amazonaws.com/prod/getMatches')
        .then(response => response.json())
        .then(data => {
            saveMatchesToLocalStorage(data);
            populateMatchesData(data);
        })
        .catch(error => console.error('Error fetching matches:', error));
});

document.getElementById('fetchStandings').addEventListener('click', async () => {
    setLoading(true);
    try {
        const response = await fetch('https://0ntypxmj16.execute-api.us-east-1.amazonaws.com/prod/');
        if (response.ok) {
            const jsonData = await response.json();
            const csvData = jsonData.body;
            updateTimestamp();
            displayStandings(csvData);
            saveToLocalStorage(csvData);
        } else {
            console.error('Response not ok:', await response.text());
            alert('Error fetching standings data.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error fetching standings data.');
    } finally {
        setLoading(false);
    }
});