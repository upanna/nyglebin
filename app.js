// js/app.js
// Firebase service instances (imported from config.js implicitly as they are global)
// `auth`, `db`, `storage` are already defined and initialized in config.js

// DOM Elements
const authModal = document.getElementById('auth-modal');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const authSection = document.getElementById('auth-section');
const userDisplay = document.getElementById('user-display');
const postCreateSection = document.getElementById('post-create');
const postTextInput = document.getElementById('post-text');
const postImageInput = document.getElementById('post-image-input');
const btnPost = document.getElementById('btn-post');
const postsContainer = document.getElementById('posts');
const userInfoSection = document.getElementById('user-info');
const userPhotoImg = document.getElementById('user-photo');
const userNameSpan = document.getElementById('user-name');
const allUsersDiv = document.getElementById('all-users');
const myProfileLink = document.getElementById('my-profile-link');
const editProfileBtn = document.getElementById('edit-profile-btn'); // For index.html sidebar

let unsubscribeFromPosts = null; // For clean-up when user logs out
let unsubscribeFromUsers = null;

// --- Authentication State Listener ---
// Ensure `auth` is defined (it should be, coming from config.js)
if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            console.log("User logged in:", user.uid);
            userDisplay.textContent = `Welcome, ${user.displayName || user.email}`;
            btnLogin.style.display = 'none';
            btnLogout.style.display = 'block';
            postCreateSection.style.display = 'block'; // Show post creation
            userInfoSection.style.display = 'block'; // Show user info sidebar
            if (authModal) authModal.style.display = 'none'; // Hide modal if open

            // Load user profile details for sidebar
            // Fetch user data from Firestore to get name and photoURL
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userPhotoImg) userPhotoImg.src = userData.photoURL || 'images/default-profile.png';
                    if (userNameSpan) userNameSpan.textContent = userData.name || userData.email;
                } else {
                    // Fallback to Firebase Auth info if Firestore profile not found
                    if (userPhotoImg) userPhotoImg.src = user.photoURL || 'images/default-profile.png';
                    if (userNameSpan) userNameSpan.textContent = user.displayName || user.email;
                    // If user just registered, their Firestore profile might not have updated yet,
                    // or if they registered before this logic was fully implemented.
                    // For a robust app, ensure user creation in Firestore after Auth registration.
                }
            } catch (error) {
                console.error("Error fetching user profile for sidebar:", error);
                debugLog(`Error loading user info: ${error.message}`, "debug-msg");
            }

            // Update profile link to specific user's profile
            if (myProfileLink) {
                myProfileLink.href = `profile.html?uid=${user.uid}`;
            }
            if (editProfileBtn) editProfileBtn.style.display = 'block'; // Show edit profile button in sidebar

            loadPosts(); // Load posts for logged-in users
            loadAllUsers(); // Load all registered users

        } else {
            // User is signed out
            console.log("User logged out");
            userDisplay.textContent = '';
            btnLogin.style.display = 'block';
            btnLogout.style.display = 'none';
            postCreateSection.style.display = 'none'; // Hide post creation
            userInfoSection.style.display = 'none'; // Hide user info sidebar
            if (postsContainer) postsContainer.innerHTML = '<h2>Recent Posts</h2><p style="text-align: center;">Please login to see posts.</p>'; // Clear posts and prompt login
            if (editProfileBtn) editProfileBtn.style.display = 'none'; // Hide edit profile button

            if (userPhotoImg) userPhotoImg.src = '';
            if (userNameSpan) userNameSpan.textContent = '';
            if (allUsersDiv) allUsersDiv.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Login to see members...</p>';

            if (unsubscribeFromPosts) unsubscribeFromPosts(); // Clean up listener
            if (unsubscribeFromUsers) unsubscribeFromUsers(); // Clean up listener
        }
    });
} else {
    console.error("Firebase Auth not initialized. Check config.js and script loading order.");
    debugLog("App Error: Auth not initialized. Reload page.", "debug-msg");
}

