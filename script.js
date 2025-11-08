// ====== SUPABASE SETUP ======
// IMPORTANT: YAHAN APNI SUPABASE URL AUR ANON KEY DAALEIN
const SUPABASE_URL = 'https://wfwjcbbylwmozqcddigc.supabase.co/'; // Yahan apna Supabase Project URL daalein
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd2pjYmJ5bHdtb3pxY2RkaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzk1MTQsImV4cCI6MjA3NzcxNTUxNH0.5hNH22mvpECQzfEgQsQRIbuWNm4XenUszgd21oOEif8'; // Yahan apni Supabase Anon Key daalein

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== GLOBAL VARIABLES ======
let allTransactions = [];
let currentlyDisplayedCount = 0;
const transactionsPerLoad = 10;
let pressTimer = null;
let longPressTriggered = false;
let isLoginMode = true; // Auth UI ke liye

// ====== AUTHENTICATION LOGIC ======

// Yeh function page load hote hi check karta hai ki user logged-in hai ya nahi
supabase.auth.onAuthStateChange((event, session) => {
    const authOverlay = document.getElementById('auth-overlay');
    const mainContainer = document.querySelector('.container');
    const tabContainer = document.querySelector('.tab-bar');

    if (session && session.user) {
        // User logged-in hai: App dikhao, login form chhupao
        authOverlay.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        tabContainer.classList.remove('hidden');
        initializeApp(); // App ka saara data load karo
    } else {
        // User logged-in nahi hai: Login form dikhao, app chhupao
        authOverlay.classList.remove('hidden');
        mainContainer.classList.add('hidden');
        tabContainer.classList.add('hidden');
    }
});

// Login aur Signup form ke beech switch karne ke liye
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-toggle-text').innerHTML = isLoginMode 
        ? 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>'
        : 'Already have an account? <a href="#" onclick="toggleAuthMode()">Login</a>';
    document.getElementById('auth-error').innerText = '';
}

// Login ya Signup button par click handle karne ke liye
async function handleAuthAction() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const authError = document.getElementById('auth-error');
    authError.innerText = '';

    try {
        const { error } = isLoginMode
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (error) throw error;

        if (!isLoginMode) {
            showMessage("Signup successful! Please check your email to verify your account.");
        }
    } catch (error) {
        authError.innerText = error.message;
    }
}

// User ko logout karne ke liye
async function logoutUser() {
    await supabase.auth.signOut();
}

// Current logged-in user ki ID lene ke liye
async function getCurrentUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? session.user.id : null;
}

// ====== UI HELPER FUNCTIONS ======
function showMessage(message) {
    document.getElementById('messageText').innerText = message;
    document.getElementById('messageBox').style.display = 'block';
}

function hideMessage() {
    document.getElementById('messageBox').style.display = 'none';
}

// Tab navigation handle karne ke liye
function handleTabClick(tabName, element) {
    resetAllCategoryStates();
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


// ====== CATEGORY MANAGEMENT (with Supabase) ======

async function getCategories() {
    const { data, error } = await supabase.from('categories').select('name');
    if (error) { console.error('Error fetching categories:', error); return []; }
    return data.map(c => c.name);
}

async function addCategory() {
    const input = document.getElementById('new-category-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Category name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase.from('categories').insert([{ name: newName, user_id: userId, type: 'expense' }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    
    renderCategoriesList();
    populateCategoriesDropdown();
    input.value = '';
}

async function removeCategory(name) {
    const { error } = await supabase.from('categories').delete().eq('name', name);
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

    const { error } = await supabase.from('categories').update({ name: newName }).eq('name', oldName);
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

// ====== ACCOUNT MANAGEMENT (with Supabase) ======

async function getAccounts() {
    const { data, error } = await supabase.from('accounts').select('name, initial_balance');
    if (error) { console.error('Error fetching accounts:', error); return []; }
    return data;
}

async function addAccount() {
    const input = document.getElementById('new-account-name');
    const newName = input.value.trim();
    if (!newName) { showMessage('Account name cannot be empty.'); return; }
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase.from('accounts').insert([{ name: newName, user_id: userId, initial_balance: 0, type: 'general' }]);
    if (error) { showMessage(`Error: ${error.message}`); return; }

    renderAccountsList();
    populatePaymentModesDropdown();
    input.value = '';
}

async function removeAccount(name) {
    const { error } = await supabase.from('accounts').delete().eq('name', name);
    if (error) { showMessage(`Error: ${error.message}`); return; }
    renderAccountsList();
    populatePaymentModesDropdown();
}

async function renderAccountsList() {
    const accounts = await getAccounts();
    const listContainer = document.getElementById('accounts-list');
    listContainer.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'account-item';
        item.innerHTML = `
            <span class="item-content">${acc.name}</span>
            <div class="item-actions">
                <button class="remove-btn" onclick="removeAccount('${acc.name}')">Remove</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

async function populatePaymentModesDropdown() {
    const accounts = await getAccounts();
    const select = document.getElementById('add-paymentMode');
    select.innerHTML = '<option value="" disabled selected>Payment Mode</option>';
    accounts.forEach(acc => select.innerHTML += `<option value="${acc.name}">${acc.name}</option>`);
}

// ====== CORE APP LOGIC (with Supabase) ======

async function fetchData() {
    try {
        const accountsData = await getAccounts();
        const { data: allTxData, error: allTxError } = await supabase.from('transactions').select('amount, payment_mode');
        if (allTxError) throw allTxError;

        const balances = {};
        accountsData.forEach(acc => {
            balances[acc.name] = acc.initial_balance || 0;
        });
        allTxData.forEach(tx => {
            if (balances[tx.payment_mode] !== undefined) {
                balances[tx.payment_mode] += tx.amount;
            }
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
        let query = supabase.from('transactions').select('*').order('transaction_date', { ascending: false });
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
        const { error } = await supabase.from('transactions').insert([{ 
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

    for (let i = start; i < end; i++) {
        const row = allTransactions[i];
        const { transaction_date, type, category, amount, notes } = row;
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.style.backgroundColor = type.toUpperCase() === 'INCOME' ? '#28a745' : '#dc3545';
        card.style.color = 'white';
        const date = new Date(transaction_date);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        card.innerHTML = `
            <div class="card-header">
                <span>${category}</span>
                <span>${new Intl.NumberFormat('en-IN', currencyFormat).format(Math.abs(amount))}</span>
            </div>
            <div class="card-footer">
                <span>${notes}</span>
                <span>${formattedDate}</span>
            </div>`;
        dataContainer.appendChild(card);
    }
    currentlyDisplayedCount = end;
    loadMoreBtn.style.display = currentlyDisplayedCount < allTransactions.length ? 'inline-block' : 'none';
}

function loadMore() { displayTransactions(); }
function clearFormFields() { document.querySelector('.input-form').reset(); }

// ====== EVENT LISTENERS & INITIALIZATION ======
function handlePressStart(item) {
    longPressTriggered = false;
    pressTimer = setTimeout(() => {
        longPressTriggered = true;
        resetAllCategoryStates();
        item.querySelector('.remove-btn').classList.remove('hidden');
    }, 2000);
}

function handlePressEnd(item) {
    clearTimeout(pressTimer);
    if (!longPressTriggered) {
        if (item.querySelector('.save-btn').classList.contains('hidden')) {
            resetAllCategoryStates();
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

// Jab app load hota hai, to auth listener sab kuchh shuru kar dega.
function initializeApp() {
    fetchData(); 
    populatePaymentModesDropdown();
    populateCategoriesDropdown();
}
