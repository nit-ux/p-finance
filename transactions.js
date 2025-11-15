// transactions.js - POORI FILE KO ISSE REPLACE KAREIN

import { supabaseClient } from './supabase.js';
import { showMessage, showSpinner, hideSpinner, generateUUID } from './ui.js';
import { getCurrentUserId } from './auth.js';
import { getCategories } from './categories.js';
import { getAccounts } from './accounts.js';

// Global state
let allTimeTransactions = [];
export function setAllTimeTransactions(data) { allTimeTransactions = data; }
let allTransactions = [];
export function setAllTransactions(data) { allTransactions = data; }
let currentlyDisplayedCount = 0;
export function getCurrentlyDisplayedCount() { return currentlyDisplayedCount; }
export function setCurrentlyDisplayedCount(count) { currentlyDisplayedCount = count; }
export const transactionsPerLoad = 10;
let expenseChartInstance = null;
let selectedModalType = 'EXPENSE';
let selectedModalAccount = null;
let selectedModalToAccount = null; // Naya variable
let selectedModalCategory = null;

// Baaki saare helper functions (getHiddenAccounts, etc.)
export function getHiddenAccounts() {
    const hidden = localStorage.getItem('hiddenAccounts');
    return hidden ? JSON.parse(hidden) : [];
}
export function saveHiddenAccounts(accounts) {
    localStorage.setItem('hiddenAccounts', JSON.stringify(accounts));
}

export async function toggleBalanceVisibility(accountName) {
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

async function populateToAccountsInModal() {
    const accounts = await getAccounts();
    const container = document.getElementById('modal-to-accounts-selector');
    container.innerHTML = '';
    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'selector-item';
        item.innerText = acc.name;
        item.dataset.name = acc.name;
        item.onclick = () => {
            container.querySelectorAll('.selector-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            selectedModalToAccount = item.dataset.name;
        };
        container.appendChild(item);
    });
}

export async function populateAccountsInModal() {
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

export async function populateCategoriesInModal(type) {
    const categories = await getCategories(type);
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

export async function saveTransactionFromModal() {
    const date = document.getElementById('modal-date').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const description = document.getElementById('modal-description').value;
    const userId = await getCurrentUserId();

    if (!userId || !date || !amount) {
        showMessage('Please fill Date, Amount, and select accounts.');
        return;
    }

    showSpinner();
    try {
        if (selectedModalType === 'TRANSFER') {
            // --- TRANSFER LOGIC ---
            if (!selectedModalAccount || !selectedModalToAccount) {
                throw new Error("Please select both 'From' and 'To' accounts for transfer.");
            }
            if (selectedModalAccount === selectedModalToAccount) {
                throw new Error("'From' and 'To' accounts cannot be the same.");
            }

            const transferId = generateUUID();
            const transferTransactions = [
                // Debit from 'From' account
                {
                    transaction_date: date,
                    type: 'EXPENSE',
                    category: 'Transfer',
                    amount: Math.abs(amount),
                    notes: description || `Transfer to ${selectedModalToAccount}`,
                    payment_mode: selectedModalAccount,
                    user_id: userId,
                    transfer_id: transferId
                },
                // Credit to 'To' account
                {
                    transaction_date: date,
                    type: 'INCOME',
                    category: 'Transfer',
                    amount: Math.abs(amount),
                    notes: description || `Transfer from ${selectedModalAccount}`,
                    payment_mode: selectedModalToAccount,
                    user_id: userId,
                    transfer_id: transferId
                }
            ];

            const { error } = await supabaseClient.from('transactions').insert(transferTransactions);
            if (error) throw error;
            showMessage('Transfer successful!');

        } else {
            // --- INCOME/EXPENSE LOGIC ---
            if (!selectedModalAccount || !selectedModalCategory) {
                throw new Error("Please select an account and a category.");
            }
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
            showMessage('Transaction added successfully!');
        }

        hideModal();
        await fetchData();
    } catch (error) {
        showMessage(`Failed: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

export function showModal() {
    document.getElementById('modal-date').valueAsDate = new Date();
    document.getElementById('modal-amount').value = '';
    document.getElementById('modal-description').value = '';
    selectedModalAccount = null;
    selectedModalToAccount = null;
    selectedModalCategory = null;
    
    // UI ko default state mein set karo (Expense)
    handleModalTypeChange('EXPENSE'); 
    
    populateAccountsInModal();
    populateToAccountsInModal();
    
    document.getElementById('transaction-modal-overlay').classList.add('active');
}

export function hideModal() {
    document.getElementById('transaction-modal-overlay').classList.remove('active');
}

export function handleModalTypeChange(type) {
    selectedModalType = type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('active');

    const transferFields = document.getElementById('transfer-fields');
    const categoryFields = document.getElementById('category-selection-area');
    const saveBtn = document.getElementById('modal-save-btn');
    
    if (type === 'TRANSFER') {
        transferFields.classList.remove('hidden');
        categoryFields.classList.add('hidden');
        saveBtn.innerText = 'SAVE TRANSFER';
    } else {
        transferFields.classList.add('hidden');
        categoryFields.classList.remove('hidden');
        saveBtn.innerText = 'SAVE TRANSACTION';
        populateCategoriesInModal(type); // Sirf Income/Expense ke liye category load karo
    }
}

// ... baaki ke saare functions (handleChartFilterClick, fetchData, etc.) yahan same rahenge ...
// (Neeche ka code poora copy-paste kar dein)

export function handleChartFilterClick(filterType) {
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

export function updateChartData() {
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
        type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Expenses', data: data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7C4DFF'], hoverOffset: 4 }] },
        options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Expenses by Category' } } }
    });
}

export async function fetchData() {
    showSpinner();
    try {
        const { data, error } = await supabaseClient.from('transactions').select('*');
        if (error) throw error;
        setAllTimeTransactions(data || []);
        
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
        const hiddenAccounts = getHiddenAccounts();
        Object.keys(balances).sort().forEach(accName => {
            const balance = balances[accName];
            const isHidden = hiddenAccounts.includes(accName);
            if (!isHidden) totalBalance += balance;
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
        
        setAllTransactions(filteredTx);
        document.getElementById('data-container').innerHTML = '';
        setCurrentlyDisplayedCount(0);
        displayTransactions();
        updateChartData();
    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage('Error fetching data from Supabase.');
    } finally {
        hideSpinner();
    }
}

export function displayTransactions() {
    const dataContainer = document.getElementById('data-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currencyFormat = { style: 'currency', currency: 'INR' };
    if (allTransactions.length === 0 && getCurrentlyDisplayedCount() === 0) {
        dataContainer.innerHTML = '<p style="text-align:center;">No transactions found.</p>';
        loadMoreBtn.style.display = 'none'; return;
    }
    const start = getCurrentlyDisplayedCount();
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
    setCurrentlyDisplayedCount(end);
    loadMoreBtn.style.display = getCurrentlyDisplayedCount() < allTransactions.length ? 'inline-block' : 'none';
}

export function loadMore() { displayTransactions(); }