// app.js

// Firebase SDK global objects (already imported in config.js)
// const auth = firebase.auth();
// const db = firebase.firestore();

// UI Elements
const debugLogElement = document.getElementById('debug-log');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authSection = document.getElementById('auth-section');
const userInfoDiv = document.getElementById('user-info');
const userPhotoEl = document.getElementById('user-photo');
const userNameEl = document.getElementById('user-name');
const authModal = document.getElementById('auth-modal');
const modalClose = document.getElementById('modal-close');
const authForm = document.getElementById('auth-form');
const switchAuth = document.getElementById('switch-auth');
const authTitle = document.getElementById('auth-title');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const postCreateSection = document.getElementById('post-create');
const postTextInput = document.getElementById('post-text');
const createPostBtn = document.getElementById('create-post-btn');
const postsDiv = document.getElementById('posts');
const allUsersDiv = document.getElementById('all-users');
const userPostsDiv = document.getElementById('user-posts'); // For profile.html
const profileHeaderDiv = document.getElementById('profile-header'); // For profile.html
const profilePhotoEl = document.getElementById('profile-photo'); // For profile.html
const profileNameEl = document.getElementById('profile-name'); // For profile.html
const profileBioEl = document.getElementById('profile-bio'); // For profile.html
const editProfileBtn = document.getElementById('edit-profile-btn'); // For profile.html

let isLoginMode = true; // State for auth modal

// --- Debugging Utility ---
function debugLog(message, type = 'debug-msg') {
    if (debugLogElement) {
        debugLogElement.textContent = message;
        debugLogElement.className = type; // Apply CSS class for styling
        console.log(`DEBUG (${type}): ${message}`);
    } else {
        console.log(`DEBUG (${type}): ${message}`);
    }
}

// --- Modals and Auth Forms ---
function showAuthModal(mode) {
    isLoginMode = mode;
    authTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
    authForm.querySelector('button').textContent = isLoginMode ? 'Login' : 'Sign Up';
    switchAuth.textContent = isLoginMode ? 'Need an account? Sign Up' : 'Already have an account? Login';
    authModal.classList.add('active');
}

function hideAuthModal() {
    authModal.classList.remove('active');
    emailInput.value = '';
    passwordInput.value = '';
}

loginBtn.addEventListener('click', () => showAuthModal(true));
signupBtn.addEventListener('click', () => showAuthModal(false));
modalClose.addEventListener('click', hideAuthModal);
switchAuth.addEventListener('click', () => showAuthModal(!isLoginMode)); // Toggle mode

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        if (isLoginMode) {
            await auth.signInWithEmailAndPassword(email, password);
            debugLog('User logged in successfully!', 'debug-msg-success');
        } else {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            // Optionally, set display name immediately for new users
            await userCredential.user.updateProfile({
                displayName: email.split('@')[0], // Default display name from email
                photoURL: 'https://i.pravatar.cc/150?u=' + userCredential.user.uid // Default avatar
            });
            debugLog('User signed up successfully!', 'debug-msg-success');
        }
        hideAuthModal();
    } catch (error) {
        alert('Authentication Error: ' + error.message);
        debugLog('Auth Error: ' + error.message, 'debug-msg-error');
        console.error('Authentication Error:', error);
    }
});

