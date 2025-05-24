// js/config.js

// Firebase SDKs များကို compat version များဖြင့် အသုံးပြုနေပါက
// ဤကဲ့သို့ global scope တွင် ဝန်ဆောင်မှုများကို ထုတ်ဖော်ရန် လိုအပ်ပါသည်။

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // Auth service ကို import လုပ်ပါ
import { getFirestore } from "firebase/firestore"; // Firestore service ကို import လုပ်ပါ
import { getStorage } from "firebase/storage"; // Storage service ကို import လုပ်ပါ


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDWaUMeurndWJXtWV5T5VR_psJrhPT3j1w",
    authDomain: "pagebook-d8147.firebaseapp.com",
    projectId: "pagebook-d8147",
    storageBucket: "pagebook-d8147.firebasestorage.app",
    messagingSenderId: "552581115998",
    appId: "1:552581115998:web:cb8f6b63516b2c824d44cf",
    measurementId: "G-1SCBH9NN00"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Firebase Services များကို Initialize လုပ်ပြီး Global အဖြစ် ထုတ်ဖော်ပါ
// ၎င်းတို့သည် app.js, auth.js နှင့် အခြားသော script များမှ အသုံးပြုမည်ဖြစ်သည်။
const auth = getAuth(app); // Auth ဝန်ဆောင်မှုကို initialize လုပ်ပါ
const db = getFirestore(app); // Firestore ဝန်ဆောင်မှုကို initialize လုပ်ပါ
const storage = getStorage(app); // Storage ဝန်ဆောင်မှုကို initialize လုပ်ပါ

// Global variables အဖြစ် window object တွင် ထည့်သွင်းပါ
// ၎င်းတို့သည် compat library များ အသုံးပြုသည့်အခါ အခြား script များမှ တိုက်ရိုက် access လုပ်နိုင်ရန်ဖြစ်သည်။
window.auth = auth;
window.db = db;
window.storage = storage;

// Global Helper Functions for rendering posts and debug messages
// These functions are expected to be available globally by app.js
/**
 * Renders a single post into the specified container element.
 */
function renderPost(post, containerElement) {
    const postElement = document.createElement('div');
    postElement.classList.add('post-item');
    postElement.setAttribute('data-id', post.id); // For like/comment handling

    const userPhoto = post.userPhoto || 'images/default-profile.png';
    const userName = post.userName || 'Unknown User';
    const postText = post.text ? `<p>${post.text}</p>` : '';
    const postImage = post.imageUrl ? `<img src="${post.imageUrl}" alt="Post Image" class="post-image">` : '';
    // Use optional chaining for timestamp in case it's missing or not a Firestore Timestamp
    const timestamp = post.timestamp?.toDate ? new Date(post.timestamp.toDate()).toLocaleString() : 'N/A';

    // Check if the current user liked this post (requires auth to be globally available)
    const currentUser = window.auth.currentUser; // Use window.auth to ensure it's globally accessed
    const isLiked = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
    const likeButtonClass = isLiked ? 'liked' : '';

    postElement.innerHTML = `
        <div class="post-header">
            <img src="${userPhoto}" alt="User Photo" class="post-user-photo">
            <span class="post-user-name">${userName}</span>
            <span class="post-timestamp">${timestamp}</span>
        </div>
        <div class="post-content">
            ${postText}
            ${postImage}
        </div>
        <div class="post-actions">
            <button class="like-btn ${likeButtonClass}" data-post-id="${post.id}">
                <i class="fa-solid fa-heart"></i> <span class="like-count">${post.likes || 0}</span> Likes
            </button>
            <button class="comment-btn" data-post-id="${post.id}">
                <i class="fa-solid fa-comment"></i> <span class="comment-count">${post.comments || 0}</span> Comments
            </button>
        </div>
        <div class="comments-section" id="comments-for-${post.id}" style="display:none;">
            <form class="add-comment-form" data-post-id="${post.id}">
                <input type="text" placeholder="Add a comment..." class="comment-input">
                <button type="submit">Post Comment</button>
            </form>
        </div>
    `;
    containerElement.appendChild(postElement);

    // Event Listeners (assuming toggleLike, toggleCommentsSection, addComment are defined in app.js)
    const likeBtn = postElement.querySelector(`.like-btn[data-post-id="${post.id}"]`);
    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (typeof window.toggleLike === 'function') { // Check if window.toggleLike exists
                window.toggleLike(post.id, likeBtn);
            } else {
                console.warn('toggleLike function not found. Likes may not work.');
            }
        });
    }

    const commentBtn = postElement.querySelector(`.comment-btn[data-post-id="${post.id}"]`);
    if (commentBtn) {
        commentBtn.addEventListener('click', () => {
            if (typeof window.toggleCommentsSection === 'function') { // Check if window.toggleCommentsSection exists
                window.toggleCommentsSection(post.id);
            } else {
                console.warn('toggleCommentsSection function not found. Comments section toggle may not work.');
            }
        });
    }

    const addCommentForm = postElement.querySelector(`.add-comment-form[data-post-id="${post.id}"]`);
    if (addCommentForm) {
        addCommentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const commentInput = addCommentForm.querySelector('.comment-input');
            const commentText = commentInput.value.trim();
            if (commentText) {
                if (typeof window.addComment === 'function') { // Check if window.addComment exists
                    window.addComment(post.id, commentText);
                    commentInput.value = '';
                } else {
                    console.warn('addComment function not found. Comments may not be added.');
                }
            }
        });
    }
}
window.renderPost = renderPost; // renderPost ကို Global အဖြစ် ထုတ်ဖော်ပါ


/**
 * Displays a debug message on the specified element.
 */
function debugLog(message, elementId = 'debug-msg') {
    const debugElement = document.getElementById(elementId);
    if (debugElement) {
        debugElement.textContent = message;
        debugElement.style.display = 'block';
        setTimeout(() => {
            debugElement.style.display = 'none';
            debugElement.textContent = '';
        }, 5000); // 5 စက္ကန့်အကြာတွင် ဖျောက်ပါ
    } else {
        console.log(`Debug: ${message}`);
    }
}
window.debugLog = debugLog; // debugLog ကို Global အဖြစ် ထုတ်ဖော်ပါ