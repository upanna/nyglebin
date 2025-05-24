// Ensure Firebase is initialized before using it
const auth = firebase.auth();
const db = firebase.firestore();

// Helper function to show debug messages
function showDebugMessage(message, type, elementId = 'debug-msg') {
    const debugMsgElement = document.getElementById(elementId);
    if (debugMsgElement) {
        debugMsgElement.textContent = message;
        debugMsgElement.className = `debug-msg ${type}`; // Add type for styling (e.g., 'error', 'success')
        debugMsgElement.style.display = 'block';
        // Hide after 5 seconds
        setTimeout(() => {
            debugMsgElement.style.display = 'none';
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Get UI elements
    const authSection = document.getElementById('auth-section');
    const userDisplay = document.getElementById('user-display');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const myProfileLink = document.getElementById('my-profile-link'); // Link to user's profile
    const navChatroomLink = document.getElementById('nav-chatroom-link'); // Added for chatroom link
    const navMessageLink = document.getElementById('nav-message-link'); // Added for message link

    // Auth Modal elements
    const authModal = document.getElementById('auth-modal');
    const modalClose = authModal ? authModal.querySelector('.modal-close') : null;
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const nameFieldContainer = document.getElementById('name-field-container');
    const nameInput = document.getElementById('name-input');
    const authSubmitBtn = document.getElementById('auth-submit');
    const authErrorMsg = document.getElementById('auth-error-msg');
    const switchAuthLink = document.getElementById('switch-auth');

    let isSignUp = false; // To toggle between login and sign-up

    // Listen for authentication state changes
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in
            userDisplay.textContent = user.displayName || user.email;
            if (btnLogin) btnLogin.style.display = 'none';
            if (btnLogout) btnLogout.style.display = 'inline-block';
            if (myProfileLink) myProfileLink.href = `profile.html?uid=${user.uid}`;
            if (authSection) authSection.style.display = 'flex'; // Ensure auth section is visible

            // Show Chatroom and Message links if logged in
            if (navChatroomLink) navChatroomLink.style.display = 'list-item'; // Or 'block' depending on CSS
            if (navMessageLink) navMessageLink.style.display = 'list-item'; // Or 'block'

            // Hide the modal if it's open
            if (authModal) authModal.style.display = 'none';

        } else {
            // User is logged out
            userDisplay.textContent = '';
            if (btnLogin) btnLogin.style.display = 'inline-block';
            if (btnLogout) btnLogout.style.display = 'none';
            if (myProfileLink) myProfileLink.href = `profile.html`; // Default for non-logged in users
            if (authSection) authSection.style.display = 'flex'; // Ensure auth section is visible

            // Hide Chatroom and Message links if logged out
            if (navChatroomLink) navChatroomLink.style.display = 'none';
            if (navMessageLink) navMessageLink.style.display = 'none';
        }
    });

    // Event listener for the main login button
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (authModal) {
                authModal.style.display = 'flex'; // Show the modal
                authErrorMsg.textContent = ''; // Clear previous errors
                nameFieldContainer.style.display = 'none'; // Hide name field for default login
                authSubmitBtn.textContent = 'Login';
                if (switchAuthLink) switchAuthLink.textContent = "Don't have an account? Sign Up";
                isSignUp = false;
                authForm.reset(); // Clear form fields
            }
        });
    }

    // Event listener for modal close button
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (authModal) {
                authModal.style.display = 'none'; // Hide the modal
                authErrorMsg.textContent = ''; // Clear errors
                authForm.reset(); // Reset form
            }
        });
    }

    // Close modal if clicking outside
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.style.display = 'none';
                authErrorMsg.textContent = ''; // Clear errors
                authForm.reset(); // Reset form
            }
        });
    }

    // Toggle between Login and Sign Up forms
    if (switchAuthLink) {
        switchAuthLink.addEventListener('click', () => {
            isSignUp = !isSignUp;
            authErrorMsg.textContent = ''; // Clear previous errors

            if (isSignUp) {
                authModal.querySelector('h2').textContent = 'Sign Up';
                nameFieldContainer.style.display = 'block'; // Show name field for sign up
                authSubmitBtn.textContent = 'Sign Up';
                switchAuthLink.textContent = 'Already have an account? Login';
            } else {
                authModal.querySelector('h2').textContent = 'Login';
                nameFieldContainer.style.display = 'none'; // Hide name field for login
                authSubmitBtn.textContent = 'Login';
                switchAuthLink.textContent = "Don't have an account? Sign Up";
            }
            authForm.reset(); // Clear form fields when switching
        });
    }

    // Handle form submission (Login/Sign Up)
    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = emailInput.value;
            const password = passwordInput.value;
            const displayName = nameInput.value;

            if (isSignUp) {
                // Sign Up
                auth.createUserWithEmailAndPassword(email, password)
                    .then(cred => {
                        return cred.user.updateProfile({
                            displayName: displayName
                        }).then(() => {
                            // Also create a user document in Firestore
                            return db.collection('users').doc(cred.user.uid).set({
                                displayName: displayName,
                                email: email,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                profilePictureUrl: '' // Default empty profile picture
                            });
                        });
                    })
                    .then(() => {
                        authModal.style.display = 'none';
                        showDebugMessage('Successfully signed up and logged in!', 'success');
                        authForm.reset();
                    })
                    .catch(error => {
                        console.error("Sign up error:", error);
                        authErrorMsg.textContent = error.message;
                    });
            } else {
                // Login
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => {
                        authModal.style.display = 'none';
                        showDebugMessage('Successfully logged in!', 'success');
                        authForm.reset();
                    })
                    .catch(error => {
                        console.error("Login error:", error);
                        authErrorMsg.textContent = error.message;
                    });
            }
        });
    }

    // Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut()
                .then(() => {
                    // Redirect to home or update UI
                    showDebugMessage('Logged out successfully!', 'success');
                    window.location.href = 'index.html'; // Or simply update UI
                })
                .catch(error => {
                    console.error('Logout error:', error);
                    showDebugMessage('Logout failed: ' + error.message, 'error');
                });
        });
    }
});