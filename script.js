const webAppUrl = 'https://script.google.com/macros/s/AKfycbzrRUUZcbkIQvX_Noo3zBRODKm34EhkkyowpBVyVxmGFMTGDw1nKCWXgFLKCLetWVY2/exec';
const ACCOUNTS_STORAGE_KEY = 'cashbookAccounts';

let allTransactions = [];
let currentlyDisplayedCount = 0;
const transactionsPerLoad = 10;

function showMessage(message) {
    document.getElementById('messageText').innerText = message;
    document.getElementById('messageBox').style.display = 'block';
}

function hideMessage() {
    document.getElementById('messageBox').style.display = 'none';
}

function handleTabClick(tabName, element) {
    document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');

    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    
    if (tabName === 'Home') {
        document.getElementById('home-page').classList.remove('hidden');
    } else if (tabName === 'Accounts') {
        document.getElementById('accounts-page').classList.remove('hidden');
        renderAccountsList();
    } else if (tabName === 'Transaction') {
        document.getElementById('transaction-page').classList.remove('hidden');
        fetchData();
    } else {
        document.getElementById('home-page').classList.remove('hidden');
        showMessage(`${tabName} feature is not yet implemented.`);
    }
}

function getAccounts() {
    const storedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (storedAccounts) {
        return JSON.parse(storedAccounts);
    } else {
        const defaultAccounts = ['IndusInd (Regular)', 'Cash'];
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(defaultAccounts));
        return defaultAccounts;
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    populatePaymentModesDropdown();
}

function renderAccountsList() {
    const accounts = getAccounts();
    const listContainer = document.getElementById('accounts-list');
    listContainer.innerHTML = '';
    
    accounts.forEach(accountName => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.innerHTML = `
            <span>${accountName}</span>
            <button class="remove-btn" onclick="removeAccount('${accountName}')">Remove</button>
        `;
        listContainer.appendChild(item);
    });
}

function addAccount() {
    const input = document.getElementById('new-account-name');
    const newName = input.value.trim();
    if (!newName) {
        showMessage('Account name cannot be empty.');
        return;
    }
    const accounts = getAccounts();
    if (accounts.map(a => a.toLowerCase()).includes(newName.toLowerCase())) {
        showMessage('This account name already exists.');
        return;
    }
    accounts.push(newName);
    saveAccounts(accounts);
    renderAccountsList();
    input.value = '';
}

function removeAccount(accountNameToRemove) {
    let accounts = getAccounts();
    accounts = accounts.filter(name => name !== accountNameToRemove);
    saveAccounts(accounts);
    renderAccountsList();
}

function populatePaymentModesDropdown() {
    const accounts = getAccounts();
    const select = document.getElementById('add-paymentMode');
    select.innerHTML = '<option value="" disabled="true" selected="true">Payment Mode</option>';
    
    accounts.forEach(accountName => {
        const option = document.createElement('option');
        option.value = accountName;
        option.innerText = accountName;
        select.appendChild(option);
    });
}

function clearFormFields() {
    document.getElementById('add-date').value = '';
    document.getElementById('add-type').selectedIndex = 0;
    document.getElementById('add-category').selectedIndex = 0;
    document.getElementById('add-paymentMode').selectedIndex = 0;
    document.getElementById('add-amount').value = '';
    document.getElementById('add-description').value = '';
}

