// accounts.js - FINAL CORRECTED VERSION

import { supabaseClient } from './supabase.js';
import { showMessage, showConfirmation, showSpinner, hideSpinner } from './ui.js';
import { getCurrentUserId } from './auth.js';
import { fetchData } from './transactions.js';

// Dependencies jo main.js se aayengi
let handleAccountPressStart, handleAccountPressEnd, cancelAccountPress, handleAccountDoubleClick;

export function setAccountDependencies(functions) {
    handleAccountPressStart = functions.handleAccountPressStart;
    handleAccountPressEnd = functions.handleAccountPressEnd;
    cancelAccountPress = functions.cancelAccountPress;
    handleAccountDoubleClick = functions.handleAccountDoubleClick;
}

export async function getAccounts() {
    const { data, error } = await supabaseClient.from('accounts').select('name, initial_balance');
    if (error) { console.error('Error fetching accounts:', error); return []; }
    return data;
}

export async function addAccount() {
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

export async function removeAccount(name) {
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

export async function updateAccount(saveButton) {
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

export async function renderAccountsList() {
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

export async function populateAccountFilter() {
    const accounts = await getAccounts();
    const select = document.getElementById('filter-account');
    if (!select) return;
    select.innerHTML = '<option value="">All Accounts</option>';
    accounts.forEach(acc => select.innerHTML += `<option value="${acc.name}">${acc.name}</option>`);
}