// js/auth.js
// This script handles authentication logic for the modal

document.addEventListener('DOMContentLoaded', () => {
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

    // --- Utility Function to Display Errors ---
    function displayAuthError(message) {
        if (authErrorMsg) {
            authErrorMsg.textContent = message;
            authErrorMsg.style.display = 'block'; // Ensure error message is visible
        }
    }

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
        if (authErrorMsg) authErrorMsg.style.display = 'none'; // Hide error message on reset
    }

    // --- Switch between Login and Register ---
    if (switchAuthLink) {
        switchAuthLink.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
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
            if (authErrorMsg) authErrorMsg.style.display = 'none'; // Hide error message
        });
    }

    // --- Form Submission (Login/Register) ---
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const displayName = nameInput.value.trim();

            if (authErrorMsg) authErrorMsg.textContent = ''; // Clear previous error messages
            if (authErrorMsg) authErrorMsg.style.display = 'none';

            if (!email || !password) {
                displayAuthError('Email and password are required.');
                return;
            }

            if (isRegisterMode && !displayName) {
                displayAuthError('Display name is required for registration.');
                return;
            }

            if (authSubmitBtn) authSubmitBtn.disabled = true; // Disable button to prevent multiple clicks

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

                    console.log("Registration successful! Logging in...");
                    // User is automatically logged in after registration
                    if (authModal) authModal.style.display = 'none';
                    resetAuthModal();
                } else {
                    // Login User
                    await auth.signInWithEmailAndPassword(email, password); // Use global auth
                    console.log("Logged in successfully!");
                    if (authModal) authModal.style.display = 'none'; // Hide modal on successful login
                    resetAuthModal();
                }
            } catch (error) {
                console.error("Authentication Error:", error);
                let errorMessage = 'An unknown authentication error occurred.';
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already in use.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'The email address is not valid.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Email/password accounts are not enabled.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'The password is too weak. Please use at least 6 characters.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This user account has been disabled.';
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect email or password.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        errorMessage = error.message; // Fallback to Firebase's message
                        break;
                }
                displayAuthError(errorMessage);
            } finally {
                if (authSubmitBtn) authSubmitBtn.disabled = false; // Re-enable button
            }
        });
    }

    // --- Global Function to show the Auth Modal ---
    // This function can be called from other parts of your application (e.g., from a login button click)
    window.showAuthModal = () => {
        if (authModal) {
            resetAuthModal(); // Ensure it starts in login mode
            authModal.style.display = 'block';
        }
    };

    // Example: If you have a login button on your main page, link it to showAuthModal
    // const btnLogin = document.getElementById('btn-login');
    // if (btnLogin) {
    //     btnLogin.addEventListener('click', window.showAuthModal);
    // }
});