const ui = {
    source: document.getElementById('db-source'),
    search: document.getElementById('db-search'),
    onlyMatches: document.getElementById('db-only-matches'),
    toggleList: document.getElementById('db-toggle-list'),
    status: document.getElementById('db-status'),
    listPanel: document.getElementById('db-list-panel'),
    head: document.getElementById('db-head'),
    body: document.getElementById('db-body')
};

const state = {
    headers: [],
    rows: [],
    query: '',
    onlyMatches: true,
    listHidden: false
};

function clean(text) {
    return String(text ?? '').trim();
}

function normalize(text) {
    return clean(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
        const char = csvText[i];
        const next = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') {
                continue;
            }

            if (cell.length || row.length) {
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
            }
            continue;
        }

        cell += char;
    }

    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
}

function rowSearchText(values) {
    return values.map(normalize).join(' ');
}

function renderHeader() {
    const headers = state.headers.map((header) => `<th>${header}</th>`).join('');
    ui.head.innerHTML = `<tr>${headers}</tr>`;
}

function renderBody() {
    if (!state.rows.length) {
        ui.body.innerHTML = `<tr><td class="empty-state" colspan="${state.headers.length || 1}">No rows to display.</td></tr>`;
        return;
    }

    ui.body.innerHTML = state.rows.map((row, rowIndex) => {
        const cells = row.values
            .map((value, cellIndex) => `<td contenteditable="true" data-row="${rowIndex}" data-cell="${cellIndex}">${value}</td>`)
            .join('');
        return `<tr data-row="${rowIndex}">${cells}</tr>`;
    }).join('');

    applyFilter();
}

function updateStatus(visibleCount, totalCount) {
    const modeText = state.onlyMatches ? 'showing only matches' : 'showing all rows';
    ui.status.textContent = `${visibleCount} of ${totalCount} rows visible (${modeText}).`;
}

function applyFilter() {
    state.query = normalize(ui.search.value);
    state.onlyMatches = ui.onlyMatches.checked;

    const rows = Array.from(ui.body.querySelectorAll('tr[data-row]'));
    let visibleCount = 0;

    rows.forEach((rowElement) => {
        const rowIndex = Number(rowElement.getAttribute('data-row'));
        const row = state.rows[rowIndex];
        const isMatch = !state.query || row.searchText.includes(state.query);

        if (state.onlyMatches) {
            rowElement.classList.toggle('is-filtered-out', !isMatch);
        } else {
            rowElement.classList.remove('is-filtered-out');
        }

        if (state.onlyMatches) {
            if (isMatch) {
                visibleCount += 1;
            }
        } else {
            visibleCount += 1;
        }
    });

    updateStatus(visibleCount, state.rows.length);
}

function toggleList() {
    state.listHidden = !state.listHidden;
    ui.listPanel.classList.toggle('is-hidden', state.listHidden);
    ui.toggleList.textContent = state.listHidden ? 'Show List' : 'Hide List';
}

function bindTableEditing() {
    ui.body.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (target.tagName !== 'TD') {
            return;
        }

        const rowIndex = Number(target.getAttribute('data-row'));
        const cellIndex = Number(target.getAttribute('data-cell'));

        if (!Number.isInteger(rowIndex) || !Number.isInteger(cellIndex)) {
            return;
        }

        const value = clean(target.textContent);
        state.rows[rowIndex].values[cellIndex] = value;
        state.rows[rowIndex].searchText = rowSearchText(state.rows[rowIndex].values);
        applyFilter();
    });
}

async function loadDatabase(csvPath) {
    ui.status.textContent = 'Loading database...';
    ui.head.innerHTML = '';
    ui.body.innerHTML = '';

    try {
        const response = await fetch(encodeURI(csvPath));
        if (!response.ok) {
            throw new Error(`Could not load ${csvPath}`);
        }

        const csvText = await response.text();
        const parsedRows = parseCSV(csvText);

        if (!parsedRows.length) {
            throw new Error('The selected CSV file is empty.');
        }

        state.headers = parsedRows[0].map((header) => clean(header) || 'Column');
        state.rows = parsedRows
            .slice(1)
            .filter((values) => values.some((value) => clean(value).length > 0))
            .map((values) => {
                const normalizedValues = state.headers.map((_, index) => clean(values[index]));
                return {
                    values: normalizedValues,
                    searchText: rowSearchText(normalizedValues)
                };
            });

        renderHeader();
        renderBody();
    } catch (error) {
        console.error(error);
        ui.status.textContent = 'Could not load database file. If opened directly from disk, run this page through Live Server.';
        ui.head.innerHTML = '';
        ui.body.innerHTML = '<tr><td class="empty-state" colspan="1">Database unavailable.</td></tr>';
    }
}

ui.source.addEventListener('change', () => {
    loadDatabase(ui.source.value);
});

ui.search.addEventListener('input', applyFilter);
ui.onlyMatches.addEventListener('change', applyFilter);
ui.toggleList.addEventListener('click', toggleList);

bindTableEditing();
loadDatabase(ui.source.value);
