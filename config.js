// config.js မှာ Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// index.html မှာ လိုအပ်တဲ့ JavaScript logic အတွက် script.js (သို့) config.js မှာ ထည့်နိုင်)
// DOM elements တွေ ရယူခြင်း
const authModal = document.getElementById('auth-modal');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userDisplay = document.getElementById('user-display');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const nameInputFieldContainer = document.getElementById('name-field-container');
const nameInput = document.getElementById('name-input');
const authSubmitBtn = document.getElementById('auth-submit');
const authTitle = document.getElementById('auth-title');
const authErrorMsg = document.getElementById('auth-error-msg');
const switchAuthLink = document.getElementById('switch-auth');
const postCreationSection = document.getElementById('post-creation');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const createPostBtn = document.getElementById('create-post-btn');
const postsContainer = document.getElementById('posts-container');
const myProfileLink = document.getElementById('my-profile-link');


let isSignUpMode = false; // Login or Sign Up mode

// Auth Modal ကို ဖွင့်/ပိတ် လုပ်ခြင်း
btnLogin.addEventListener('click', () => {
    authModal.style.display = 'flex';
    authTitle.textContent = 'Login';
    authSubmitBtn.textContent = 'Login';
    nameInputFieldContainer.style.display = 'none';
    switchAuthLink.textContent = "Don't have an account? Sign Up";
    isSignUpMode = false;
    authErrorMsg.textContent = ''; // Clear previous errors
    authForm.reset(); // Clear form fields
});

authModal.querySelector('.modal-close').addEventListener('click', () => {
    authModal.style.display = 'none';
});

// Modal အပြင်ဘက် နှိပ်ရင် ပိတ်ဖို့
window.addEventListener('click', (event) => {
    if (event.target === authModal) {
        authModal.style.display = 'none';
    }
});

// Login/Sign Up Form Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    const displayName = nameInput.value;
    authErrorMsg.textContent = '';

    try {
        if (isSignUpMode) {
            // Sign Up
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: displayName });
            // Save user data to Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                displayName: displayName,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('User signed up and profile updated:', userCredential.user);
        } else {
            // Login
            await auth.signInWithEmailAndPassword(email, password);
            console.log('User logged in');
        }
        authModal.style.display = 'none'; // Close modal on success
    } catch (error) {
        console.error('Authentication error:', error.message);
        authErrorMsg.textContent = error.message;
    }
});

// Login / Sign Up Mode ပြောင်းလဲခြင်း
switchAuthLink.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
        authTitle.textContent = 'Sign Up';
        authSubmitBtn.textContent = 'Sign Up';
        nameInputFieldContainer.style.display = 'block';
        switchAuthLink.textContent = "Already have an account? Login";
    } else {
        authTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        nameInputFieldContainer.style.display = 'none';
        switchAuthLink.textContent = "Don't have an account? Sign Up";
    }
    authErrorMsg.textContent = ''; // Clear errors when switching
    authForm.reset(); // Clear form fields
});

// User State Changed (Login/Logout ဖြစ်တိုင်း)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is logged in
        userDisplay.textContent = `Hello, ${user.displayName || user.email}!`;
        btnLogin.style.display = 'none';
        btnLogout.style.display = 'inline-block';
        postCreationSection.style.display = 'block'; // Show post creation
        myProfileLink.href = `profile.html?userId=${user.uid}`; // Set profile link dynamically
        loadPosts(); // Load posts when user logs in

    } else {
        // User is logged out
        userDisplay.textContent = '';
        btnLogin.style.display = 'inline-block';
        btnLogout.style.display = 'none';
        postCreationSection.style.display = 'none'; // Hide post creation
        myProfileLink.href = 'profile.html'; // Reset profile link
        postsContainer.innerHTML = ''; // Clear posts when logged out
    }
});

// Logout
btnLogout.addEventListener('click', async () => {
    try {
        await auth.signOut();
        console.log('User logged out');
    } catch (error) {
        console.error('Logout error:', error.message);
    }
});

// Post Creation
createPostBtn.addEventListener('click', async () => {
    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert('Please log in to create a post.');
        return;
    }

    if (title && content) {
        try {
            await db.collection('posts').add({
                title: title,
                content: content,
                authorId: currentUser.uid,
                authorName: currentUser.displayName || currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                comments: []
            });
            postTitleInput.value = '';
            postContentInput.value = '';
            console.log('Post created successfully!');
            // Posts will automatically reload due to snapshot listener
        } catch (error) {
            console.error('Error creating post:', error.message);
            alert('Error creating post: ' + error.message);
        }
    } else {
        alert('Please enter both title and content for your post.');
    }
});

// Load and display posts from Firestore
function loadPosts() {
    // Real-time listener for posts
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
        postsContainer.innerHTML = ''; // Clear existing posts
        snapshot.forEach((doc) => {
            const post = doc.data();
            const postId = doc.id;
            const postElement = document.createElement('div');
            postElement.classList.add('post-card');
            postElement.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <small>By: ${post.authorName} on ${post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : 'N/A'}</small>
                <div class="post-actions">
                    <button class="like-btn" data-post-id="${postId}">Like (${post.likes || 0})</button>
                    <button class="comment-btn" data-post-id="${postId}">Comment</button>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });
        // Add event listeners for new like buttons
        document.querySelectorAll('.like-btn').forEach(button => {
            button.removeEventListener('click', handleLikeClick); // Avoid duplicate listeners
            button.addEventListener('click', handleLikeClick);
        });
    }, (error) => {
        console.error('Error loading posts:', error);
    });
}

async function handleLikeClick(event) {
    const postId = event.target.dataset.postId;
    const postRef = db.collection('posts').doc(postId);

    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) {
                throw "Document does not exist!";
            }
            const newLikes = (postDoc.data().likes || 0) + 1;
            transaction.update(postRef, { likes: newLikes });
        });
        console.log("Like updated successfully!");
    } catch (e) {
        console.error("Error liking post: ", e);
    }
}


// Debugging message display (optional)
function showDebugMessage(msg, type = 'info') {
    const debugMsg = document.getElementById('debug-msg');
    debugMsg.textContent = msg;
    debugMsg.className = `debug-msg ${type}`;
    debugMsg.style.display = 'block';
    setTimeout(() => {
        debugMsg.style.display = 'none';
    }, 5000);
}

// Initial load for authentication state
auth.onAuthStateChanged(user => {
    if (user) {
        loadPosts(); // Load posts if user is already logged in on page load
    }
});
