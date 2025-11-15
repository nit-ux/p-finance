// ui.js

export function showMessage(message) {
    const msgBox = document.getElementById('messageBox');
    document.getElementById('messageText').innerText = message;
    msgBox.style.display = 'block';
}
export function hideMessage() { document.getElementById('messageBox').style.display = 'none'; }

export function showConfirmation(message) {
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

export function showSpinner() { document.getElementById('loading-overlay').style.display = 'flex'; }
export function hideSpinner() { document.getElementById('loading-overlay').style.display = 'none'; }

export function openSidebar() {
    document.getElementById('sidebar-menu').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}
export function closeSidebar() {
    document.getElementById('sidebar-menu').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

// ui.js ke aakhir mein add karein
export function generateUUID() {
    return crypto.randomUUID();
}