// --- Auth State Change Listener ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in.
        authSection.style.display = 'none';
        userInfoDiv.style.display = 'flex';
        postCreateSection.style.display = 'block';
        logoutBtn.style.display = 'inline-block'; // Ensure logout button is visible

        // Save/Update user profile in Firestore
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // New user, create their profile with default values
            await userRef.set({
                uid: user.uid,
                userName: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || 'https://i.pravatar.cc/150?u=' + user.uid, // Default avatar
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false // Default to false
            });
            debugLog('New user profile created in Firestore.', 'debug-msg');
        } else {
            // Existing user, update last login and potentially other fields if they change
            // Also update local user info from Firestore data if available
            const userData = userDoc.data();
            userNameEl.textContent = userData.userName || user.displayName || 'Anonymous';
            userPhotoEl.src = userData.photoURL || user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid; // Fallback avatar

            await userRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                // You might also want to update displayName and photoURL if they were changed in Firebase Auth
                // userName: user.displayName || user.email.split('@')[0],
                // photoURL: user.photoURL || 'https://i.pravatar.cc/150?u=' + user.uid,
            });
            debugLog('User profile updated in Firestore.', 'debug-msg');
        }

        // Update UI elements for logged-in state
        userNameEl.textContent = user.displayName || user.email.split('@')[0];
        userPhotoEl.src = user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid; // Default avatar if none

        // If on profile page, load profile data
        if (window.location.pathname.includes('profile.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const profileUid = urlParams.get('uid') || user.uid;
            loadProfile(profileUid);
            loadUserPosts(profileUid);
        } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            fetchAndDisplayAllPosts(); // Display all posts on index page
            fetchAllUsers(); // Display all users on index page
        }

        debugLog(`User logged in: ${user.email} (UID: ${user.uid})`, 'debug-msg');

    } else {
        // User is signed out.
        authSection.style.display = 'flex';
        userInfoDiv.style.display = 'none';
        postCreateSection.style.display = 'none';
        logoutBtn.style.display = 'none';

        // Clear posts and user list on logout
        if (postsDiv) postsDiv.innerHTML = '';
        if (allUsersDiv) allUsersDiv.innerHTML = '';
        if (userPostsDiv) userPostsDiv.innerHTML = '';
        if (profileHeaderDiv) profileHeaderDiv.style.display = 'none';

        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            fetchAndDisplayAllPosts(); // Still display posts, but without edit/delete, like functionality
            fetchAllUsers(); // Still display users
        } else if (window.location.pathname.includes('profile.html')) {
            // Redirect to index or show a message if not logged in on profile page
            // window.location.href = 'index.html';
            debugLog('Please login to view profiles or posts.', 'debug-msg-info');
            profileHeaderDiv.innerHTML = '<p style="text-align:center; margin-top:50px;">Please login to view this profile.</p>';
            if (userPostsDiv) userPostsDiv.innerHTML = '';
        }

        debugLog('User logged out.', 'debug-msg');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        debugLog('User signed out successfully!', 'debug-msg-success');
        // No need to redirect here, auth.onAuthStateChanged will handle UI updates
    } catch (error) {
        alert('Logout Error: ' + error.message);
        debugLog('Logout Error: ' + error.message, 'debug-msg-error');
        console.error('Logout Error:', error);
    }
});

// --- Post Management (for index.html and profile.html) ---
createPostBtn.addEventListener('click', async () => {
    const postText = postTextInput.value.trim();
    const user = auth.currentUser;

    if (postText && user) {
        try {
            // Fetch user's profile data from Firestore for post
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const userName = userData ? userData.userName : (user.displayName || 'Anonymous');
            const userPhoto = userData ? userData.photoURL : (user.photoURL || 'https://i.pravatar.cc/150?u=' + user.uid);

            await db.collection('posts').add({
                uid: user.uid,
                userName: userName,
                userPhoto: userPhoto,
                text: postText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [] // Store UIDs of users who liked this post
            });
            postTextInput.value = '';
            debugLog('Post created successfully!', 'debug-msg-success');
        } catch (error) {
            alert('Error creating post: ' + error.message);
            debugLog('Post creation error: ' + error.message, 'debug-msg-error');
            console.error('Error creating post:', error);
        }
    } else if (!user) {
        alert('Please login to create a post.');
        debugLog('Attempted to create post without login.', 'debug-msg-info');
    }
});

