const webAppUrl = 'https://script.google.com/macros/s/AKfycbxsnpi2-TEDRskcAGwrNcjnBN9JXgvCUHjLqhnQSfp6GdyH36MJCqBjPvxpMfQzY_jfCw/exec';
const ACCOUNTS_STORAGE_KEY = 'cashbookAccounts';
const CATEGORIES_STORAGE_KEY = 'cashbookCategories';

let allTransactions = [];
let currentlyDisplayedCount = 0;
const transactionsPerLoad = 10;
// --- NEW: Variables for long press detection ---
let pressTimer = null;
let longPressTriggered = false;

function showMessage(message) {
    document.getElementById('messageText').innerText = message;
    document.getElementById('messageBox').style.display = 'block';
}

function hideMessage() {
    document.getElementById('messageBox').style.display = 'none';
}

function handleTabClick(tabName, element) {
    resetAllCategoryStates(); // Reset states when changing tabs
    document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    
    if (tabName === 'Home') document.getElementById('home-page').classList.remove('hidden');
    else if (tabName === 'Category') {
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

// --- CATEGORY MANAGEMENT ---

function getCategories() {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : ['BY AKD', 'OFFICE ESSENTIAL', 'FOOD', 'PRINT OUT', 'OTHER'];
}

function saveCategories(categories) {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    populateCategoriesDropdown();
}

function renderCategoriesList() {
    const categories = getCategories();
    const listContainer = document.getElementById('categories-list');
    listContainer.innerHTML = '';
    
    categories.forEach(categoryName => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.categoryName = categoryName; // Store original name

        item.innerHTML = `
            <div class="item-content">
                <span class="category-name">${categoryName}</span>
                <input type="text" class="edit-category-input hidden" value="${categoryName}">
            </div>
            <div class="item-actions">
                <button class="save-btn hidden" onclick="updateCategory(this)">Save</button>
                <button class="remove-btn hidden" onclick="removeCategory('${categoryName}')">Remove</button>
            </div>
        `;
        
        // --- NEW: Attach event listeners for interaction ---
        item.addEventListener('mousedown', () => handlePressStart(item));
        item.addEventListener('mouseup', () => handlePressEnd(item));
        item.addEventListener('mouseleave', () => cancelPress());
        item.addEventListener('touchstart', () => handlePressStart(item), { passive: true });
        item.addEventListener('touchend', () => handlePressEnd(item));

        listContainer.appendChild(item);
    });
}

function addCategory() {
    const input = document.getElementById('new-category-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    const categories = getCategories();
    if (categories.some(c => c.toLowerCase() === newName.toLowerCase())) {
        showMessage('This category name already exists.'); return;
    }
    categories.push(newName);
    saveCategories(categories);
    renderCategoriesList();
    input.value = '';
}

function removeCategory(name) {
    let categories = getCategories();
    categories = categories.filter(c => c !== name);
    saveCategories(categories);
    renderCategoriesList();
}

function updateCategory(saveButton) {
    const item = saveButton.closest('.category-item');
    const oldName = item.dataset.categoryName;
    const input = item.querySelector('.edit-category-input');
    const newName = input.value.trim();

    if (!newName) { showMessage('Category name cannot be empty.'); return; }

    let categories = getCategories();
    if (categories.some(c => c.toLowerCase() === newName.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
        showMessage('This category name already exists.'); return;
    }

    const index = categories.findIndex(c => c === oldName);
    if (index !== -1) categories[index] = newName;
    
    saveCategories(categories);
    renderCategoriesList(); // Re-render to exit edit mode
}

function populateCategoriesDropdown() {
    const categories = getCategories();
    const select = document.getElementById('add-category');
    select.innerHTML = '<option value="" disabled selected>Select Category</option>';
    categories.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);
}

// --- NEW: INTERACTION LOGIC FOR CATEGORY ITEMS ---
function handlePressStart(item) {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
        longPressTriggered = true;
        resetAllCategoryStates();
        item.classList.add('show-remove');
        item.querySelector('.remove-btn').classList.remove('hidden');
    }, 2000); // 2 seconds for long press
}

function handlePressEnd(item) {
    clearTimeout(pressTimer);
    if (!longPressTriggered) {
        // This was a click, not a long press
        resetAllCategoryStates();
        item.classList.add('editing');
        item.querySelector('.category-name').classList.add('hidden');
        const input = item.querySelector('.edit-category-input');
        input.classList.remove('hidden');
        input.focus();
        item.querySelector('.save-btn').classList.remove('hidden');
    }
}

