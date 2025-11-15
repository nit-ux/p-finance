// pomodoro.js - CORRECTED VERSION WITH EXPORT

import { supabaseClient } from './supabase.js';
import { showMessage } from './ui.js';
import { getCurrentUserId } from './auth.js';

let stopwatchInterval = null;
let currentStopwatchTask = null;

// Iska kaam sirf UI ko update karna hai
function updateTimerDisplay(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    document.getElementById('stopwatch-timer-display').innerText = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// YAHAN BADLAV HUA HAI: 'export' keyword add kiya gaya hai
export function handleStopwatchUpdate(task) {
    currentStopwatchTask = task;
    clearInterval(stopwatchInterval); // Hamesha purana interval clear karo

    const toggleBtn = document.getElementById('stopwatch-toggle-btn');

    if (task && task.pomodoro_state === 'running' && task.pomodoro_start_time) {
        const startTime = new Date(task.pomodoro_start_time).getTime();
        
        stopwatchInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            updateTimerDisplay(elapsed);
        }, 1000);

        toggleBtn.innerText = 'Stop';
        toggleBtn.classList.add('running');
    } else {
        // 'stopped' state
        updateTimerDisplay(0);
        toggleBtn.innerText = 'Start';
        toggleBtn.classList.remove('running');
    }
}

// Start aur Stop, dono ko handle karega
export async function toggleStopwatch() {
    const taskId = document.getElementById('pomodoro-task-select').value;
    if (!taskId) { showMessage("Please select a task first."); return; }

    if (currentStopwatchTask && currentStopwatchTask.pomodoro_state === 'running') {
        // --- STOP THE TIMER & LOG THE TIME ---
        const startTime = currentStopwatchTask.pomodoro_start_time;
        const endTime = new Date().toISOString();
        const userId = await getCurrentUserId();

        await supabaseClient.from('time_logs').insert({ task_id: taskId, user_id: userId, start_time: startTime, end_time: endTime });
        
        const { data } = await supabaseClient.from('tasks').update({ pomodoro_state: 'stopped', pomodoro_start_time: null }).eq('id', taskId).select().single();
        handleStopwatchUpdate(data);
    } else {
        // --- START THE TIMER ---
        const updates = { pomodoro_state: 'running', pomodoro_start_time: new Date().toISOString() };
        const { data, error } = await supabaseClient.from('tasks').update(updates).eq('id', taskId).select().single();
        if (error) { showMessage(error.message); return; }
        handleStopwatchUpdate(data);
    }
}

export async function resetStopwatch() {
    const taskId = document.getElementById('pomodoro-task-select').value;
    if (!taskId) return;

    if (currentStopwatchTask && currentStopwatchTask.pomodoro_state === 'running') {
        await toggleStopwatch();
    } else {
        handleStopwatchUpdate(null);
    }
}

export async function populatePomodoroTaskSelect() {
    const select = document.getElementById('pomodoro-task-select');
    const { data: tasks } = await supabaseClient.from('tasks').select('id, title').eq('is_completed', false);
    if (!tasks) return;
    const currentSelection = select.value;
    select.innerHTML = '<option value="">-- Choose a task --</option>';
    tasks.forEach(task => { select.innerHTML += `<option value="${task.id}">${task.title}</option>`; });
    select.value = currentSelection;
}

export function initializePomodoroPage() {
    populatePomodoroTaskSelect();
    handleStopwatchUpdate(null);
}