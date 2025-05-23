// config.js
// This file holds your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDWaUMeurndWJXtWV5T5VR_psJrhPT3j1w",
  authDomain: "pagebook-d8147.firebaseapp.com",
  projectId: "pagebook-d8147",
  storageBucket: "pagebook-d8147.firebasestorage.app",
  messagingSenderId: "552581115998",
  appId: "1:552581115998:web:d7efe9e8502eca064d44cf",
  measurementId: "G-6CHHSFTD3P"
};

// Initialize Firebase once and export the instances
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initialization failed:", e);
  // alert("Firebase initialization failed: " + e.message + ". Check your Firebase config and internet connection.");
}

const auth = firebase.auth();
const db = firebase.firestore();

// Helper function for logging to a specific debug element
function debugLog(message, elementId) {
    console.log(message);
    const debugEl = document.getElementById(elementId || 'debug-msg');
    if (debugEl) {
        debugEl.textContent = message;
        debugEl.style.display = 'block'; // Ensure it's visible
        // Auto-hide after some time for less clutter
        setTimeout(() => {
            debugEl.style.display = 'none';
        }, 5000);
    }
}

// Function to render a single post (reusable for index.js and profile.js)
function renderPost(post, containerElement, authInstance, dbInstance) {
    const currentUser = authInstance.currentUser;
    const liked = currentUser ? (post.likedBy && post.likedBy.includes(currentUser.uid)) : false;

    const postEl = document.createElement('article');
    postEl.className = 'post';
    postEl.id = `post-${post.id}`; // Add ID for easier linking/scrolling

    const headerEl = document.createElement('div');
    headerEl.className = 'post-header';
    const authorImg = document.createElement('img');
    authorImg.src = post.userPhoto || 'https://i.pravatar.cc/48?u=' + (post.uid || post.userName);
    authorImg.alt = post.userName + ' profile photo';
    const authorName = document.createElement('div');
    authorName.className = 'username';
    authorName.textContent = post.userName || 'Anonymous';
    authorName.onclick = () => {
        window.location.href = `profile.html?uid=${post.uid}`;
    };
    headerEl.appendChild(authorImg);
    headerEl.appendChild(authorName);

    const contentEl = document.createElement('div');
    contentEl.className = 'post-content';
    // Display only first ~150 characters for Postlist titles
    const displayLength = 150;
    const isFullPost = containerElement.id !== 'titles-container'; // Check if it's the main posts section or postlist
    contentEl.textContent = isFullPost ? post.text : post.text.substring(0, displayLength) + (post.text.length > displayLength ? '...' : '');

    const actionsEl = document.createElement('div');
    actionsEl.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.innerHTML = (liked ? '❤️ Like ' : '🤍 Like ');
    const likeCount = document.createElement('span');
    likeCount.className = 'like-count';
    likeCount.textContent = post.likes || 0;

    likeBtn.appendChild(likeCount);

    likeBtn.addEventListener('click', async () => {
        if(!currentUser){
            alert('Please login to like posts.');
            debugLog('Attempted like without login.', 'debug-msg'); // Use global debug-msg for this context
            return;
        }
        const postRef = dbInstance.collection('posts').doc(post.id);
        try {
            const doc = await postRef.get();
            if(!doc.exists) {
                debugLog('Post does not exist to like.', 'debug-msg');
                return;
            }
            const currentData = doc.data();
            let updatedLikes = currentData.likes || 0;
            let updatedLikedBy = currentData.likedBy || [];

            if(updatedLikedBy.includes(currentUser.uid)){
                updatedLikes -= 1;
                updatedLikedBy = updatedLikedBy.filter(uid => uid !== currentUser.uid);
            } else {
                updatedLikes += 1;
                updatedLikedBy.push(currentUser.uid);
            }

            await postRef.update({
                likes: updatedLikes,
                likedBy: updatedLikedBy
            });
        } catch (e) {
            alert('Failed to update like: ' + e.message);
            debugLog('Like update error: ' + e.message, 'debug-msg');
            console.error(e);
        }
    });

    actionsEl.appendChild(likeBtn);

    postEl.appendChild(headerEl);
    postEl.appendChild(contentEl);
    postEl.appendChild(actionsEl);

    containerElement.appendChild(postEl);
}