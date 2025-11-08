const SUPABASE_URL = 'https://wfwjcbbylwmozqcddigc.supabase.co/'; // Yahan apna Supabase Project URL daalein
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmd2pjYmJ5bHdtb3pxY2RkaWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzk1MTQsImV4cCI6MjA3NzcxNTUxNH0.5hNH22mvpECQzfEgQsQRIbuWNm4XenUszgd21oOEif8'; // Yahan apni Supabase Anon Key daalein
// ====== SUPABASE SETUP for LOGIN PAGE ======

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isLoginMode = true;

// Check karein ki user pehle se logged-in hai ya nahi
supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // Agar user logged-in hai, to use seedhe main app par bhej do
        window.location.href = 'index.html';
    }
});

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-action-btn').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-toggle-text').innerHTML = isLoginMode 
        ? 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>'
        : 'Already have an account? <a href="#" onclick="toggleAuthMode()">Login</a>';
    document.getElementById('auth-error').innerText = '';
}

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

        // Login successful hone par onAuthStateChange apne aap redirect kar dega.
        if (!isLoginMode) {
            alert("Signup successful! Please check your email to verify your account before logging in.");
        }
    } catch (error) {
        authError.innerText = error.message;
    }
}
