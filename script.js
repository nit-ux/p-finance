// === COMPLETE SCRIPT.JS WITH FAB/MODAL & ERROR FIX ===

// ====== SUPABASE SETUP for MAIN APP ======
const SUPABASE_URL = 'https://wfwjcbbylwmozqcddigc.supabase.co/';
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
        yesBtn.onclick = () => { confirmBox.style.display = 'none'; resolve(true); };
        noBtn.onclick = () => { confirmBox.style.display = 'none'; resolve(false); };
    });
}

function showSpinner() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideSpinner() { document.getElementById('loading-overlay').style.display = 'none'; }
function openSidebar() {
    document.getElementById('sidebar-menu').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebar-menu').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function handleTabClick(pageName, element) {
    resetAllCategoryStates();
    resetAllAccountStates();
    
    // Check karo ki click hua element sidebar ka hai ya tab bar ka
    if (element.classList.contains('sidebar-link')) {
        // Agar sidebar link hai, to tab bar se active state hata do
        document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
    } else if (element.classList.contains('tab-link')) {
        // Agar tab link hai, to sabhi tab links se active state manage karo
        document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
        element.classList.add('active');
    }
    
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    
    if (pageName === 'Home') document.getElementById('home-page').classList.remove('hidden');
    else if (pageName === 'Category') { document.getElementById('category-page').classList.remove('hidden'); renderCategoriesList(); } 
    else if (pageName === 'Accounts') { document.getElementById('accounts-page').classList.remove('hidden'); renderAccountsList(); } 
    else if (pageName === 'Transaction') { document.getElementById('transaction-page').classList.remove('hidden'); fetchData(); }
    else if (pageName === 'Tasks') { document.getElementById('tasks-page').classList.remove('hidden'); renderTasks(); }

    closeSidebar(); // Hamesha sidebar ko band kar do
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
    const categories = await getCategories();
    const listContainer = document.getElementById('categories-list');
    listContainer.innerHTML = '';
    categories.forEach(categoryName => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.dataset.categoryName = categoryName;
        item.innerHTML = `<div class="item-content"><span class="category-name">${categoryName}</span><input type="text" class="edit-category-input hidden" value="${categoryName}"></div><div class="item-actions"><button class="save-btn hidden" onclick="updateCategory(this)">Save</button><button class="remove-btn hidden" onclick="removeCategory('${categoryName}')">Remove</button></div>`;
        item.addEventListener('mousedown', () => handlePressStart(item));
        item.addEventListener('mouseup', () => handlePressEnd(item));
        item.addEventListener('mouseleave', () => cancelPress());
        item.addEventListener('touchstart', () => handlePressStart(item), { passive: true });
        item.addEventListener('touchend', () => handlePressEnd(item));
        listContainer.appendChild(item);
    });
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
    input.value = '';
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
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    try {
        const { error: txError } = await supabaseClient.from('transactions').update({ payment_mode: newName }).eq('payment_mode', oldName);
        if (txError) throw txError;
        const { error: accError } = await supabaseClient.from('accounts').update({ name: newName }).eq('name', oldName);
        if (accError) throw accError;
        renderAccountsList();
    } catch (error) { showMessage(`Error updating account: ${error.message}`); renderAccountsList(); }
}

async function renderAccountsList() {
    const accounts = await getAccounts();
    const listContainer = document.getElementById('accounts-list');
    listContainer.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.dataset.accountName = acc.name;
        item.innerHTML = `<div class="item-content"><span class="account-name">${acc.name}</span><input type="text" class="edit-account-input hidden" value="${acc.name}"></div><div class="item-actions"><button class="save-btn hidden" onclick="updateAccount(this)">Save</button><button class="remove-btn hidden" onclick="removeAccount('${acc.name}')">Remove</button></div>`;
        item.addEventListener('mousedown', () => handleAccountPressStart(item));
        item.addEventListener('mouseup', () => handleAccountPressEnd(item));
        item.addEventListener('mouseleave', () => cancelAccountPress());
        item.addEventListener('touchstart', () => handleAccountPressStart(item), { passive: true });
        item.addEventListener('touchend', () => handleAccountPressEnd(item));
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

// --- MODAL LOGIC START ---
let selectedModalType = 'EXPENSE';
let selectedModalAccount = null;
let selectedModalCategory = null;

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
            container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedModalAccount = item.dataset.name;
        };
        container.appendChild(item);
    });
}

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

