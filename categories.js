// categories.js

import { supabaseClient } from './supabase.js';
import { showMessage, showConfirmation } from './ui.js';
import { getCurrentUserId } from './auth.js';

// Global state/functions jo is module ko chahiye
let handlePressStart, handlePressEnd, cancelPress, handleCategoryDoubleClick, resetAllCategoryStates, resetAllAccountStates;

export function setCategoryDependencies(functions) {
    handlePressStart = functions.handlePressStart;
    handlePressEnd = functions.handlePressEnd;
    cancelPress = functions.cancelPress;
    handleCategoryDoubleClick = functions.handleCategoryDoubleClick;
    resetAllCategoryStates = functions.resetAllCategoryStates;
    resetAllAccountStates = functions.resetAllAccountStates;
}

export function handleCategoryTabClick(type, element) {
    document.querySelectorAll('.cat-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.category-content').forEach(content => content.classList.remove('active'));
    element.classList.add('active');
    if (type === 'EXPENSE') {
        document.getElementById('expense-categories-content').classList.add('active');
    } else {
        document.getElementById('income-categories-content').classList.add('active');
    }
}

export async function getCategories(type) {
    let query = supabaseClient.from('categories').select('name');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) { console.error('Error fetching categories:', error); return []; }
    return data.map(c => c.name);
}

export async function addCategory(type) {
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

export async function removeCategory(name) {
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

export async function updateCategory(saveButton) {
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

export async function renderCategoriesList() {
    const [expenseCategories, incomeCategories] = await Promise.all([ getCategories('EXPENSE'), getCategories('INCOME') ]);
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

export async function populateCategoryFilter() {
    const categories = await getCategories(); // getCategories pehle se exported hai
    const select = document.getElementById('filter-category');
    select.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(name => select.innerHTML += `<option value="${name}">${name}</option>`);
}