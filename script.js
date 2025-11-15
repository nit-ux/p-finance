// === COMPLETE SCRIPT.JS WITH REALTIME POMODORO & SYNTAX FIX ===

// ====== SUPABASE SETUP for MAIN APP ======
const SUPABASE_URL = 'https://wfwjcbbylwmozqcddigc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd2pjYmJ5bHdtb3pxY2RkaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzk1MTQsImV4cCI6MjA3NzcxNTUxNH0.5hNH22mvpECQzfEgQsQRIbuWNm4XenUszgd21oOEif8';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== GLOBAL VARIABLES ======
let allTransactions = [];
let currentlyDisplayedCount = 0;
const transactionsPerLoad = 10;
let pressTimer = null;
let longPressTriggered = false;
let accountPressTimer = null;
let accountLongPressTriggered = false;
let expenseChartInstance = null;
let allTimeTransactions = [];
let pomodoroInterval = null;
let currentPomodoroTask = null;
let selectedModalType = 'EXPENSE';
let selectedModalCategory = null;
let selectedModalFromAccount = null;
let selectedModalToAccount = null;


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
async function logoutUser() { await supabaseClient.auth.signOut(); }
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
function showConfirmation(message) {
    return new Promise(resolve => {
        const confirmBox = document.getElementById('confirmationBox');
        document.getElementById('confirmationText').innerText = message;
        confirmBox.style.display = 'block';
        document.getElementById('confirm-yes-btn').onclick = () => { confirmBox.style.display = 'none'; resolve(true); };
        document.getElementById('confirm-no-btn').onclick = () => { confirmBox.style.display = 'none'; resolve(false); };
    });
}
function showSpinner() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideSpinner() { document.getElementById('loading-overlay').style.display = 'none'; }
function openSidebar() { document.getElementById('sidebar-menu').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('active'); }
function closeSidebar() { document.getElementById('sidebar-menu').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
function getHiddenAccounts() { const hidden = localStorage.getItem('hiddenAccounts'); return hidden ? JSON.parse(hidden) : []; }
function saveHiddenAccounts(accounts) { localStorage.setItem('hiddenAccounts', JSON.stringify(accounts)); }

function handleTabClick(pageName, element) {
    if (element.classList.contains('sidebar-link')) {
        document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    } else if (element.classList.contains('tab-link')) {
        document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
        element.classList.add('active');
    }
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    if (pageName === 'Home') document.getElementById('home-page').classList.remove('hidden');
    else if (pageName === 'Category') { document.getElementById('category-page').classList.remove('hidden'); renderCategoriesList(); }
    else if (pageName === 'Accounts') { document.getElementById('accounts-page').classList.remove('hidden'); renderAccountsList(); }
    else if (pageName === 'Transaction') { document.getElementById('transaction-page').classList.remove('hidden'); fetchData(); }
    else if (pageName === 'Tasks') { document.getElementById('tasks-page').classList.remove('hidden'); renderTasks(); }
    else if (pageName === 'Pomodoro') { document.getElementById('pomodoro-page').classList.remove('hidden'); initializePomodoroPage(); }
    closeSidebar();
}

// ====== CATEGORY MANAGEMENT ======
function handleCategoryTabClick(type, element) {
    document.querySelectorAll('.cat-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.category-content').forEach(content => content.classList.remove('active'));
    element.classList.add('active');
    if (type === 'EXPENSE') {
        document.getElementById('expense-categories-content').classList.add('active');
    } else {
        document.getElementById('income-categories-content').classList.add('active');
    }
}
async function getCategories(type) {
    let query = supabaseClient.from('categories').select('name');
    if (type) {
        query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) { console.error('Error fetching categories:', error); return []; }
    return data.map(c => c.name);
}
async function addCategory(type) {
    const inputId = type === 'EXPENSE' ? 'new-expense-category-name' : 'new-income-category-name';
    const input = document.getElementById(inputId);
    const newName = input.value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;
    const { error } = await supabaseClient.from('categories').insert([{ name: newName, user_id: userId, type: type }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    await renderCategoriesList();
    input.value = '';
}
async function removeCategory(name) {
    try {
        const { count, error: checkError } = await supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('category', name);
        if (checkError) throw checkError;
        let confirmed = true;
        if (count > 0) {
            confirmed = await showConfirmation(`"${name}" is used in ${count} transaction(s).\n\nDelete this category AND all its transactions?`);
        }
        if (confirmed) {
            if (count > 0) {
                const { error: txError } = await supabaseClient.from('transactions').delete().eq('category', name);
                if (txError) throw txError;
            }
            const { error: catError } = await supabaseClient.from('categories').delete().eq('name', name);
            if (catError) throw catError;
            renderCategoriesList();
        }
    } catch (error) { showMessage(`Error: ${error.message}`); }
}
async function updateCategory(saveButton) {
    const item = saveButton.closest('.category-item');
    const oldName = item.dataset.categoryName;
    const newName = item.querySelector('.edit-category-input').value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    if (newName === oldName) { renderCategoriesList(); return; }
    try {
        const { error: txError } = await supabaseClient.from('transactions').update({ category: newName }).eq('category', oldName);
        if (txError) throw txError;
        const { error: catError } = await supabaseClient.from('categories').update({ name: newName }).eq('name', oldName);
        if (catError) throw catError;
        renderCategoriesList();
    } catch (error) { showMessage(`Error updating category: ${error.message}`); renderCategoriesList(); }
}
async function renderCategoriesList() {
    const [expenseCategories, incomeCategories] = await Promise.all([getCategories('EXPENSE'), getCategories('INCOME')]);
    const expenseList = document.getElementById('expense-categories-list');
    const incomeList = document.getElementById('income-categories-list');
    expenseList.innerHTML = '';
    incomeList.innerHTML = '';
    expenseCategories.forEach(name => {
        const item = createCategoryElement(name);
        expenseList.appendChild(item);
    });
    incomeCategories.forEach(name => {
        const item = createCategoryElement(name);
        incomeList.appendChild(item);
    });
    handleCategoryTabClick('EXPENSE', document.querySelector('.cat-tab-btn'));
}
function createCategoryElement(name) {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.dataset.categoryName = name;
    item.innerHTML = `<div class="item-content"><span class="category-name">${name}</span><input type="text" class="edit-category-input hidden" value="${name}"></div><div class="item-actions"><button class="save-btn hidden" onclick="updateCategory(this)">Save</button><button class="remove-btn hidden" onclick="removeCategory('${name}')">Remove</button></div>`;
    item.addEventListener('mousedown', () => handlePressStart(item));
    item.addEventListener('mouseup', () => handlePressEnd());
    item.addEventListener('mouseleave', () => cancelPress());
    item.addEventListener('touchstart', () => handlePressStart(item), { passive: true });
    item.addEventListener('touchend', () => handlePressEnd());
    item.addEventListener('dblclick', () => handleCategoryDoubleClick(item));
    return item;
}

// ====== ACCOUNT MANAGEMENT ======
async function getAccounts() {
    const { data, error } = await supabaseClient.from('accounts').select('name, initial_balance');
    if (error) { console.error('Error fetching accounts:', error); return []; }
    return data;
}
async function addAccount() {
    const nameInput = document.getElementById('new-account-name');
    const balanceInput = document.getElementById('new-account-balance');
    const newName = nameInput.value.trim();
    const initialBalance = parseFloat(balanceInput.value) || 0;
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;
    showSpinner();
    try {
        const { error } = await supabaseClient.from('accounts').insert([{ name: newName, user_id: userId, initial_balance: initialBalance, type: 'general' }]);
        if (error) throw error;
        nameInput.value = '';
        balanceInput.value = '';
        await renderAccountsList();
        await populateAccountFilter();
    } catch (error) {
        showMessage(`Error adding account: ${error.message}`);
    } finally {
        hideSpinner();
    }
}
async function removeAccount(name) {
    try {
        const { count, error: checkError } = await supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('payment_mode', name);
        if (checkError) throw checkError;
        let confirmed = true;
        if (count > 0) {
            confirmed = await showConfirmation(`"${name}" is used in ${count} transaction(s).\n\nDelete this account AND all its transactions?`);
        }
        if (confirmed) {
            if (count > 0) {
                const { error: txError } = await supabaseClient.from('transactions').delete().eq('payment_mode', name);
                if (txError) throw txError;
            }
            const { error: accError } = await supabaseClient.from('accounts').delete().eq('name', name);
            if (accError) throw accError;
            renderAccountsList();
        }
    } catch (error) { showMessage(`Error: ${error.message}`); }
}
async function updateAccount(saveButton) {
    const item = saveButton.closest('.account-item');
    const oldName = item.dataset.accountName;
    const newName = item.querySelector('.edit-account-input').value.trim();
    const newBalance = parseFloat(item.querySelector('.edit-balance-input').value) || 0;
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    showSpinner();
    try {
        const { error: accError } = await supabaseClient.from('accounts').update({ name: newName, initial_balance: newBalance }).eq('name', oldName);
        if (accError) throw accError;
        if (oldName !== newName) {
            const { error: txError } = await supabaseClient.from('transactions').update({ payment_mode: newName }).eq('payment_mode', oldName);
            if (txError) throw txError;
        }
        await renderAccountsList();
        await populateAccountFilter();
        await fetchData();
    } catch (error) {
        showMessage(`Error updating account: ${error.message}`);
        renderAccountsList();
    } finally {
        hideSpinner();
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
        item.dataset.initialBalance = acc.initial_balance;
        item.innerHTML = `<div class="item-content"><span class="account-name">${acc.name}</span><span class="account-balance">Balance: ₹${acc.initial_balance.toFixed(2)}</span><div class="edit-account-view hidden"><input type="text" class="edit-account-input" value="${acc.name}"><input type="number" class="edit-balance-input" value="${acc.initial_balance}"></div></div><div class="item-actions"><button class="save-btn hidden" onclick="updateAccount(this)">Save</button><button class="remove-btn hidden" onclick="removeAccount('${acc.name}')">Remove</button></div>`;
        item.addEventListener('mousedown', () => handleAccountPressStart(item));
        item.addEventListener('mouseup', () => handleAccountPressEnd());
        item.addEventListener('mouseleave', () => cancelAccountPress());
        item.addEventListener('touchstart', () => handleAccountPressStart(item), { passive: true });
        item.addEventListener('touchend', () => handleAccountPressEnd());
        item.addEventListener('dblclick', () => handleAccountDoubleClick(item));
        listContainer.appendChild(item);
    });
}
async function populateCategoryFilter() {
    const categories = await getCategories();
    const select = document.getElementById('filter-category');
    select.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);
}
async function populateAccountFilter() {
    const accounts = await getAccounts();
    const select = document.getElementById('filter-account');
    select.innerHTML = '<option value="">All Accounts</option>';
    accounts.forEach(acc => select.innerHTML += `<option value="${acc.name}">${acc.name}</option>`);
}

// ====== CORE APP LOGIC ======
async function toggleBalanceVisibility(accountName) {
    let hiddenAccounts = getHiddenAccounts();
    const isHidden = hiddenAccounts.includes(accountName);
    if (isHidden) {
        hiddenAccounts = hiddenAccounts.filter(name => name !== accountName);
    } else {
        hiddenAccounts.push(accountName);
    }
    saveHiddenAccounts(hiddenAccounts);
    await fetchData();
}
async function saveTransactionFromModal() { if (selectedModalType === 'TRANSFER') { await saveTransfer(); } else { await saveStandardTransaction(); } }
async function saveStandardTransaction() {
    const date = document.getElementById('modal-date').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const description = document.getElementById('modal-description').value;
    const userId = await getCurrentUserId();
    if (!userId || !date || !amount || !description || !selectedModalFromAccount || !selectedModalCategory) { showMessage('Please fill all fields and select an account/category.'); return; }
    showSpinner();
    try {
        const { error } = await supabaseClient.from('transactions').insert([{ transaction_date: date, type: selectedModalType, category: selectedModalCategory, amount: Math.abs(amount), notes: description, payment_mode: selectedModalFromAccount, user_id: userId }]);
        if (error) throw error;
        hideModal();
        showMessage('Transaction added successfully!');
        await fetchData();
    } catch (error) { showMessage(`Failed to add transaction: ${error.message}`); } finally { hideSpinner(); }
}
async function saveTransfer() {
    const date = document.getElementById('modal-date').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const description = document.getElementById('modal-description').value;
    const userId = await getCurrentUserId();
    if (!userId || !date || !amount || !description || !selectedModalFromAccount || !selectedModalToAccount) { showMessage('Please fill all fields and select both accounts.'); return; }
    if (selectedModalFromAccount === selectedModalToAccount) { showMessage('From and To accounts cannot be the same.'); return; }
    const newTransferId = crypto.randomUUID();
    const expenseTx = { transaction_date: date, type: 'EXPENSE', category: 'Internal Transfer', amount: Math.abs(amount), notes: description, payment_mode: selectedModalFromAccount, user_id: userId, transfer_id: newTransferId };
    const incomeTx = { transaction_date: date, type: 'INCOME', category: 'Internal Transfer', amount: Math.abs(amount), notes: description, payment_mode: selectedModalToAccount, user_id: userId, transfer_id: newTransferId };
    showSpinner();
    try {
        const { error } = await supabaseClient.from('transactions').insert([expenseTx, incomeTx]);
        if (error) throw error;
        hideModal();
        showMessage('Transfer successful!');
        await fetchData();
    } catch (error) { showMessage(`Transfer failed: ${error.message}`); } finally { hideSpinner(); }
}
function showModal() {
    document.getElementById('modal-date').valueAsDate = new Date();
    document.getElementById('modal-amount').value = '';
    document.getElementById('modal-description').value = '';
    selectedModalFromAccount = null;
    selectedModalToAccount = null;
    selectedModalCategory = null;
    handleModalTypeChange('EXPENSE', document.querySelector('.type-btn[data-type="EXPENSE"]'));
    document.getElementById('transaction-modal-overlay').classList.add('active');
}
function hideModal() { document.getElementById('transaction-modal-overlay').classList.remove('active'); }
function handleModalTypeChange(type, element) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    selectedModalType = type;
    const standardView = document.getElementById('modal-standard-view');
    const transferView = document.getElementById('modal-transfer-view');
    if (type === 'TRANSFER') {
        standardView.classList.add('hidden');
        transferView.classList.remove('hidden');
        populateAccountsInModal('modal-from-account', name => selectedModalFromAccount = name);
        populateAccountsInModal('modal-to-account', name => selectedModalToAccount = name);
    } else {
        standardView.classList.remove('hidden');
        transferView.classList.add('hidden');
        populateAccountsInModal('modal-accounts-selector', name => selectedModalFromAccount = name);
        populateCategoriesInModal(selectedModalType);
    }
}
async function populateAccountsInModal(containerId, onSelect) {
    const accounts = await getAccounts();
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        item.innerText = acc.name;
        item.dataset.name = acc.name;
        item.onclick = () => { container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active')); item.classList.add('active'); onSelect(item.dataset.name); };
        container.appendChild(item);
    });
}
async function populateCategoriesInModal(type) {
    const categories = await getCategories(type);
    const container = document.getElementById('modal-categories-selector');
    container.innerHTML = '';
    categories.forEach(catName => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        item.innerText = catName;
        item.dataset.name = catName;
        item.onclick = () => { container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active')); item.classList.add('active'); selectedModalCategory = item.dataset.name; };
        container.appendChild(item);
    });
}
function handleChartFilterClick(filterType) {
    document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));
    const startDateInput = document.getElementById('chart-start-date');
    const endDateInput = document.getElementById('chart-end-date');
    const today = new Date();
    if (filterType === 'thisMonth') {
        document.getElementById('btn-this-month').classList.add('active');
        startDateInput.valueAsDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDateInput.valueAsDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (filterType === 'allTime') {
        document.getElementById('btn-all-time').classList.add('active');
        startDateInput.value = '';
        endDateInput.value = '';
    }
    updateChartData();
}
function updateChartData() {
    const startDate = document.getElementById('chart-start-date').value;
    const endDate = document.getElementById('chart-end-date').value;
    let transactionsForChart = allTimeTransactions;
    if (startDate && endDate) {
        transactionsForChart = allTimeTransactions.filter(tx => {
            const txDate = new Date(tx.transaction_date);
            return txDate >= new Date(startDate) && txDate <= new Date(endDate);
        });
    }
    renderExpenseChart(transactionsForChart);
}
async function renderExpenseChart(transactions) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const expenses = transactions.filter(tx => tx.type.toUpperCase() === 'EXPENSE');
    const expenseByCategory = {};
    expenses.forEach(tx => { expenseByCategory[tx.category] ? expenseByCategory[tx.category] += tx.amount : expenseByCategory[tx.category] = tx.amount; });
    const labels = Object.keys(expenseByCategory);
    const data = Object.values(expenseByCategory);
    if (expenseChartInstance) { expenseChartInstance.destroy(); }
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Expenses', data: data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7C4DFF'], hoverOffset: 4 }] },
        options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Expenses by Category' } } }
    });
}
async function fetchData() {
    showSpinner();
    try {
        const { data, error } = await supabaseClient.from('transactions').select('*');
        if (error) throw error;
        allTimeTransactions = data || [];
        const accountsData = await getAccounts();
        const balances = {};
        accountsData.forEach(acc => { balances[acc.name] = acc.initial_balance || 0; });
        allTimeTransactions.forEach(tx => { if (balances[tx.payment_mode] !== undefined) { if (tx.type.toUpperCase() === 'INCOME') balances[tx.payment_mode] += Math.abs(tx.amount); else if (tx.type.toUpperCase() === 'EXPENSE') balances[tx.payment_mode] -= Math.abs(tx.amount); } });
        const currencyFormat = { style: 'currency', currency: 'INR' };
        let totalBalance = 0;
        const individualBalancesContainer = document.getElementById('individual-balances');
        individualBalancesContainer.innerHTML = '';
        const hiddenAccounts = getHiddenAccounts();
        Object.keys(balances).sort().forEach(accName => {
            const balance = balances[accName];
            const isHidden = hiddenAccounts.includes(accName);
            if (!isHidden) { totalBalance += balance; }
            const balanceText = isHidden ? '∗∗∗∗' : new Intl.NumberFormat('en-IN', currencyFormat).format(balance);
            const eyeIconSVG = isHidden ? `<svg viewBox="0 0 576 512"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 204.8 2.5 256a32.5 32.5 0 000 7.2c14.8 51.2 46.1 99.4 93.1 142.4C142.5 443.2 207.2 480 288 480c80.8 0 145.5-36.8 192.6-80.6c47-43 78.3-91.2 93.1-142.4a32.5 32.5 0 000-7.2c-14.8-51.2-46.1-99.4-93.1-142.4C433.5 68.8 368.8 32 288 32zM432 256c0 79.5-64.5 144-144 144s-144-64.5-144-144s64.5-144 144-144s144 64.5 144 144zM288 192c0 35.3-28.7 64-64 64c-11.2 0-21.6-2.9-30.7-8.1l-98.3-98.3c-23.1 27.9-39.7 61.9-46.9 99.4L288 192zm22.4 91.9c-7.7 5.1-16.6 8.1-26.4 8.1c-35.3 0-64-28.7-64-64c0-9.8 2.9-18.7 8.1-26.4l-98.3-98.3c-37.5 7.2-71.5 23.8-99.4 46.9l286.1 286.1c23.1-27.9 39.7-61.9 46.9-99.4L310.4 283.9z"/></svg>` : `<svg viewBox="0 0 576 512"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 204.8 2.5 256a32.5 32.5 0 000 7.2c14.8 51.2 46.1 99.4 93.1 142.4C142.5 443.2 207.2 480 288 480c80.8 0 145.5-36.8 192.6-80.6c47-43 78.3-91.2 93.1-142.4a32.5 32.5 0 000-7.2c-14.8-51.2-46.1-99.4-93.1-142.4C433.5 68.8 368.8 32 288 32zM432 256c0 79.5-64.5 144-144 144s-144-64.5-144-144s64.5-144 144-144s144 64.5 144 144zM288 224a32 32 0 110 64a32 32 0 110-64z"/></svg>`;
            individualBalancesContainer.innerHTML += `<div class="balance-item"><span>${accName}:</span><div class="balance-value-container"><span>${balanceText}</span><button class="visibility-toggle-btn" onclick="toggleBalanceVisibility('${accName}')">${eyeIconSVG}</button></div></div>`;
        });
        document.getElementById('total-balance').innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(totalBalance);
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const searchTerm = document.getElementById('search-input').value.trim();
        const selectedCategory = document.getElementById('filter-category').value;
        const selectedAccount = document.getElementById('filter-account').value;
        let filteredTx = allTimeTransactions.filter(tx => {
            const txDate = new Date(tx.transaction_date);
            const notes = tx.notes || '';
            const dateMatch = (!startDate || txDate >= new Date(startDate)) && (!endDate || txDate <= new Date(endDate));
            const categoryMatch = !selectedCategory || tx.category === selectedCategory;
            const accountMatch = !selectedAccount || tx.payment_mode === selectedAccount;
            const searchMatch = !searchTerm || notes.toLowerCase().includes(searchTerm.toLowerCase());
            return dateMatch && categoryMatch && accountMatch && searchMatch;
        });
        filteredTx.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
        allTransactions = filteredTx;
        document.getElementById('data-container').innerHTML = '';
        currentlyDisplayedCount = 0;
        displayTransactions();
        updateChartData();
    } catch (error) { console.error('Error fetching data:', error); showMessage('Error fetching data from Supabase.'); } finally { hideSpinner(); }
}
function displayTransactions() {
    const dataContainer = document.getElementById('data-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currencyFormat = { style: 'currency', currency: 'INR' };
    if (allTransactions.length === 0 && currentlyDisplayedCount === 0) { dataContainer.innerHTML = '<p style="text-align:center;">No transactions found.</p>'; loadMoreBtn.style.display = 'none'; return; }
    const start = currentlyDisplayedCount;
    const end = Math.min(start + transactionsPerLoad, allTransactions.length);
    let contentToAdd = '';
    for (let i = start; i < end; i++) {
        const { transaction_date, type, category, amount, notes, payment_mode } = allTransactions[i];
        const date = new Date(transaction_date);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        contentToAdd += `<div class="transaction-card"><div class="card-header"><span>${category}</span><span style="color: ${type.toUpperCase() === 'INCOME' ? 'green' : 'red'};">${type.toUpperCase() === 'INCOME' ? '+' : '-'} ${new Intl.NumberFormat('en-IN', currencyFormat).format(amount)}</span></div><div class="card-body"><p>${notes || ''}</p></div><div class="card-footer"><span><small>${payment_mode}</small></span><span><small>${formattedDate}</small></span></div></div>`;
    }
    dataContainer.innerHTML += contentToAdd;
    currentlyDisplayedCount = end;
    loadMoreBtn.style.display = currentlyDisplayedCount < allTransactions.length ? 'inline-block' : 'none';
}
function loadMore() { displayTransactions(); }

// ====== EVENT LISTENERS & INTERACTION ======
function handlePressStart(item) { longPressTriggered = false; pressTimer = setTimeout(() => { longPressTriggered = true; resetAllCategoryStates(); resetAllAccountStates(); item.querySelector('.remove-btn').classList.remove('hidden'); }, 2000); }
function handlePressEnd() { clearTimeout(pressTimer); }
function cancelPress() { clearTimeout(pressTimer); }
function resetAllCategoryStates() { document.querySelectorAll('.category-item').forEach(item => { item.querySelector('.category-name').classList.remove('hidden'); item.querySelector('.edit-category-input').classList.add('hidden'); item.querySelector('.save-btn').classList.add('hidden'); item.querySelector('.remove-btn').classList.add('hidden'); }); }
function handleCategoryDoubleClick(item) { if (longPressTriggered) return; if (item.querySelector('.save-btn').classList.contains('hidden')) { resetAllCategoryStates(); resetAllAccountStates(); item.querySelector('.category-name').classList.add('hidden'); const input = item.querySelector('.edit-category-input'); input.classList.remove('hidden'); input.focus(); item.querySelector('.save-btn').classList.remove('hidden'); } }
function handleAccountPressStart(item) { accountLongPressTriggered = false; accountPressTimer = setTimeout(() => { accountLongPressTriggered = true; resetAllAccountStates(); resetAllCategoryStates(); item.querySelector('.remove-btn').classList.remove('hidden'); }, 2000); }
function handleAccountPressEnd() { clearTimeout(accountPressTimer); }
function cancelAccountPress() { clearTimeout(accountPressTimer); }
function resetAllAccountStates() { document.querySelectorAll('.account-item').forEach(item => { item.querySelector('.account-name').classList.remove('hidden'); item.querySelector('.account-balance').classList.remove('hidden'); item.querySelector('.edit-account-view').classList.add('hidden'); item.querySelector('.save-btn').classList.add('hidden'); item.querySelector('.remove-btn').classList.add('hidden'); }); }
function handleAccountDoubleClick(item) { if (accountLongPressTriggered) return; if (item.querySelector('.save-btn').classList.contains('hidden')) { resetAllAccountStates(); resetAllCategoryStates(); item.querySelector('.account-name').classList.add('hidden'); item.querySelector('.account-balance').classList.add('hidden'); item.querySelector('.edit-account-view').classList.remove('hidden'); item.querySelector('.save-btn').classList.remove('hidden'); item.querySelector('.edit-account-view .edit-account-input').focus(); } }

// --- TASK MANAGEMENT LOGIC ---
async function renderTasks() {
    showSpinner();
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        const incompleteTasks = tasks.filter(task => !task.is_completed);
        const completedTasks = tasks.filter(task => task.is_completed);
        const incompleteContainer = document.getElementById('tasks-list-container');
        const completedContainer = document.getElementById('completed-tasks-list');
        incompleteContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        document.getElementById('completed-tasks-count').innerText = completedTasks.length;
        if (incompleteTasks.length === 0) { incompleteContainer.innerHTML = '<p style="text-align:center;">No active tasks. Add one above!</p>'; } else { incompleteTasks.forEach(task => { const taskEl = createTaskElement(task); incompleteContainer.appendChild(taskEl); }); }
        if (completedTasks.length > 0) { completedTasks.forEach(task => { const taskEl = createTaskElement(task); completedContainer.appendChild(taskEl); }); }
    } catch (error) { showMessage(`Error fetching tasks: ${error.message}`); } finally { hideSpinner(); }
}
function createTaskElement(task) {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.is_completed ? 'completed' : ''}`;
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
    taskEl.innerHTML = `<div class="checkbox-container"><input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTaskStatus(${task.id}, ${task.is_completed})"></div><div class="task-details"><h4>${task.title}</h4><p>${task.description || ''}</p><div class="due-date">${dueDate}</div></div><div class="task-actions"><button class="delete-btn" onclick="deleteTask(${task.id})" title="Delete Task"><svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg></button></div>`;
    return taskEl;
}
async function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const description = document.getElementById('new-task-desc').value.trim();
    const dueDate = document.getElementById('new-task-due-date').value;
    if (!title) { showMessage('Task title is required.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;
    showSpinner();
    try {
        const { error } = await supabaseClient.from('tasks').insert({ title: title, description: description, due_date: dueDate || null, user_id: userId, is_completed: false });
        if (error) throw error;
        document.getElementById('new-task-title').value = '';
        document.getElementById('new-task-desc').value = '';
        document.getElementById('new-task-due-date').value = '';
        await renderTasks();
    } catch (error) { showMessage(`Error adding task: ${error.message}`); } finally { hideSpinner(); }
}
async function toggleTaskStatus(taskId, currentStatus) { try { const { error } = await supabaseClient.from('tasks').update({ is_completed: !currentStatus }).eq('id', taskId); if (error) throw error; await renderTasks(); } catch (error) { showMessage(`Error updating task: ${error.message}`); } }
async function deleteTask(taskId) { if (await showConfirmation('Are you sure you want to delete this task?')) { try { const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId); if (error) throw error; await renderTasks(); } catch (error) { showMessage(`Error deleting task: ${error.message}`); } } }
function toggleCompletedTasks() { const header = document.getElementById('completed-tasks-header'); const list = document.getElementById('completed-tasks-list'); header.classList.toggle('open'); list.classList.toggle('open'); }

