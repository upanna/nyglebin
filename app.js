// js/app.js

// Firebase service instances (imported from config.js implicitly as they are global)
// Ensure window.auth, window.db, window.storage are defined in config.js
// and loaded before this script.
// Ensure window.renderPost and window.debugLog are also defined in config.js.

const postsContainer = document.getElementById('posts');
const postForm = document.getElementById('post-form');
const postTextInput = document.getElementById('post-text-input');
const postImageInput = document.getElementById('post-image-input');
const imagePreview = document.getElementById('image-preview');
const postBtn = document.getElementById('post-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const userDisplay = document.getElementById('user-display');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const myProfileLink = document.getElementById('my-profile-link');
const authModal = document.getElementById('auth-modal'); // Assuming auth-modal exists on index.html
const debugMsg = document.getElementById('debug-msg'); // Main debug message area

// Function to handle showing/hiding debug messages
// This is now defined in config.js and exposed globally.
// function debugLog(message, elementId = 'debug-msg') { ... }

// --- User Authentication State Handling ---
// This listener runs whenever the user's sign-in state changes.
if (typeof window.auth !== 'undefined') {
    window.auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            userDisplay.textContent = user.displayName || user.email;
            userDisplay.style.display = 'inline-block';
            btnLogin.style.display = 'none';
            btnLogout.style.display = 'inline-block';
            postForm.style.display = 'block'; // Show post form
            myProfileLink.href = `profile.html?uid=${user.uid}`; // Update profile link
            window.debugLog(`Logged in as: ${user.displayName || user.email}`, 'debug-msg'); // Use window.debugLog

            // Fetch user's profile photo if it exists in Firestore
            try {
                const userDoc = await window.db.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().photoURL) {
                    // Update user's profile picture if it's different from default
                    if (user.photoURL !== userDoc.data().photoURL) {
                        await user.updateProfile({ photoURL: userDoc.data().photoURL });
                    }
                } else {
                    // Ensure a default profile picture is set if none exists
                    if (!user.photoURL || user.photoURL === '') {
                        await user.updateProfile({ photoURL: 'images/default-profile.png' });
                    }
                    // Also save to Firestore if not present
                    if (userDoc.exists) {
                        await userDoc.ref.update({ photoURL: 'images/default-profile.png' });
                    } else {
                        await window.db.collection('users').doc(user.uid).set({
                            email: user.email,
                            displayName: user.displayName || user.email,
                            photoURL: 'images/default-profile.png',
                            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }); // Use merge: true to avoid overwriting existing data
                    }
                }
            } catch (error) {
                console.error("Error fetching/setting user photoURL in Firestore:", error);
                window.debugLog("Error with profile photo.", "debug-msg"); // Use window.debugLog
            }

        } else {
            // User is signed out
            userDisplay.textContent = '';
            userDisplay.style.display = 'none';
            btnLogin.style.display = 'inline-block';
            btnLogout.style.display = 'none';
            postForm.style.display = 'none'; // Hide post form
            myProfileLink.href = `profile.html`; // Reset profile link
            window.debugLog("Logged out.", "debug-msg"); // Use window.debugLog
        }
    });
} else {
    console.error("Firebase Auth not initialized. Check config.js and script loading order.");
    window.debugLog("App initialization error. Auth not ready.", "debug-msg"); // Use window.debugLog
    // Hide UI elements if auth is not ready
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
    if (postForm) postForm.style.display = 'none';
}


// --- Logout Button Listener ---
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            if (typeof window.auth === 'undefined') {
                console.error("Firebase Auth not initialized. Cannot logout.");
                window.debugLog("Logout error: Auth not ready.", "debug-msg"); // Use window.debugLog
                return;
            }
            await window.auth.signOut();
            window.debugLog("Logged out successfully!", "debug-msg"); // Use window.debugLog
            // No need to redirect here, onAuthStateChanged will handle UI update
        } catch (error) {
            console.error('Logout Error:', error);
            window.debugLog(`Logout failed: ${error.message}`, "debug-msg"); // Use window.debugLog
        }
    });
}

// --- Post Image Preview ---
if (postImageInput) {
    postImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (imagePreview) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block'; // Show preview
                }
            };
            reader.readAsDataURL(file);
        } else {
            if (imagePreview) {
                imagePreview.src = '';
                imagePreview.style.display = 'none'; // Hide preview if no file
            }
        }
    });
}


