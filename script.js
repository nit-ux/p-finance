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
let expenseChartInstance = null;
let allTimeTransactions = [];

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

function showConfirmation(message) {
    return new Promise(resolve => {
        const confirmBox = document.getElementById('confirmationBox');
        const confirmText = document.getElementById('confirmationText');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');

        confirmText.innerText = message;
        confirmBox.style.display = 'block';

        yesBtn.onclick = () => {
            confirmBox.style.display = 'none';
            resolve(true);
        };
        noBtn.onclick = () => {
            confirmBox.style.display = 'none';
            resolve(false);
        };
    });
}

function showSpinner() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideSpinner() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function handleTabClick(tabName, element) {
    resetAllCategoryStates();
    resetAllAccountStates();
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
    try {
        const { count, error: checkError } = await supabaseClient
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category', name);
        if (checkError) throw checkError;

        let confirmed = true;
        if (count > 0) {
            confirmed = await showConfirmation(
                `"${name}" category is used in ${count} transaction(s).\n\nAre you sure you want to delete this category AND all its related transactions permanently? This action cannot be undone.`
            );
        }

        if (confirmed) {
            if (count > 0) {
                const { error: txError } = await supabaseClient.from('transactions').delete().eq('category', name);
                if (txError) throw txError;
            }
            const { error: catError } = await supabaseClient.from('categories').delete().eq('name', name);
            if (catError) throw catError;
            
            renderCategoriesList();
            populateCategoriesDropdown();
        }
    } catch (error) {
        showMessage(`Error: ${error.message}`);
    }
}

async function updateCategory(saveButton) {
    const item = saveButton.closest('.category-item');
    const oldName = item.dataset.categoryName;
    const input = item.querySelector('.edit-category-input');
    const newName = input.value.trim();

    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    if (newName === oldName) { renderCategoriesList(); return; }

    try {
        const { error: txError } = await supabaseClient.from('transactions').update({ category: newName }).eq('category', oldName);
        if (txError) throw txError;
        
        const { error: catError } = await supabaseClient.from('categories').update({ name: newName }).eq('name', oldName);
        if (catError) throw catError;

        renderCategoriesList();
        populateCategoriesDropdown();
    } catch (error) {
        showMessage(`Error updating category: ${error.message}`);
        renderCategoriesList(); 
    }
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

async function populateCategoryFilter() {
    const categories = await getCategories();
    const select = document.getElementById('filter-category');
    // Pehla option "All Categories" hoga
    select.innerHTML = '<option value="">All Categories</option>';
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
    try {
        const { count, error: checkError } = await supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('payment_mode', name);
        if (checkError) throw checkError;

        let confirmed = true;
        if (count > 0) {
            confirmed = await showConfirmation(
                `"${name}" account is used in ${count} transaction(s).\n\nAre you sure you want to delete this account AND all its related transactions permanently? This action cannot be undone.`
            );
        }

        if (confirmed) {
            if (count > 0) {
                const { error: txError } = await supabaseClient.from('transactions').delete().eq('payment_mode', name);
                if (txError) throw txError;
            }
            const { error: accError } = await supabaseClient.from('accounts').delete().eq('name', name);
            if (accError) throw accError;
            
            renderAccountsList();
            populatePaymentModesDropdown();
        }
    } catch (error) {
        showMessage(`Error: ${error.message}`);
    }
}

async function updateAccount(saveButton) {
    const item = saveButton.closest('.account-item');
    const oldName = item.dataset.accountName;
    const input = item.querySelector('.edit-account-input');
    const newName = input.value.trim();
    if (!newName) { showMessage('Account name cannot be empty.'); return; }

    try {
        const { error: txError } = await supabaseClient.from('transactions').update({ payment_mode: newName }).eq('payment_mode', oldName);
        if (txError) throw txError;
        
        const { error: accError } = await supabaseClient.from('accounts').update({ name: newName }).eq('name', oldName);
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

async function populateAccountFilter() {
    const accounts = await getAccounts();
    const select = document.getElementById('filter-account');
    // Pehla option "All Accounts" hoga
    select.innerHTML = '<option value="">All Accounts</option>';
    accounts.forEach(acc => select.innerHTML += `<option value="${acc.name}">${acc.name}</option>`);
}

// ====== CORE APP LOGIC ======
async function renderExpenseChart(transactions) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    // Step 1: Sirf 'EXPENSE' type ke transactions filter karo
    const expenses = transactions.filter(tx => tx.type.toUpperCase() === 'EXPENSE');

    // Step 2: Categories ke hisab se kharchon ko group karke unka total karo
    const expenseByCategory = {};
    expenses.forEach(tx => {
        if (expenseByCategory[tx.category]) {
            expenseByCategory[tx.category] += tx.amount;
        } else {
            expenseByCategory[tx.category] = tx.amount;
        }
    });

    // Step 3: Chart.js ke liye labels aur data arrays banao
    const labels = Object.keys(expenseByCategory);
    const data = Object.values(expenseByCategory);

    // Step 4: Purana chart agar ho to use destroy kar do
    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }
    
    // Step 5: Naya chart banao
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut', // Chart ka type
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: [ // Chart ke liye sundar colors
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                    '#9966FF', '#FF9F40', '#C9CBCF', '#7C4DFF'
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top', // Labels upar dikhayein
                },
                title: {
                    display: true,
                    text: 'Expenses by Category' // Chart ka title
                }
            }
        }
    });
}