// --- REALTIME POMODORO TIMER LOGIC ---
function initializePomodoroPage() { populatePomodoroTaskSelect(); resetPomodoroUI(); }
async function populatePomodoroTaskSelect() {
    const select = document.getElementById('pomodoro-task-select');
    const { data: tasks } = await supabaseClient.from('tasks').select('id, title').eq('is_completed', false);
    if (!tasks) return;
    const currentSelection = select.value;
    select.innerHTML = '<option value="">-- Choose a task --</option>';
    tasks.forEach(task => { select.innerHTML += `<option value="${task.id}">${task.title}</option>`; });
    select.value = currentSelection;
}
async function startPomodoro() {
    const taskId = document.getElementById('pomodoro-task-select').value;
    if (!taskId) { showMessage("Please select a task."); return; }
    let updates = {};
    if (currentPomodoroTask && currentPomodoroTask.pomodoro_state === 'paused') {
        const timeLeft = currentPomodoroTask.pomodoro_time_left_on_pause;
        updates = { pomodoro_state: 'running', pomodoro_start_time: new Date(Date.now() - ((25 * 60) - timeLeft) * 1000).toISOString() };
    } else {
        updates = { pomodoro_state: 'running', pomodoro_start_time: new Date().toISOString(), pomodoro_time_left_on_pause: null };
    }
    const { error } = await supabaseClient.from('tasks').update(updates).eq('id', taskId);
    if (error) { console.error("Error starting pomodoro:", error); showMessage(`Error: Could not start timer. ${error.message}`); }
}
async function pausePomodoro() {
    if (!currentPomodoroTask || currentPomodoroTask.pomodoro_state !== 'running') return;
    const elapsed = (Date.now() - new Date(currentPomodoroTask.pomodoro_start_time).getTime()) / 1000;
    const timeLeft = Math.round((25 * 60) - elapsed);
    await supabaseClient.from('tasks').update({ pomodoro_state: 'paused', pomodoro_time_left_on_pause: timeLeft }).eq('id', currentPomodoroTask.id);
}
async function resetPomodoro() {
    const taskId = document.getElementById('pomodoro-task-select').value;
    if (!taskId) { resetPomodoroUI(); return; }
    await supabaseClient.from('tasks').update({ pomodoro_state: 'stopped', pomodoro_start_time: null, pomodoro_time_left_on_pause: null }).eq('id', taskId);
}
function resetPomodoroUI() {
    clearInterval(pomodoroInterval);
    document.getElementById('pomodoro-timer-display').innerText = '25:00';
    document.getElementById('pomodoro-start-btn').innerText = 'Start';
    document.getElementById('pomodoro-start-btn').classList.remove('hidden');
    document.getElementById('pomodoro-pause-btn').classList.add('hidden');
    document.getElementById('pomodoro-container').classList.remove('break-time');
}
function handlePomodoroUpdate(task) {
    currentPomodoroTask = task;
    clearInterval(pomodoroInterval);
    switch (task.pomodoro_state) {
        case 'running':
            const startTime = new Date(task.pomodoro_start_time).getTime();
            const endTime = startTime + (25 * 60 * 1000);
            pomodoroInterval = setInterval(() => {
                const now = Date.now();
                const timeLeft = Math.round((endTime - now) / 1000);
                if (timeLeft <= 0) { clearInterval(pomodoroInterval); document.getElementById('alarm-sound').play(); resetPomodoro(); return; }
                updateTimerDisplay(timeLeft);
            }, 1000);
            document.getElementById('pomodoro-start-btn').classList.add('hidden');
            document.getElementById('pomodoro-pause-btn').classList.remove('hidden');
            break;
        case 'paused':
            updateTimerDisplay(task.pomodoro_time_left_on_pause);
            document.getElementById('pomodoro-start-btn').innerText = 'Resume';
            document.getElementById('pomodoro-start-btn').classList.remove('hidden');
            document.getElementById('pomodoro-pause-btn').classList.add('hidden');
            break;
        default:
            resetPomodoroUI();
            break;
    }
}
function updateTimerDisplay(totalSeconds) { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; document.getElementById('pomodoro-timer-display').innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }

