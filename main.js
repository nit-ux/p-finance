// main.js - FINAL COMPLETE VERSION WITH GLOBAL TIMER (SYNTAX CORRECTED)

import { supabaseClient } from './supabase.js';
import { logoutUser } from './auth.js';
import * as UI from './ui.js';
import * as Categories from './categories.js';
import * as Accounts from './accounts.js';
import * as Tasks from './tasks.js';
import * as Pomodoro from './pomodoro.js';
import * as Transactions from './transactions.js';

// Global variables
let pressTimer = null;
let longPressTriggered = false;
let accountPressTimer = null;
let accountLongPressTriggered = false;
let globalTimerInterval = null;
let currentRunningTask = null;

// --- GLOBAL TIMER LOGIC ---
function updateGlobalTimerDisplay() {
    clearInterval(globalTimerInterval); // Always clear the old interval

    if (!currentRunningTask || currentRunningTask.pomodoro_state !== 'running' || !currentRunningTask.pomodoro_start_time) {
        document.getElementById('global-timer-display').classList.add('hidden');
        return;
    }

    const timerUI = document.getElementById('global-timer-display');
    const taskNameUI = document.getElementById('global-timer-task-name');
    const timeUI = document.getElementById('global-timer-time');
    
    taskNameUI.innerText = `${currentRunningTask.title}:`;
    timerUI.classList.remove('hidden');

    const startTime = new Date(currentRunningTask.pomodoro_start_time).getTime();
    
    const update = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        timeUI.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    
    update(); // Run once immediately
    globalTimerInterval = setInterval(update, 1000);
}

// --- Interaction Logic ---
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

// --- Master Navigation ---
function handleTabClick(pageName, element) {
    if (element.classList.contains('sidebar-link')) { document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active')); }
    else if (element.classList.contains('tab-link')) { document.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active')); element.classList.add('active'); }
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));

    if (pageName === 'Home') document.getElementById('home-page').classList.remove('hidden');
    else if (pageName === 'Category') { document.getElementById('category-page').classList.remove('hidden'); Categories.renderCategoriesList(); } 
    else if (pageName === 'Accounts') { document.getElementById('accounts-page').classList.remove('hidden'); Accounts.renderAccountsList(); } 
    else if (pageName === 'Transaction') { document.getElementById('transaction-page').classList.remove('hidden'); Transactions.fetchData(); }
    else if (pageName === 'Tasks') { document.getElementById('tasks-page').classList.remove('hidden'); Tasks.renderTasks(); }
    else if (pageName === 'Pomodoro') { document.getElementById('pomodoro-page').classList.remove('hidden'); Pomodoro.initializePomodoroPage(); }
    UI.closeSidebar();
}

// --- Realtime Subscriptions (Currently Disabled for Simplicity) ---
function initializeRealtimeSubscriptions() {
    // console.log("Realtime connections disabled.");
}

// --- Main App Initialization ---
async function initializeApp() {
    console.log("Loading initial data...");

    // Dependencies
    Categories.setCategoryDependencies({ handlePressStart, handlePressEnd, cancelPress, handleCategoryDoubleClick, resetAllCategoryStates, resetAllAccountStates });
    Accounts.setAccountDependencies({ handleAccountPressStart, handleAccountPressEnd, cancelAccountPress, handleAccountDoubleClick });

    // Make functions globally available for HTML onclicks
    window.handleTabClick = handleTabClick;
    window.handleCategoryTabClick = Categories.handleCategoryTabClick;
    window.addCategory = Categories.addCategory;
    window.updateCategory = Categories.updateCategory;
    window.removeCategory = Categories.removeCategory;
    window.addAccount = Accounts.addAccount;
    window.updateAccount = Accounts.updateAccount;
    window.removeAccount = Accounts.removeAccount;
    window.addTask = Tasks.addTask;
    window.toggleTaskStatus = Tasks.toggleTaskStatus;
    window.deleteTask = Tasks.deleteTask;
    window.toggleStopwatch = async () => {
        const updatedTask = await Pomodoro.toggleStopwatch(currentRunningTask);
        currentRunningTask = updatedTask;
        updateGlobalTimerDisplay();
        Tasks.renderTasks();
    };
    window.resetStopwatch = async () => {
        const updatedTask = await Pomodoro.resetStopwatch(currentRunningTask);
        currentRunningTask = updatedTask;
        updateGlobalTimerDisplay();
        Tasks.renderTasks();
    };
    window.fetchData = Transactions.fetchData;
    window.loadMore = Transactions.loadMore;
    window.handleChartFilterClick = Transactions.handleChartFilterClick;
    window.toggleBalanceVisibility = Transactions.toggleBalanceVisibility;
    window.hideMessage = UI.hideMessage;
    
    // Event Listeners
    document.getElementById('menu-btn').onclick = UI.openSidebar;
    document.getElementById('sidebar-overlay').onclick = UI.closeSidebar;
    document.getElementById('add-transaction-fab').onclick = Transactions.showModal;
    document.getElementById('modal-close-btn').onclick = Transactions.hideModal;
    document.getElementById('modal-save-btn').onclick = Transactions.saveTransactionFromModal;
    document.getElementById('transaction-modal-overlay').onclick = (event) => { if (event.target.id === 'transaction-modal-overlay') Transactions.hideModal(); };
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => { Transactions.handleModalTypeChange(btn.dataset.type); };
    });
    document.getElementById('pomodoro-task-select').onchange = async (e) => {
        const taskId = e.target.value;
        if (!taskId) {
            Pomodoro.handleStopwatchUpdate(null);
            currentRunningTask = null; // Clear the running task
            updateGlobalTimerDisplay(); // Hide the global timer
            return;
        }
        const { data: task } = await supabaseClient.from('tasks').select('*').eq('id', taskId).single();
        if (task) {
            currentRunningTask = task;
            Pomodoro.handleStopwatchUpdate(task);
        }
    };
    document.getElementById('completed-tasks-header').onclick = Tasks.toggleCompletedTasks;
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    // Initial data load
    await Transactions.fetchData(); 
    await Categories.populateCategoryFilter();
    await Accounts.populateAccountFilter();
    Transactions.handleChartFilterClick('thisMonth');
    
    // Check for any running task on app start
    const { data: runningTask } = await supabaseClient.from('tasks').select('*').eq('pomodoro_state', 'running').single();
    if (runningTask) {
        currentRunningTask = runningTask;
        updateGlobalTimerDisplay();
    }
    
    initializeRealtimeSubscriptions();
}

// --- App Entry Point ---
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