// config.js
// This file holds your Firebase configuration and global utility functions

const firebaseConfig = {
    apiKey: "AIzaSyDWaUMeurndWJXtWV5T5VR_psJrhPT3j1w",
    authDomain: "pagebook-d8147.firebaseapp.com",
    projectId: "pagebook-d8147",
    storageBucket: "pagebook-d8147.firebasestorage.app",
    messagingSenderId: "552581115998",
    appId: "1:552581115998:web:d7efe9e8502eca064d44cf",
    measurementId: "G-6CHHSFTD3P"
};

// Initialize Firebase once and make instances globally available
// Ensure firebase is loaded via CDN script in HTML BEFORE this script
try {
    // Check if Firebase is already initialized to prevent multiple initializations
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
    // Consider adding a more visible error to the user if critical
    // alert("Firebase initialization failed: " + e.message + ". Check your Firebase config and internet connection.");
}

// Get Firebase service instances
const auth = firebase.auth();
const db = firebase.firestore();
// If you use storage, you would also initialize it here:
// const storage = firebase.storage();

// Helper function for logging to a specific debug element
function debugLog(message, elementId) {
    console.log(message);
    // Ensure DOM is loaded before trying to access elements
    document.addEventListener('DOMContentLoaded', () => {
        const debugEl = document.getElementById(elementId || 'debug-msg');
        if (debugEl) {
            debugEl.textContent = message;
            debugEl.style.display = 'block'; // Ensure it's visible
            // Auto-hide after some time for less clutter
            setTimeout(() => {
                debugEl.style.display = 'none';
            }, 5000);
        }
    }, { once: true }); // Use { once: true } to only run this listener once
}

// Function to render a single post (reusable for index.js and profile.js)
function renderPost(post, containerElement, authInstance, dbInstance) {
    if (!post || !containerElement || !authInstance || !dbInstance) {
        console.error("renderPost: Missing required arguments.", { post, containerElement, authInstance, dbInstance });
        debugLog("Error: renderPost called with missing data.", "debug-msg");
        return;
    }

    const currentUser = authInstance.currentUser; // Get current user from the provided auth instance
    // Determine if the current user has liked the post
    const liked = currentUser ? (post.likedBy && post.likedBy.includes(currentUser.uid)) : false;

    const postEl = document.createElement('article');
    postEl.className = 'post';
    postEl.id = `post-${post.id}`; // Add ID for easier linking/scrolling

    const headerEl = document.createElement('div');
    headerEl.className = 'post-header';

    const authorImg = document.createElement('img');
    authorImg.src = post.userPhoto || `https://i.pravatar.cc/48?u=${post.uid || post.userName}`; // Default avatar
    authorImg.alt = (post.userName || 'Anonymous') + ' profile photo';

    const authorName = document.createElement('div');
    authorName.className = 'username';
    authorName.textContent = post.userName || 'Anonymous';
    authorName.style.cursor = 'pointer'; // Indicate it's clickable
    authorName.onclick = () => {
        window.location.href = `profile.html?uid=${post.uid}`;
    };
    headerEl.appendChild(authorImg);
    headerEl.appendChild(authorName);

    const contentEl = document.createElement('div');
    contentEl.className = 'post-content';
    // Display only first ~150 characters for Postlist titles
    const displayLength = 150;
    // Check if it's the main posts section or postlist. This check assumes containerElement.id.
    const isFullPost = containerElement.id !== 'titles-container';
    contentEl.textContent = isFullPost ? post.text : post.text.substring(0, displayLength) + (post.text.length > displayLength ? '...' : '');

    const actionsEl = document.createElement('div');
    actionsEl.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn'; // Add a class for styling
    likeBtn.innerHTML = (liked ? '❤️ ' : '🤍 ') + '<span class="like-count">' + (post.likes || 0) + '</span> Likes'; // Combine text and count

    likeBtn.addEventListener('click', async () => {
        if (!currentUser) {
            alert('Please login to like posts.');
            debugLog('Attempted like without login.', 'debug-msg'); // Use global debug-msg
            return;
        }

        const postRef = dbInstance.collection('posts').doc(post.id);
        try {
            const doc = await postRef.get();
            if (!doc.exists) {
                debugLog('Post does not exist to like or unlike.', 'debug-msg');
                return;
            }
            const currentData = doc.data();
            let updatedLikes = currentData.likes || 0;
            let updatedLikedBy = currentData.likedBy || [];

            if (updatedLikedBy.includes(currentUser.uid)) {
                // User already liked, so unlike
                updatedLikes = Math.max(0, updatedLikes - 1); // Ensure likes don't go below zero
                updatedLikedBy = updatedLikedBy.filter(uid => uid !== currentUser.uid);
            } else {
                // User hasn't liked, so like
                updatedLikes += 1;
                updatedLikedBy.push(currentUser.uid);
            }

            await postRef.update({
                likes: updatedLikes,
                likedBy: updatedLikedBy
            });
            debugLog('Like status updated successfully!', 'debug-msg');
        } catch (e) {
            alert('Failed to update like: ' + e.message);
            debugLog('Like update error: ' + e.message, 'debug-msg');
            console.error('Error updating like status:', e);
        }
    });

    actionsEl.appendChild(likeBtn);

    // --- Start: Add Edit and Delete Buttons ---
    if (currentUser && currentUser.uid === post.uid) { // Only show for the post owner
        const ownerActionsEl = document.createElement('div');
        ownerActionsEl.className = 'post-owner-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', async () => {
            const newText = prompt('Edit your post:', post.text);
            if (newText !== null && newText.trim() !== post.text.trim()) {
                try {
                    await dbInstance.collection('posts').doc(post.id).update({
                        text: newText.trim(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp() // Add an update timestamp
                    });
                    debugLog('Post updated successfully!', 'debug-msg');
                    // Optionally, update the displayed post text immediately without full re-render
                    contentEl.textContent = newText.trim();
                } catch (error) {
                    alert('Error updating post: ' + error.message);
                    debugLog('Post update error: ' + error.message, 'debug-msg');
                    console.error('Error updating post:', error);
                }
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this post?')) {
                try {
                    await dbInstance.collection('posts').doc(post.id).delete();
                    debugLog('Post deleted successfully!', 'debug-msg');
                    postEl.remove(); // Remove the post element from the DOM
                } catch (error) {
                    alert('Error deleting post: ' + error.message);
                    debugLog('Post delete error: ' + error.message, 'debug-msg');
                    console.error('Error deleting post:', error);
                }
            }
        });

        ownerActionsEl.appendChild(editBtn);
        ownerActionsEl.appendChild(deleteBtn);
        postEl.appendChild(ownerActionsEl); // Add owner actions to the post element
    }
    // --- End: Add Edit and Delete Buttons ---

    postEl.appendChild(headerEl);
    postEl.appendChild(contentEl);
    postEl.appendChild(actionsEl);

    // Append to container (consider prepending for new posts in a feed)
    containerElement.appendChild(postEl);
}