function fetchData() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    const url = new URL(webAppUrl);
    if (startDate) url.searchParams.append('startDate', startDate);
    if (endDate) url.searchParams.append('endDate', endDate);

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const currencyFormat = { style: 'currency', currency: 'INR' };
            
            const accountBalances = data.accountBalances || {};
            const totalBalanceElement = document.getElementById('total-balance');
            const individualBalancesContainer = document.getElementById('individual-balances');
            
            let totalBalance = 0;
            individualBalancesContainer.innerHTML = '';

            const sortedAccounts = Object.keys(accountBalances).sort();

            for (const accountName of sortedAccounts) {
                const balance = accountBalances[accountName];
                totalBalance += balance;
                
                const item = document.createElement('div');
                item.className = 'balance-item';
                item.innerHTML = `
                    <span>${accountName}:</span>
                    <span>${new Intl.NumberFormat('en-IN', currencyFormat).format(balance)}</span>
                `;
                individualBalancesContainer.appendChild(item);
            }

            totalBalanceElement.innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(totalBalance);
            
            allTransactions = data.tableRows ? data.tableRows.reverse() : [];
            document.getElementById('data-container').innerHTML = '';
            currentlyDisplayedCount = 0;
            
            displayTransactions();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            showMessage('Error fetching data. Check console for details.');
        });
}

function displayTransactions() {
    const dataContainer = document.getElementById('data-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currencyFormat = { style: 'currency', currency: 'INR' };

    if (allTransactions.length === 0 && currentlyDisplayedCount === 0) {
        dataContainer.innerHTML = '<p style="text-align:center;">No transactions found for the selected date range.</p>';
        loadMoreBtn.style.display = 'none';
        return;
    }

    const start = currentlyDisplayedCount;
    const end = Math.min(start + transactionsPerLoad, allTransactions.length);

    for (let i = start; i < end; i++) {
        const row = allTransactions[i];
        const dateCell = row[0], typeCell = row[1], categoryCell = row[2], 
              amountCell = row[3], descriptionCell = row[4], paymentModeCell = row[5] || ''; 

        const card = document.createElement('div');
        card.classList.add('transaction-card');
        
        if (typeCell.toUpperCase() === 'INCOME') {
            card.style.backgroundColor = '#28a745';
            card.style.color = 'white';
        } else {
            card.style.backgroundColor = '#dc3545';
            card.style.color = 'white';
        }

        const header = document.createElement('div');
        header.classList.add('card-header');
        const categorySpan = document.createElement('span');
        categorySpan.innerText = categoryCell;
        header.appendChild(categorySpan);
        const amountSpan = document.createElement('span');
        amountSpan.innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(Math.abs(amountCell));
        if (card.style.color === 'white') {
            amountSpan.style.color = 'white';
        }
        header.appendChild(amountSpan);
        card.appendChild(header);

        const footer = document.createElement('div');
        footer.classList.add('card-footer');
        const descriptionSpan = document.createElement('span');
        descriptionSpan.innerText = descriptionCell;
        footer.appendChild(descriptionSpan);
        const date = new Date(dateCell);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const dateSpan = document.createElement('span');
        dateSpan.innerText = `${day}-${month}-${year}`;
        footer.appendChild(dateSpan);
        card.appendChild(footer);

        dataContainer.appendChild(card);
    }

    currentlyDisplayedCount = end;

    if (currentlyDisplayedCount < allTransactions.length) {
        loadMoreBtn.style.display = 'inline-block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

function loadMore() {
    displayTransactions();
}

function addData() {
    const date = document.getElementById('add-date').value;
    const type = document.getElementById('add-type').value;
    const category = document.getElementById('add-category').value;
    const amount = document.getElementById('add-amount').value;
    const description = document.getElementById('add-description').value;
    const paymentMode = document.getElementById('add-paymentMode').value;

    if (!date || !type || !category || !amount || !description || !paymentMode) {
        showMessage('Please fill all required fields.');
        return;
    }

    const formData = new FormData();
    formData.append('date', date);
    formData.append('type', type);
    formData.append('category', category);
    formData.append('amount', amount);
    formData.append('description', description);
    formData.append('paymentMode', paymentMode);

    fetch(webAppUrl, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            showMessage('Data added successfully!');
            clearFormFields();
            fetchData(); 
        } else {
            showMessage('Failed to add data.');
        }
    })
    .catch(error => {
        console.error('Error adding data:', error);
        showMessage('Error adding data.');
    });
}

window.onload = () => {
    fetchData(); 
    populatePaymentModesDropdown();
};