// Function to render a single post
function renderPost(post, targetElement) {
    const currentUser = auth.currentUser;
    const postEl = document.createElement('div');
    postEl.className = 'post card';
    postEl.id = `post-${post.id}`; // Add ID for easy selection

    // Header with user info
    const postHeader = document.createElement('div');
    postHeader.className = 'post-header';
    const userImg = document.createElement('img');
    userImg.src = post.userPhoto || 'https://i.pravatar.cc/44?u=' + post.uid; // Default avatar if none
    userImg.alt = 'Profile Photo';
    userImg.addEventListener('click', () => {
        window.location.href = `profile.html?uid=${post.uid}`;
    });
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = post.userName || 'Anonymous';
    usernameSpan.addEventListener('click', () => {
        window.location.href = `profile.html?uid=${post.uid}`;
    });

    postHeader.appendChild(userImg);
    postHeader.appendChild(usernameSpan);
    postEl.appendChild(postHeader);

    // Post content
    const postContent = document.createElement('p');
    postContent.className = 'post-content';
    postContent.textContent = post.text;
    postEl.appendChild(postContent);

    // Post actions (Like button and count)
    const postActions = document.createElement('div');
    postActions.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    const isLiked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
    likeBtn.innerHTML = `<i class="fa-solid fa-thumbs-up" style="color: ${isLiked ? 'var(--primary-color)' : 'var(--text-light)'};"></i> Like`;
    likeBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('Please login to like posts.');
            debugLog('Attempted to like post without login.', 'debug-msg-info');
            return;
        }

        const postRef = db.collection('posts').doc(post.id);
        if (isLiked) {
            // Unlike post
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(-1),
                likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            }).then(() => {
                debugLog('Post unliked successfully!', 'debug-msg');
            }).catch(error => {
                debugLog('Unlike error: ' + error.message, 'debug-msg-error');
                console.error('Error unliking post:', error);
            });
        } else {
            // Like post
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(1),
                likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            }).then(() => {
                debugLog('Post liked successfully!', 'debug-msg');
            }).catch(error => {
                debugLog('Like error: ' + error.message, 'debug-msg-error');
                console.error('Error liking post:', error);
            });
        }
    });

    const likeCountSpan = document.createElement('span');
    likeCountSpan.className = 'like-count';
    likeCountSpan.textContent = `${post.likes || 0} Likes`;

    postActions.appendChild(likeBtn);
    postActions.appendChild(likeCountSpan);
    postEl.appendChild(postActions);

    // Post Owner Actions (Edit/Delete Buttons)
    if (currentUser && currentUser.uid === post.uid) { // Only show for the post owner
        const ownerActionsEl = document.createElement('div');
        ownerActionsEl.className = 'post-owner-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            const newText = prompt('Edit your post:', post.text);
            if (newText !== null && newText.trim() !== post.text.trim()) {
                db.collection('posts').doc(post.id).update({
                    text: newText.trim(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    debugLog('Post updated successfully!', 'debug-msg-success');
                }).catch(error => {
                    alert('Error updating post: ' + error.message);
                    debugLog('Post update error: ' + error.message, 'debug-msg-error');
                    console.error('Error updating post:', error);
                });
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this post?')) {
                db.collection('posts').doc(post.id).delete().then(() => {
                    debugLog('Post deleted successfully!', 'debug-msg-success');
                }).catch(error => {
                    alert('Error deleting post: ' + error.message);
                    debugLog('Post delete error: ' + error.message, 'debug-msg-error');
                    console.error('Error deleting post:', error);
                });
            }
        });

        ownerActionsEl.appendChild(editBtn);
        ownerActionsEl.appendChild(deleteBtn);
        postEl.appendChild(ownerActionsEl);
    }

    targetElement.appendChild(postEl);
}

// Fetch and display all posts for index.html
function fetchAndDisplayAllPosts() {
    if (!postsDiv) return; // Only run if on index.html

    db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        postsDiv.innerHTML = ''; // Clear existing posts
        if (snapshot.empty) {
            postsDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">No posts yet. Be the first to post!</p>';
            debugLog('No posts found in Firestore.', 'debug-msg-info');
            return;
        }
        snapshot.forEach(doc => {
            const post = { id: doc.id, ...doc.data() };
            renderPost(post, postsDiv);
        });
        debugLog('All posts fetched and displayed.', 'debug-msg');
    }, error => {
        debugLog('Error fetching all posts: ' + error.message, 'debug-msg-error');
        console.error('Error fetching all posts:', error);
        postsDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading posts: ${error.message}</p>`;
    });
}

// Fetch and display user's posts for profile.html
function loadUserPosts(uid) {
    if (!userPostsDiv) return; // Only run if on profile.html

    db.collection('posts')
        .where('uid', '==', uid)
        .orderBy('timestamp', 'desc') // Requires Firestore index: uid (asc), timestamp (desc)
        .onSnapshot(snapshot => {
            userPostsDiv.innerHTML = '<h2>Posts</h2>'; // Clear and add heading
            if (snapshot.empty) {
                userPostsDiv.innerHTML += '<p style="text-align:center; color: var(--text-light); margin-top:20px;">No posts found for this user.</p>';
                debugLog('No posts found for user UID: ' + uid, 'debug-msg-info');
                return;
            }
            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                renderPost(post, userPostsDiv);
            });
            debugLog(`Posts loaded for user UID: ${uid}`, 'debug-msg');
        }, error => {
            debugLog('Error loading user posts: ' + error.message, 'debug-msg-error');
            console.error('Error loading user posts:', error);
            userPostsDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading posts: ${error.message}</p>`;
        });
}