// --- Post Submission Handling ---
if (postForm) {
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const postText = postTextInput.value.trim();
        const postImageFile = postImageInput.files[0];
        const user = window.auth.currentUser;

        if (!user) {
            window.debugLog("Please log in to create a post.", "debug-msg"); // Use window.debugLog
            return;
        }

        if (!postText && !postImageFile) {
            window.debugLog("Please enter text or select an image for your post.", "debug-msg"); // Use window.debugLog
            return;
        }

        if (typeof window.db === 'undefined' || typeof window.storage === 'undefined') {
            console.error("Firebase Firestore or Storage not initialized. Check config.js.");
            window.debugLog("App initialization error. Cannot post.", "debug-msg"); // Use window.debugLog
            return;
        }

        postBtn.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        window.debugLog("Posting...", "debug-msg"); // Use window.debugLog

        let imageUrl = '';
        if (postImageFile) {
            try {
                const storageRef = window.storage.ref(`post_images/${user.uid}/${Date.now()}_${postImageFile.name}`);
                const snapshot = await storageRef.put(postImageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
                window.debugLog("Image uploaded successfully!", "debug-msg"); // Use window.debugLog
            } catch (error) {
                console.error('Error uploading image:', error);
                window.debugLog(`Image upload failed: ${error.message}`, "debug-msg"); // Use window.debugLog
                postBtn.disabled = false;
                loadingSpinner.style.display = 'none';
                return; // Stop if image upload fails
            }
        }

        try {
            await window.db.collection('posts').add({
                userId: user.uid,
                userName: user.displayName || user.email,
                userPhoto: user.photoURL || 'images/default-profile.png', // Use user's current photoURL
                text: postText,
                imageUrl: imageUrl,
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(), // Firestore server timestamp
                likes: 0,
                comments: 0,
                likedBy: [] // Array to store UIDs of users who liked the post
            });
            window.debugLog("Post created successfully!", "debug-msg"); // Use window.debugLog
            postTextInput.value = '';
            postImageInput.value = ''; // Clear file input
            if (imagePreview) {
                imagePreview.src = '';
                imagePreview.style.display = 'none'; // Hide preview
            }
        } catch (error) {
            console.error('Error adding post:', error);
            window.debugLog(`Post creation failed: ${error.message}`, "debug-msg"); // Use window.debugLog
        } finally {
            postBtn.disabled = false;
            loadingSpinner.style.display = 'none';
        }
    });
}


// --- Load Posts (Real-time Listener) ---
// This will listen for changes in the 'posts' collection and update the UI.
if (postsContainer && typeof window.db !== 'undefined') {
    window.db.collection('posts')
        .orderBy('timestamp', 'desc') // Order by latest posts
        .onSnapshot(snapshot => {
            postsContainer.innerHTML = ''; // Clear existing posts
            if (snapshot.empty) {
                postsContainer.innerHTML = '<p style="text-align: center; color: #666;">No posts yet. Be the first to post!</p>';
                window.debugLog("No posts to display.", "debug-msg"); // Use window.debugLog
                return;
            }
            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                if (typeof window.renderPost === 'function') {
                    window.renderPost(post, postsContainer);
                } else {
                    console.error("renderPost function not found. Posts cannot be rendered.");
                    window.debugLog("Render error: Missing renderPost function.", "debug-msg"); // Use window.debugLog
                }
            });
            window.debugLog("Posts loaded successfully!", "debug-msg"); // Use window.debugLog
        }, error => {
            console.error('Error getting posts:', error);
            window.debugLog(`Error loading posts: ${error.message}`, "debug-msg"); // Use window.debugLog
            postsContainer.innerHTML = '<p style="text-align: center; color: red;">Failed to load posts. Please check your internet connection and Firebase rules.</p>';
        });
} else {
    console.error("Posts container or Firebase Firestore not initialized. Cannot load posts.");
    window.debugLog("App initialization error. Posts cannot load.", "debug-msg"); // Use window.debugLog
}


// --- Like and Comment Functionality (Helper Functions) ---
// These functions are expected to be called by renderPost and need global exposure.

/**
 * Toggles a like on a post.
 */