// --- MODAL LOGIC START ---

let selectedModalType = 'EXPENSE'; // Default type
let selectedModalAccount = null;
let selectedModalCategory = null;

// Modal mein accounts (payment modes) ko populate karega
async function populateAccountsInModal() {
    const accounts = await getAccounts();
    const container = document.getElementById('modal-accounts-selector');
    container.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        item.innerText = acc.name;
        item.dataset.name = acc.name;
        
        item.onclick = () => {
            // Pehle sabse 'active' class hatao
            container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active'));
            // Fir is par 'active' class lagao
            item.classList.add('active');
            selectedModalAccount = item.dataset.name;
        };
        container.appendChild(item);
    });
}

// Modal mein categories ko populate karega
async function populateCategoriesInModal() {
    const categories = await getCategories();
    const container = document.getElementById('modal-categories-selector');
    container.innerHTML = '';
    categories.forEach(catName => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        item.innerText = catName;
        item.dataset.name = catName;

        item.onclick = () => {
            container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedModalCategory = item.dataset.name;
        };
        container.appendChild(item);
    });
}

// Modal se data save karega
async function saveTransactionFromModal() {
    const date = document.getElementById('modal-date').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const description = document.getElementById('modal-description').value;
    const userId = await getCurrentUserId();

    // Validation
    if (!userId || !date || !amount || !description || !selectedModalAccount || !selectedModalCategory) {
        showMessage('Please fill all fields and select an account/category.');
        return;
    }

    showSpinner();
    try {
        const { error } = await supabaseClient.from('transactions').insert([{ 
            transaction_date: date, 
            type: selectedModalType, 
            category: selectedModalCategory, 
            amount: Math.abs(amount), 
            notes: description, 
            payment_mode: selectedModalAccount, 
            user_id: userId 
        }]);
        if (error) throw error;
        
        hideModal();
        showMessage('Transaction added successfully!');
        await fetchData(); // Data refresh karo
    } catch (error) {
        showMessage(`Failed to add transaction: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

function showModal() {
    // Modal kholne se pehle default values set karo
    document.getElementById('modal-date').valueAsDate = new Date();
    document.getElementById('modal-amount').value = '';
    document.getElementById('modal-description').value = '';
    selectedModalAccount = null;
    selectedModalCategory = null;
    populateAccountsInModal();
    populateCategoriesInModal();
    document.getElementById('transaction-modal-overlay').classList.add('active');
}

function hideModal() {
    document.getElementById('transaction-modal-overlay').classList.remove('active');
}

// Yeh function buttons ke click ko handle karega
function handleChartFilterClick(filterType) {
    // Sabhi buttons se 'active' class hatao
    document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));

    const startDateInput = document.getElementById('chart-start-date');
    const endDateInput = document.getElementById('chart-end-date');
    const today = new Date();

    if (filterType === 'thisMonth') {
        document.getElementById('btn-this-month').classList.add('active');
        // Is mahine ki pehli तारीख
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        // Is mahine ki aakhri तारीख
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        startDateInput.valueAsDate = firstDay;
        endDateInput.valueAsDate = lastDay;
    } else if (filterType === 'allTime') {
        document.getElementById('btn-all-time').classList.add('active');
        // Dates ko khaali kar do taaki koi filter na lage
        startDateInput.value = '';
        endDateInput.value = '';
    }
    
    // Naya function call karo jo chart ko update karega
    updateChartData();
}

// Yeh function chart ke liye data filter karke use render karega
function updateChartData() {
    const startDate = document.getElementById('chart-start-date').value;
    const endDate = document.getElementById('chart-end-date').value;

    let transactionsForChart = allTimeTransactions;

    // Agar dates select ki gayi hain, to data filter karo
    if (startDate && endDate) {
        transactionsForChart = allTimeTransactions.filter(tx => {
            const txDate = new Date(tx.transaction_date);
            return txDate >= new Date(startDate) && txDate <= new Date(endDate);
        });
    }
    
    // Chart ko naye filtered data ke saath render karo
    renderExpenseChart(transactionsForChart);
}

// YAHAN TAK ADD KAREIN
// NAYA AUR FINAL fetchData FUNCTION (ISE PASTE KAREIN)
async function fetchData() {
    showSpinner();
    try {
        // Step 1: BINA KISI FILTER ke saare transactions fetch karo
        const { data, error } = await supabaseClient.from('transactions').select('*');
        if (error) throw error;
        allTimeTransactions = data || []; // Saare data ko global variable mein store karo

        // Balance calculation ab 'allTimeTransactions' se hoga
        const accountsData = await getAccounts();
        const balances = {};
        accountsData.forEach(acc => { balances[acc.name] = acc.initial_balance || 0; });
        allTimeTransactions.forEach(tx => {
            if (balances[tx.payment_mode] !== undefined) {
                if (tx.type.toUpperCase() === 'INCOME') balances[tx.payment_mode] += Math.abs(tx.amount);
                else if (tx.type.toUpperCase() === 'EXPENSE') balances[tx.payment_mode] -= Math.abs(tx.amount);
            }
        });
        
        // UI mein balance update karo
        const currencyFormat = { style: 'currency', currency: 'INR' };
        let totalBalance = 0;
        const individualBalancesContainer = document.getElementById('individual-balances');
        individualBalancesContainer.innerHTML = '';
        Object.keys(balances).sort().forEach(accName => {
            const balance = balances[accName];
            totalBalance += balance;
            individualBalancesContainer.innerHTML += `<div class="balance-item"><span>${accName}:</span><span>${new Intl.NumberFormat('en-IN', currencyFormat).format(balance)}</span></div>`;
        });
        document.getElementById('total-balance').innerText = new Intl.NumberFormat('en-IN', currencyFormat).format(totalBalance);

        // Step 2: Ab Transaction Page ke filters ke liye data filter karo
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
        
        // Date ke hisab se sort karo
        filteredTx.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        allTransactions = filteredTx; // Yeh sirf transaction list ke liye hai
        document.getElementById('data-container').innerHTML = '';
        currentlyDisplayedCount = 0;
        displayTransactions();
        
        // Chart ko default filter ke saath update karo
        updateChartData();

    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage('Error fetching data from Supabase.');
    } finally {
        hideSpinner();
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
    
    amount = Math.abs(amount);

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
        const { transaction_date, type, category, amount, notes, payment_mode } = row;
        const cardClass = type.toUpperCase() === 'INCOME' ? 'income-card' : 'expense-card';
        const date = new Date(transaction_date);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        
        contentToAdd += `
            <div class="transaction-card ${cardClass}">
                <div class="card-header">
                    <span>${category}</span>
                    <span style="color: ${type.toUpperCase() === 'INCOME' ? 'green' : 'red'};">
                        ${type.toUpperCase() === 'INCOME' ? '+' : '-'} ${new Intl.NumberFormat('en-IN', currencyFormat).format(amount)}
                    </span>
                </div>
                <div class="card-body">
                    <p>${notes || ''}</p>
                </div>
                <div class="card-footer">
                    <span><small>${payment_mode}</small></span>
                    <span><small>${formattedDate}</small></span>
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
    populateCategoryFilter();
    populateAccountFilter();
    handleChartFilterClick('thisMonth');
    document.getElementById('add-transaction-fab').onclick = showModal;
    document.getElementById('modal-close-btn').onclick = hideModal;
    document.getElementById('modal-save-btn').onclick = saveTransactionFromModal;

    // Overlay par click karne se modal band ho jayega
    document.getElementById('transaction-modal-overlay').onclick = (event) => {
        if (event.target.id === 'transaction-modal-overlay') {
            hideModal();
        }
    };

    // Income/Expense buttons ke liye logic
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedModalType = btn.dataset.type;
        };
    });
}

const logoutButton = document.getElementById('logout-btn');
if (logoutButton) {
    logoutButton.addEventListener('click', logoutUser);
}
