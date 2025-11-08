// ====== SUPABASE SETUP for MAIN APP ======
const SUPABASE_URL = 'https://wfwjcbbylwmozqcddigc.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd2pjYmJ5bHdtb3pxY2RkaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzk1MTQsImV4cCI6MjA3NzcxNTUxNH0.5hNH22mvpECQzfEgQsQRIbuWNm4XenUszgd21oOEif8';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== GLOBAL VARIABLES ======
let allTransactions = [];
let currentlyDisplayedCount = 0;
const transactionsPerLoad = 10;
let pressTimer = null; // For categories
let longPressTriggered = false;
let accountPressTimer = null; // For accounts
let accountLongPressTriggered = false;

// ====== AUTHENTICATION & SECURITY CHECK ======
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!session || !session.user) {
        window.location.href = 'login.html';
    }
});

(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        initializeApp();
    } else {
        window.location.href = 'login.html';
    }
})();

async function logoutUser() {
    await supabaseClient.auth.signOut();
}

async function getCurrentUserId() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.user.id : null;
}

// ====== UI HELPER FUNCTIONS ======
function showMessage(message) {
    const msgBox = document.getElementById('messageBox');
    document.getElementById('messageText').innerText = message;
    msgBox.style.display = 'block';
}
function hideMessage() { document.getElementById('messageBox').style.display = 'none'; }

function handleTabClick(tabName, element) {
    resetAllCategoryStates();
    resetAllAccountStates(); // Reset account states too
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

// ====== CATEGORY MANAGEMENT ======
async function getCategories() {
    const { data, error } = await supabaseClient.from('categories').select('name');
    if (error) { console.error('Error fetching categories:', error); return []; }
    return data.map(c => c.name);
}

async function addCategory() {
    const input = document.getElementById('new-category-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabaseClient.from('categories').insert([{ name: newName, user_id: userId, type: 'expense' }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    
    renderCategoriesList();
    populateCategoriesDropdown();
    input.value = '';
}

async function removeCategory(name) {
    const { error } = await supabaseClient.from('categories').delete().eq('name', name);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    renderCategoriesList();
    populateCategoriesDropdown();
}

async function updateCategory(saveButton) {
    const item = saveButton.closest('.category-item');
    const oldName = item.dataset.categoryName;
    const input = item.querySelector('.edit-category-input');
    const newName = input.value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }

    const { error } = await supabaseClient.from('categories').update({ name: newName }).eq('name', oldName);
    if (error) { showMessage(`Error: ${error.message}`); return; }

    renderCategoriesList();
    populateCategoriesDropdown();
}

async function renderCategoriesList() {
    const categories = await getCategories();
    const listContainer = document.getElementById('categories-list');
    listContainer.innerHTML = '';
    
    categories.forEach(categoryName => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.categoryName = categoryName;
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
        item.addEventListener('mousedown', () => handlePressStart(item));
        item.addEventListener('mouseup', () => handlePressEnd(item));
        item.addEventListener('mouseleave', () => cancelPress());
        item.addEventListener('touchstart', () => handlePressStart(item), { passive: true });
        item.addEventListener('touchend', () => handlePressEnd(item));
        listContainer.appendChild(item);
    });
}

async function populateCategoriesDropdown() {
    const categories = await getCategories();
    const select = document.getElementById('add-category');
    select.innerHTML = '<option value="" disabled selected>Select Category</option>';
    categories.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);
}

// ====== ACCOUNT MANAGEMENT ======
async function getAccounts() {
    const { data, error } = await supabaseClient.from('accounts').select('name, initial_balance');
    if (error) { console.error('Error fetching accounts:', error); return []; }
    return data;
}

