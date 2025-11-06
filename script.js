const webAppUrl = 'https://script.google.com/macros/s/AKfycbzrRUUZcbkIQvX_Noo3zBRODKm34EhkkyowpBVyVxmGFMTGDw1nKCWXgFLKCLetWVY2/exec';
const ACCOUNTS_STORAGE_KEY = 'cashbookAccounts';
const CATEGORIES_STORAGE_KEY = 'cashbookCategories';

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
    } else if (tabName === 'Category') {
        document.getElementById('category-page').classList.remove('hidden');
        renderCategoriesList();
    } else if (tabName === 'Accounts') {
        document.getElementById('accounts-page').classList.remove('hidden');
        renderAccountsList();
    } else if (tabName === 'Transaction') {
        document.getElementById('transaction-page').classList.remove('hidden');
        fetchData();
    }
}

// --- CATEGORY MANAGEMENT FUNCTIONS ---

function getCategories() {
    const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (storedCategories) {
        return JSON.parse(storedCategories);
    } else {
        const defaultCategories = ['BY AKD', 'OFFICE ESSENTIAL', 'FOOD', 'PRINT OUT', 'OTHER'];
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(defaultCategories));
        return defaultCategories;
    }
}

function saveCategories(categories) {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    populateCategoriesDropdown();
}

// MODIFIED: Renders the list with edit/remove buttons
function renderCategoriesList() {
    const categories = getCategories();
    const listContainer = document.getElementById('categories-list');
    listContainer.innerHTML = '';
    
    categories.forEach(categoryName => {
        const item = document.createElement('div');
        item.className = 'category-item';
        
        // The HTML structure for each item now includes an input field (hidden by default)
        item.innerHTML = `
            <div class="item-name">
                <span class="category-name">${categoryName}</span>
                <input type="text" class="edit-category-input hidden" value="${categoryName}">
            </div>
            <div>
                <button class="edit-btn" onclick="toggleEditCategory('${categoryName}', this)">Edit</button>
                <button class="remove-btn" onclick="removeCategory('${categoryName}')">Remove</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// NEW: Toggles between view and edit mode for a category
function toggleEditCategory(oldName, editButton) {
    const itemElement = editButton.closest('.category-item');
    const nameSpan = itemElement.querySelector('.category-name');
    const inputField = itemElement.querySelector('.edit-category-input');

    const isEditing = editButton.innerText === 'Save';

    if (isEditing) {
        // If we are saving, call the update function
        const newName = inputField.value.trim();
        updateCategory(oldName, newName); // This will handle validation and re-render the list
    } else {
        // If we are editing, switch to input mode
        nameSpan.classList.add('hidden');
        inputField.classList.remove('hidden');
        inputField.focus(); // Automatically focus the input
        editButton.innerText = 'Save';
    }
}

// NEW: Updates a category name after validation
function updateCategory(oldName, newName) {
    if (!newName) {
        showMessage('Category name cannot be empty.');
        renderCategoriesList(); // Re-render to cancel the edit
        return;
    }

    let categories = getCategories();
    // Check if the new name already exists (and is not the same as the old name, case-insensitive)
    const isDuplicate = categories.some(c => c.toLowerCase() === newName.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase());

    if (isDuplicate) {
        showMessage('This category name already exists.');
        renderCategoriesList(); // Re-render to cancel the edit
        return;
    }

    // Find and update the category
    const categoryIndex = categories.findIndex(c => c === oldName);
    if (categoryIndex !== -1) {
        categories[categoryIndex] = newName;
        saveCategories(categories);
    }
    
    // Re-render the entire list to reflect the change cleanly
    renderCategoriesList();
}


function addCategory() {
    const input = document.getElementById('new-category-name');
    const newName = input.value.trim();
    if (!newName) {
        showMessage('Category name cannot be empty.');
        return;
    }
    const categories = getCategories();
    if (categories.map(c => c.toLowerCase()).includes(newName.toLowerCase())) {
        showMessage('This category name already exists.');
        return;
    }
    categories.push(newName);
    saveCategories(categories);
    renderCategoriesList();
    input.value = '';
}

function removeCategory(categoryNameToRemove) {
    let categories = getCategories();
    categories = categories.filter(name => name !== categoryNameToRemove);
    saveCategories(categories);
    renderCategoriesList();
}

function populateCategoriesDropdown() {
    const categories = getCategories();
    const select = document.getElementById('add-category');
    select.innerHTML = '<option value="" disabled="true" selected="true">Select Category</option>';
    
    categories.forEach(categoryName => {
        const option = document.createElement('option');
        option.value = categoryName;
        option.innerText = categoryName;
        select.appendChild(option);
    });
}


// --- ACCOUNT MANAGEMENT FUNCTIONS ---

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
            <span class="item-name">${accountName}</span>
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


// --- CORE CASHBOOK FUNCTIONS ---

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
              amountCell = row[3], descriptionCell = row[4];

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
    populateCategoriesDropdown();
};