function cancelPress() {
    clearTimeout(pressTimer);
}

function resetAllCategoryStates() {
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('editing', 'show-remove');
        item.querySelector('.category-name').classList.remove('hidden');
        item.querySelector('.edit-category-input').classList.add('hidden');
        item.querySelector('.save-btn').classList.add('hidden');
        item.querySelector('.remove-btn').classList.add('hidden');
    });
}

// --- ACCOUNT MANAGEMENT ---
function getAccounts() {
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : ['IndusInd (Regular)', 'Cash'];
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    populatePaymentModesDropdown();
}

function renderAccountsList() {
    const accounts = getAccounts();
    const listContainer = document.getElementById('accounts-list');
    listContainer.innerHTML = '';
    accounts.forEach(name => {
        listContainer.innerHTML += `
            <div class="account-item">
                <span class="item-content">${name}</span>
                <div class="item-actions">
                    <button class="remove-btn" onclick="removeAccount('${name}')">Remove</button>
                </div>
            </div>
        `;
    });
}

function addAccount() {
    const input = document.getElementById('new-account-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    const accounts = getAccounts();
    if (accounts.some(a => a.toLowerCase() === newName.toLowerCase())) {
        showMessage('This account name already exists.'); return;
    }
    accounts.push(newName);
    saveAccounts(accounts);
    renderAccountsList();
    input.value = '';
}

function removeAccount(name) {
    let accounts = getAccounts();
    accounts = accounts.filter(a => a !== name);
    saveAccounts(accounts);
    renderAccountsList();
}

function populatePaymentModesDropdown() {
    const accounts = getAccounts();
    const select = document.getElementById('add-paymentMode');
    select.innerHTML = '<option value="" disabled selected>Payment Mode</option>';
    accounts.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);
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
                individualBalancesContainer.innerHTML += `
                    <div class="balance-item">
                        <span>${accountName}:</span>
                        <span>${new Intl.NumberFormat('en-IN', currencyFormat).format(balance)}</span>
                    </div>`;
            }

            totalBalanceElement.innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(totalBalance);
            
            allTransactions = data.tableRows ? data.tableRows.reverse() : [];
            document.getElementById('data-container').innerHTML = '';
            currentlyDisplayedCount = 0;
            displayTransactions();
        })
        .catch(error => console.error('Error fetching data:', error));
}

function displayTransactions() {
    const dataContainer = document.getElementById('data-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currencyFormat = { style: 'currency', currency: 'INR' };

    if (allTransactions.length === 0 && currentlyDisplayedCount === 0) {
        dataContainer.innerHTML = '<p style="text-align:center;">No transactions found.</p>';
        loadMoreBtn.style.display = 'none'; return;
    }

    const start = currentlyDisplayedCount;
    const end = Math.min(start + transactionsPerLoad, allTransactions.length);

    for (let i = start; i < end; i++) {
        const row = allTransactions[i];
        const [dateCell, typeCell, categoryCell, amountCell, descriptionCell] = row;
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.style.backgroundColor = typeCell.toUpperCase() === 'INCOME' ? '#28a745' : '#dc3545';
        card.style.color = 'white';

        const date = new Date(dateCell);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        
        card.innerHTML = `
            <div class="card-header">
                <span>${categoryCell}</span>
                <span>${new Intl.NumberFormat('en-IN', currencyFormat).format(Math.abs(amountCell))}</span>
            </div>
            <div class="card-footer">
                <span>${descriptionCell}</span>
                <span>${formattedDate}</span>
            </div>
        `;
        dataContainer.appendChild(card);
    }
    currentlyDisplayedCount = end;
    loadMoreBtn.style.display = currentlyDisplayedCount < allTransactions.length ? 'inline-block' : 'none';
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
        showMessage('Please fill all required fields.'); return;
    }

    const formData = new FormData();
    formData.append('date', date);
    formData.append('type', type);
    formData.append('category', category);
    formData.append('amount', amount);
    formData.append('description', description);
    formData.append('paymentMode', paymentMode);

    fetch(webAppUrl, { method: 'POST', body: formData })
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
        .catch(error => console.error('Error adding data:', error));
}

window.onload = () => {
    fetchData(); 
    populatePaymentModesDropdown();
    populateCategoriesDropdown();
};