async function toggleLike(postId, likeButtonElement) {
    const user = window.auth.currentUser;
    if (!user) {
        window.debugLog("Please log in to like posts.", "debug-msg"); // Use window.debugLog
        return;
    }
    if (typeof window.db === 'undefined') {
        console.error("Firestore not initialized. Cannot toggle like.");
        window.debugLog("Like error: DB not ready.", "debug-msg"); // Use window.debugLog
        return;
    }

    const postRef = window.db.collection('posts').doc(postId);
    try {
        await window.db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) {
                throw "Post does not exist!";
            }

            const postData = postDoc.data();
            let likes = postData.likes || 0;
            let likedBy = postData.likedBy || [];

            if (likedBy.includes(user.uid)) {
                // User already liked, so unlike
                likes--;
                likedBy = likedBy.filter(uid => uid !== user.uid);
                likeButtonElement.classList.remove('liked');
            } else {
                // User hasn't liked, so like
                likes++;
                likedBy.push(user.uid);
                likeButtonElement.classList.add('liked');
            }

            transaction.update(postRef, { likes: likes, likedBy: likedBy });
        });
        window.debugLog("Like toggled!", "debug-msg"); // Use window.debugLog
    } catch (error) {
        console.error("Error toggling like:", error);
        window.debugLog(`Like failed: ${error.message}`, "debug-msg"); // Use window.debugLog
    }
}
window.toggleLike = toggleLike; // Make it globally available

/**
 * Toggles the visibility of the comments section for a post.
 */
async function toggleCommentsSection(postId) {
    const commentsSection = document.getElementById(`comments-for-${postId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            await loadComments(postId, commentsSection); // Load comments when section is opened
        } else {
            commentsSection.style.display = 'none';
        }
    }
}
window.toggleCommentsSection = toggleCommentsSection; // Make it globally available

/**
 * Loads and displays comments for a given post.
 */
async function loadComments(postId, commentsSectionElement) {
    const user = window.auth.currentUser;
    if (!user) {
        // No need to load comments if not logged in
        return;
    }
    if (typeof window.db === 'undefined') {
        console.error("Firestore not initialized. Cannot load comments.");
        return;
    }

    let commentsContainer = commentsSectionElement.querySelector('.comments-list');
    if (!commentsContainer) {
        // Create a div to hold comments if it doesn't exist
        const newCommentsContainer = document.createElement('div');
        newCommentsContainer.classList.add('comments-list');
        commentsSectionElement.prepend(newCommentsContainer);
        commentsContainer = newCommentsContainer;
    }
    commentsContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading comments...</p>';

    try {
        window.db.collection('posts').doc(postId).collection('comments')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                commentsContainer.innerHTML = ''; // Clear previous comments
                if (snapshot.empty) {
                    commentsContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No comments yet.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const comment = doc.data();
                    const commentElement = document.createElement('div');
                    commentElement.classList.add('comment-item');
                    commentElement.innerHTML = `
                        <strong>${comment.userName || 'Anonymous'}:</strong> ${comment.text}
                        <span class="comment-timestamp">${comment.timestamp?.toDate ? new Date(comment.timestamp.toDate()).toLocaleString() : 'N/A'}</span>
                    `;
                    commentsContainer.appendChild(commentElement);
                });
            }, error => {
                console.error("Error loading comments:", error);
                commentsContainer.innerHTML = `<p style="color: red;">Error loading comments: ${error.message}</p>`;
            });
    } catch (error) {
        console.error("Error setting up comment listener:", error);
        commentsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}
window.loadComments = loadComments; // Make it globally available


/**
 * Adds a new comment to a post.
 */
async function addComment(postId, commentText) {
    const user = window.auth.currentUser;
    if (!user) {
        window.debugLog("Please log in to comment.", "debug-msg"); // Use window.debugLog
        return;
    }
    if (typeof window.db === 'undefined') {
        console.error("Firestore not initialized. Cannot add comment.");
        window.debugLog("Comment error: DB not ready.", "debug-msg"); // Use window.debugLog
        return;
    }

    try {
        await window.db.collection('posts').doc(postId).collection('comments').add({
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhoto: user.photoURL || 'images/default-profile.png',
            text: commentText,
            timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        window.debugLog("Comment added!", "debug-msg"); // Use window.debugLog
        // Update post's comment count
        const postRef = window.db.collection('posts').doc(postId);
        await postRef.update({
            comments: window.firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error("Error adding comment:", error);
        window.debugLog(`Comment failed: ${error.message}`, "debug-msg"); // Use window.debugLog
    }
}
window.addComment = addComment; // Make it globally available