// --- User List (for index.html) ---
function fetchAllUsers() {
    if (!allUsersDiv) return; // Only run if on index.html

    db.collection('users').orderBy('userName').onSnapshot(snapshot => {
        allUsersDiv.innerHTML = '';
        const currentUser = auth.currentUser;

        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            const userItemEl = document.createElement('div');
            userItemEl.className = 'user-item';
            if (currentUser && user.uid === currentUser.uid) {
                userItemEl.classList.add('current-user-item'); // Add class for current user
            }
            userItemEl.innerHTML = `
                <img src="${user.photoURL || 'https://i.pravatar.cc/40?u=' + user.uid}" alt="Profile Photo">
                <span class="${currentUser && user.uid === currentUser.uid ? 'current-user' : ''}">${user.userName || 'Anonymous'}</span>
            `;
            userItemEl.addEventListener('click', () => {
                window.location.href = `profile.html?uid=${user.uid}`;
            });
            allUsersDiv.appendChild(userItemEl);
        });
        debugLog('All users fetched and displayed.', 'debug-msg');
    }, error => {
        debugLog('Error fetching all users: ' + error.message, 'debug-msg-error');
        console.error('Error fetching all users:', error);
        allUsersDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading users: ${error.message}</p>`;
    });
}

// --- Profile Page Logic (for profile.html) ---
async function loadProfile(uid) {
    if (!profileHeaderDiv) return; // Only run if on profile.html

    profileHeaderDiv.style.display = 'block'; // Ensure it's visible

    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            profilePhotoEl.src = userData.photoURL || 'https://i.pravatar.cc/150?u=' + uid;
            profileNameEl.textContent = userData.userName || 'Anonymous';
            profileBioEl.textContent = userData.bio || 'No bio available.';

            // Show/hide edit profile button for owner
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === uid) {
                editProfileBtn.style.display = 'inline-block';
                editProfileBtn.addEventListener('click', () => showEditProfileModal(userData));
            } else {
                editProfileBtn.style.display = 'none';
            }
            debugLog(`Profile loaded for UID: ${uid}`, 'debug-msg');
        } else {
            profilePhotoEl.src = 'https://i.pravatar.cc/150?u=unknown';
            profileNameEl.textContent = 'User Not Found';
            profileBioEl.textContent = 'This user does not exist.';
            editProfileBtn.style.display = 'none';
            debugLog('Profile not found for UID: ' + uid, 'debug-msg-info');
        }
    } catch (error) {
        debugLog('Error loading profile: ' + error.message, 'debug-msg-error');
        console.error('Error loading profile:', error);
        profileHeaderDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading profile: ${error.message}</p>`;
    }
}

// Edit Profile Modal (Simple example, can be expanded)
const editProfileModal = document.getElementById('edit-profile-modal'); // Assuming you have this in profile.html
const editProfileForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-name');
const editBioInput = document.getElementById('edit-bio');
const editPhotoURLInput = document.getElementById('edit-photo-url');
const saveProfileBtn = document.getElementById('save-profile-btn');
const closeEditProfileModal = document.getElementById('close-edit-profile-modal');

function showEditProfileModal(userData) {
    if (editProfileModal) {
        editNameInput.value = userData.userName || '';
        editBioInput.value = userData.bio || '';
        editPhotoURLInput.value = userData.photoURL || '';
        editProfileModal.classList.add('active');
    }
}

function hideEditProfileModal() {
    if (editProfileModal) {
        editProfileModal.classList.remove('active');
    }
}

if (closeEditProfileModal) {
    closeEditProfileModal.addEventListener('click', hideEditProfileModal);
}

if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const newName = editNameInput.value.trim();
        const newBio = editBioInput.value.trim();
        const newPhotoURL = editPhotoURLInput.value.trim();

        try {
            await db.collection('users').doc(user.uid).update({
                userName: newName,
                bio: newBio,
                photoURL: newPhotoURL
            });
            // Also update Firebase Auth profile if name/photoURL changes
            await user.updateProfile({
                displayName: newName,
                photoURL: newPhotoURL
            });

            debugLog('Profile updated successfully!', 'debug-msg-success');
            hideEditProfileModal();
            loadProfile(user.uid); // Reload profile to show changes
            // Refresh main posts if on index page (to update user names/photos on posts)
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                fetchAndDisplayAllPosts();
            }
        } catch (error) {
            alert('Error updating profile: ' + error.message);
            debugLog('Profile update error: ' + error.message, 'debug-msg-error');
            console.error('Error updating profile:', error);
        }
    });
}


// Initial calls based on page
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we are on
    const currentPath = window.location.pathname;

    if (currentPath.includes('index.html') || currentPath === '/') {
        // These will be called by auth.onAuthStateChanged if user is logged in
        // If logged out, they will still try to fetch (but may not show all features)
        if (!auth.currentUser) { // If user is not yet loaded, call once directly
            fetchAndDisplayAllPosts();
            fetchAllUsers();
        }
    } else if (currentPath.includes('profile.html')) {
        // Logic handled by auth.onAuthStateChanged
    }
    // chat.js and message.js will handle their own DOMContentLoaded listeners
});
