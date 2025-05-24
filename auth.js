// js/auth.js

// Firebase service instances (imported from config.js implicitly as they are global)
// Ensure window.auth and window.db are defined in config.js and loaded before this script.
// If config.js is properly set up, 'auth' and 'db' will be available directly.
// For robustness, using window.auth and window.db is safer.

const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit');
const switchAuthBtn = document.getElementById('switch-auth');
const authErrorMsg = document.getElementById('auth-error-msg');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const nameFieldContainer = document.getElementById('name-field-container');
const nameInput = document.getElementById('name-input');
const modalCloseBtn = document.querySelector('#auth-modal .modal-close');

let isSignUp = false; // To toggle between login and signup

// Function to display authentication errors
function displayAuthError(message) {
    authErrorMsg.textContent = message;
    authErrorMsg.style.display = 'block';
    setTimeout(() => {
        authErrorMsg.style.display = 'none';
        authErrorMsg.textContent = '';
    }, 5000);
}

// Event listener for showing the modal (if a login button exists on the page)
// This assumes an element with id="btn-login" exists on the page to trigger the modal.
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            authModal.style.display = 'block';
            isSignUp = false;
            authTitle.textContent = 'Login';
            authSubmitBtn.textContent = 'Login';
            switchAuthBtn.textContent = "Don't have an account? Sign Up";
            nameFieldContainer.style.display = 'none'; // Hide name field for login
            authErrorMsg.textContent = ''; // Clear previous errors
        });
    }
});


// Close modal button
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        authModal.style.display = 'none';
        authErrorMsg.textContent = ''; // Clear errors when closing
    });
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.style.display = 'none';
        authErrorMsg.textContent = ''; // Clear errors when closing
    }
});

// Toggle between Login and Sign Up
if (switchAuthBtn) {
    switchAuthBtn.addEventListener('click', () => {
        isSignUp = !isSignUp;
        if (isSignUp) {
            authTitle.textContent = 'Sign Up';
            authSubmitBtn.textContent = 'Sign Up';
            switchAuthBtn.textContent = 'Already have an account? Login';
            nameFieldContainer.style.display = 'block'; // Show name field for signup
        } else {
            authTitle.textContent = 'Login';
            authSubmitBtn.textContent = 'Login';
            switchAuthBtn.textContent = "Don't have an account? Sign Up";
            nameFieldContainer.style.display = 'none'; // Hide name field for login
        }
        authErrorMsg.textContent = ''; // Clear errors when switching
    });
}

// Handle form submission (Login or Sign Up)
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;
        const displayName = nameInput.value;

        if (typeof window.auth === 'undefined' || typeof window.db === 'undefined') {
            console.error("Firebase Auth or Firestore not initialized. Check config.js and script loading order.");
            displayAuthError("App initialization error. Please try again later.");
            return;
        }

        try {
            authErrorMsg.textContent = ''; // Clear previous errors

            if (isSignUp) {
                const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Update user profile with display name
                if (displayName) {
                    await user.updateProfile({ displayName: displayName });
                }

                // Save user data to Firestore
                await window.db.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: displayName || user.email, // Default to email if no display name
                    photoURL: user.photoURL || 'images/default-profile.png', // Set default profile picture
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp() // Use FieldValue
                });
                window.debugLog("User registered successfully!", "debug-msg"); // Use window.debugLog
            } else {
                await window.auth.signInWithEmailAndPassword(email, password);
                window.debugLog("User logged in successfully!", "debug-msg"); // Use window.debugLog
            }
            authModal.style.display = 'none'; // Close modal on success
            authForm.reset(); // Clear form
        } catch (error) {
            console.error('Authentication Error:', error.code, error.message);
            // Display user-friendly messages for common Firebase auth errors
            switch (error.code) {
                case 'auth/email-already-in-use':
                    displayAuthError('This email is already in use. Please use a different email or login.');
                    break;
                case 'auth/invalid-email':
                    displayAuthError('The email address is not valid.');
                    break;
                case 'auth/operation-not-allowed':
                    displayAuthError('Email/password accounts are not enabled. Please contact support.');
                    break;
                case 'auth/weak-password':
                    displayAuthError('The password is too weak. Please use a stronger password.');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    displayAuthError('Incorrect email or password. Please try again.');
                    break;
                case 'auth/network-request-failed':
                    displayAuthError('Network error. Please check your internet connection.');
                    break;
                default:
                    displayAuthError('An unexpected error occurred. Please try again.');
            }
        }
    });
}

// Handle Logout for pages that have their own logout button (e.g., about.html, contact.html)
// This is for pages that don't use the main app.js logout listener
function setupLogoutButton(buttonId, redirectPage = 'index.html') {
    const btnLogout = document.getElementById(buttonId);
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (typeof window.auth === 'undefined') {
                console.error("Firebase Auth not initialized. Cannot logout.");
                window.debugLog("Logout error: Auth not ready.", "debug-msg"); // Use window.debugLog
                return;
            }
            window.auth.signOut().then(() => {
                window.debugLog("Logged out successfully!", "debug-msg"); // Use window.debugLog
                window.location.href = redirectPage; // Redirect to specified page
            }).catch(error => {
                console.error('Logout Error:', error);
                window.debugLog(`Logout failed: ${error.message}`, "debug-msg"); // Use window.debugLog
            });
        });
    }
}

// Call setupLogoutButton for relevant pages
document.addEventListener('DOMContentLoaded', () => {
    // Check for specific logout buttons on different pages
    setupLogoutButton('btn-logout-about', 'index.html');
    setupLogoutButton('btn-logout-contact', 'index.html');
    setupLogoutButton('btn-logout-message', 'index.html');
    setupLogoutButton('btn-logout-postlist', 'index.html');
    setupLogoutButton('btn-logout', 'index.html'); // For index.html, profile.html, chat.html, live.html
});