async function saveTransactionFromModal() {
    const date = document.getElementById('modal-date').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const description = document.getElementById('modal-description').value;
    const userId = await getCurrentUserId();

    if (!userId || !date || !amount || !description || !selectedModalAccount || !selectedModalCategory) {
        showMessage('Please fill all fields and select an account/category.');
        return;
    }
    showSpinner();
    try {
        const { error } = await supabaseClient.from('transactions').insert([{ transaction_date: date, type: selectedModalType, category: selectedModalCategory, amount: Math.abs(amount), notes: description, payment_mode: selectedModalAccount, user_id: userId }]);
        if (error) throw error;
        hideModal();
        showMessage('Transaction added successfully!');
        await fetchData();
    } catch (error) {
        showMessage(`Failed to add transaction: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

function showModal() {
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
// --- MODAL LOGIC END ---

function handleChartFilterClick(filterType) {
    document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));
    const startDateInput = document.getElementById('chart-start-date');
    const endDateInput = document.getElementById('chart-end-date');
    const today = new Date();
    if (filterType === 'thisMonth') {
        document.getElementById('btn-this-month').classList.add('active');
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDateInput.valueAsDate = firstDay;
        endDateInput.valueAsDate = lastDay;
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
    expenses.forEach(tx => {
        if (expenseByCategory[tx.category]) {
            expenseByCategory[tx.category] += tx.amount;
        } else {
            expenseByCategory[tx.category] = tx.amount;
        }
    });
    const labels = Object.keys(expenseByCategory);
    const data = Object.values(expenseByCategory);
    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }
    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses', data: data,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7C4DFF'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Expenses by Category' }
            }
        }
    });
}

// ... renderExpenseChart() function ke baad ...

// YEH SAARE NAYE FUNCTIONS ADD KAREIN

// --- TASK MANAGEMENT LOGIC ---

// Database se saare tasks fetch karke screen par dikhayega
async function renderTasks() {
    showSpinner();
    try {
        const userId = await getCurrentUserId();
        if (!userId) return;

        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }); // Naye tasks upar

        if (error) throw error;

        const container = document.getElementById('tasks-list-container');
        container.innerHTML = ''; // Purani list saaf karo

        if (tasks.length === 0) {
            container.innerHTML = '<p style="text-align:center;">No tasks found. Add one above!</p>';
            return;
        }

        tasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `task-item ${task.is_completed ? 'completed' : ''}`;
            
            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';

            taskEl.innerHTML = `
                <div class="checkbox-container">
                    <input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTaskStatus(${task.id}, ${task.is_completed})">
                </div>
                <div class="task-details">
                    <h4>${task.title}</h4>
                    <p>${task.description || ''}</p>
                    <div class="due-date">${dueDate}</div>
                </div>
                <div class="task-actions">
                    <button class="delete-btn" onclick="deleteTask(${task.id})" title="Delete Task">
                        <svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
                    </button>
                </div>
            `;
            container.appendChild(taskEl);
        });
    } catch (error) {
        showMessage(`Error fetching tasks: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

// Naya task add karega
async function addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    const description = document.getElementById('new-task-desc').value.trim();
    const dueDate = document.getElementById('new-task-due-date').value;
    
    if (!title) {
        showMessage('Task title is required.');
        return;
    }

    const userId = await getCurrentUserId();
    if (!userId) return;

    showSpinner();
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .insert({
                title: title,
                description: description,
                due_date: dueDate || null, // Agar date khaali hai to null bhejo
                user_id: userId,
                is_completed: false
            });

        if (error) throw error;

        // Form clear karo
        document.getElementById('new-task-title').value = '';
        document.getElementById('new-task-desc').value = '';
        document.getElementById('new-task-due-date').value = '';

        await renderTasks(); // List ko refresh karo
    } catch (error) {
        showMessage(`Error adding task: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

// Task ka status (complete/incomplete) badlega
async function toggleTaskStatus(taskId, currentStatus) {
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .update({ is_completed: !currentStatus }) // Status ko ulta kar do
            .eq('id', taskId);

        if (error) throw error;
        await renderTasks(); // List refresh karo
    } catch (error) {
        showMessage(`Error updating task: ${error.message}`);
    }
}

// Task ko delete karega
async function deleteTask(taskId) {
    const confirmed = await showConfirmation('Are you sure you want to delete this task?');
    if (confirmed) {
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .delete()
                .eq('id', taskId);
            
            if (error) throw error;
            await renderTasks(); // List refresh karo
        } catch (error) {
            showMessage(`Error deleting task: ${error.message}`);
        }
    }
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
        allTimeTransactions.forEach(tx => {
            if (balances[tx.payment_mode] !== undefined) {
                if (tx.type.toUpperCase() === 'INCOME') balances[tx.payment_mode] += Math.abs(tx.amount);
                else if (tx.type.toUpperCase() === 'EXPENSE') balances[tx.payment_mode] -= Math.abs(tx.amount);
            }
        });
        
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
    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage('Error fetching data from Supabase.');
    } finally {
        hideSpinner();
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
// PURANE initializeApp KO ISSE REPLACE KAREIN
function initializeApp() {
    console.log("Loading initial data...");
    fetchData(); 
    populateCategoryFilter();
    populateAccountFilter();
    handleChartFilterClick('thisMonth');
    
    // --- SIDEBAR EVENT LISTENERS ---
    document.getElementById('menu-btn').onclick = openSidebar;
    document.getElementById('sidebar-overlay').onclick = closeSidebar;

    // --- MODAL EVENT LISTENERS ---
    document.getElementById('add-transaction-fab').onclick = showModal;
    document.getElementById('modal-close-btn').onclick = hideModal;
    document.getElementById('modal-save-btn').onclick = saveTransactionFromModal;
    document.getElementById('transaction-modal-overlay').onclick = (event) => {
        if (event.target.id === 'transaction-modal-overlay') hideModal();
    };
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedModalType = btn.dataset.type;
        };
    });

    // --- LOGOUT BUTTON LISTENER ---
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logoutUser);
    }
}
