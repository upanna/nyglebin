// js/auth.js
// This script handles authentication logic for the modal

// DOM Elements from the modal
const authModal = document.getElementById('auth-modal');
const modalCloseBtn = authModal ? authModal.querySelector('.modal-close') : null;
const authTitle = document.getElementById('auth-title');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const nameFieldContainer = document.getElementById('name-field-container');
const nameInput = document.getElementById('name-input');
const authSubmitBtn = document.getElementById('auth-submit');
const switchAuthLink = document.getElementById('switch-auth');
const authErrorMsg = document.getElementById('auth-error-msg');

let isRegisterMode = false; // State to track if we are in login or register mode

// --- Modal Display Logic ---
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        if (authModal) authModal.style.display = 'none';
        resetAuthModal();
    });
}

// Close modal when clicking outside
if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.style.display = 'none';
            resetAuthModal();
        }
    });
}

// Reset modal state
function resetAuthModal() {
    isRegisterMode = false;
    if (authTitle) authTitle.textContent = 'Login';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
    if (switchAuthLink) switchAuthLink.textContent = "Don't have an account? Sign Up";
    if (nameFieldContainer) nameFieldContainer.style.display = 'none';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (nameInput) nameInput.value = '';
    if (authErrorMsg) authErrorMsg.textContent = '';
}

// --- Switch between Login and Register ---
if (switchAuthLink) {
    switchAuthLink.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            if (authTitle) authTitle.textContent = 'Sign Up';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Register';
            if (switchAuthLink) switchAuthLink.textContent = "Already have an account? Login";
            if (nameFieldContainer) nameFieldContainer.style.display = 'block'; // Show name field
        } else {
            if (authTitle) authTitle.textContent = 'Login';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
            if (switchAuthLink) switchAuthLink.textContent = "Don't have an account? Sign Up";
            if (nameFieldContainer) nameFieldContainer.style.display = 'none'; // Hide name field
        }
        if (authErrorMsg) authErrorMsg.textContent = ''; // Clear previous errors
    });
}

// --- Form Submission (Login/Register) ---
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission

        const email = emailInput.value;
        const password = passwordInput.value;
        const displayName = nameInput.value;

        if (authErrorMsg) authErrorMsg.textContent = ''; // Clear previous error messages

        if (!email || !password) {
            if (authErrorMsg) authErrorMsg.textContent = 'Email and password are required.';
            return;
        }

        if (isRegisterMode && !displayName) {
            if (authErrorMsg) authErrorMsg.textContent = 'Display name is required for registration.';
            return;
        }

        authSubmitBtn.disabled = true; // Disable button to prevent multiple clicks

        try {
            if (isRegisterMode) {
                // Register User
                const userCredential = await auth.createUserWithEmailAndPassword(email, password); // Use global auth
                const user = userCredential.user;

                // Update user profile with display name
                await user.updateProfile({ displayName: displayName });

                // Store user data in Firestore 'users' collection
                await db.collection('users').doc(user.uid).set({ // Use global db
                    name: displayName,
                    email: email,
                    photoURL: user.photoURL || '', // Default empty or from updateProfile
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                debugLog("Registration successful! Logging in...", "debug-msg");
                // User is automatically logged in after registration
                if (authModal) authModal.style.display = 'none';
                resetAuthModal();
            } else {
                // Login User
                await auth.signInWithEmailAndPassword(email, password); // Use global auth
                debugLog("Logged in successfully!", "debug-msg");
                if (authModal) authModal.style.display = 'none'; // Hide modal on successful login
                resetAuthModal();
            }
        } catch (error) {
            console.error("Authentication Error:", error);
            if (authErrorMsg) authErrorMsg.textContent = error.message; // Display Firebase error message
            debugLog(`Auth Error: ${error.message}`, "debug-msg");
        } finally {
            authSubmitBtn.disabled = false; // Re-enable button
        }
    });
}