async function addAccount() {
    const input = document.getElementById('new-account-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabaseClient.from('accounts').insert([{ name: newName, user_id: userId, initial_balance: 0, type: 'general' }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }

    renderAccountsList();
    populatePaymentModesDropdown();
    input.value = '';
}

async function removeAccount(name) {
    const { error } = await supabaseClient.from('accounts').delete().eq('name', name);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    renderAccountsList();
    populatePaymentModesDropdown();
}

async function updateAccount(saveButton) {
    const item = saveButton.closest('.account-item');
    const oldName = item.dataset.accountName;
    const input = item.querySelector('.edit-account-input');
    const newName = input.value.trim();
    if (!newName) { showMessage('Account name cannot be empty.'); return; }

    try {
        const { error: txError } = await supabaseClient
            .from('transactions')
            .update({ payment_mode: newName })
            .eq('payment_mode', oldName);
        if (txError) throw txError;
        
        const { error: accError } = await supabaseClient
            .from('accounts')
            .update({ name: newName })
            .eq('name', oldName);
        if (accError) throw accError;

        renderAccountsList();
        populatePaymentModesDropdown();

    } catch (error) {
        showMessage(`Error updating account: ${error.message}`);
        renderAccountsList();
    }
}

async function renderAccountsList() {
    const accounts = await getAccounts();
    const listContainer = document.getElementById('accounts-list');
    listContainer.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.dataset.accountName = acc.name;
        item.innerHTML = `
            <div class="item-content">
                <span class="account-name">${acc.name}</span>
                <input type="text" class="edit-account-input hidden" value="${acc.name}">
            </div>
            <div class="item-actions">
                <button class="save-btn hidden" onclick="updateAccount(this)">Save</button>
                <button class="remove-btn hidden" onclick="removeAccount('${acc.name}')">Remove</button>
            </div>
        `;
        item.addEventListener('mousedown', () => handleAccountPressStart(item));
        item.addEventListener('mouseup', () => handleAccountPressEnd(item));
        item.addEventListener('mouseleave', () => cancelAccountPress());
        item.addEventListener('touchstart', () => handleAccountPressStart(item), { passive: true });
        item.addEventListener('touchend', () => handleAccountPressEnd(item));
        listContainer.appendChild(item);
    });
}

async function populatePaymentModesDropdown() {
    const accounts = await getAccounts();
    const select = document.getElementById('add-paymentMode');
    select.innerHTML = '<option value="" disabled selected>Payment Mode</option>';
    accounts.forEach(acc => select.innerHTML += `<option value="${acc.name}">${acc.name}</option>`);
}

// ====== CORE APP LOGIC ======
async function fetchData() {
    try {
        const accountsData = await getAccounts();
        const { data: allTxData, error: allTxError } = await supabaseClient.from('transactions').select('amount, payment_mode');
        if (allTxError) throw allTxError;

        const balances = {};
        accountsData.forEach(acc => { balances[acc.name] = acc.initial_balance || 0; });
        allTxData.forEach(tx => {
            if (balances[tx.payment_mode] !== undefined) { balances[tx.payment_mode] += tx.amount; }
        });
        
        const currencyFormat = { style: 'currency', currency: 'INR' };
        const totalBalanceElement = document.getElementById('total-balance');
        const individualBalancesContainer = document.getElementById('individual-balances');
        let totalBalance = 0;
        individualBalancesContainer.innerHTML = '';
        Object.keys(balances).sort().forEach(accName => {
            const balance = balances[accName];
            totalBalance += balance;
            individualBalancesContainer.innerHTML += `<div class="balance-item"><span>${accName}:</span><span>${new Intl.NumberFormat('en-IN', currencyFormat).format(balance)}</span></div>`;
        });
        totalBalanceElement.innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(totalBalance);

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        let query = supabaseClient.from('transactions').select('*').order('transaction_date', { ascending: false });
        if (startDate) query = query.gte('transaction_date', startDate);
        if (endDate) query = query.lte('transaction_date', endDate);
        const { data: filteredTx, error: filteredTxError } = await query;
        if (filteredTxError) throw filteredTxError;

        allTransactions = filteredTx || [];
        document.getElementById('data-container').innerHTML = '';
        currentlyDisplayedCount = 0;
        displayTransactions();

    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage('Error fetching data from Supabase.');
    }
}

