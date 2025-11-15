// tasks.js

import { supabaseClient } from './supabase.js';
import { showMessage, showConfirmation, showSpinner, hideSpinner } from './ui.js';
import { getCurrentUserId } from './auth.js';

export async function renderTasks() {
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
        if (incompleteTasks.length === 0) {
            incompleteContainer.innerHTML = '<p style="text-align:center;">No active tasks. Add one above!</p>';
        } else {
            incompleteTasks.forEach(task => { const taskEl = createTaskElement(task); incompleteContainer.appendChild(taskEl); });
        }
        if (completedTasks.length > 0) {
             completedTasks.forEach(task => { const taskEl = createTaskElement(task); completedContainer.appendChild(taskEl); });
        }
    } catch (error) {
        showMessage(`Error fetching tasks: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

function createTaskElement(task) {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.is_completed ? 'completed' : ''}`;
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date';
    taskEl.innerHTML = `<div class="checkbox-container"><input type="checkbox" ${task.is_completed ? 'checked' : ''} onchange="toggleTaskStatus(${task.id}, ${task.is_completed})"></div><div class="task-details"><h4>${task.title}</h4><p>${task.description || ''}</p><div class="due-date">${dueDate}</div></div><div class="task-actions"><button class="delete-btn" onclick="deleteTask(${task.id})" title="Delete Task"><svg viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg></button></div>`;
    return taskEl;
}

export async function addTask() {
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
    } catch (error) {
        showMessage(`Error adding task: ${error.message}`);
    } finally {
        hideSpinner();
    }
}

export async function toggleTaskStatus(taskId, currentStatus) {
    try {
        const { error } = await supabaseClient.from('tasks').update({ is_completed: !currentStatus }).eq('id', taskId);
        if (error) throw error;
        await renderTasks();
    } catch (error) {
        showMessage(`Error updating task: ${error.message}`);
    }
}

export async function deleteTask(taskId) {
    const confirmed = await showConfirmation('Are you sure you want to delete this task?');
    if (confirmed) {
        try {
            const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            await renderTasks();
        } catch (error) {
            showMessage(`Error deleting task: ${error.message}`);
        }
    }
}

export function toggleCompletedTasks() {
    document.getElementById('completed-tasks-header').classList.toggle('open');
    document.getElementById('completed-tasks-list').classList.toggle('open');
}