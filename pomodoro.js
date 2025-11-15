// pomodoro.js

import { supabaseClient } from './supabase.js';
import { showMessage } from './ui.js';

let pomodoroInterval = null;
let currentPomodoroTask = null;

export function setCurrentPomodoroTask(task) {
    currentPomodoroTask = task;
}
export function getCurrentPomodoroTask() {
    return currentPomodoroTask;
}

export function initializePomodoroPage() {
    populatePomodoroTaskSelect();
    resetPomodoroUI();
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

export async function startPomodoro() {
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
    if (error) {
        console.error("Error starting pomodoro:", error);
        showMessage(`Error: Could not start timer. ${error.message}`);
    }
}

export async function pausePomodoro() {
    if (!currentPomodoroTask || currentPomodoroTask.pomodoro_state !== 'running') return;
    const elapsed = (Date.now() - new Date(currentPomodoroTask.pomodoro_start_time).getTime()) / 1000;
    const timeLeft = Math.round((25 * 60) - elapsed);
    await supabaseClient.from('tasks').update({ pomodoro_state: 'paused', pomodoro_time_left_on_pause: timeLeft }).eq('id', currentPomodoroTask.id);
}

export async function resetPomodoro() {
    const taskId = document.getElementById('pomodoro-task-select').value;
    if (!taskId) { resetPomodoroUI(); return; }
    await supabaseClient.from('tasks').update({ pomodoro_state: 'stopped', pomodoro_start_time: null, pomodoro_time_left_on_pause: null }).eq('id', taskId);
}

export function resetPomodoroUI() {
    clearInterval(pomodoroInterval);
    document.getElementById('pomodoro-timer-display').innerText = '25:00';
    document.getElementById('pomodoro-start-btn').innerText = 'Start';
    document.getElementById('pomodoro-start-btn').classList.remove('hidden');
    document.getElementById('pomodoro-pause-btn').classList.add('hidden');
    document.getElementById('pomodoro-container').classList.remove('break-time');
}

export function handlePomodoroUpdate(task) {
    currentPomodoroTask = task;
    clearInterval(pomodoroInterval);

    switch (task.pomodoro_state) {
        case 'running':
            const startTime = new Date(task.pomodoro_start_time).getTime();
            const endTime = startTime + (25 * 60 * 1000);
            pomodoroInterval = setInterval(() => {
                const now = Date.now();
                const timeLeft = Math.round((endTime - now) / 1000);
                if (timeLeft <= 0) {
                    clearInterval(pomodoroInterval);
                    document.getElementById('alarm-sound').play();
                    resetPomodoro();
                    return;
                }
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

function updateTimerDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    document.getElementById('pomodoro-timer-display').innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}