// ====== APP INITIALIZATION ======
function initializeRealtimeSubscriptions() {
    console.log("Initializing realtime subscriptions...");
    supabaseClient.channel('public:all_data')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, async () => { await fetchData(); await populateAccountFilter(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => { await fetchData(); await populateCategoryFilter(); })
        .subscribe();
    supabaseClient.channel('public:tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
            renderTasks();
            const selectedTaskId = document.getElementById('pomodoro-task-select').value;
            if (payload.new.id == selectedTaskId) {
                handlePomodoroUpdate(payload.new);
            }
        })
        .subscribe();
}
function initializeApp() {
    console.log("Loading initial data...");
    fetchData(); 
    populateCategoryFilter();
    populateAccountFilter();
    handleChartFilterClick('thisMonth');
    window.toggleBalanceVisibility = toggleBalanceVisibility;
    document.getElementById('menu-btn').onclick = openSidebar;
    document.getElementById('sidebar-overlay').onclick = closeSidebar;
    document.getElementById('add-transaction-fab').onclick = showModal;
    document.getElementById('modal-close-btn').onclick = hideModal;
    document.getElementById('modal-save-btn').onclick = saveTransactionFromModal;
    document.getElementById('transaction-modal-overlay').onclick = (event) => { if (event.target.id === 'transaction-modal-overlay') hideModal(); };
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => { handleModalTypeChange(btn.dataset.type, btn); };
    });
    document.getElementById('pomodoro-start-btn').onclick = startPomodoro;
    document.getElementById('pomodoro-pause-btn').onclick = pausePomodoro;
    document.getElementById('pomodoro-reset-btn').onclick = resetPomodoro;
    document.getElementById('pomodoro-task-select').onchange = async (e) => {
        const taskId = e.target.value;
        if (!taskId) { resetPomodoroUI(); currentPomodoroTask = null; return; }
        const { data: task } = await supabaseClient.from('tasks').select('*').eq('id', taskId).single();
        if (task) { handlePomodoroUpdate(task); }
    };
    document.getElementById('completed-tasks-header').onclick = toggleCompletedTasks;
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logoutUser);
    }
    initializeRealtimeSubscriptions();
}