async function addData() {
    const date = document.getElementById('add-date').value;
    const type = document.getElementById('add-type').value;
    const category = document.getElementById('add-category').value;
    let amount = parseFloat(document.getElementById('add-amount').value);
    const description = document.getElementById('add-description').value;
    const paymentMode = document.getElementById('add-paymentMode').value;
    const userId = await getCurrentUserId();

    if (!userId || !date || !type || !category || !amount || !description || !paymentMode) {
        showMessage('Please fill all required fields.'); return;
    }

    if (type === 'EXPENSE') amount = -Math.abs(amount);
    
    try {
        const { error } = await supabaseClient.from('transactions').insert([{ 
            transaction_date: date, type, category, amount, notes: description, payment_mode: paymentMode, user_id: userId 
        }]);
        if (error) throw error;
        showMessage('Data added successfully!');
        clearFormFields();
        fetchData();
    } catch (error) {
        console.error('Error adding data:', error);
        showMessage(`Failed to add data: ${error.message}`);
    }
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

    let contentToAdd = '';
    for (let i = start; i < end; i++) {
        const row = allTransactions[i];
        const { transaction_date, type, category, amount, notes } = row;
        const cardClass = type.toUpperCase() === 'INCOME' ? 'income-card' : 'expense-card';
        const date = new Date(transaction_date);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        contentToAdd += `
            <div class="transaction-card ${cardClass}">
                <div class="card-header">
                    <span>${category}</span>
                    <span>${new Intl.NumberFormat('en-IN', currencyFormat).format(Math.abs(amount))}</span>
                </div>
                <div class="card-footer">
                    <span>${notes || ''}</span>
                    <span>${formattedDate}</span>
                </div>
            </div>`;
    }
    dataContainer.innerHTML += contentToAdd;

    currentlyDisplayedCount = end;
    loadMoreBtn.style.display = currentlyDisplayedCount < allTransactions.length ? 'inline-block' : 'none';
}

function loadMore() { displayTransactions(); }
function clearFormFields() { 
    document.getElementById('add-date').value = '';
    document.getElementById('add-type').selectedIndex = 0;
    document.getElementById('add-category').selectedIndex = 0;
    document.getElementById('add-paymentMode').selectedIndex = 0;
    document.getElementById('add-amount').value = '';
    document.getElementById('add-description').value = '';
}

// ====== EVENT LISTENERS & INTERACTION ======
function handlePressStart(item) {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
        longPressTriggered = true;
        resetAllCategoryStates();
        resetAllAccountStates();
        item.querySelector('.remove-btn').classList.remove('hidden');
    }, 2000);
}
function handlePressEnd(item) {
    clearTimeout(pressTimer);
    if (!longPressTriggered) {
        if (item.querySelector('.save-btn').classList.contains('hidden')) {
            resetAllCategoryStates();
            resetAllAccountStates();
            item.querySelector('.category-name').classList.add('hidden');
            const input = item.querySelector('.edit-category-input');
            input.classList.remove('hidden');
            input.focus();
            item.querySelector('.save-btn').classList.remove('hidden');
        }
    }
}
function cancelPress() { clearTimeout(pressTimer); }
function resetAllCategoryStates() {
    document.querySelectorAll('.category-item').forEach(item => {
        item.querySelector('.category-name').classList.remove('hidden');
        item.querySelector('.edit-category-input').classList.add('hidden');
        item.querySelector('.save-btn').classList.add('hidden');
        item.querySelector('.remove-btn').classList.add('hidden');
    });
}

function handleAccountPressStart(item) {
    accountLongPressTriggered = false;
    accountPressTimer = setTimeout(() => {
        accountLongPressTriggered = true;
        resetAllAccountStates();
        resetAllCategoryStates();
        item.querySelector('.remove-btn').classList.remove('hidden');
    }, 2000);
}
function handleAccountPressEnd(item) {
    clearTimeout(accountPressTimer);
    if (!accountLongPressTriggered) {
        if (item.querySelector('.save-btn').classList.contains('hidden')) {
            resetAllAccountStates();
            resetAllCategoryStates();
            item.querySelector('.account-name').classList.add('hidden');
            const input = item.querySelector('.edit-account-input');
            input.classList.remove('hidden');
            input.focus();
            item.querySelector('.save-btn').classList.remove('hidden');
        }
    }
}
function cancelAccountPress() { clearTimeout(accountPressTimer); }
function resetAllAccountStates() {
    document.querySelectorAll('.account-item').forEach(item => {
        item.querySelector('.account-name').classList.remove('hidden');
        item.querySelector('.edit-account-input').classList.add('hidden');
        item.querySelector('.save-btn').classList.add('hidden');
        item.querySelector('.remove-btn').classList.add('hidden');
    });
}

// ====== APP INITIALIZATION ======
function initializeApp() {
    console.log("Loading initial data...");
    fetchData(); 
    populatePaymentModesDropdown();
    populateCategoriesDropdown();
}

const logoutButton = document.getElementById('logout-btn');
if (logoutButton) {
    logoutButton.addEventListener('click', logoutUser);
}