// --- Event Listeners for Authentication Buttons ---
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        if (authModal) {
            authModal.style.display = 'flex'; // Show the modal
            // Reset modal to login mode
            const authTitle = document.getElementById('auth-title');
            const authSubmitBtn = document.getElementById('auth-submit');
            const switchAuth = document.getElementById('switch-auth');
            const nameFieldContainer = document.getElementById('name-field-container');
            const emailInput = document.getElementById('email-input');
            const passwordInput = document.getElementById('password-input');
            const nameInput = document.getElementById('name-input');
            const authErrorMsg = document.getElementById('auth-error-msg');

            if (authTitle) authTitle.textContent = 'Login';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
            if (switchAuth) switchAuth.textContent = "Don't have an account? Sign Up";
            if (nameFieldContainer) nameFieldContainer.style.display = 'none';
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (nameInput) nameInput.value = '';
            if (authErrorMsg) authErrorMsg.textContent = '';
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            if (auth) {
                await auth.signOut();
                debugLog("Logged out successfully!", "debug-msg");
                console.log("Logged out");
            }
        } catch (error) {
            console.error("Error signing out:", error);
            debugLog(`Logout Error: ${error.message}`, "debug-msg");
        }
    });
}

// --- Post Creation ---
if (btnPost) {
    btnPost.addEventListener('click', async () => {
        const postText = postTextInput.value.trim();
        const postImage = postImageInput.files[0];

        if (!postText && !postImage) {
            debugLog("Please enter text or select an image for your post.", "debug-msg");
            return;
        }
        if (!auth.currentUser) {
            debugLog("You must be logged in to create a post.", "debug-msg");
            return;
        }

        btnPost.disabled = true; // Disable button to prevent multiple submissions
        let imageUrl = '';

        try {
            if (postImage) {
                // Ensure storage is initialized from config.js
                const storageRef = storage.ref(`post_images/${auth.currentUser.uid}/${Date.now()}_${postImage.name}`); // Unique name
                const snapshot = await storageRef.put(postImage);
                imageUrl = await snapshot.ref.getDownloadURL();
                debugLog("Image uploaded successfully!", "debug-msg");
            }

            await db.collection('posts').add({
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName || auth.currentUser.email,
                userPhoto: auth.currentUser.photoURL || '',
                text: postText,
                imageUrl: imageUrl,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [], // To track who liked the post
                comments: 0
            });
            postTextInput.value = ''; // Clear input
            postImageInput.value = ''; // Clear file input
            debugLog("Post created successfully!", "debug-msg");
        } catch (error) {
            console.error("Error creating post:", error);
            debugLog(`Error creating post: ${error.message}`, "debug-msg");
        } finally {
            btnPost.disabled = false; // Re-enable button
        }
    });
}

// --- Load and Display Posts ---
async function loadPosts() {
    if (!postsContainer || typeof db === 'undefined') return; // Ensure elements and db are available

    if (unsubscribeFromPosts) {
        unsubscribeFromPosts(); // Unsubscribe previous listener
    }

    // Real-time listener for posts
    unsubscribeFromPosts = db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(20) // Limit to latest 20 posts
        .onSnapshot(async (snapshot) => {
            postsContainer.innerHTML = '<h2>Recent Posts</h2>'; // Clear previous posts
            if (snapshot.empty) {
                postsContainer.innerHTML += '<p style="text-align: center;">No posts yet. Be the first to create one!</p>';
                return;
            }

            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() }; // Add doc.id to post object
                // Call renderPost from config.js (which is globally available)
                renderPost(post, postsContainer);
            });
        }, (error) => {
            console.error("Error loading posts:", error);
            debugLog(`Error loading posts: ${error.message}`, "debug-msg");
        });
}

// --- Load All Users (for sidebar) ---
async function loadAllUsers() {
    if (!allUsersDiv || typeof db === 'undefined') return;

    if (unsubscribeFromUsers) {
        unsubscribeFromUsers(); // Unsubscribe previous listener
    }

    unsubscribeFromUsers = db.collection('users')
        .orderBy('name', 'asc') // Order by name or email
        .onSnapshot((snapshot) => {
            allUsersDiv.innerHTML = ''; // Clear previous users
            if (snapshot.empty) {
                allUsersDiv.innerHTML = '<p style="text-align: center;">No other members found.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const user = doc.data();
                const userId = doc.id;
                if (auth.currentUser && userId === auth.currentUser.uid) return; // Don't show current user

                const userElement = document.createElement('div');
                userElement.classList.add('member-item');
                userElement.innerHTML = `
                    <img src="${user.photoURL || 'images/default-profile.png'}" alt="User Photo" class="member-photo">
                    <span class="member-name">${user.name || user.email}</span>
                `;
                allUsersDiv.appendChild(userElement);
            });
        }, (error) => {
            console.error("Error loading all users:", error);
            debugLog(`Error loading members: ${error.message}`, "debug-msg");
        });
}